// Inschrijven voor alleen de nieuwsbrief (zonder aanmelding voor een samenkomst),
// vanaf de samenkomstenpagina. Schrijft in bij Buttondown met een taal-tag.

import { isProductie } from "./lib/omgeving.mjs";

const TEKST = {
  nl: {
    ongeldig: "Vul een geldig e-mailadres in.",
    fout: "Er ging iets mis. Probeer het later opnieuw of mail naar anderevragen@proton.me.",
  },
  en: {
    ongeldig: "Please enter a valid email address.",
    fout: "Something went wrong. Please try again later or email anderevragen@proton.me.",
  },
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false }, 405);

  let lang = "nl";
  try {
    const body = await req.json();
    lang = body.lang === "en" ? "en" : "nl";
    const t = TEKST[lang];

    // Spambot: doe alsof het gelukt is.
    if (body["bot-field"]) return json({ ok: true });

    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, message: t.ongeldig }, 400);

    const BUTTONDOWN_API_KEY = Netlify.env.get("BUTTONDOWN_API_KEY");
    if (!BUTTONDOWN_API_KEY) {
      console.error("Nieuwsbrief: BUTTONDOWN_API_KEY ontbreekt.");
      return json({ ok: false, message: t.fout }, 500);
    }

    const tags = ["website", lang === "en" ? "engels" : "nederlands"];
    if (!isProductie(context)) tags.push("test");

    const res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: { Authorization: `Token ${BUTTONDOWN_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, tags }),
    });

    if (res.ok) return json({ ok: true });

    const tekst = await res.text();
    if (/already|exists/i.test(tekst)) return json({ ok: true, alIngeschreven: true });

    console.error("Buttondown API error (nieuwsbrief):", res.status, tekst);
    return json({ ok: false, message: t.fout }, 502);
  } catch (error) {
    console.error("Error in nieuwsbrief-inschrijven:", error);
    return json({ ok: false, message: TEKST[lang].fout }, 500);
  }
};
