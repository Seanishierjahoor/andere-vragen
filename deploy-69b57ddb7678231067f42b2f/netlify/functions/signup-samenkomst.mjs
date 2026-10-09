// Verwerkt aanmeldingen voor een samenkomst: bepaalt open/vol (zonder aantallen te
// tonen), past de "één actieve aanmelding tegelijk"-regel toe, stuurt de melding aan
// Andere Vragen en de bevestiging aan de aanmelder (met agenda-uitnodiging bij een
// bevestigde plek), en schrijft desgewenst direct in bij de nieuwsbrief.

import { getStore } from "@netlify/blobs";
import { isProductie, storeNaam } from "./lib/omgeving.mjs";
import { AFZENDER, ANTWOORD_ADRES } from "./lib/mail.mjs";
import { bevestigingsMail, wachtlijstMail } from "./lib/mails.mjs";
import { icsBijlage } from "./lib/agenda.mjs";
import samenkomsten from "./data/samenkomsten.mjs";
import instellingen from "./data/instellingen.mjs";

// Teksten die de aanmelder te zien krijgt (foutmeldingen en bevestigingsmail), per taal.
const TEKSTEN = {
  nl: {
    missingFields: "Naam, e-mail en een gekozen datum zijn verplicht.",
    unknownEvent: "Deze samenkomst bestaat niet (meer).",
    alreadyRegistered: (wanneer) =>
      `Je bent al aangemeld voor de samenkomst op ${wanneer}. Voor nu kun je je maar voor één samenkomst tegelijk inschrijven. Kom een volgende keer gerust opnieuw langs.`,
    serverError: "Er ging iets mis. Probeer het later opnieuw.",
  },
  en: {
    missingFields: "Name, email and a chosen date are required.",
    unknownEvent: "This gathering no longer exists.",
    alreadyRegistered: (wanneer) =>
      `You're already signed up for the gathering on ${wanneer}. For now you can only sign up for one gathering at a time. Feel free to come back after that one.`,
    serverError: "Something went wrong. Please try again later.",
  },
};

