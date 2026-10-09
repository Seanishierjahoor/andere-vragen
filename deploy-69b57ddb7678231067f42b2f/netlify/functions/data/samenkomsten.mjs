// Lijst van komende "Filosofische gesprekken"-samenkomsten.
// Beheren via /beheer-samenkomsten.html (wachtwoord vereist) — dat schrijft dit
// bestand automatisch weg. Handmatig bewerken kan ook: kopieer een object en pas
// de velden aan.
//
// - id: uniek, wijzig dit niet voor een bestaande samenkomst (koppelt aanmeldingen)
// - start: ISO-datumtijd MET UTC-offset (+02:00 zomertijd / +01:00 wintertijd)
// - duurMinuten: gebruikt voor de agenda-uitnodiging (ics/Google Calendar)
// - locatie: vrije tekst
// - adres: straat, postcode en plaats; wordt een klikbare kaartlink op site en in mails
// - thema: vrije tekst, mag leeg zijn (dan toont de site "wordt nog aangekondigd")
// - capaciteit: aantal plekken; wordt nooit als getal getoond, alleen gebruikt om
//   "open"/"vol" te bepalen

export default [
  {
    "id": "2026-10-08",
    "start": "2026-10-08T19:00:00+02:00",
    "duurMinuten": 120,
    "locatie": "Social Art Platform (SAP)",
    "adres": "Willem Buytewechstraat 61A, 3024 BM Rotterdam",
    "thema": "Herhaling",
    "capaciteit": 15
  },
  {
    "id": "sk-mupicjscf3tv",
    "start": "2026-10-22T19:00:00+02:00",
    "duurMinuten": 120,
    "locatie": "Social Art Platform (SAP)",
    "adres": "Willem Buytewechstraat 61A, 3024 BM Rotterdam",
    "thema": "",
    "capaciteit": 15
  }
];
