// Handmatig testen van de herinneringsmail (wachtwoord vereist):
// - { password, eventId, naar, eten?, lang? }  stuurt één voorbeeld naar `naar`
// - { password, eventId, verstuur: true }       verstuurt de echte herinneringen voor
//   die samenkomst nu meteen (alleen op de testsite, zodat je het hele proces kunt
//   controleren zonder op 10:00 te wachten)

import { getStore } from "@netlify/blobs";
import samenkomsten from "./data/samenkomsten.mjs";
import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { isProductie, storeNaam } from "./lib/omgeving.mjs";
import { stuurVoorbeeld, verstuurHerinneringen } from "./lib/herinnering.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const { password, eventId, naar, eten = false, lang = "nl", verstuur = false } = await req.json();
    if (!wachtwoordKlopt(password, Netlify.env.get("EDITOR_PASSWORD"))) {
      return json({ ok: false, error: "Onjuist wachtwoord." }, 401);
    }

    const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY ontbreekt op deze site." }, 500);

    const event = samenkomsten.find((e) => e.id === eventId);
    if (!event) return json({ ok: false, error: "Onbekende samenkomst." }, 400);

    const prefix = isProductie(context) ? "" : "[TEST] ";

    if (verstuur) {
      if (isProductie(context)) {
        return json({ ok: false, error: "Direct versturen kan alleen op de testsite." }, 403);
      }
      const resultaat = await verstuurHerinneringen({ store: getStore(storeNaam(context)), RESEND_API_KEY, events: [event], prefix });
      return json({ ok: true, resultaat });
    }

    if (!naar) return json({ ok: false, error: "Geef een adres op in `naar`." }, 400);
    await stuurVoorbeeld({ RESEND_API_KEY, event, naar, eten, lang, prefix });
    return json({ ok: true, verstuurdNaar: naar });
  } catch (error) {
    console.error("Error in test-herinnering:", error);
    return json({ ok: false, error: error.message || "Interne fout." }, 500);
  }
};
