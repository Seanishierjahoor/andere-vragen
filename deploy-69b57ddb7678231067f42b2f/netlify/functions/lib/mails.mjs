// Teksten en opmaak van de mails aan deelnemers: bevestiging, wachtlijst en de
// herinnering een dag van tevoren. Zelfde huisstijl als de site: warm papier, petrol
// voor tekst, een koraallijn als accent, schreefletter voor woordmerk en titel.
//
// Alles tussen ${...} wordt automatisch ingevuld uit de aanmelding (naam, eten) en
// uit de samenkomst in de beheer-app (datum, locatie, adres, thema).

const CONTACT = "anderevragen@proton.me";

const KLEUR = { papier: "#F3EFE6", vlak: "#FAF8F3", petrol: "#193B3A", zacht: "#4A5F5E", koraal: "#E96A4B", lijn: "#D9DCD6" };
const FONT = {
  kop: "'DM Serif Display',Georgia,'Times New Roman',serif",
  body: "'DM Sans',Helvetica,Arial,sans-serif",
};

const T = {
  nl: {
    locale: "nl-NL",
    hoi: (naam) => (naam ? `Hoi ${naam},` : "Hoi,"),
    labels: { wanneer: "Wanneer", waar: "Waar", thema: "Thema", eten: "Eten", kosten: "Kosten" },
    tijd: (van, tot) => `${van} tot ${tot}`,
    geenThema: "Wordt nog aangekondigd",
    etenJa: "Je eet mee, om 18:00. Vegetarisch, vrijwillige bijdrage.",
    kosten: "Vrijwillige bijdrage, ter plekke",
    ondertekening: ["Sean", "andere vragen"],

    bevestiging: {
      onderwerp: (datum) => `Je bent aangemeld voor ${datum} | andere vragen`,
      titel: "Leuk dat je komt!",
      alineas: (eten, { herinneringKomt }) => [
        "Je hoeft niets voor te bereiden. Kom zoals je bent, zin om mee te denken is genoeg.",
        ...(eten ? [] : [`Toch zin om mee te eten? We eten om 18:00. Mail dan even naar ${CONTACT}.`]),
        herinneringKomt
          ? "In de bijlage zit een agenda-uitnodiging. De dag van tevoren krijg je nog een herinnering."
          : "In de bijlage zit een agenda-uitnodiging.",
        `Kun je toch niet komen? Mail dan even naar ${CONTACT}, dan kan iemand van de wachtlijst je plek krijgen.`,
      ],
      afsluiting: "Tot dan!",
    },

    afmelding: {
      onderwerp: (datum) => `Je afmelding voor ${datum} is verwerkt | andere vragen`,
      titel: "Je afmelding is verwerkt",
      alineas: (eten, { datumTekst }) => [
        `Je bent afgemeld voor ${datumTekst}. Jammer dat je er niet bij kunt zijn!`,
        "Hopelijk tot een volgende keer. Op de site zie je wanneer de volgende samenkomsten zijn:",
        knop("Bekijk de volgende samenkomsten", "https://andere-vragen.nl/"),
      ],
      afsluiting: "Hartelijke groet,",
    },

    wachtlijst: {
      onderwerp: (datum) => `Je staat op de wachtlijst voor ${datum} | andere vragen`,
      titel: "Je staat op de wachtlijst",
      alineas: () => [
        "Dank je wel voor je aanmelding! Deze avond zit op dit moment vol, dus je staat op de wachtlijst.",
        "Komt er een plek vrij, dan hoor je het meteen.",
      ],
      afsluiting: "Hartelijke groet,",
    },

    plek: {
      onderwerp: (datum) => `Er is een plek vrij voor ${datum} | andere vragen`,
      titel: "Er is een plek vrij!",
      intro: "Goed nieuws: er is een plek vrijgekomen, en die is voor jou. Je staat nu op de deelnemerslijst.",
      alineas: (eten) => [
        ...(eten ? [] : [`Zin om mee te eten? We eten om 18:00. Mail dan even naar ${CONTACT}.`]),
        "In de bijlage zit een agenda-uitnodiging.",
        `Kun je toch niet komen? Mail dan even naar ${CONTACT}, dan geven we de plek door aan de volgende.`,
      ],
      afsluiting: "Tot dan!",
    },

    herinnering: {
      onderwerp: () => "Morgen: filosofisch gesprek | andere vragen",
      titel: "Morgen is het zover!",
      intro: "Wat leuk dat je langskomt.",
      alineas: (eten) => [
        eten
          ? "Je eet mee! Zorg dat je er om 18:00 bent, dan zijn we op tijd klaar met eten om aan de slag te gaan."
          : `Toch zin om mee te eten? We eten om 18:00. Mail dan vandaag nog even naar ${CONTACT}, dan houden we rekening met je.`,
        `Kun je toch niet komen? Mail me dan even op ${CONTACT}, dan kan iemand van de wachtlijst je plek nog krijgen.`,
      ],
      afsluiting: "Tot morgen!",
    },
  },

  en: {
    locale: "en-GB",
    hoi: (naam) => (naam ? `Hi ${naam},` : "Hi,"),
    labels: { wanneer: "When", waar: "Where", thema: "Theme", eten: "Dinner", kosten: "Cost" },
    tijd: (van, tot) => `${van} to ${tot}`,
    geenThema: "To be announced",
    etenJa: "You're joining for dinner at 18:00. Vegetarian, voluntary contribution.",
    kosten: "Voluntary contribution, on the night",
    ondertekening: ["Sean", "andere vragen"],

    bevestiging: {
      onderwerp: (datum) => `You're signed up for ${datum} | andere vragen`,
      titel: "Great that you're coming!",
      alineas: (eten, { herinneringKomt }) => [
        "You don't need to prepare anything. Come as you are, feeling like thinking along is enough.",
        ...(eten ? [] : [`Feel like joining for dinner after all? We eat at 18:00. Just email ${CONTACT}.`]),
        herinneringKomt ? "A calendar invite is attached. You'll get a reminder the day before." : "A calendar invite is attached.",
        `Can't make it after all? Just email ${CONTACT}, so someone on the waiting list can take your spot.`,
      ],
      afsluiting: "See you then!",
    },

    afmelding: {
      onderwerp: (datum) => `Your cancellation for ${datum} is confirmed | andere vragen`,
      titel: "Your cancellation is confirmed",
      alineas: (eten, { datumTekst }) => [
        `You're no longer signed up for ${datumTekst}. A pity you can't make it!`,
        "Hopefully see you another time. The site shows when the next gatherings are:",
        knop("See the next gatherings", "https://andere-vragen.nl/gatherings.html"),
      ],
      afsluiting: "Warm regards,",
    },

    wachtlijst: {
      onderwerp: (datum) => `You're on the waiting list for ${datum} | andere vragen`,
      titel: "You're on the waiting list",
      alineas: () => [
        "Thank you for signing up! This evening is full at the moment, so you're on the waiting list.",
        "If a spot opens up, you'll hear right away.",
      ],
      afsluiting: "Warm regards,",
    },

    plek: {
      onderwerp: (datum) => `A spot opened up for ${datum} | andere vragen`,
      titel: "A spot opened up!",
      intro: "Good news: a spot has opened up, and it's yours. You're now on the list of participants.",
      alineas: (eten) => [
        ...(eten ? [] : [`Feel like joining for dinner? We eat at 18:00. Just email ${CONTACT}.`]),
        "A calendar invite is attached.",
        `Can't make it after all? Just email ${CONTACT}, so we can pass the spot on to the next person.`,
      ],
      afsluiting: "See you then!",
    },

    herinnering: {
      onderwerp: () => "Tomorrow: philosophical conversation | andere vragen",
      titel: "See you tomorrow!",
      intro: "Lovely that you're coming.",
      alineas: (eten) => [
        eten
          ? "You're joining for dinner! Please be there at 18:00, so we finish eating in time to get started."
          : `Feel like joining for dinner after all? We eat at 18:00. Email ${CONTACT} today, so we can count you in.`,
        `Can't make it after all? Just email me at ${CONTACT}, so someone on the waiting list can still take your spot.`,
      ],
      afsluiting: "See you tomorrow!",
    },
  },
};

