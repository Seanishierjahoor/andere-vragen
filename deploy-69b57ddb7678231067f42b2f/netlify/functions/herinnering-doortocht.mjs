// Draait elk uur (Netlify Scheduled Function), maar doet alleen iets om 10:00 Nederlandse
// tijd: dan krijgt Sean de schrijfherinneringen voor het archief van Op doortocht
// (zie lib/doortocht-herinnering.mjs). Alleen op de echte site, niet op de testsite.

import { getStore } from "@netlify/blobs";
import { isProductie } from "./lib/omgeving.mjs";
import { uurNL, stuur } from "./lib/herinnering.mjs";
import { gegevensStore, GEGEVENS_SLEUTEL, START, zetOm } from "./lib/doortocht.mjs";
import { HERINNERING_SLEUTEL, teVersturen, herinneringsMailDoortocht, vingerafdruk } from "./lib/doortocht-herinnering.mjs";

export default async (req, context) => {
  if (!isProductie(context)) return new Response("Alleen op de echte site.", { status: 200 });
  if (uurNL() !== 10) return new Response("Niet het herinneringsuur.", { status: 200 });

  const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("Doortocht-herinnering: RESEND_API_KEY ontbreekt.");
    return new Response("RESEND_API_KEY ontbreekt.", { status: 500 });
  }

  const store = getStore(gegevensStore(context));
  const gegevens = zetOm(await store.get(GEGEVENS_SLEUTEL, { type: "json" })) || START;
  const staat = (await store.get(HERINNERING_SLEUTEL, { type: "json" })) || {};
  const vandaag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

  const resultaat = [];
  for (const taak of teVersturen(gegevens, staat, vandaag)) {
    try {
      const mail = herinneringsMailDoortocht(taak, gegevens.plekken);
      await stuur({ RESEND_API_KEY, naar: mail.naar, mail, prefix: "" });
      staat[taak.sleutel] = { ...staat[taak.sleutel], [taak.soort]: new Date().toISOString(), ...(taak.soort === "eerste" ? { verhaal: vingerafdruk(taak.e) } : {}) };
      // Na elke mail opslaan: valt de functie halverwege om, dan mailt de volgende run niet dubbel.
      await store.setJSON(HERINNERING_SLEUTEL, staat);
      resultaat.push({ sleutel: taak.sleutel, soort: taak.soort, verstuurd: true });
    } catch (fout) {
      console.error(`Doortocht-herinnering ${taak.sleutel} mislukt:`, fout);
      resultaat.push({ sleutel: taak.sleutel, soort: taak.soort, fout: fout.message });
    }
  }
  console.log("Doortocht-herinneringen:", JSON.stringify(resultaat));
  return new Response(JSON.stringify(resultaat), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const config = {
  schedule: "0 * * * *",
};
