// Wachtwoord-beveiligd: beheert de aanmeldlijsten van een samenkomst.
// - "remove":  haalt iemand weg. Had diegene een bevestigde plek en is er plek, dan
//              schuift de eerste van de wachtlijst automatisch door en krijgt een mail.
// - "promote": geeft iemand van de wachtlijst een plek (mag de capaciteit
//              overschrijden, bewuste keuze van de beheerder) en mailt diegene.
// Schrijft de bijgewerkte lijsten terug naar Blobs.

import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { getStore } from "@netlify/blobs";
import { isProductie, storeNaam } from "./lib/omgeving.mjs";
import { AFZENDER, ANTWOORD_ADRES } from "./lib/mail.mjs";
import { afmeldMail, plekVrijMail } from "./lib/mails.mjs";
import { icsBijlage } from "./lib/agenda.mjs";
import samenkomsten from "./data/samenkomsten.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function mailPersoon({ persoon, event, prefix, soort }) {
  const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return "geen RESEND_API_KEY";
  const lang = persoon.lang || "nl";
  const maakMail = soort === "afmelding" ? afmeldMail : plekVrijMail;
  const mail = maakMail({ naam: persoon.name, eten: !!persoon.eten, event, lang });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: AFZENDER,
      to: [persoon.email],
      reply_to: ANTWOORD_ADRES,
      subject: prefix + mail.onderwerp,
      html: mail.html,
      text: mail.text,
      ...(soort === "afmelding" ? {} : { attachments: [icsBijlage(event, lang)] }),
    }),
  });
  if (!res.ok) {
    const fout = await res.text();
    console.error(`Resend API error (${soort}):`, fout);
    return `fout ${res.status}`;
  }
  return "verstuurd";
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const { password, eventId, email, action, doorschuiven = true, afmeldmail = false } = await req.json();

    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
    if (!EDITOR_PASSWORD) {
      return json({ ok: false, error: "Beheerscherm is nog niet geconfigureerd (EDITOR_PASSWORD ontbreekt)." }, 500);
    }
    if (!wachtwoordKlopt(password, EDITOR_PASSWORD)) return json({ ok: false, error: "Onjuist wachtwoord." }, 401);

    if (!eventId || !email || !["remove", "promote"].includes(action)) {
      return json({ ok: false, error: "Ongeldige aanvraag." }, 400);
    }

    const event = samenkomsten.find((e) => e.id === eventId);
    if (!event) return json({ ok: false, error: "Onbekende samenkomst." }, 404);

    const store = getStore(storeNaam(context));
    const confirmedKey = `${event.id}::confirmed`;
    const waitlistKey = `${event.id}::wachtlijst`;
    const prefix = isProductie(context) ? "" : "[TEST] ";

    let [confirmed, wachtlijst] = await Promise.all([
      store.get(confirmedKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
      store.get(waitlistKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
    ]);

    let doorgeschoven = null;
    let mail = null;
    let afgemeld = null;
    let afmeldStatus = null;

    if (action === "remove") {
      afgemeld = confirmed.find((e) => e.email === email) || wachtlijst.find((e) => e.email === email) || null;
      const hadPlek = confirmed.some((e) => e.email === email);
      confirmed = confirmed.filter((e) => e.email !== email);
      wachtlijst = wachtlijst.filter((e) => e.email !== email);

      if (hadPlek && doorschuiven && wachtlijst.length && confirmed.length < event.capaciteit) {
        doorgeschoven = wachtlijst[0];
        wachtlijst = wachtlijst.slice(1);
        confirmed = [...confirmed, doorgeschoven];
      }
    } else {
      const persoon = wachtlijst.find((e) => e.email === email);
      if (!persoon) return json({ ok: false, error: "Deze persoon staat niet op de wachtlijst." }, 404);
      wachtlijst = wachtlijst.filter((e) => e.email !== email);
      confirmed = [...confirmed, persoon];
      doorgeschoven = persoon;
    }

    await Promise.all([store.setJSON(confirmedKey, confirmed), store.setJSON(waitlistKey, wachtlijst)]);

    if (doorgeschoven) mail = await mailPersoon({ persoon: doorgeschoven, event, prefix, soort: "plek" });
    if (afgemeld && afmeldmail) afmeldStatus = await mailPersoon({ persoon: afgemeld, event, prefix, soort: "afmelding" });

    return json({
      ok: true,
      confirmed,
      wachtlijst,
      doorgeschoven: doorgeschoven ? { name: doorgeschoven.name, email: doorgeschoven.email } : null,
      mail,
      afmeldmail: afmeldStatus,
    });
  } catch (error) {
    console.error("Error in update-aanmelding:", error);
    return json({ ok: false, error: "Interne fout." }, 500);
  }
};
