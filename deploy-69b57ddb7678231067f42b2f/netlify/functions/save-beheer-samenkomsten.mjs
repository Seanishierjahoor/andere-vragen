// Slaat wijzigingen uit het beheerscherm (/beheer-samenkomsten.html) op: schrijft
// data/samenkomsten.mjs en data/instellingen.mjs opnieuw weg als commit naar GitHub.
// Zelfde mechanisme als de bewerk-modus (save-edit.mjs): EDITOR_PASSWORD + GITHUB_TOKEN.
//
// Na het opslaan bouwt Netlify een nieuwe deploy, die automatisch live gaat.

import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";

const OWNER = "Seanishierjahoor";
const REPO = "andere-vragen";
const BRANCH = "main";
const SAMENKOMSTEN_PATH = "deploy-69b57ddb7678231067f42b2f/netlify/functions/data/samenkomsten.mjs";
const INSTELLINGEN_PATH = "deploy-69b57ddb7678231067f42b2f/netlify/functions/data/instellingen.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { password, samenkomsten, instellingen } = await req.json();

    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
    const GITHUB_TOKEN = Netlify.env.get("GITHUB_TOKEN");

    if (!EDITOR_PASSWORD || !GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "Beheerscherm is nog niet geconfigureerd (environment variables ontbreken)." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!wachtwoordKlopt(password, EDITOR_PASSWORD)) {
      return new Response(JSON.stringify({ ok: false, error: "Onjuist wachtwoord." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validationError = validate(samenkomsten, instellingen);
    if (validationError) {
      return new Response(JSON.stringify({ ok: false, error: validationError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "andere-vragen-beheer",
      Accept: "application/vnd.github+json",
    };

    await commitFile({
      headers,
      path: SAMENKOMSTEN_PATH,
      content: serializeSamenkomsten(samenkomsten),
      message: "Beheerscherm: update samenkomsten",
    });
    await commitFile({
      headers,
      path: INSTELLINGEN_PATH,
      content: serializeInstellingen(instellingen),
      message: "Beheerscherm: update instellingen",
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in save-beheer-samenkomsten:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message || "Interne fout." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

function validate(samenkomsten, instellingen) {
  if (!Array.isArray(samenkomsten)) return "Ongeldige samenkomsten-lijst.";
  const ids = new Set();
  for (const event of samenkomsten) {
    if (!event || typeof event !== "object") return "Ongeldig samenkomst-object.";
    if (typeof event.id !== "string" || !event.id.trim()) return "Elke samenkomst heeft een id nodig.";
    if (ids.has(event.id)) return `Dubbel id: ${event.id}.`;
    ids.add(event.id);
    if (typeof event.start !== "string" || isNaN(new Date(event.start).getTime())) {
      return `Ongeldige datum/tijd bij ${event.id}.`;
    }
    if (typeof event.duurMinuten !== "number" || event.duurMinuten <= 0) {
      return `Ongeldige duur bij ${event.id}.`;
    }
    if (typeof event.locatie !== "string" || !event.locatie.trim()) {
      return `Locatie ontbreekt bij ${event.id}.`;
    }
    if (event.thema != null && (typeof event.thema !== "string" || event.thema.length > 120)) {
      return `Thema bij ${event.id} is te lang (max. 120 tekens).`;
    }
    if (typeof event.capaciteit !== "number" || event.capaciteit <= 0 || !Number.isInteger(event.capaciteit)) {
      return `Ongeldige capaciteit bij ${event.id}.`;
    }
  }
  if (!instellingen || typeof instellingen.eenPerKeer !== "boolean") {
    return "Ongeldige instellingen.";
  }
  return null;
}

function serializeSamenkomsten(samenkomsten) {
  const header = `// Lijst van komende "Filosofische gesprekken"-samenkomsten.
// Beheren via /beheer-samenkomsten.html (wachtwoord vereist) — dat schrijft dit
// bestand automatisch weg. Handmatig bewerken kan ook: kopieer een object en pas
// de velden aan.
//
// - id: uniek, wijzig dit niet voor een bestaande samenkomst (koppelt aanmeldingen)
// - start: ISO-datumtijd MET UTC-offset (+02:00 zomertijd / +01:00 wintertijd)
// - duurMinuten: gebruikt voor de agenda-uitnodiging (ics/Google Calendar)
// - locatie: vrije tekst
// - thema: vrije tekst, mag leeg zijn (dan toont de site "wordt nog aangekondigd")
// - capaciteit: aantal plekken; wordt nooit als getal getoond, alleen gebruikt om
//   "open"/"vol" te bepalen

`;
  // Alleen de planningsvelden serialiseren — confirmed/wachtlijst (indien meegestuurd
  // door een client die ze ook toont) leven in Blobs, niet in dit bronbestand.
  const planning = samenkomsten.map(({ id, start, duurMinuten, locatie, thema, capaciteit }) => ({
    id,
    start,
    duurMinuten,
    locatie,
    thema: (thema || "").trim(),
    capaciteit,
  }));
  return header + "export default " + JSON.stringify(planning, null, 2) + ";\n";
}

function serializeInstellingen(instellingen) {
  const header = `// Instellingen voor de aanmelding bij samenkomsten.
// Beheren via /beheer-samenkomsten.html (wachtwoord vereist).

`;
  return header + "export default " + JSON.stringify(instellingen, null, 2) + ";\n";
}

async function commitFile({ headers, path, content, message }) {
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

  const currentRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers });
  if (!currentRes.ok) {
    throw new Error(`Bestand niet gevonden op GitHub: ${path} (${currentRes.status}).`);
  }
  const current = await currentRes.json();

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha: current.sha,
      branch: BRANCH,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    console.error("GitHub API error:", err);
    throw new Error(`GitHub weigerde de commit voor ${path}.`);
  }
}
