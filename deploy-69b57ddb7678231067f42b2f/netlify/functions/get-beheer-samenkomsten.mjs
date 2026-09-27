// Levert de volledige, ongefilterde samenkomsten-data + instellingen aan het
// beheerscherm (/beheer-samenkomsten.html). Wachtwoord vereist — deze data bevat
// de capaciteit én de namenlijsten, die nooit publiek zichtbaar mogen zijn.

import { wachtwoordKlopt } from "./lib/wachtwoord.mjs";
import { getStore } from "@netlify/blobs";
import samenkomsten from "./data/samenkomsten.mjs";
import instellingen from "./data/instellingen.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { password } = await req.json();
    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");

    if (!EDITOR_PASSWORD) {
      return new Response(
        JSON.stringify({ ok: false, error: "Beheerscherm is nog niet geconfigureerd (EDITOR_PASSWORD ontbreekt)." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!wachtwoordKlopt(password, EDITOR_PASSWORD)) {
      return new Response(JSON.stringify({ ok: false, error: "Onjuist wachtwoord." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("samenkomsten");
    const samenkomstenMetAanmeldingen = await Promise.all(
      samenkomsten.map(async (event) => {
        const [confirmed, wachtlijst] = await Promise.all([
          store.get(`${event.id}::confirmed`, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
          store.get(`${event.id}::wachtlijst`, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
        ]);
        return { ...event, confirmed, wachtlijst };
      })
    );

    return new Response(JSON.stringify({ ok: true, samenkomsten: samenkomstenMetAanmeldingen, instellingen }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-beheer-samenkomsten:", error);
    return new Response(JSON.stringify({ ok: false, error: "Interne fout." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
