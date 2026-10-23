// Schrijfherinneringen voor het archief van Op doortocht. De dag na een bijeenkomst krijgt
// Sean een mail om er een stukje over te schrijven; een week later nog één, als er sinds
// die eerste mail niets aan het verhaal is toegevoegd. Wat al verstuurd is, staat in Blobs
// (sleutel "herinneringen"), zodat een tweede run niemand dubbel mailt.

import { opmaak, knop } from "./mails.mjs";
import { ANTWOORD_ADRES } from "./mail.mjs";

export const HERINNERING_SLEUTEL = "herinneringen";
const BEHEER = "https://andere-vragen.nl/beheer-doortocht.html";
const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

const dagen = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mooieDatum = (iso) => `${+iso.slice(8, 10)} ${MAANDEN[+iso.slice(5, 7) - 1]}`;

// Een vingerafdruk van het verhaal: verandert zodra er een blok bij komt of tekst wijzigt.
function vingerafdruk(e) {
  const tekst = JSON.stringify([e.blokken || [], e.omslag || null, e.samenvatting || ""]);
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + ":" + tekst.length;
}

// Welke herinneringen moeten vandaag weg? Bijeenkomsten uit dezelfde reeks die binnen drie dagen op
// elkaar volgen (5 en 6 november) tellen als één: alleen de laatste krijgt een mail, die de eerdere noemt.
// Vensters van een paar dagen, zodat een gemiste run de mail niet laat vallen.
export function teVersturen(gegevens, staat, vandaag) {
  const lijst = [];
  const alle = (gegevens.bijeenkomsten || []).filter((b) => b.zichtbaar !== false);
  for (const e of alle) {
    const datum = e.datum;
    const zelfdeReeks = (x) => e.reeks && x.reeks === e.reeks;
    if (alle.some((x) => x !== e && zelfdeReeks(x) && x.datum > datum && x.datum <= dagen(datum, 3))) continue;
    const data = alle.filter((x) => (x === e || zelfdeReeks(x)) && x.datum <= datum && x.datum >= dagen(datum, -3)).map((x) => x.datum).sort();
    const sleutel = e.id;
    // Vóór 23 okt heette een herinnering "<bijeenkomst>|<datum>"; die telt ook, anders komt hij dubbel.
    const oud = Object.keys(staat).find((k) => k.endsWith(`|${datum}`));
    const s = staat[sleutel] || (oud ? staat[oud] : {});
    if (!s.eerste && vandaag >= dagen(datum, 1) && vandaag <= dagen(datum, 3)) {
      lijst.push({ soort: "eerste", e, datum, sleutel, data });
    } else if (s.eerste && !s.tweede && vandaag >= dagen(datum, 8) && vandaag <= dagen(datum, 12) && s.verhaal === vingerafdruk(e)) {
      lijst.push({ soort: "tweede", e, datum, sleutel, data });
    }
  }
  return lijst;
}

function plekRegel(e, plekken) {
  const namen = e.plekken.map((id) => plekken.find((p) => p.id === id)?.naam).filter(Boolean);
  return namen.length === 1 ? `bij ${namen[0]}` : namen.join(" × ");
}

export function herinneringsMailDoortocht({ soort, e, data }, plekken) {
  const waar = plekRegel(e, plekken);
  const watWaar = `${e.soort}${waar.startsWith("bij ") ? " " : " · "}${waar}`;
  const kortWaar = e.plekken.map((id) => plekken.find((p) => p.id === id)?.naam).filter(Boolean).join(" × ");
  const themas = [e.naam, e.thema, e.vraag].filter(Boolean);
  const wanneer = data.length > 1 ? `${data.slice(0, -1).map((d) => +d.slice(8, 10)).join(", ")} en ${mooieDatum(data[data.length - 1])}` : mooieDatum(data[0]);
  const link = `${BEHEER}#bijeenkomst/${encodeURIComponent(e.id)}`;
  const rijen = [
    ["Wat", watWaar],
    ["Wanneer", wanneer],
    ...(themas.length ? [["Thema", [...new Set(themas)].join(" · ")]] : []),
  ].map(([label, tekst]) => [label, tekst.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])), tekst]);

  const eerste = soort === "eerste";
  const { html, text } = opmaak({
    titel: eerste ? `Hoe was het ${waar}?` : `Nog een stukje over ${kortWaar}?`,
    aanhef: "Hoi Sean,",
    intro: eerste
      ? "De bijeenkomst is geweest. Schrijf er een kort stukje over voor het archief van Op doortocht, nu het nog vers is, en zet er een paar foto's bij."
      : "Een week geleden was deze bijeenkomst, en in het archief staat er nog niets bij. Een paar zinnen en een foto zijn al genoeg.",
    rijen,
    alineas: [knop("Schrijf het stukje", link), "Het beheer opent direct bij deze bijeenkomst."],
    afsluiting: eerste ? "Veel schrijfplezier!" : "Daarna laat ik je met rust.",
    ondertekening: ["De site van andere vragen"],
  });
  return { onderwerp: eerste ? `Schrijf een stukje: ${watWaar}, ${wanneer}` : `Herinnering: nog geen stukje over ${kortWaar}, ${wanneer}`, html, text, naar: ANTWOORD_ADRES };
}

export { vingerafdruk };
