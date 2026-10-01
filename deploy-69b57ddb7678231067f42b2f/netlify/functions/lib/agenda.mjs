// Agenda-uitnodiging (.ics) als bijlage bij mails met een bevestigde plek.

const TEKST = {
  nl: {
    titel: "Filosofische gesprekken, Andere Vragen",
    beschrijving: "Filosofisch gesprek in een kleine groep. https://andere-vragen.nl/samenkomsten.html",
    bestand: "filosofische-gesprekken.ics",
  },
  en: {
    titel: "Philosophical conversations, Andere Vragen",
    beschrijving: "Philosophical conversation in a small group. https://andere-vragen.nl/gatherings.html",
    bestand: "philosophical-conversations.ics",
  },
};

function utc(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function esc(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function volledigeLocatie(event) {
  return event.adres ? `${event.locatie}, ${event.adres}` : event.locatie;
}

export function icsBijlage(event, lang = "nl") {
  const t = TEKST[lang] || TEKST.nl;
  const start = new Date(event.start);
  const eind = new Date(start.getTime() + (event.duurMinuten || 120) * 60000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Andere Vragen//Samenkomsten//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@andere-vragen.nl`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(eind)}`,
    `SUMMARY:${esc(t.titel)}`,
    `LOCATION:${esc(volledigeLocatie(event))}`,
    `DESCRIPTION:${esc(t.beschrijving)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return { filename: t.bestand, content: Buffer.from(ics, "utf-8").toString("base64") };
}
