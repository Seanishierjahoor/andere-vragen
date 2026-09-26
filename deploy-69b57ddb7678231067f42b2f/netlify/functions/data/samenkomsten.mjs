// Lijst van komende "Filosofische gesprekken"-samenkomsten.
// Beheren via /beheer-samenkomsten.html (wachtwoord vereist) — dat schrijft dit
// bestand automatisch weg. Handmatig bewerken kan ook: kopieer een object en pas
// de velden aan.
//
// - id: uniek, bijvoorbeeld de datum in ISO-vorm (YYYY-MM-DD)
// - start: ISO-datumtijd MET UTC-offset (+02:00 zomertijd / +01:00 wintertijd in Nederland),
//          anders wordt het tijdstip op sommige apparaten verkeerd omgerekend
// - duurMinuten: gebruikt voor de agenda-uitnodiging (ics/Google Calendar)
// - locatie: vrije tekst
// - capaciteit: aantal plekken; wordt nooit als getal getoond, alleen gebruikt om
//   "open"/"vol" te bepalen

export default [
  {
    id: "2026-10-08",
    start: "2026-10-08T19:00:00+02:00",
    duurMinuten: 120,
    locatie: "Social Art Platform (SAP), Rotterdam",
    capaciteit: 15,
  },
];
