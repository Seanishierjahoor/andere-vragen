// Foto's van "Op doortocht".
// GET  /doortocht-foto/<id>  toont een foto (publiek, lang te cachen: een id verandert nooit).
// POST /doortocht-foto        bewaart een foto uit het beheerscherm (wachtwoord in X-Wachtwoord).
// Het beheerscherm verkleint foto's al vóór het uploaden, dus ze passen ruim binnen de limiet.

import { getStore } from "@netlify/blobs";
import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { fotoStore, json } from "./lib/doortocht.mjs";

const SOORTEN = ["image/webp", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export default async (req, context) => {
  const store = getStore(fotoStore(context));

  if (req.method === "GET") {
    const id = new URL(req.url).pathname.split("/").pop();
    if (!/^[a-z0-9-]{8,64}$/.test(id)) return new Response("Niet gevonden", { status: 404 });
    const foto = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!foto) return new Response("Niet gevonden", { status: 404 });
    return new Response(foto.data, {
      headers: {
        "Content-Type": foto.metadata?.soort || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "POST") {
    try {
      const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
      if (!wachtwoordKlopt(decodeURIComponent(req.headers.get("x-wachtwoord") || ""), EDITOR_PASSWORD)) {
        return json({ ok: false, error: "Onjuist wachtwoord." }, 401);
      }
      const soort = (req.headers.get("content-type") || "").split(";")[0];
      if (!SOORTEN.includes(soort)) return json({ ok: false, error: "Alleen webp, jpeg of png." }, 400);
      const data = await req.arrayBuffer();
      if (!data.byteLength || data.byteLength > MAX_BYTES) return json({ ok: false, error: "Foto is te groot." }, 400);

      const id = crypto.randomUUID();
      await store.set(id, data, { metadata: { soort, bytes: data.byteLength, geupload: new Date().toISOString() } });
      return json({ ok: true, id });
    } catch (error) {
      console.error("Error in foto-doortocht:", error);
      return json({ ok: false, error: "Uploaden mislukt." }, 500);
    }
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
};

export const config = {
  path: ["/doortocht-foto", "/doortocht-foto/*"],
};