// Een knop in de mail. In de platte-tekstversie wordt het "tekst: url".
function knop(tekst, url) {
  return {
    html: `<p style="margin:8px 0 20px;"><a href="${url}" style="display:inline-block;padding:13px 24px;border-radius:6px;background:${KLEUR.petrol};color:${KLEUR.papier};text-decoration:none;font-size:15px;font-weight:600;font-family:${FONT.body};">${esc(tekst)}</a></p>`,
    text: `${tekst}: ${url}`,
  };
}

export function voornaam(naam) {
  return String(naam || "").trim().split(/\s+/)[0] || "";
}

export function mapsUrl(adres) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
}

function esc(tekst) {
  return String(tekst ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function datum(startISO, locale) {
  return new Date(startISO).toLocaleDateString(locale, {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function klok(date, locale) {
  return date.toLocaleTimeString(locale, { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
}

// Rijen voor het infoblok: [label, html, tekst]
function infoRijen(t, event, eten, metKosten) {
  const start = new Date(event.start);
  const eind = new Date(start.getTime() + (event.duurMinuten || 120) * 60000);
  const wanneer = `${datum(event.start, t.locale)}, ${t.tijd(klok(start, t.locale), klok(eind, t.locale))}`;

  const waarHtml = esc(event.locatie) + (event.adres ? `<br><a href="${mapsUrl(event.adres)}" style="color:${KLEUR.petrol};">${esc(event.adres)}</a>` : "");
  const waarTekst = event.adres ? `${event.locatie}, ${event.adres} (${mapsUrl(event.adres)})` : event.locatie;

  const thema = (event.thema || "").trim();
  const rijen = [
    [t.labels.wanneer, esc(wanneer), wanneer],
    [t.labels.waar, waarHtml, waarTekst],
    [t.labels.thema, thema ? esc(thema) : `<em style="color:${KLEUR.zacht};">${esc(t.geenThema)}</em>`, thema || t.geenThema],
  ];
  if (eten) rijen.push([t.labels.eten, esc(t.etenJa), t.etenJa]);
  if (metKosten) rijen.push([t.labels.kosten, esc(t.kosten), t.kosten]);
  return rijen;
}

function opmaak({ titel, aanhef, intro, rijen, alineas, afsluiting, ondertekening }) {
  const p = (tekst, extra = "") =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${KLEUR.petrol};${extra}">${esc(tekst)}</p>`;

  const info = rijen.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 24px;border-top:1px solid ${KLEUR.lijn};">${rijen
        .map(
          ([label, html]) =>
            `<tr><td style="padding:11px 12px 11px 0;width:92px;vertical-align:top;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${KLEUR.zacht};border-bottom:1px solid ${KLEUR.lijn};">${esc(label)}</td><td style="padding:11px 0;vertical-align:top;font-size:16px;line-height:1.5;color:${KLEUR.petrol};border-bottom:1px solid ${KLEUR.lijn};">${html}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&family=DM+Serif+Display&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${KLEUR.papier};">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${KLEUR.papier};"><tr><td style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;background:${KLEUR.vlak};border:1px solid ${KLEUR.lijn};border-top:4px solid ${KLEUR.petrol};border-radius:6px;">
<tr><td style="padding:32px 32px 28px;font-family:${FONT.body};color:${KLEUR.petrol};">
<p style="margin:0;font-family:${FONT.kop};font-size:24px;line-height:1;color:${KLEUR.petrol};">andere vragen</p>
<div style="width:56px;height:4px;margin:12px 0 28px;border-radius:2px;background:${KLEUR.koraal};line-height:4px;font-size:0;">&nbsp;</div>
<h1 style="margin:0 0 24px;font-family:${FONT.kop};font-weight:normal;font-size:30px;line-height:1.15;color:${KLEUR.petrol};">${esc(titel)}</h1>
${p(aanhef)}
${intro ? p(intro) : ""}
${info}
${alineas.map((a) => (typeof a === "object" ? a.html : p(a))).join("\n")}
${p(afsluiting, "margin-top:24px;")}
<p style="margin:0;font-size:16px;line-height:1.5;color:${KLEUR.petrol};">${ondertekening.map(esc).join("<br>")}</p>
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-family:${FONT.body};font-size:13px;line-height:1.5;color:${KLEUR.zacht};text-align:center;">andere vragen · Rotterdam · <a href="mailto:${CONTACT}" style="color:${KLEUR.zacht};">${CONTACT}</a></p>
</td></tr></table>
</body></html>`;

  const text = [
    titel,
    "",
    aanhef,
    ...(intro ? ["", intro] : []),
    "",
    ...(rijen.length ? [...rijen.map(([label, , tekst]) => `${label}: ${tekst}`), ""] : []),
    ...alineas.flatMap((a) => [typeof a === "object" ? a.text : a, ""]),
    afsluiting,
    ...ondertekening,
  ].join("\n");

  return { html, text };
}

function maak(soort, { naam, eten, event, lang, herinneringKomt = true }) {
  const t = T[lang] || T.nl;
  const s = t[soort];
  const metInfo = soort !== "wachtlijst" && soort !== "afmelding";
  const { html, text } = opmaak({
    titel: s.titel,
    aanhef: t.hoi(voornaam(naam)),
    intro: s.intro,
    rijen: metInfo ? infoRijen(t, event, eten, soort === "bevestiging" || soort === "plek") : [],
    alineas: s.alineas(eten, { herinneringKomt, datumTekst: datum(event.start, t.locale) }),
    afsluiting: s.afsluiting,
    ondertekening: t.ondertekening,
  });
  return { onderwerp: s.onderwerp(datum(event.start, t.locale)), html, text };
}

export const bevestigingsMail = (gegevens) => maak("bevestiging", gegevens);
export const wachtlijstMail = (gegevens) => maak("wachtlijst", gegevens);
export const herinneringsMail = (gegevens) => maak("herinnering", gegevens);
export const plekVrijMail = (gegevens) => maak("plek", gegevens);
export const afmeldMail = (gegevens) => maak("afmelding", gegevens);
