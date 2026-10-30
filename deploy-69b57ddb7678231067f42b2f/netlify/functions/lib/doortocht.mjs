// Gedeelde onderdelen voor "Op doortocht (portfolio)": opslag, startgegevens, omzetten en controle.
// Alles staat in Netlify Blobs, zodat opslaan en foto's uploaden geen build kosten.
//
// Model (versie 2, okt 2026): elke datum is een eigen bijeenkomst met een eigen verhaal. Bijeenkomsten die
// bij elkaar horen, delen een "reeks" (bijvoorbeeld "Te gast bij SAP"). Elke plek heeft een vaste
// beschrijving die onderaan elke bijeenkomst op die plek staat.

import { isProductie } from "./omgeving.mjs";
import { PLEK_TEKSTEN, BIJEENKOMST_TEKSTEN } from "./doortocht-proefteksten.mjs";

export function gegevensStore(context) {
  return isProductie(context) ? "doortocht" : "doortocht-staging";
}

export function fotoStore(context) {
  return isProductie(context) ? "doortocht-fotos" : "doortocht-fotos-staging";
}

export const GEGEVENS_SLEUTEL = "gegevens";

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

const bijeenkomst = (velden) => ({
  soort: "Filosofisch gesprek", naam: "", vraag: "", thema: "", reeks: "", plek: "", wat: "",
  samenvatting: "", omslag: null, blokken: [], zichtbaar: true, ...velden,
});

// Zolang er nog niets is opgeslagen, toont de pagina deze plekken en bijeenkomsten.
export const START = {
  versie: 2,
  plekken: [
    { id: "sap", naam: "SAP", adres: "Willem Buytewechstraat 61A, 3024 BM Rotterdam", lat: 51.9074322, lon: 4.4602528, beschrijving: "" },
    { id: "tent", naam: "TENT", adres: "Coolhaven 32, 3024 AC Rotterdam", lat: 51.9076, lon: 4.454, beschrijving: "" },
    { id: "nieuwe-instituut", naam: "Nieuwe Instituut", adres: "Museumpark 25, 3015 CB Rotterdam", lat: 51.9146161, lon: 4.4708953, beschrijving: "" },
    { id: "volkstuin", naam: "Streven naar Verbetering", adres: "Volkstuinvereniging, Rotterdam-Noord", lat: 51.9247071, lon: 4.4453405, beschrijving: "" },
    { id: "bakkerij", naam: "Studio de Bakkerij", adres: "Bergweg 283, 3037 EM Rotterdam", lat: 51.9339242, lon: 4.4735414, beschrijving: "" },
    { id: "filmlokaal", naam: "Filmlokaal Hammerstraat", adres: "Hammerstraat 17, 3036 MC Rotterdam", lat: 51.938143, lon: 4.48344677, beschrijving: "" },
  ],
  bijeenkomsten: [
    bijeenkomst({ id: "zwaan-kleef-aan", datum: "2026-08-15", naam: "Zwaan kleef aan", plekken: ["tent", "sap"],
      vraag: "Wat is vasthouden? En wat is loslaten? En wat hebben die twee met elkaar te maken?" }),
    bijeenkomst({ id: "nieuwe-instituut-volkstuin", datum: "2026-09-25", naam: "After Summer School", thema: "Socratisch rondhangen",
      plekken: ["nieuwe-instituut", "volkstuin"], plek: "volkstuin", vraag: "Why does imposed silence take so long?" }),
    bijeenkomst({ id: "sap-2026-10-08", datum: "2026-10-08", reeks: "Te gast bij SAP", thema: "Herhaling", plekken: ["sap"],
      vraag: "Moeten machines rechten krijgen?" }),
    bijeenkomst({ id: "sap-2026-10-22", datum: "2026-10-22", reeks: "Te gast bij SAP", thema: "Simpel", plekken: ["sap"],
      vraag: "Zitten er in de simpelste dingen het grootste geluk?" }),
    bijeenkomst({ id: "filmlokaal-2026-11-05", datum: "2026-11-05", reeks: "Filmlokaal × SAP", soort: "Filmvertoning",
      plekken: ["filmlokaal", "sap"], plek: "filmlokaal", wat: "Filmvertoning" }),
    bijeenkomst({ id: "sap-2026-11-06", datum: "2026-11-06", reeks: "Filmlokaal × SAP", soort: "Vervolggesprek",
      plekken: ["filmlokaal", "sap"], plek: "sap", wat: "Vervolggesprek" }),
    bijeenkomst({ id: "sap-2026-11-20", datum: "2026-11-20", reeks: "Te gast bij SAP", plekken: ["sap"] }),
    bijeenkomst({ id: "bakkerij-2026-12-04", datum: "2026-12-04", reeks: "Te gast bij Studio de Bakkerij", plekken: ["bakkerij"] }),
    bijeenkomst({ id: "bakkerij-2026-12-17", datum: "2026-12-17", reeks: "Te gast bij Studio de Bakkerij", plekken: ["bakkerij"] }),
  ],
};

