// Wachtwoord-beveiligd: verwijdert iemand uit een aanmeldlijst, of promoveert iemand
// van de wachtlijst naar bevestigd (mag capaciteit overschrijden — bewuste keuze van
// de beheerder). Schrijft de bijgewerkte lijst(en) terug naar Blobs.

import { getStore } from "@netlify/blobs";
import samenkomsten from "./data/samenkomsten.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { password, eventId, email, action } = await req.json();

    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
    if (!EDITOR_PASSWORD) {
      return new Response(
        JSON.stringify({ ok: false, error: "Beheerscherm is nog niet geconfigureerd (EDITOR_PASSWORD ontbreekt)." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (password !== EDITOR_PASSWORD) {
      return new Response(JSON.stringify({ ok: false, error: "Onjuist wachtwoord." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!eventId || !email || !["remove", "promote"].includes(action)) {
      return new Response(JSON.stringify({ ok: false, error: "Ongeldige aanvraag." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = samenkomsten.find((e) => e.id === eventId);
    if (!event) {
      return new Response(JSON.stringify({ ok: false, error: "Onbekende samenkomst." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("samenkomsten");
    const confirmedKey = `${event.id}::confirmed`;
    const waitlistKey = `${event.id}::wachtlijst`;

    const [confirmedList, waitlistList] = await Promise.all([
      store.get(confirmedKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
      store.get(waitlistKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
    ]);

    if (action === "remove") {
      const nextConfirmed = confirmedList.filter((e) => e.email !== email);
      const nextWaitlist = waitlistList.filter((e) => e.email !== email);
      await Promise.all([store.setJSON(confirmedKey, nextConfirmed), store.setJSON(waitlistKey, nextWaitlist)]);
      return new Response(JSON.stringify({ ok: true, confirmed: nextConfirmed, wachtlijst: nextWaitlist }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // action === "promote": verplaats van wachtlijst naar bevestigd.
    const entry = waitlistList.find((e) => e.email === email);
    if (!entry) {
      return new Response(JSON.stringify({ ok: false, error: "Deze persoon staat niet op de wachtlijst." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const nextWaitlist = waitlistList.filter((e) => e.email !== email);
    const nextConfirmed = [...confirmedList, entry];
    await Promise.all([store.setJSON(confirmedKey, nextConfirmed), store.setJSON(waitlistKey, nextWaitlist)]);

    return new Response(JSON.stringify({ ok: true, confirmed: nextConfirmed, wachtlijst: nextWaitlist }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in update-aanmelding:", error);
    return new Response(JSON.stringify({ ok: false, error: "Interne fout." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
