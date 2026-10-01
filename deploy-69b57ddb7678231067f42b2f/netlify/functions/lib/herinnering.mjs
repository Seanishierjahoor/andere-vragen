// Herinneringsmail de dag voor een samenkomst. Iedereen met een bevestigde plek krijgt
// er precies één: wie al een herinnering kreeg, wordt bijgehouden in Blobs
// (`<id>::herinnerd`), zodat een tweede run niemand dubbel mailt.

import samenkomsten from "../data/samenkomsten.mjs";
import { herinneringsMail } from "./mails.mjs";
import { AFZENDER, ANTWOORD_ADRES } from "./mail.mjs";

const TZ = "Europe/Amsterdam";

// YYYY-MM-DD in Nederlandse tijd
function datumNL(date) {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function uurNL(date = new Date()) {
  return Number(date.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
}

export function samenkomstenVanMorgen(nu = new Date()) {
  const morgen = datumNL(new Date(nu.getTime() + 24 * 60 * 60 * 1000));
  return samenkomsten.filter((e) => datumNL(new Date(e.start)) === morgen);
}

async function stuur({ RESEND_API_KEY, naar, mail, prefix }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: AFZENDER,
      to: [naar],
      reply_to: ANTWOORD_ADRES,
      subject: prefix + mail.onderwerp,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Verstuurt de herinneringen voor de opgegeven samenkomsten. Geeft per samenkomst
// terug wie een mail kreeg, wie al eerder gemaild was en wat er misging.
export async function verstuurHerinneringen({ store, RESEND_API_KEY, events, prefix = "" }) {
  const resultaat = [];
  for (const event of events) {
    const herinnerdKey = `${event.id}::herinnerd`;
    const [bevestigd, herinnerd] = await Promise.all([
      store.get(`${event.id}::confirmed`, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
      store.get(herinnerdKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
    ]);

    const verstuurd = [];
    const fouten = [];
    for (const persoon of bevestigd) {
      if (herinnerd.includes(persoon.email)) continue;
      try {
        const mail = herinneringsMail({ naam: persoon.name, eten: !!persoon.eten, event, lang: persoon.lang || "nl" });
        await stuur({ RESEND_API_KEY, naar: persoon.email, mail, prefix });
        herinnerd.push(persoon.email);
        verstuurd.push(persoon.email);
        // Na elke mail opslaan: valt de functie halverwege om, dan mailt de volgende run
        // niemand dubbel.
        await store.setJSON(herinnerdKey, herinnerd);
      } catch (fout) {
        console.error(`Herinnering aan ${persoon.email} mislukt:`, fout);
        fouten.push({ email: persoon.email, fout: fout.message });
      }
    }
    resultaat.push({ id: event.id, verstuurd, alEerder: bevestigd.length - verstuurd.length - fouten.length, fouten });
  }
  return resultaat;
}

// Eén voorbeeldmail naar een opgegeven adres, zonder iets bij te houden.
export async function stuurVoorbeeld({ RESEND_API_KEY, event, naar, eten, lang, prefix = "" }) {
  const mail = herinneringsMail({ naam: "Sean", eten, event, lang });
  await stuur({ RESEND_API_KEY, naar, mail, prefix: prefix + "[VOORBEELD] " });
}
