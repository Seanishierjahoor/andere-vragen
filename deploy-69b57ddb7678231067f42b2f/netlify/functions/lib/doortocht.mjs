// Gedeelde onderdelen voor "Op doortocht (portfolio)": opslag, startgegevens en controle.
// Alles staat in Netlify Blobs, zodat opslaan en foto's uploaden geen build kosten.

import { isProductie } from "./omgeving.mjs";

export function gegevensStore(context) {
  return isProductie(context) ? "doortocht" : "doortocht-staging";
}

export function fotoStore(context) {
  return isProductie(context) ? "doortocht-fotos" : "doortocht-fotos-staging";
}

export const GEGEVENS_SLEUTEL = "gegevens";

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

// Zolang er nog niets is opgeslagen, toont de pagina deze plekken en bijeenkomsten.
export const START = {
  plekken: [
    { id: "sap", naam: "SAP", adres: "Willem Buytewechstraat 61A, 3024 BM Rotterdam", lat: 51.9074322, lon: 4.4602528 },
    { id: "tent", naam: "TENT", adres: "Witte de Withstraat 50, 3012 BR Rotterdam", lat: 51.9153949, lon: 4.4770797 },
    { id: "nieuwe-instituut", naam: "Nieuwe Instituut", adres: "Museumpark 25, 3015 CB Rotterdam", lat: 51.9146161, lon: 4.4708953 },
    { id: "volkstuin", naam: "Streven naar Verbetering", adres: "Volkstuinvereniging, Rotterdam-Noord", lat: 51.9247071, lon: 4.4453405 },
    { id: "bakkerij", naam: "Studio de Bakkerij", adres: "Bergweg 283, 3037 EM Rotterdam", lat: 51.9339242, lon: 4.4735414 },
    { id: "filmlokaal", naam: "Filmlokaal Hammerstraat", adres: "Hammerstraat 17, 3036 MC Rotterdam", lat: 51.938143, lon: 4.48344677 },
  ],
  evenementen: [
    {
      id: "zwaan-kleef-aan", soort: "Filosofisch gesprek", naam: "Zwaan kleef aan", thema: "",
      plekken: ["tent", "sap"], momenten: [{ datum: "2026-08-15", plek: "", wat: "", thema: "" }], omslag: null, blokken: [], zichtbaar: true,
    },
    {
      id: "nieuwe-instituut-volkstuin", soort: "Filosofisch gesprek", naam: "After Summer School", thema: "Socratisch rondhangen",
      plekken: ["nieuwe-instituut", "volkstuin"], momenten: [{ datum: "2026-09-25", plek: "volkstuin", wat: "", thema: "" }], omslag: null, blokken: [], zichtbaar: true,
    },
    {
      id: "te-gast-bij-sap", soort: "Filosofisch gesprek", naam: "", thema: "",
      plekken: ["sap"],
      momenten: [
        { datum: "2026-10-08", plek: "sap", wat: "", thema: "Herhaling" },
        { datum: "2026-10-22", plek: "sap", wat: "", thema: "Simpel" },
        { datum: "2026-11-20", plek: "sap", wat: "", thema: "" },
      ],
      omslag: null, blokken: [], zichtbaar: true,
    },
    {
      id: "filmlokaal-sap", soort: "Filmvertoning en vervolggesprek", naam: "", thema: "",
      plekken: ["filmlokaal", "sap"],
      momenten: [
        { datum: "2026-11-05", plek: "filmlokaal", wat: "Filmvertoning", thema: "" },
        { datum: "2026-11-06", plek: "sap", wat: "Vervolggesprek", thema: "" },
      ],
      omslag: null, blokken: [], zichtbaar: true,
    },
    {
      id: "studio-de-bakkerij", soort: "Filosofisch gesprek", naam: "", thema: "",
      plekken: ["bakkerij"], momenten: ["2026-12-04", "2026-12-17"].map((datum) => ({ datum, plek: "bakkerij", wat: "", thema: "" })),
      omslag: null, blokken: [], zichtbaar: true,
    },
  ],
};

const tekst = (v, max) => String(v ?? "").slice(0, max);
const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const FOTO_ID = /^[a-z0-9-]{8,64}$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const fotoOfNull = (v) => (typeof v === "string" && FOTO_ID.test(v) ? v : null);

