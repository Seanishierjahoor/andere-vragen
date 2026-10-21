// Beheer van "Op doortocht" (/beheer-doortocht.html). Wachtwoord vereist (EDITOR_PASSWORD).
// { actie: "ophalen" } geeft alles, ook verborgen bijeenkomsten.
// { actie: "opslaan", gegevens } controleert en bewaart alles in één keer in Blobs (geen build).

import { getStore } from "@netlify/blobs";
import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { gegevensStore, GEGEVENS_SLEUTEL, START, controleer, json, zetOm } from "./lib/doortocht.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const { password, actie, gegevens } = await req.json();
    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
    if (!EDITOR_PASSWORD) return json({ ok: false, error: "Beheerscherm is nog niet geconfigureerd (EDITOR_PASSWORD ontbreekt)." }, 500);
    if (!wachtwoordKlopt(password, EDITOR_PASSWORD)) return json({ ok: false, error: "Onjuist wachtwoord." }, 401);

    const store = getStore(gegevensStore(context));

    if (actie === "ophalen") {
      const opgeslagen = await store.get(GEGEVENS_SLEUTEL, { type: "json" });
      return json({ ok: true, gegevens: zetOm(opgeslagen) || START });
    }

    if (actie === "opslaan") {
      const { fout, gegevens: schoon } = controleer(zetOm(gegevens));
      if (fout) return json({ ok: false, error: fout }, 400);
      await store.setJSON(GEGEVENS_SLEUTEL, schoon);
      return json({ ok: true, gegevens: schoon });
    }

    return json({ ok: false, error: "Onbekende actie." }, 400);
  } catch (error) {
    console.error("Error in beheer-doortocht:", error);
    return json({ ok: false, error: "Interne fout." }, 500);
  }
};
