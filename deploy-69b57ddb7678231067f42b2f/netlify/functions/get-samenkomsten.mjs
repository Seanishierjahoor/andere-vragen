// Levert de lijst van komende samenkomsten met status "open" of "vol" —
// nooit een aantal plekken, zodat de widget die informatie niet kan tonen.

import { getStore } from "@netlify/blobs";
import samenkomsten from "./data/samenkomsten.mjs";

export default async () => {
  try {
    const store = getStore("samenkomsten");
    const nu = Date.now();

    const events = await Promise.all(
      samenkomsten
        .filter((event) => new Date(event.start).getTime() > nu)
        .map(async (event) => {
          const raw = await store.get(`${event.id}::confirmed`, { type: "json" });
          const confirmedCount = Array.isArray(raw) ? raw.length : 0;
          return {
            id: event.id,
            start: event.start,
            duurMinuten: event.duurMinuten,
            locatie: event.locatie,
            thema: (event.thema || "").trim(),
            status: confirmedCount >= event.capaciteit ? "vol" : "open",
          };
        })
    );

    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-samenkomsten:", error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
