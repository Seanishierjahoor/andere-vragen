// Draait elk uur (Netlify Scheduled Function), maar doet alleen iets om 10:00
// Nederlandse tijd: dan krijgt iedereen met een bevestigde plek voor de samenkomst
// van morgen één herinneringsmail. Elk uur draaien in plaats van een vast UTC-uur
// houdt de herinnering op 10:00, ook na de overgang naar zomer- of wintertijd.

import { getStore } from "@netlify/blobs";
import { isProductie, storeNaam } from "./lib/omgeving.mjs";
import { samenkomstenVanMorgen, uurNL, verstuurHerinneringen } from "./lib/herinnering.mjs";

export default async (req, context) => {
  if (uurNL() !== 10) return new Response("Niet het herinneringsuur.", { status: 200 });

  const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("Herinnering: RESEND_API_KEY ontbreekt.");
    return new Response("RESEND_API_KEY ontbreekt.", { status: 500 });
  }

  const events = samenkomstenVanMorgen();
  if (!events.length) return new Response("Morgen geen samenkomst.", { status: 200 });

  const resultaat = await verstuurHerinneringen({
    store: getStore(storeNaam(context)),
    RESEND_API_KEY,
    events,
    prefix: isProductie(context) ? "" : "[TEST] ",
  });
  console.log("Herinneringen:", JSON.stringify(resultaat));
  return new Response(JSON.stringify(resultaat), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const config = {
  schedule: "0 * * * *",
};