export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
    }

    const body = await req.json();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const message = (body.message || "").trim();
    const newsletter = body.newsletter === "ja";
    const eten = body.eten === "ja";
    const eventId = body.event_id;
    const lang = body.lang === "en" ? "en" : "nl";
    const t = TEKSTEN[lang];

    if (body["bot-field"]) {
      // Spambot: doe alsof het gelukt is, zonder iets te verwerken.
      return new Response(JSON.stringify({ ok: true, status: "confirmed" }), { status: 200 });
    }

    if (!name || !email || !eventId) {
      return new Response(
        JSON.stringify({ error: "missing_fields", message: t.missingFields }),
        { status: 400 }
      );
    }

    const event = samenkomsten.find((e) => e.id === eventId);
    if (!event || new Date(event.start).getTime() <= Date.now()) {
      return new Response(
        JSON.stringify({ error: "unknown_event", message: t.unknownEvent }),
        { status: 400 }
      );
    }

    const store = getStore(storeNaam(context));
    const confirmedKey = `${event.id}::confirmed`;
    const waitlistKey = `${event.id}::wachtlijst`;

    const [confirmedList, waitlistList] = await Promise.all([
      store.get(confirmedKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
      store.get(waitlistKey, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
    ]);

    // Al aangemeld voor déze samenkomst: geen dubbele registratie, gewoon opnieuw bevestigen.
    const alreadyHere = confirmedList.some((e) => e.email === email) || waitlistList.some((e) => e.email === email);

    if (!alreadyHere && instellingen.eenPerKeer) {
      const conflict = await findActiveRegistrationElsewhere(store, event.id, email);
      if (conflict) {
        return new Response(
          JSON.stringify({
            error: "already_registered",
            message: t.alreadyRegistered(formatDatumTijd(conflict.start, lang)),
          }),
          { status: 409 }
        );
      }
    }

    let isWaitlist = waitlistList.some((e) => e.email === email);
    if (!alreadyHere) {
      isWaitlist = confirmedList.length >= event.capaciteit;
      const entry = { name, email, eten, lang, timestamp: new Date().toISOString() };
      if (message) entry.message = message.slice(0, 2000);
      if (isWaitlist) {
        waitlistList.push(entry);
        await store.setJSON(waitlistKey, waitlistList);
      } else {
        confirmedList.push(entry);
        await store.setJSON(confirmedKey, confirmedList);
      }
    }

    const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
    let mailStatus = "geen RESEND_API_KEY op deze site";
    if (RESEND_API_KEY) {
      const prefix = isProductie(context) ? "" : "[TEST] ";
      const melding = await sendNotification({ RESEND_API_KEY, name, email, message, newsletter, eten, event, isWaitlist, lang, prefix });
      const bevestiging = await sendConfirmation({ RESEND_API_KEY, name, email, eten, event, isWaitlist, lang, prefix });
      mailStatus = { melding, bevestiging };
    } else {
      console.log("RESEND_API_KEY not configured. Signup received:", JSON.stringify({ name, email, event: event.id, isWaitlist }));
    }

    const BUTTONDOWN_API_KEY = Netlify.env.get("BUTTONDOWN_API_KEY");
    let nieuwsbrief = newsletter ? (BUTTONDOWN_API_KEY ? "onbekend" : "geen BUTTONDOWN_API_KEY") : "niet aangevinkt";
    if (newsletter && BUTTONDOWN_API_KEY) {
      try {
        const bdResponse = await fetch("https://api.buttondown.com/v1/subscribers", {
          method: "POST",
          headers: {
            Authorization: `Token ${BUTTONDOWN_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email_address: email, tags: isProductie(context) ? ["samenkomsten"] : ["samenkomsten", "test"] }),
        });
        if (bdResponse.ok) {
          nieuwsbrief = "ingeschreven";
        } else {
          const tekst = await bdResponse.text();
          // Al ingeschreven is geen fout.
          nieuwsbrief = /already|exists|bestaat/i.test(tekst) ? "was al ingeschreven" : `fout ${bdResponse.status}: ${tekst.slice(0, 200)}`;
          if (!nieuwsbrief.startsWith("was al")) console.error("Buttondown API error:", tekst);
        }
      } catch (bdError) {
        nieuwsbrief = `fout: ${bdError.message}`;
        console.error("Fout bij Buttondown-inschrijving:", bdError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: isWaitlist ? "waitlist" : "confirmed",
        event: { id: event.id, start: event.start, duurMinuten: event.duurMinuten, locatie: event.locatie, adres: event.adres || "" },
        ...(isProductie(context) ? {} : { test: { nieuwsbrief, mail: mailStatus, store: storeNaam(context), deploy: context?.deploy?.id, context: context?.deploy?.context, resendGezien: Boolean(Netlify.env.get("RESEND_API_KEY")), bekendeSleutels: ["RESEND_API_KEY", "BUTTONDOWN_API_KEY", "EDITOR_PASSWORD", "GITHUB_TOKEN"].filter((k) => Netlify.env.has(k)) } }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in signup-samenkomst:", error);
    return new Response(
      JSON.stringify({ error: "server_error", message: TEKSTEN.nl.serverError + " / " + TEKSTEN.en.serverError }),
      { status: 500 }
    );
  }
};

async function findActiveRegistrationElsewhere(store, currentEventId, email) {
  const now = Date.now();
  const others = samenkomsten.filter((e) => e.id !== currentEventId && new Date(e.start).getTime() > now);
  for (const other of others) {
    const [confirmed, waitlist] = await Promise.all([
      store.get(`${other.id}::confirmed`, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
      store.get(`${other.id}::wachtlijst`, { type: "json" }).then((v) => (Array.isArray(v) ? v : [])),
    ]);
    if (confirmed.some((e) => e.email === email) || waitlist.some((e) => e.email === email)) {
      return other;
    }
  }
  return null;
}

function formatDatumTijdNL(startISO) {
  return formatDatumTijd(startISO, "nl");
}

function formatDatumTijd(startISO, lang) {
  const locale = lang === "en" ? "en-GB" : "nl-NL";
  const date = new Date(startISO);
  const datum = date.toLocaleDateString(locale, {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const tijd = date.toLocaleTimeString(locale, {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  });
  return lang === "en" ? `${datum} at ${tijd}` : `${datum} om ${tijd}`;
}

// De herinnering gaat de dag voor de samenkomst om 10:00 (NL-tijd). Wie zich daarna
// aanmeldt, krijgt hem niet meer; dan noemt de bevestiging hem ook niet.
function herinneringNogTeVersturen(event) {
  const offset = event.start.slice(-6); // bv. "+02:00"
  const dagErvoor = new Date(new Date(event.start).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
  return Date.now() < new Date(`${dagErvoor}T10:00:00${offset}`).getTime();
}

async function sendNotification({ RESEND_API_KEY, name, email, message, newsletter, eten, event, isWaitlist, lang, prefix = "" }) {
  const submittedAt = new Date().toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "full",
    timeStyle: "short",
  });
  const title = (isWaitlist ? "WACHTLIJST: nieuwe aanmelding samenkomst" : "Nieuwe aanmelding samenkomst") + (lang === "en" ? " (Engelstalig)" : "");
  const wanneer = formatDatumTijdNL(event.start);

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="border-bottom: 1px solid #e5e2dd; padding-bottom: 24px; margin-bottom: 24px;">
        <h2 style="font-style: italic; font-weight: 400; font-size: 24px; margin: 0;">${title}</h2>
        <p style="color: #5a5a5a; font-size: 13px; margin-top: 8px;">${submittedAt}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; width: 120px; vertical-align: top;">Naam</td><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">${name || "-"}</td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">E-mail</td><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;"><a href="mailto:${email}" style="color: #1a1a1a;">${email || "-"}</a></td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">Samenkomst</td><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">${wanneer}, ${event.locatie}</td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">Eet mee</td><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">${eten ? "Ja (18:00)" : "Nee"}</td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">Opmerking</td><td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; white-space: pre-wrap;">${message || "-"}</td></tr>
        <tr><td style="padding: 12px 0; color: #5a5a5a; vertical-align: top;">Nieuwsbrief</td><td style="padding: 12px 0;">${newsletter ? "Ja, wil zich aanmelden" : "Nee"}</td></tr>
      </table>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e2dd;">
        <a href="mailto:${email}?subject=Re: Aanmelding samenkomst" style="display: inline-block; padding: 12px 32px; background: #1a1a1a; color: #fcfaf7; text-decoration: none; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Beantwoorden</a>
      </div>
    </div>
  `;
  const text = `${title}\n${submittedAt}\n\nNaam: ${name || "-"}\nE-mail: ${email || "-"}\nSamenkomst: ${wanneer}, ${event.locatie}\nEet mee: ${eten ? "Ja (18:00)" : "Nee"}\nOpmerking: ${message || "-"}\nNieuwsbrief: ${newsletter ? "Ja" : "Nee"}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: AFZENDER,
      to: [ANTWOORD_ADRES],
      subject: `${prefix}${title}: ${name || "onbekend"}`,
      html,
      text,
      reply_to: email || undefined,
    }),
  });
  if (!response.ok) {
    const fout = await response.text();
    console.error("Resend API error (melding):", fout);
    return `fout ${response.status}: ${fout.slice(0, 200)}`;
  }
  return "verstuurd";
}

async function sendConfirmation({ RESEND_API_KEY, name, email, eten, event, isWaitlist, lang = "nl", prefix = "" }) {
  const mail = (isWaitlist ? wachtlijstMail : bevestigingsMail)({ naam: name, eten, event, lang, herinneringKomt: herinneringNogTeVersturen(event) });
  const html = mail.html;
  const text = mail.text;

  const payload = {
    from: AFZENDER,
    to: [email],
    reply_to: ANTWOORD_ADRES,
    subject: prefix + mail.onderwerp,
    html,
    text,
  };

  if (!isWaitlist) {
    payload.attachments = [icsBijlage(event, lang)];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const fout = await response.text();
    console.error("Resend API error (bevestiging):", fout);
    return `fout ${response.status}: ${fout.slice(0, 200)}`;
  }
  return "verstuurd";
}
