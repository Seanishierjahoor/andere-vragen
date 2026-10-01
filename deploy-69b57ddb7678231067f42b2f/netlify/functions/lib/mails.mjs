// Teksten en opmaak van de mails aan deelnemers: bevestiging, wachtlijst en de
// herinnering een dag van tevoren. Zelfde stijl als de site: crème achtergrond, wit
// vlak met dunne rand, schreefletter voor de titel en een infoblok met kleine kopjes.
//
// Alles tussen ${...} wordt automatisch ingevuld uit de aanmelding (naam, eten) en
// uit de samenkomst in de beheer-app (datum, locatie, adres, thema).

const CONTACT = "anderevragen@proton.me";

const T = {
  nl: {
    locale: "nl-NL",
    hoi: (naam) => (naam ? `Hoi ${naam},` : "Hoi,"),
    labels: { wanneer: "Wanneer", waar: "Waar", thema: "Thema", eten: "Eten", kosten: "Kosten" },
    tijd: (van, tot) => `${van} tot ${tot}`,
    geenThema: "Wordt nog aangekondigd",
    etenJa: "Je eet mee, om 18:00. Vegetarisch, vrijwillige bijdrage.",
    kosten: "Vrijwillige bijdrage, ter plekke",
    ondertekening: ["Sean", "Andere Vragen"],

    bevestiging: {
      onderwerp: (datum) => `Je bent aangemeld voor ${datum} | Andere Vragen`,
      titel: "Leuk dat je komt!",
      alineas: (eten) => [
        "Je hoeft niets voor te bereiden. Kom zoals je bent, zin om mee te denken is genoeg.",
        ...(eten ? [] : [`Toch zin om mee te eten? We eten om 18:00. Mail dan even naar ${CONTACT}.`]),
        "In de bijlage zit een agenda-uitnodiging. De dag van tevoren krijg je nog een herinnering.",
        `Kun je toch niet komen? Mail dan even naar ${CONTACT}, dan kan iemand van de wachtlijst je plek krijgen.`,
      ],
      afsluiting: "Tot dan!",
    },

    wachtlijst: {
      onderwerp: (datum) => `Je staat op de wachtlijst voor ${datum} | Andere Vragen`,
      titel: "Je staat op de wachtlijst",
      alineas: () => [
        "Dank je wel voor je aanmelding! Deze avond zit op dit moment vol, dus je staat op de wachtlijst.",
        "Komt er een plek vrij, dan hoor je het meteen.",
      ],
      afsluiting: "Hartelijke groet,",
    },

    herinnering: {
      onderwerp: () => "Morgen: filosofisch gesprek | Andere Vragen",
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
    ondertekening: ["Sean", "Andere Vragen"],

    bevestiging: {
      onderwerp: (datum) => `You're signed up for ${datum} | Andere Vragen`,
      titel: "Great that you're coming!",
      alineas: (eten) => [
        "You don't need to prepare anything. Come as you are, feeling like thinking along is enough.",
        ...(eten ? [] : [`Feel like joining for dinner after all? We eat at 18:00. Just email ${CONTACT}.`]),
        "A calendar invite is attached. You'll get a reminder the day before.",
        `Can't make it after all? Just email ${CONTACT}, so someone on the waiting list can take your spot.`,
      ],
      afsluiting: "See you then!",
    },

    wachtlijst: {
      onderwerp: (datum) => `You're on the waiting list for ${datum} | Andere Vragen`,
      titel: "You're on the waiting list",
      alineas: () => [
        "Thank you for signing up! This evening is full at the moment, so you're on the waiting list.",
        "If a spot opens up, you'll hear right away.",
      ],
      afsluiting: "Warm regards,",
    },

    herinnering: {
      onderwerp: () => "Tomorrow: philosophical conversation | Andere Vragen",
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

  const waarHtml = esc(event.locatie) + (event.adres ? `<br><a href="${mapsUrl(event.adres)}" style="color:#1a1a1a;">${esc(event.adres)}</a>` : "");
  const waarTekst = event.adres ? `${event.locatie}, ${event.adres} (${mapsUrl(event.adres)})` : event.locatie;

  const thema = (event.thema || "").trim();
  const rijen = [
    [t.labels.wanneer, esc(wanneer), wanneer],
    [t.labels.waar, waarHtml, waarTekst],
    [t.labels.thema, thema ? esc(thema) : `<em style="color:#5a5a5a;">${esc(t.geenThema)}</em>`, thema || t.geenThema],
  ];
  if (eten) rijen.push([t.labels.eten, esc(t.etenJa), t.etenJa]);
  if (metKosten) rijen.push([t.labels.kosten, esc(t.kosten), t.kosten]);
  return rijen;
}

function opmaak({ titel, aanhef, intro, rijen, alineas, afsluiting, ondertekening }) {
  const p = (tekst, extra = "") =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;${extra}">${esc(tekst)}</p>`;

  const info = rijen.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 24px;border-top:1px solid #ece7df;">${rijen
        .map(
          ([label, html]) =>
            `<tr><td style="padding:10px 12px 10px 0;width:90px;vertical-align:top;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#5a5a5a;border-bottom:1px solid #ece7df;">${esc(label)}</td><td style="padding:10px 0;vertical-align:top;font-size:15px;line-height:1.5;color:#1a1a1a;border-bottom:1px solid #ece7df;">${html}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fcfaf7;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fcfaf7;"><tr><td style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #d9d2c5;">
<tr><td style="padding:36px 32px 28px;font-family:Helvetica,Arial,sans-serif;">
<p style="margin:0 0 20px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#4a5d4e;">Andere Vragen</p>
<h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:normal;font-size:28px;line-height:1.2;color:#1a1a1a;">${esc(titel)}</h1>
${p(aanhef)}
${intro ? p(intro) : ""}
${info}
${alineas.map((a) => p(a)).join("\n")}
${p(afsluiting, "margin-top:24px;")}
<p style="margin:0;font-size:15px;line-height:1.5;color:#1a1a1a;">${ondertekening.map(esc).join("<br>")}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    titel,
    "",
    aanhef,
    ...(intro ? ["", intro] : []),
    "",
    ...rijen.map(([label, , tekst]) => `${label}: ${tekst}`),
    "",
    ...alineas.flatMap((a) => [a, ""]),
    afsluiting,
    ...ondertekening,
  ].join("\n");

  return { html, text };
}

function maak(soort, { naam, eten, event, lang }) {
  const t = T[lang] || T.nl;
  const s = t[soort];
  const metInfo = soort !== "wachtlijst";
  const { html, text } = opmaak({
    titel: s.titel,
    aanhef: t.hoi(voornaam(naam)),
    intro: s.intro,
    rijen: metInfo ? infoRijen(t, event, eten, soort === "bevestiging") : [],
    alineas: s.alineas(eten),
    afsluiting: s.afsluiting,
    ondertekening: t.ondertekening,
  });
  return { onderwerp: s.onderwerp(datum(event.start, t.locale)), html, text };
}

export const bevestigingsMail = (gegevens) => maak("bevestiging", gegevens);
export const wachtlijstMail = (gegevens) => maak("wachtlijst", gegevens);
export const herinneringsMail = (gegevens) => maak("herinnering", gegevens);
