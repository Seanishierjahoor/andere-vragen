// Slaat wijzigingen uit het beheerscherm (/beheer-samenkomsten.html) op: schrijft
// data/samenkomsten.mjs en data/instellingen.mjs opnieuw weg als commit naar GitHub.
// Zelfde mechanisme als de bewerk-modus (save-edit.mjs): EDITOR_PASSWORD + GITHUB_TOKEN.
//
// Na het opslaan bouwt Netlify een nieuwe deploy, die automatisch live gaat.

import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { gitBranch } from "./lib/omgeving.mjs";

const OWNER = "Seanishierjahoor";
const REPO = "andere-vragen";
const SAMENKOMSTEN_PATH = "deploy-69b57ddb7678231067f42b2f/netlify/functions/data/samenkomsten.mjs";
const INSTELLINGEN_PATH = "deploy-69b57ddb7678231067f42b2f/netlify/functions/data/instellingen.mjs";

export default async (req, context) => {
  const BRANCH = gitBranch(context);
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

    // Beide bestanden in één commit, en alleen als er echt iets veranderd is: elke
    // commit start een Netlify-build, en builds kosten credits.
    const resultaat = await commitAlsGewijzigd({
      headers,
      branch: BRANCH,
      message: "Beheerscherm: update samenkomsten",
      bestanden: [
        { path: SAMENKOMSTEN_PATH, content: serializeSamenkomsten(samenkomsten) },
        { path: INSTELLINGEN_PATH, content: serializeInstellingen(instellingen) },
      ],
    });

    return new Response(JSON.stringify({ ok: true, ongewijzigd: resultaat.ongewijzigd }), { status: 200, headers: { "Content-Type": "application/json" } });
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
    if (event.adres != null && (typeof event.adres !== "string" || event.adres.length > 200)) {
      return `Adres bij ${event.id} is te lang (max. 200 tekens).`;
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
// - adres: straat, postcode en plaats; wordt een klikbare kaartlink op site en in mails
// - thema: vrije tekst, mag leeg zijn (dan toont de site "wordt nog aangekondigd")
// - capaciteit: aantal plekken; wordt nooit als getal getoond, alleen gebruikt om
//   "open"/"vol" te bepalen

`;
  // Alleen de planningsvelden serialiseren — confirmed/wachtlijst (indien meegestuurd
  // door een client die ze ook toont) leven in Blobs, niet in dit bronbestand.
  const planning = samenkomsten.map(({ id, start, duurMinuten, locatie, adres, thema, capaciteit }) => ({
    id,
    start,
    duurMinuten,
    locatie,
    adres: (adres || "").trim(),
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

async function gh(headers, url, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${url}`, { headers, ...options });
  if (!res.ok) {
    const fout = await res.text();
    console.error("GitHub API error:", url, res.status, fout);
    throw new Error(`GitHub weigerde de opdracht (${res.status}).`);
  }
  return res.json();
}

async function commitAlsGewijzigd({ headers, branch, message, bestanden }) {
  // Huidige inhoud ophalen en vergelijken
  const gewijzigd = [];
  for (const bestand of bestanden) {
    const huidig = await gh(headers, `/contents/${bestand.path}?ref=${branch}`);
    const oud = Buffer.from(huidig.content, "base64").toString("utf-8");
    if (oud !== bestand.content) gewijzigd.push(bestand);
  }
  if (!gewijzigd.length) return { ongewijzigd: true };

  // Eén commit met alle gewijzigde bestanden (Git Data API)
  const ref = await gh(headers, `/git/ref/heads/${branch}`);
  const parent = await gh(headers, `/git/commits/${ref.object.sha}`);
  const tree = await gh(headers, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: gewijzigd.map((b) => ({ path: b.path, mode: "100644", type: "blob", content: b.content })),
    }),
  });
  const commit = await gh(headers, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
  });
  await gh(headers, `/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
  return { ongewijzigd: false };
}