// Proefteksten erin als start.
for (const p of START.plekken) p.beschrijving = PLEK_TEKSTEN[p.id] || "";
for (const b of START.bijeenkomsten) b.samenvatting = BIJEENKOMST_TEKSTEN[b.id] || "";

const tekst = (v, max) => String(v ?? "").slice(0, max);
const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const FOTO_ID = /^[a-z0-9-]{8,64}$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const procent = (v) => (Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Math.round(Number(v)))) : 50);
const fotoOfNull = (v) => (typeof v === "string" && FOTO_ID.test(v) ? v : null);

// Zet oudere opslag om naar versie 2:
// - heel oud (vóór 21 okt): "titel"/"ondertitel" worden "soort"/"naam";
// - versie 1 (tot 23 okt): een bijeenkomst met meer data ("momenten") wordt per datum een eigen bijeenkomst,
//   samen in een reeks. Verhaal, omslag en samenvatting gaan mee naar de eerste datum.
const TENT_PIN = { lat: 51.9076, lon: 4.454 };
export function zetOm(gegevens) {
  if (!gegevens) return gegevens;
  for (const p of gegevens.plekken || []) {
    if (p.beschrijving === undefined) p.beschrijving = "";
    // TENT stond eerst per vergissing op de Witte de Withstraat; het juiste adres is Coolhaven 32.
    if (p.id === "tent" && /Witte de Withstraat/.test(p.adres || "")) Object.assign(p, { adres: "Coolhaven 32, 3024 AC Rotterdam", lat: TENT_PIN.lat, lon: TENT_PIN.lon });
    // De pin van TENT staat bewust iets links van SAP (Sean, 30 okt): op het adres zelf vallen de twee pins
    // over elkaar en is het samenwerkingslijntje niet te zien. Alleen als hij nog precies op het adres staat.
    if (p.id === "tent" && p.lat === 51.9079129 && p.lon === 4.4605758) Object.assign(p, TENT_PIN);
  }
  if (gegevens.versie === 2 && Array.isArray(gegevens.bijeenkomsten)) return gegevens;

  // Versie 1 waarin nog niets is geschreven (alleen de oorspronkelijke startgegevens): dan meteen de nieuwe
  // start nemen, met proefteksten, de juiste reeksen en TENT op de goede plek.
  const ietsGeschreven = (gegevens.evenementen || []).some((e) => (e.blokken || []).length || e.omslag || (e.samenvatting || "").trim())
    || (gegevens.plekken || []).some((p) => (p.beschrijving || "").trim());
  if (!ietsGeschreven && (gegevens.plekken || []).every((p) => START.plekken.some((x) => x.id === p.id))) return structuredClone(START);

  const naamVan = (id) => (gegevens.plekken || []).find((p) => p.id === id)?.naam || id;
  const bijeenkomsten = [];
  for (const e of gegevens.evenementen || []) {
    if (e.soort === undefined) {
      e.soort = e.ondertitel || "Filosofisch gesprek";
      e.naam = String(e.titel || "").includes(":") ? e.titel.split(":").slice(1).join(":").trim() : "";
    }
    const momenten = [...(e.momenten || [])].sort((a, b) => a.datum.localeCompare(b.datum));
    const reeks = momenten.length > 1 ? e.naam || `Te gast bij ${e.plekken.map(naamVan).join(" × ")}` : "";
    momenten.forEach((m, i) => bijeenkomsten.push(bijeenkomst({
      id: momenten.length > 1 ? `${e.id}-${m.datum}` : e.id,
      datum: m.datum, soort: m.wat || e.soort, naam: momenten.length > 1 ? "" : e.naam,
      thema: m.thema || e.thema || "", reeks, plekken: e.plekken, plek: m.plek || "", wat: m.wat || "",
      samenvatting: i === 0 ? e.samenvatting || "" : "", omslag: i === 0 ? e.omslag || null : null,
      blokken: i === 0 ? e.blokken || [] : [], zichtbaar: e.zichtbaar !== false,
    })));
  }
  return { versie: 2, plekken: gegevens.plekken || [], bijeenkomsten };
}

