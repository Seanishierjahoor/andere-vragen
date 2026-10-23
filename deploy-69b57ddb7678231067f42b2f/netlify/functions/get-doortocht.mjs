// Levert de plekken en zichtbare bijeenkomsten voor /op-doortocht.html. Publiek.

import { getStore } from "@netlify/blobs";
import { gegevensStore, GEGEVENS_SLEUTEL, START, json, zetOm } from "./lib/doortocht.mjs";

export default async (req, context) => {
  try {
    const opgeslagen = await getStore(gegevensStore(context)).get(GEGEVENS_SLEUTEL, { type: "json" });
    const gegevens = zetOm(opgeslagen) || START;
    const bijeenkomsten = gegevens.bijeenkomsten.filter((b) => b.zichtbaar !== false);
    return json({ ok: true, plekken: gegevens.plekken, bijeenkomsten }, 200, { "Cache-Control": "public, max-age=60" });
  } catch (error) {
    console.error("Error in get-doortocht:", error);
    return json({ ok: false, error: "Interne fout." }, 500);
  }
};