// Oude opslag (vóór okt 2026) had "titel" en "ondertitel"; nu zijn dat "soort" en "naam".
// "TENT × SAP: Zwaan kleef aan" wordt soort "Filosofisch gesprek" (uit de ondertitel) en naam "Zwaan kleef aan".
export function zetOm(gegevens) {
  for (const e of gegevens?.evenementen || []) {
    if (e.soort !== undefined) continue;
    e.soort = e.ondertitel || "Filosofisch gesprek";
    e.naam = String(e.titel || "").includes(":") ? e.titel.split(":").slice(1).join(":").trim() : "";
    delete e.titel;
    delete e.ondertitel;
  }
  return gegevens;
}

// Controleert en schoont de gegevens uit het beheerscherm. Geeft { fout } of { gegevens }.
export function controleer(invoer) {
  if (!invoer || !Array.isArray(invoer.plekken) || !Array.isArray(invoer.evenementen)) return { fout: "Ongeldige gegevens." };

  const plekIds = new Set();
  const plekken = [];
  for (const p of invoer.plekken) {
    if (!ID.test(p?.id || "")) return { fout: `Plek "${p?.naam || "?"}" heeft een ongeldige sleutel.` };
    if (plekIds.has(p.id)) return { fout: `Plek "${p.naam}" staat er twee keer in.` };
    if (!tekst(p.naam, 120).trim()) return { fout: "Elke plek heeft een naam nodig." };
    const lat = Number(p.lat), lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { fout: `Plek "${p.naam}" heeft nog geen plek op de kaart.` };
    plekIds.add(p.id);
    plekken.push({ id: p.id, naam: tekst(p.naam, 120).trim(), adres: tekst(p.adres, 200), lat, lon });
  }

  const evenementIds = new Set();
  const evenementen = [];
  for (const e of invoer.evenementen) {
    const label = tekst(e?.naam, 200) || tekst(e?.soort, 200) || "?";
    if (!ID.test(e?.id || "")) return { fout: `Bijeenkomst "${label}" heeft een ongeldige sleutel.` };
    if (evenementIds.has(e.id)) return { fout: `Twee bijeenkomsten hebben dezelfde sleutel (${e.id}).` };
    if (!tekst(e.soort, 200).trim()) return { fout: "Geef bij elke bijeenkomst de soort op, bijvoorbeeld Filosofisch gesprek." };
    const eigenPlekken = (Array.isArray(e.plekken) ? e.plekken : []).filter((id) => plekIds.has(id));
    if (!eigenPlekken.length) return { fout: `Kies bij "${label}" minstens één plek.` };
    const momenten = (Array.isArray(e.momenten) ? e.momenten : [])
      .filter((m) => DATUM.test(m?.datum || ""))
      .map((m) => ({ datum: m.datum, plek: plekIds.has(m.plek) ? m.plek : "", wat: tekst(m.wat, 120), thema: tekst(m.thema, 300) }))
      .sort((a, b) => a.datum.localeCompare(b.datum));
    if (!momenten.length) return { fout: `Geef bij "${label}" minstens één datum op.` };

    const blokken = [];
    for (const b of Array.isArray(e.blokken) ? e.blokken : []) {
      if (b?.type === "tekst") blokken.push({ type: "tekst", tekst: tekst(b.tekst, 20000) });
      else if (b?.type === "foto" && fotoOfNull(b.foto)) blokken.push({ type: "foto", foto: b.foto, onderschrift: tekst(b.onderschrift, 300) });
      else if (b?.type === "reeks") {
        const fotos = (Array.isArray(b.fotos) ? b.fotos : [])
          .filter((f) => fotoOfNull(f?.foto))
          .slice(0, 30)
          .map((f) => ({ foto: f.foto, onderschrift: tekst(f.onderschrift, 300) }));
        if (fotos.length) blokken.push({ type: "reeks", fotos });
      } else if (b?.type === "citaat") blokken.push({ type: "citaat", tekst: tekst(b.tekst, 1000), bron: tekst(b.bron, 200) });
    }

    evenementIds.add(e.id);
    evenementen.push({
      id: e.id,
      soort: tekst(e.soort, 200).trim(),
      naam: tekst(e.naam, 200).trim(),
      thema: tekst(e.thema, 300),
      samenvatting: tekst(e.samenvatting, 600),
      plekken: eigenPlekken,
      momenten,
      omslag: fotoOfNull(e.omslag),
      blokken: blokken.slice(0, 80),
      zichtbaar: e.zichtbaar !== false,
    });
  }

  return { gegevens: { plekken, evenementen } };
}