function schoneBlokken(invoer) {
  const blokken = [];
  for (const b of Array.isArray(invoer) ? invoer : []) {
    if (b?.type === "tekst") blokken.push({ type: "tekst", tekst: tekst(b.tekst, 20000) });
    else if (b?.type === "foto" && fotoOfNull(b.foto)) blokken.push({ type: "foto", foto: b.foto, onderschrift: tekst(b.onderschrift, 300) });
    else if (b?.type === "reeks") {
      // Een reeks is een strook kaarten: foto's en (sinds 30 okt) tekstkaarten, in de gekozen volgorde.
      // Sinds 30 okt is het hele verhaal één strook: foto's, tekstkaarten en citaten hangen eraan.
      const fotos = (Array.isArray(b.fotos) ? b.fotos : [])
        .filter((f) => fotoOfNull(f?.foto) || tekst(f?.tekst, 8000).trim() || tekst(f?.citaat, 1000).trim())
        .slice(0, 60)
        .map((f) => (fotoOfNull(f.foto) ? { foto: f.foto, onderschrift: tekst(f.onderschrift, 300) }
          : tekst(f.citaat, 1000).trim() ? { citaat: tekst(f.citaat, 1000), bron: tekst(f.bron, 200) }
          : { tekst: tekst(f.tekst, 8000) }));
      // Fotocredit onder de strook: wie de foto's maakte, met eventueel een link naar diens website.
      const credit = tekst(b.credit, 200).trim();
      let link = tekst(b.creditLink, 500).trim();
      if (link && !/^https?:\/\//i.test(link) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(link)) link = "https://" + link;
      if (fotos.length) blokken.push({ type: "reeks", fotos, credit, creditLink: credit && /^https?:\/\/\S+$/.test(link) ? link : "" });
    } else if (b?.type === "citaat") blokken.push({ type: "citaat", tekst: tekst(b.tekst, 1000), bron: tekst(b.bron, 200) });
  }
  return blokken.slice(0, 80);
}

// Controleert en schoont de gegevens uit het beheerscherm. Geeft { fout } of { gegevens }.
export function controleer(invoer) {
  if (!invoer || !Array.isArray(invoer.plekken) || !Array.isArray(invoer.bijeenkomsten)) return { fout: "Ongeldige gegevens." };

  const plekIds = new Set();
  const plekken = [];
  for (const p of invoer.plekken) {
    if (!ID.test(p?.id || "")) return { fout: `Plek "${p?.naam || "?"}" heeft een ongeldige sleutel.` };
    if (plekIds.has(p.id)) return { fout: `Plek "${p.naam}" staat er twee keer in.` };
    if (!tekst(p.naam, 120).trim()) return { fout: "Elke plek heeft een naam nodig." };
    const lat = Number(p.lat), lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { fout: `Plek "${p.naam}" heeft nog geen plek op de kaart.` };
    plekIds.add(p.id);
    plekken.push({ id: p.id, naam: tekst(p.naam, 120).trim(), adres: tekst(p.adres, 200), lat, lon, beschrijving: tekst(p.beschrijving, 8000),
      foto: fotoOfNull(p.foto), fotocredit: tekst(p.fotocredit, 200).trim(), ondertitel: tekst(p.ondertitel, 120).trim(),
      // Focuspunt van de plekfoto in procenten (welk deel in beeld blijft als de foto wordt bijgesneden)
      focus: { x: procent(p.focus?.x), y: procent(p.focus?.y) } });
  }

  const ids = new Set();
  const bijeenkomsten = [];
  for (const b of invoer.bijeenkomsten) {
    const label = [tekst(b?.naam, 200) || tekst(b?.soort, 200) || "?", b?.datum].filter(Boolean).join(", ");
    if (!ID.test(b?.id || "")) return { fout: `Bijeenkomst "${label}" heeft een ongeldige sleutel.` };
    if (ids.has(b.id)) return { fout: `Twee bijeenkomsten hebben dezelfde sleutel (${b.id}).` };
    if (!DATUM.test(b.datum || "")) return { fout: `Geef bij "${label}" een datum op.` };
    if (!tekst(b.soort, 200).trim()) return { fout: `Geef bij "${label}" de soort op, bijvoorbeeld Filosofisch gesprek.` };
    const eigenPlekken = (Array.isArray(b.plekken) ? b.plekken : []).filter((id) => plekIds.has(id));
    if (!eigenPlekken.length) return { fout: `Kies bij "${label}" minstens één plek.` };
    ids.add(b.id);
    bijeenkomsten.push({
      id: b.id,
      datum: b.datum,
      soort: tekst(b.soort, 200).trim(),
      naam: tekst(b.naam, 200).trim(),
      vraag: tekst(b.vraag, 400).trim(),
      thema: tekst(b.thema, 300).trim(),
      reeks: tekst(b.reeks, 200).trim(),
      plekken: eigenPlekken,
      plek: eigenPlekken.includes(b.plek) ? b.plek : "",
      wat: tekst(b.wat, 120).trim(),
      samenvatting: tekst(b.samenvatting, 4000),
      omslag: fotoOfNull(b.omslag),
      omslagFocus: { x: procent(b.omslagFocus?.x), y: procent(b.omslagFocus?.y) },
      blokken: schoneBlokken(b.blokken),
      zichtbaar: b.zichtbaar !== false,
    });
  }
  bijeenkomsten.sort((a, b) => a.datum.localeCompare(b.datum));
  return { gegevens: { versie: 2, plekken, bijeenkomsten } };
}
