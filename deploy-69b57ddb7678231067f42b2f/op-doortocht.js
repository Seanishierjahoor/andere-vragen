// Op doortocht (portfolio). Drie standen op één scherm:
//   omslag  (#)            rustige kaart, grote titel, één uitnodiging om te klikken
//   kaart   (#kaart)       de lappendeken komt tot leven: pins, slepen en zoomen, index rechts
//   verhaal (#verhaal/id)  schermvullend artikel; archief (#archief) is alles onder elkaar, als een cv
// Gegevens komen uit /.netlify/functions/get-doortocht (beheer: /beheer-doortocht.html).

import { tekenKaart, maakSvg } from './op-doortocht-kaart.js';

const VANDAAG = new Date().toLocaleDateString('sv-SE'); // JJJJ-MM-DD in lokale tijd
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const RUSTIG = matchMedia('(prefers-reduced-motion: reduce)');
// Strookjes: namen van de plekken altijd zichtbaar op touchscreens (en in een smal venster),
// omdat je daar niet kunt aanwijzen. Op false zetten om terug te gaan naar alleen pins.
const STROOKJES = true;
const AANRAAK = matchMedia('(hover: none), (max-width: 860px)');
const SMAL = matchMedia('(max-width: 860px)');

const kortDatum = (iso) => `${+iso.slice(8, 10)} ${KORT[+iso.slice(5, 7) - 1]}`;
const langDatum = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
};
const opsomming = (lijst) => lijst.length < 2 ? lijst.join('') : lijst.slice(0, -1).join(', ') + ' en ' + lijst[lijst.length - 1];
// "5 en 6 november", "8 oktober, 22 oktober en 20 november": de maand alleen waar hij wisselt.
const dataInJaar = (data) => opsomming(data.map((iso, i) => {
    const volgende = data[i + 1];
    return volgende && volgende.slice(5, 7) === iso.slice(5, 7) ? `${+iso.slice(8, 10)}` : `${+iso.slice(8, 10)} ${MAANDEN[+iso.slice(5, 7) - 1]}`;
}));
const veilig = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fotoUrl = (id) => '/doortocht-foto/' + encodeURIComponent(id);
// Alinea's bij een lege regel, een enkele enter wordt een regelafbreking.
const alineas = (tekst) => String(tekst || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map((a) => `<p>${veilig(a).replace(/\n/g, '<br>')}</p>`).join('');

const $ = (id) => document.getElementById(id);
const podium = $('podium');
const kaartVak = $('kaart');
const index = $('index');
const indexVak = $('index-vak');
const pinkaart = $('pinkaart');
const overlay = $('verhaal');

// Geheime ingang: drie keer snel op "(portfolio)" klikken opent het beheer.
let tikken = [];
document.querySelector('.dt-geheim')?.addEventListener('click', () => {
    const nu = Date.now();
    tikken = [...tikken.filter((t) => nu - t < 1200), nu];
    if (tikken.length >= 3) location.href = 'beheer-doortocht.html';
});

const [kaart, gegevens] = await Promise.all([
    tekenKaart(kaartVak, { rand: false, lijnwerk: true }),
    fetch('/.netlify/functions/get-doortocht').then((r) => r.json()).catch(() => null),
]);

const PLEKKEN = Object.fromEntries((gegevens?.plekken || []).map((p) => [p.id, p]));
const EVENEMENTEN = (gegevens?.evenementen || [])
    .map((e) => ({ ...e, plekken: e.plekken.filter((id) => PLEKKEN[id]), data: [...new Set(e.momenten.map((m) => m.datum))].sort() }))
    .filter((e) => e.plekken.length && e.data.length)
    .sort((a, b) => a.data[0].localeCompare(b.data[0]));
// In de index en het kaartje bij een pin krijgt elke datum een eigen blokje, met een eigen nummer
// (chronologisch) en het thema en "wat" van die datum.
const DATUMRIJEN = EVENEMENTEN.flatMap((e) => e.data.map((d) => ({ e, d, m: e.momenten.find((m) => m.datum === d) || {} })))
    .sort((a, b) => a.d.localeCompare(b.d));
DATUMRIJEN.forEach((r, i) => { r.nr = String(i + 1).padStart(2, '0'); });
const komtNog = (e) => e.data[e.data.length - 1] >= VANDAAG;
const plekNamen = (e) => e.plekken.map((id) => PLEKKEN[id].naam).join(' × ');
const plekRegel = (e) => e.plekken.length === 1 ? 'bij ' + PLEKKEN[e.plekken[0]].naam : plekNamen(e);
// Naam en thema's van een bijeenkomst (eventueel alleen van bepaalde data) als HTML, zonder dubbelen en
// met een label voor de thema's: "After Summer School · Thema: Socratisch rondhangen". Zo zie je meteen
// dat "Simpel" of "Herhaling" het thema van de avond was.
function naamEnThemaHtml(e, data = e.data) {
    const naam = String(e.naam || '').trim();
    const gezien = new Set([naam.toLowerCase()]);
    const themas = [e.thema, ...e.momenten.filter((m) => data.includes(m.datum)).map((m) => m.thema)]
        .map((t) => String(t || '').trim()).filter((t) => t && !gezien.has(t.toLowerCase()) && gezien.add(t.toLowerCase()));
    const delen = [];
    if (naam) delen.push(veilig(naam));
    if (themas.length) delen.push(`<span class="dt-themalabel">${themas.length > 1 ? "Thema's" : 'Thema'}:</span> ${veilig(themas.join(', '))}`);
    return delen.join(' · ');
}
// Korte naam voor koppen en de paginatitel: de eigen naam, anders het thema, anders de soort.
const titelVan = (e) => e.naam || e.thema || e.soort;

// --- Beeld: zoomen en pannen via de viewBox -----------------------------------

const { svg, BREED, HOOG, naarKaart } = kaart;
svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
svg.classList.add('lijnwerk'); // de omslag is kleurloos

// --- Afbeeldingen van de kaart: tijdens bewegen schuift de browser een plaatje, geen vectorkaart ----

const defs = svg.querySelector('defs');
defs.insertAdjacentHTML('beforeend', `
    <radialGradient id="zachte-rand"><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="onthul" maskUnits="userSpaceOnUse" x="0" y="0" width="${BREED}" height="${HOOG}">
        <rect width="${BREED}" height="${HOOG}" fill="#000"/><circle id="onthul-cirkel" r="0" fill="url(#zachte-rand)"/>
    </mask>`);
const rasterLijn = maakSvg('image', { id: 'raster-lijn', class: 'raster', width: BREED, height: HOOG, preserveAspectRatio: 'none' });
const rasterKleur = maakSvg('image', { id: 'raster-kleur', class: 'raster', width: BREED, height: HOOG, preserveAspectRatio: 'none' });
svg.querySelector('.kaartvector').before(rasterLijn, rasterKleur);
const klaar = { lijn: false, kleur: false };
(async () => {
    const schaal = SMAL.matches ? 1 : 1.5;
    try {
        rasterLijn.setAttribute('href', await kaart.maakAfbeelding({ lijnwerk: true, schaal }));
        klaar.lijn = true;
        rasterKleur.setAttribute('href', await kaart.maakAfbeelding({ schaal }));
        klaar.kleur = true;
    } catch (fout) {
        console.warn('Kaartafbeelding maken lukte niet; de vectorkaart blijft staan.', fout);
    }
})();

// Tijdens bewegen het plaatje tonen; even stil, dan weer de scherpe vectorkaart.
let stilTimer = null;
function beweeg() {
    const nodig = podium.dataset.stand === 'kaart' ? klaar.kleur : klaar.lijn;
    if (!nodig && !svg.classList.contains('overgang')) return;
    svg.dataset.laag = 'raster';
    clearTimeout(stilTimer);
    stilTimer = setTimeout(() => { if (!svg.classList.contains('overgang')) svg.dataset.laag = 'vector'; }, 220);
}
const gebruikt = Object.values(PLEKKEN).filter((p) => EVENEMENTEN.some((e) => e.plekken.includes(p.id)));
const xyVan = Object.fromEntries(gebruikt.map((p) => [p.id, naarKaart(p.lat, p.lon)]));
const MIN_BREEDTE = 220;

let beeld = { x: 0, y: 0, w: BREED, h: HOOG };
const schermMaat = () => [kaartVak.clientWidth || 1, kaartVak.clientHeight || 1];
const eenheidPerPixel = () => beeld.w / schermMaat()[0];

// Houdt het beeld binnen de kaart en in de verhouding van het scherm.
function begrens({ x, y, w }) {
    const [cw, ch] = schermMaat();
    w = Math.min(Math.max(w, MIN_BREEDTE), BREED);
    let h = w * ch / cw;
    if (h > HOOG) { h = HOOG; w = h * cw / ch; }
    return { x: Math.min(Math.max(x, 0), BREED - w), y: Math.min(Math.max(y, 0), HOOG - h), w, h };
}
// Beeld met breedte w waarin (cx, cy) op schermpositie (ankerX, ankerY) valt (0..1).
const beeldRond = (cx, cy, w, ankerX = 0.5, ankerY = 0.5) => {
    const [cw, ch] = schermMaat();
    const h = w * ch / cw;
    return begrens({ x: cx - w * ankerX, y: cy - h * ankerY, w });
};

// Het vrije stuk scherm: rechts zit de index (als die open is), onder op mobiel ook.
function vrijVlak() {
    const [cw, ch] = schermMaat();
    const open = podium.dataset.stand === 'kaart' && !indexVak.classList.contains('ingeklapt');
    if (SMAL.matches) {
        const onder = open ? indexVak.offsetHeight + 16 : 0;
        return { x0: 0.05, x1: 0.95, y0: 0.1, y1: Math.max(0.35, (ch - onder) / ch - 0.03) };
    }
    const rechts = open ? indexVak.offsetWidth + 40 : 0;
    return { x0: 0.06, x1: (cw - rechts) / cw - 0.03, y0: 0.12, y1: 0.9 };
}

function rondPunten(punten, { rand = SMAL.matches ? 80 : 140, minW = 600 } = {}) {
    const [cw, ch] = schermMaat();
    const xs = punten.map((p) => p[0]), ys = punten.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const v = vrijVlak();
    const w = Math.max((x1 - x0 + 2 * rand) / (v.x1 - v.x0), ((y1 - y0 + 2 * rand) / (v.y1 - v.y0)) * cw / ch, minW);
    return beeldRond((x0 + x1) / 2, (y0 + y1) / 2, w, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2);
}

const overzicht = () => {
    const punten = Object.values(xyVan);
    if (!punten.length) return begrens({ x: 0, y: 0, w: BREED });
    if (podium.dataset.stand === 'omslag') {
        // Op de omslag iets verder weg, zodat de overgang naar de kaart een zachte zoom is.
        const b = rondPunten(punten, { rand: 260, minW: 900 });
        return beeldRond(b.x + b.w / 2, b.y + b.h / 2, b.w * 1.25);
    }
    return rondPunten(punten);
};

function zetBeeld(b, { stil = false } = {}) {
    if (!stil) beweeg();
    beeld = begrens(b);
    svg.setAttribute('viewBox', `${beeld.x} ${beeld.y} ${beeld.w} ${beeld.h}`);
    schaalPins();
    plaatsPinkaart();
}

let animatie = null;
function vliegNaar(doel, duur = 900) {
    cancelAnimationFrame(animatie);
    doel = begrens(doel);
    if (RUSTIG.matches || duur === 0) { zetBeeld(doel); return Promise.resolve(); }
    const start = { ...beeld }, t0 = performance.now();
    const zacht = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    return new Promise((klaar) => {
        const stap = (nu) => {
            const t = Math.min((nu - t0) / duur, 1), k = zacht(t);
            zetBeeld({ x: start.x + (doel.x - start.x) * k, y: start.y + (doel.y - start.y) * k, w: start.w + (doel.w - start.w) * k });
            if (t < 1) animatie = requestAnimationFrame(stap); else klaar();
        };
        animatie = requestAnimationFrame(stap);
    });
}

// Zoomen rond een schermpunt (muis, vinger of het midden).
function zoomOm(factor, sx, sy) {
    const r = kaartVak.getBoundingClientRect();
    const fx = sx === undefined ? 0.5 : (sx - r.left) / r.width, fy = sy === undefined ? 0.5 : (sy - r.top) / r.height;
    const px = beeld.x + fx * beeld.w, py = beeld.y + fy * beeld.h;
    const w = Math.min(Math.max(beeld.w * factor, MIN_BREEDTE), BREED);
    const h = w * beeld.h / beeld.w;
    return { x: px - fx * w, y: py - fy * h, w };
}

// --- Lijnen en pins -----------------------------------------------------------

const lijnen = maakSvg('g', { class: 'dt-lijnen' });
svg.appendChild(lijnen);
const lijnenVan = {};
for (const e of EVENEMENTEN) {
    const [eerste, ...rest] = e.plekken;
    lijnenVan[e.id] = rest.map((ander) => {
        const [x1, y1] = xyVan[eerste], [x2, y2] = xyVan[ander];
        const cx = (x1 + x2) / 2 - (y2 - y1) * 0.18, cy = (y1 + y2) / 2 + (x2 - x1) * 0.18;
        // Een lichte baan eronder, en koraal stippen met een petrol rand: zo steekt de lijn af tegen de kaart.
        const d = `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`;
        const g = maakSvg('g', { class: 'lijn' });
        g.append(maakSvg('path', { d, class: 'lijn-baan' }), maakSvg('path', { d, class: 'lijn-rand' }), maakSvg('path', { d, class: 'lijn-stip' }));
        return lijnen.appendChild(g);
    });
}

const bubbels = maakSvg('g', { class: 'dt-pins' });
svg.appendChild(bubbels);
const bubbelVan = {};

// Pins als papieren knipsels: een met de schaar geknipt rondje (net niet rond), een witte
// papierrand, een tikje scheef, een glimlijn waar het licht valt en een zachte schaduw eronder,
// zodat ze boven de kaart lijken te zweven. Bij aanwijzen komt het knipsel omhoog.
svg.querySelector('defs').insertAdjacentHTML('beforeend',
    '<filter id="knipsel-schaduw" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>');
function knipPad(r, zaad) {
    const punten = Array.from({ length: 20 }, (_, k) => {
        const a = (k / 20) * Math.PI * 2;
        const rr = r * (1 + 0.055 * Math.sin(a * 3 + zaad) + 0.03 * Math.sin(a * 5 + zaad * 1.7));
        return `${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`;
    });
    return 'M' + punten.join('L') + 'Z';
}
function knipsel(id) {
    const zaad = [...id].reduce((n, c) => n + c.charCodeAt(0), 0);
    const draai = ((zaad * 37) % 15) - 7;
    const boog = (r, van, tot) => {
        const p = (graden) => [Math.cos(graden * Math.PI / 180) * r, Math.sin(graden * Math.PI / 180) * r].map((n) => n.toFixed(2)).join(' ');
        return `M${p(van)}A${r} ${r} 0 0 1 ${p(tot)}`;
    };
    // Elk knipsel wiegt en ademt in een eigen tempo, zodat de kaart een beetje leeft.
    const leven = `--duur:${(5.5 + (zaad % 7) * 0.45).toFixed(2)}s;--start:${-((zaad * 13) % 50) / 10}s`;
    return `<g class="schaduw-leeft" style="${leven}"><ellipse class="pin-schaduw" cx="3" cy="5.5" rx="12.5" ry="11.5"/></g>
        <circle class="halo" r="13.5"/><circle class="raak" r="21"/>
        <g class="knipsel" style="--draai:${draai}deg">
            <g class="knipsel-leeft" style="${leven}">
                <path class="papier" d="${knipPad(13, zaad)}"/>
                <path class="hart" d="${knipPad(9.2, zaad + 2)}"/>
                <path class="glans" d="${boog(6.2, 195, 255)}"/>
            </g>
        </g>
        <circle class="ring" r="17.5"/>`;
}
for (const p of gebruikt) {
    const data = EVENEMENTEN.filter((e) => e.plekken.includes(p.id)).flatMap((e) => e.data).sort();
    const komt = data.filter((d) => d >= VANDAAG);
    const regel = komt.length ? `Volgende: ${kortDatum(komt[0])}` : `Geweest: ${kortDatum(data[data.length - 1])}`;
    const g = maakSvg('g', { class: 'bubbel ' + (komt.length ? 'komt' : 'geweest'), tabindex: '-1', role: 'button', 'aria-label': `${p.naam}, ${regel}` });
    g.innerHTML = `${knipsel(p.id)}
        <g class="bordje"><rect class="bordschaduw" rx="4"/><rect class="vlak" rx="4"/><text class="naam">${veilig(p.naam)}</text><text class="regel">${regel}</text></g>
        ${STROOKJES ? `<g class="strook"><g class="strook-draai"><rect class="strook-schaduw" rx="2"/><rect class="strook-vlak" rx="2"/><text class="strook-naam">${veilig(p.naam)}</text><rect class="plakband" width="15" height="7"/></g></g>` : ''}`;
    bubbels.appendChild(g);
    bubbelVan[p.id] = g;
}

// Pins in schermpixels: elke pin krijgt scale(eenheden per pixel). Bordjes klappen om bij de index.
function schaalPins() {
    const u = eenheidPerPixel();
    const grens = beeld.x + beeld.w * vrijVlak().x1;
    for (const [id, g] of Object.entries(bubbelVan)) {
        const [x, y] = xyVan[id];
        g.setAttribute('transform', `translate(${x} ${y}) scale(${u})`);
        const rect = g.querySelector('rect.vlak');
        if (!rect.dataset.w) {
            const naam = g.querySelector('.naam'), sub = g.querySelector('.regel');
            rect.dataset.w = Math.max(naam.getBBox().width, sub.getBBox().width) + 22;
        }
        const w = +rect.dataset.w;
        const bx = x + (22 + w) * u > grens ? -22 - w : 22;
        Object.entries({ x: bx, y: -22, width: w, height: 44 }).forEach(([k, v]) => rect.setAttribute(k, v));
        // Papieren schaduw onder het bordje, iets naar rechtsonder.
        Object.entries({ x: bx + 3, y: -18, width: w, height: 44 }).forEach(([k, v]) => g.querySelector('rect.bordschaduw').setAttribute(k, v));
        g.querySelector('.naam').setAttribute('x', bx + 11); g.querySelector('.naam').setAttribute('y', -3);
        g.querySelector('.regel').setAttribute('x', bx + 11); g.querySelector('.regel').setAttribute('y', 14);
    }
    if (STROOKJES) plaatsStrookjes(u);
}

// Strookjes naast de pins. Eerst rechts proberen, dan links; botst het met een ander strookje
// of een pin, dan wijkt de plek met de minste bijeenkomsten (bij inzoomen komt hij terug).
const voorrang = Object.keys(bubbelVan).sort((a, b) =>
    EVENEMENTEN.filter((e) => e.plekken.includes(b)).length - EVENEMENTEN.filter((e) => e.plekken.includes(a)).length);
function plaatsStrookjes(u) {
    podium.classList.toggle('met-strookjes', AANRAAK.matches);
    if (!AANRAAK.matches) return;
    const scherm = (id) => [(xyVan[id][0] - beeld.x) / u, (xyVan[id][1] - beeld.y) / u];
    const bezet = Object.keys(bubbelVan).map((id) => { const [x, y] = scherm(id); return { id, x: x - 15, y: y - 15, w: 30, h: 30 }; });
    // Ook de zoomknoppen en de indexknop zijn bezet.
    const vak = kaartVak.getBoundingClientRect();
    for (const el of [document.querySelector('.dt-bediening'), $('index-knop')]) {
        const r = el.getBoundingClientRect();
        if (r.width) bezet.push({ id: 'knoppen', x: r.left - vak.left - 6, y: r.top - vak.top - 6, w: r.width + 12, h: r.height + 12 });
    }
    const botst = (a) => bezet.some((b) => b.id !== a.id && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
    const breedte = schermMaat()[0];
    for (const id of voorrang) {
        const g = bubbelVan[id].querySelector('.strook');
        const tekst = g.querySelector('.strook-naam');
        if (!g.dataset.w) g.dataset.w = tekst.getBBox().width + 18;
        const w = +g.dataset.w, h = 22;
        const [px, py] = scherm(id);
        const kanten = [{ x: 15, y: -30 }, { x: -15 - w, y: -30 }, { x: 15, y: 9 }, { x: -15 - w, y: 9 }];
        const kant = kanten.find((k) => px + k.x > 4 && px + k.x + w < breedte - 4 && !botst({ id, x: px + k.x, y: py + k.y, w, h }));
        g.classList.toggle('weg', !kant);
        if (!kant) continue;
        bezet.push({ id: id + '-strook', x: px + kant.x, y: py + kant.y, w, h });
        // Een tikje scheef, zoals een opgeplakt papiertje; altijd dezelfde kant op per plek.
        const scheef = (([...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 7) - 3) * 0.8;
        g.querySelector('.strook-draai').setAttribute('transform', `translate(${kant.x} ${kant.y}) rotate(${scheef} ${w / 2} ${h / 2})`);
        for (const [sel, extra] of [['.strook-vlak', 0], ['.strook-schaduw', 2.5]]) {
            Object.entries({ x: extra, y: extra, width: w, height: h }).forEach(([k, val]) => g.querySelector(sel).setAttribute(k, val));
        }
        tekst.setAttribute('x', 9); tekst.setAttribute('y', 15);
        g.querySelector('.plakband').setAttribute('transform', `translate(${kant.x > 0 ? -5 : w - 10} -3) rotate(${kant.x > 0 ? -18 : 18} 7.5 3.5)`);
    }
}

// --- Wat er oplicht -------------------------------------------------------------

const selectieVanPlek = (id) => {
    const samen = EVENEMENTEN.filter((e) => e.plekken.length > 1 && e.plekken.includes(id));
    return { plekken: [id], partners: samen.flatMap((e) => e.plekken), evenementen: samen.map((e) => e.id), regels: EVENEMENTEN.filter((e) => e.plekken.includes(id)).map((e) => e.id) };
};
const selectieVanEvenement = (e) => ({ plekken: e.plekken, partners: e.plekken, evenementen: [e.id], regels: [e.id] });

let zweef = null, vast = null;
function teken() {
    const actief = [zweef, vast].filter(Boolean);
    const plekken = new Set(actief.flatMap((s) => s.plekken));
    const partners = new Set(actief.flatMap((s) => s.partners));
    const evenementen = new Set(actief.flatMap((s) => s.evenementen));
    const regels = new Set(actief.flatMap((s) => s.regels));
    for (const [id, g] of Object.entries(bubbelVan)) {
        g.classList.toggle('open', plekken.has(id));
        g.classList.toggle('partner', partners.has(id) && !plekken.has(id));
        // Bovenop de andere pins, maar alleen verplaatsen als het nodig is: tijdens een klik zou dat de klik breken.
        if (plekken.has(id) && bubbels.lastElementChild !== g) bubbels.appendChild(g);
    }
    for (const [id, lijst] of Object.entries(lijnenVan)) lijst.forEach((l) => l.classList.toggle('aan', evenementen.has(id)));
    index.querySelectorAll('[data-evenement]').forEach((k) => k.classList.toggle('open', regels.has(k.dataset.evenement)));
}
const zweefOp = (sel) => { zweef = sel; teken(); };

// --- Kaartje bij een pin ----------------------------------------------------------

let pinkaartPlek = null;

function toonPinkaart(plekId, alleen = null, alleenDatum = null) {
    const hier = alleen ? [alleen] : EVENEMENTEN.filter((e) => e.plekken.includes(plekId));
    // Komt eraan en geweest apart, en elke datum een eigen blokje.
    const rijen = DATUMRIJEN.filter((r) => hier.includes(r.e) && (!alleenDatum || r.d === alleenDatum));
    const komt = rijen.filter((r) => r.d >= VANDAAG);
    const geweest = rijen.filter((r) => r.d < VANDAAG).reverse();
    const item = ({ e, d, m, nr }, soort) => `<div class="dt-pinitem ${soort}">
        ${e.omslag ? `<img src="${fotoUrl(e.omslag)}" alt="" loading="lazy">` : ''}
        <span class="dt-bovenregel">${nr} · ${langDatum(d)}</span>
        <h3>${veilig(m.wat || e.soort)}</h3>
        ${naamEnThemaHtml(e, [d]) ? `<p class="thema">${naamEnThemaHtml(e, [d])}</p>` : ''}
        ${e.plekken.length > 1 ? `<p>${veilig(plekNamen(e))}</p>` : ''}
        <button type="button" class="dt-meer dt-knop" data-evenement="${veilig(e.id)}">${soort === 'komt' ? 'Lees meer' : 'Terugblik'}</button>
    </div>`;
    const deel = (rijen, soort, kop) => rijen.length
        ? `<section class="dt-pindeel ${soort}"><h4><span class="dt-stip ${soort}" aria-hidden="true"></span>${kop}</h4>${rijen.map((r) => item(r, soort)).join('')}</section>`
        : '';
    pinkaart.innerHTML = `<div class="dt-pinkaart-kop"><strong>${veilig(PLEKKEN[plekId].naam)}</strong>
            <button type="button" class="dt-pinkaart-sluit" aria-label="Sluiten">×</button></div>
        ${deel(komt, 'komt', 'Komt eraan')}${deel(geweest, 'geweest', 'Geweest')}`;
    if (SMAL.matches && !indexVak.classList.contains('ingeklapt')) zetIndex(false);
    pinkaart.hidden = false;
    pinkaartPlek = plekId;
    if (SMAL.matches) {
        const [x, y] = xyVan[plekId];
        const vrij = 1 - pinkaart.offsetHeight / schermMaat()[1];
        vliegNaar(beeldRond(x, y, beeld.w, 0.5, Math.max(0.18, vrij / 2)), 450);
    }
    vast = alleen ? selectieVanEvenement(alleen) : selectieVanPlek(plekId);
    teken();
    plaatsPinkaart();
    pinkaart.querySelector('.dt-pinkaart-sluit').addEventListener('click', sluitPinkaart);
    pinkaart.querySelectorAll('.dt-meer').forEach((k) => k.addEventListener('click', () => openVerhaal(EVENEMENTEN.find((e) => e.id === k.dataset.evenement))));
    pinkaart.querySelector('.dt-meer')?.focus({ preventScroll: true });
}

function sluitPinkaart() {
    if (pinkaart.hidden) return;
    pinkaart.hidden = true;
    const terug = bubbelVan[pinkaartPlek];
    pinkaartPlek = null;
    vast = null;
    teken();
    if (podium.dataset.stand === 'kaart') terug?.focus({ preventScroll: true });
}

// Naast de pin; bij te weinig ruimte rechts aan de linkerkant. Op mobiel regelt de CSS het (onderaan).
function plaatsPinkaart() {
    if (pinkaart.hidden || !pinkaartPlek || SMAL.matches) return;
    const [x, y] = xyVan[pinkaartPlek];
    const u = eenheidPerPixel();
    const px = (x - beeld.x) / u, py = (y - beeld.y) / u;
    const [cw, ch] = schermMaat();
    const kw = pinkaart.offsetWidth, kh = pinkaart.offsetHeight;
    const rechtsVrij = cw * vrijVlak().x1;
    const left = px + 24 + kw < rechtsVrij ? px + 24 : Math.max(12, px - 24 - kw);
    const top = Math.min(Math.max(py - 40, 12), ch - kh - 12);
    pinkaart.style.left = left + 'px';
    pinkaart.style.top = top + 'px';
}

// --- Slepen, knijpen en scrollen om te zoomen ---------------------------------

const vingers = new Map();
let versleept = false, knijpStart = null;
svg.addEventListener('pointerdown', (ev) => {
    if (podium.dataset.stand !== 'kaart') return;
    vingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    versleept = false;
    if (vingers.size === 2) {
        const [a, b] = [...vingers.values()];
        knijpStart = { afstand: Math.hypot(a.x - b.x, a.y - b.y), beeld: { ...beeld } };
    }
});
svg.addEventListener('pointermove', (ev) => {
    const vorige = vingers.get(ev.pointerId);
    if (!vorige) return;
    const nu = { x: ev.clientX, y: ev.clientY };
    vingers.set(ev.pointerId, nu);
    if (vingers.size === 2 && knijpStart) {
        const [a, b] = [...vingers.values()];
        const factor = knijpStart.afstand / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
        beeld = knijpStart.beeld;
        zetBeeld(zoomOm(factor, (a.x + b.x) / 2, (a.y + b.y) / 2));
        versleept = true;
        return;
    }
    const dx = nu.x - vorige.x, dy = nu.y - vorige.y;
    if (!versleept && Math.hypot(dx, dy) < 3) return;
    if (!versleept) { svg.setPointerCapture(ev.pointerId); svg.classList.add('slepen'); }
    versleept = true;
    cancelAnimationFrame(animatie);
    const u = eenheidPerPixel();
    zetBeeld({ x: beeld.x - dx * u, y: beeld.y - dy * u, w: beeld.w });
});
const laatLos = (ev) => {
    vingers.delete(ev.pointerId);
    if (vingers.size < 2) knijpStart = null;
    svg.classList.remove('slepen');
    setTimeout(() => { if (!vingers.size) versleept = false; }, 0);
};
svg.addEventListener('pointerup', laatLos);
svg.addEventListener('pointercancel', laatLos);
svg.addEventListener('click', () => { if (!versleept) sluitPinkaart(); });
kaartVak.addEventListener('wheel', (ev) => {
    if (podium.dataset.stand !== 'kaart') return;
    ev.preventDefault();
    cancelAnimationFrame(animatie);
    zetBeeld(zoomOm(Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), ev.clientX, ev.clientY));
}, { passive: false });

$('zoom-in').addEventListener('click', () => vliegNaar(zoomOm(0.65), 350));
$('zoom-uit').addEventListener('click', () => vliegNaar(zoomOm(1.5), 350));
$('zoom-alles').addEventListener('click', () => vliegNaar(overzicht(), 600));

// --- Pins: aanwijzen en klikken -------------------------------------------------

for (const [id, g] of Object.entries(bubbelVan)) {
    g.addEventListener('mouseenter', () => zweefOp(selectieVanPlek(id)));
    g.addEventListener('mouseleave', () => zweefOp(null));
    g.addEventListener('click', (ev) => { ev.stopPropagation(); if (!versleept) toonPinkaart(id); });
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toonPinkaart(id); } });
}

// --- Index ------------------------------------------------------------------

// Een reeks die deels geweest is, staat in beide groepen met de bijbehorende data.
for (const groep of [
    { kop: 'Komt eraan', soort: 'komt', rijen: DATUMRIJEN.filter((r) => r.d >= VANDAAG) },
    { kop: 'Geweest', soort: 'geweest', rijen: DATUMRIJEN.filter((r) => r.d < VANDAAG).reverse() },
]) {
    if (!groep.rijen.length) continue;
    const kop = document.createElement('h2');
    kop.innerHTML = `<span class="dt-stip ${groep.soort}" aria-hidden="true"></span>${groep.kop}`;
    const lijst = document.createElement('ol');
    for (const { e, d, m, nr } of groep.rijen) {
        const li = document.createElement('li');
        const namen = naamEnThemaHtml(e, [d]);
        // Bij een samenwerking met een plek per datum: die plek voorop.
        const waar = m.plek && PLEKKEN[m.plek] && e.plekken.length > 1
            ? [PLEKKEN[m.plek].naam, ...e.plekken.filter((p) => p !== m.plek).map((p) => PLEKKEN[p].naam)].join(' × ')
            : plekNamen(e);
        li.innerHTML = `<button type="button" class="dt-regel" data-evenement="${veilig(e.id)}">
            <span class="dt-nr" aria-hidden="true">${nr}</span>
            <span class="dt-bovenregel">${kortDatum(d)}</span>
            <span class="titel">${veilig(waar)}</span>
            <span class="sub">${veilig(m.wat || e.soort)}</span>
            ${namen ? `<span class="namen">${namen}</span>` : ''}
            ${e.omslag ? `<img class="dt-duim" src="${fotoUrl(e.omslag)}" alt="" loading="lazy">` : ''}</button>`;
        const knop = li.querySelector('button');
        knop.addEventListener('mouseenter', () => zweefOp(selectieVanEvenement(e)));
        knop.addEventListener('mouseleave', () => zweefOp(null));
        knop.addEventListener('focus', () => zweefOp(selectieVanEvenement(e)));
        knop.addEventListener('blur', () => zweefOp(null));
        // Naar de plek vliegen en daar het kaartje met "Lees meer" openen.
        knop.addEventListener('click', async () => {
            pinkaart.hidden = true;
            await vliegNaar(rondPunten(e.plekken.map((p) => xyVan[p]), { rand: 220, minW: 700 }), 700);
            toonPinkaart(m.plek && PLEKKEN[m.plek] ? m.plek : e.plekken[0], e, d);
        });
        lijst.appendChild(li);
    }
    index.append(kop, lijst);
}
if (!EVENEMENTEN.length) index.innerHTML = '<p class="dt-leeg">Nog geen bijeenkomsten.</p>';
index.insertAdjacentHTML('beforeend', '<p class="dt-index-voet"><a class="dt-knop dt-knop-klein" href="#archief">Volledig archief →</a></p>');

function zetIndex(open) {
    indexVak.classList.toggle('ingeklapt', !open);
    $('index-knop').setAttribute('aria-expanded', String(open));
}
$('index-knop').addEventListener('click', () => {
    zetIndex(indexVak.classList.contains('ingeklapt'));
    // Op een telefoon bedekt de index het onderste deel: schuif de pins naar het vrije stuk.
    if (SMAL.matches) { sluitPinkaart(); requestAnimationFrame(() => vliegNaar(overzicht(), 500)); }
    schaalPins();
    plaatsPinkaart();
});
if (SMAL.matches) zetIndex(false);

// --- Standen -------------------------------------------------------------------

function zetStand(stand) {
    if (podium.dataset.stand === stand) return false;
    podium.dataset.stand = stand;
    const opKaart = stand === 'kaart';
    // Op de kaart verdwijnt de bovenste balk, zodat de kaart het hele scherm vult.
    document.body.classList.toggle('dt-kaart-open', opKaart);
    toonBalk(false);
    $('balk-knop').tabIndex = opKaart ? 0 : -1;
    if (opKaart) window.scrollTo({ top: 0, behavior: 'instant' });
    indexVak.inert = !opKaart;
    document.querySelector('.dt-bediening').inert = !opKaart;
    document.querySelector('.dt-legenda').inert = !opKaart;
    document.querySelector('.dt-start').inert = opKaart;
    document.querySelector('.dt-archieflink').inert = opKaart;
    $('naar-omslag').tabIndex = opKaart ? 0 : -1;
    Object.values(bubbelVan).forEach((g) => { g.tabIndex = opKaart ? 0 : -1; });
    if (!opKaart) sluitPinkaart();
    return true;
}

// De lappendeken vloeit als inkt vanuit de knop over de kaart; intussen zoomt de kaart in.
async function kleurIn(vanaf) {
    if (!klaar.kleur || RUSTIG.matches) { svg.classList.remove('lijnwerk'); return vliegNaar(overzicht(), 1300); }
    const cirkel = svg.querySelector('#onthul-cirkel');
    cirkel.setAttribute('cx', vanaf[0]);
    cirkel.setAttribute('cy', vanaf[1]);
    cirkel.setAttribute('r', 0);
    rasterKleur.setAttribute('mask', 'url(#onthul)');
    svg.classList.add('overgang');
    svg.dataset.laag = 'raster';
    // De inkt groeit tot de verste hoek van het beeld waar we heen zoomen (niet van de hele kaart),
    // anders is hij in beeld al klaar voordat je hem ziet.
    const doel = overzicht();
    const hoeken = [[beeld.x, beeld.y], [beeld.x + beeld.w, beeld.y + beeld.h], [doel.x, doel.y], [doel.x + doel.w, doel.y], [doel.x, doel.y + doel.h], [doel.x + doel.w, doel.y + doel.h]];
    const straal = Math.max(...hoeken.map(([x, y]) => Math.hypot(x - vanaf[0], y - vanaf[1]))) / 0.8;
    const duur = 2000, t0 = performance.now();
    const zacht = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const inkt = new Promise((klaar) => {
        const stap = (nu) => {
            const t = Math.min((nu - t0) / duur, 1);
            cirkel.setAttribute('r', straal * zacht(t));
            if (t < 1) requestAnimationFrame(stap); else klaar();
        };
        requestAnimationFrame(stap);
    });
    await Promise.all([inkt, vliegNaar(overzicht(), 1500)]);
    svg.classList.remove('lijnwerk', 'overgang');
    rasterKleur.removeAttribute('mask');
    beweeg();
}

// Pins een voor een laten verschijnen.
function pinsGolf() {
    Object.values(bubbelVan).forEach((g, i) => {
        g.style.transitionDelay = RUSTIG.matches ? '0s' : `${0.6 + i * 0.12}s`;
        g.style.setProperty('--strook-vertraging', RUSTIG.matches ? '0s' : `${1.4 + i * 0.15}s`);
        setTimeout(() => { g.style.transitionDelay = ''; g.style.removeProperty('--strook-vertraging'); }, 3500);
    });
}

$('naar-omslag').addEventListener('click', () => { if (podium.dataset.stand === 'kaart') location.hash = ''; });

// --- De bovenste balk terughalen op de kaart ---------------------------------------
// Laptop: zoals het Dock, muis even tegen de bovenrand houden; van de balk af en hij gaat weer weg.
// Overal: het lipje bovenaan in het midden. Klik of tik op de kaart om hem weer te verbergen.
const balk = document.querySelector('.av-header');
function toonBalk(aan) {
    document.body.classList.toggle('balk-zichtbaar', aan);
    $('balk-knop').setAttribute('aria-expanded', String(aan));
    $('balk-knop').setAttribute('aria-label', aan ? 'Menu verbergen' : 'Menu tonen');
}
$('balk-knop').addEventListener('click', () => toonBalk(!document.body.classList.contains('balk-zichtbaar')));
svg.addEventListener('pointerdown', () => toonBalk(false));
let dockTimer = null, wegTimer = null;
document.addEventListener('mousemove', (ev) => {
    if (podium.dataset.stand !== 'kaart' || !overlay.hidden) return;
    if (ev.clientY <= 6) {
        if (!dockTimer && !document.body.classList.contains('balk-zichtbaar')) dockTimer = setTimeout(() => toonBalk(true), 320);
    } else {
        clearTimeout(dockTimer);
        dockTimer = null;
    }
});
balk.addEventListener('mouseenter', () => clearTimeout(wegTimer));
balk.addEventListener('mouseleave', () => {
    if (podium.dataset.stand !== 'kaart') return;
    wegTimer = setTimeout(() => toonBalk(false), 500);
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') toonBalk(false); });
let inktBron = null;
document.querySelector('.dt-startknop').addEventListener('click', () => {
    const r = document.querySelector('.dt-startknop').getBoundingClientRect();
    inktBron = kaart.schermNaarKaart(r.left + r.width / 2, r.top + r.height / 2);
});

// --- Verhaal en archief (schermvullend) -------------------------------------------

function blokHtml(b) {
    if (b.type === 'tekst') return `<div class="dt-tekst">${alineas(b.tekst)}</div>`;
    if (b.type === 'foto') return `<figure class="breed"><img src="${fotoUrl(b.foto)}" alt="${veilig(b.onderschrift)}" loading="lazy">${b.onderschrift ? `<figcaption>${veilig(b.onderschrift)}</figcaption>` : ''}</figure>`;
    if (b.type === 'reeks') return `<div class="dt-reeks breed">${b.fotos.map((f) => `<figure><img src="${fotoUrl(f.foto)}" alt="${veilig(f.onderschrift)}" loading="lazy">${f.onderschrift ? `<figcaption>${veilig(f.onderschrift)}</figcaption>` : ''}</figure>`).join('')}</div>`;
    if (b.type === 'citaat') return `<blockquote><p>${veilig(b.tekst)}</p>${b.bron ? `<footer>${veilig(b.bron)}</footer>` : ''}</blockquote>`;
    return '';
}

function verhaalHtml(e) {
    const metPlek = e.plekken.length > 1;
    const wanneer = e.momenten.map((m) => `${langDatum(m.datum)}${m.wat ? ': ' + veilig(m.wat) : ''}${metPlek && m.plek && PLEKKEN[m.plek] ? ' bij ' + veilig(PLEKKEN[m.plek].naam) : ''}${m.thema ? ` · <em>${veilig(m.thema)}</em>` : ''}`).join('<br>');
    const kop = titelVan(e);
    const waar = e.plekken.map((id) => veilig(PLEKKEN[id].naam)).join('<br>');
    const i = EVENEMENTEN.indexOf(e);
    const vorige = EVENEMENTEN[i - 1], volgende = EVENEMENTEN[i + 1];
    const link = (x, richting) => x ? `<a href="#verhaal/${encodeURIComponent(x.id)}"><small class="dt-bovenregel">${richting}</small><span>${veilig(titelVan(x))}</span></a>` : '';
    return `<button type="button" class="dt-sluit dt-knop">← Terug</button>
        <header class="dt-held ${e.omslag ? 'met-foto' : ''}">
            ${e.omslag ? `<img src="${fotoUrl(e.omslag)}" alt="">` : ''}
            <div class="dt-held-tekst">
                <p class="dt-bovenregel">${veilig(plekNamen(e))} · ${opsomming(e.data.map(kortDatum))}</p>
                <h1 id="verhaal-titel">${veilig(kop)}</h1>
                <p class="dt-ondertitel">${kop === e.soort ? '' : veilig(e.soort) + (e.plekken.length === 1 ? ' ' : ' · ')}${veilig(plekRegel(e))}</p>
            </div>
        </header>
        <article class="dt-artikel">
            <ul class="dt-meta"><li><small>Wanneer</small>${wanneer}</li><li><small>Waar</small>${waar}</li></ul>
            ${e.thema && e.thema !== kop ? `<p class="dt-thema-groot">${veilig(e.thema)}</p>` : ''}
            ${e.blokken.length ? e.blokken.map(blokHtml).join('') : `<p class="dt-geen-verhaal">${komtNog(e) ? 'Deze bijeenkomst komt nog.' : 'Het verhaal van deze bijeenkomst volgt nog.'}</p>`}
            <nav class="dt-verder-lezen breed" aria-label="Andere bijeenkomsten">${link(vorige, 'Vorige')}${link(volgende, 'Volgende')}</nav>
        </article>`;
}

function archiefHtml() {
    const perJaar = {};
    for (const e of [...EVENEMENTEN].reverse()) (perJaar[e.data[0].slice(0, 4)] ||= []).push(e);
    const jaren = Object.keys(perJaar).sort().reverse();
    const sinds = EVENEMENTEN[0]?.data[0].slice(0, 4);
    const plekken = gebruikt.map((p) => {
        const hier = EVENEMENTEN.filter((e) => e.plekken.includes(p.id));
        const jaartallen = [...new Set(hier.flatMap((e) => e.data.map((d) => d.slice(0, 4))))].sort();
        // Per datum tellen; bij een samenwerking met een plek per datum alleen de data op deze plek.
        const aantal = hier.reduce((n, e) => n + e.data.filter((d) => {
            const plekVanDatum = e.momenten.find((m) => m.datum === d)?.plek;
            return !plekVanDatum || plekVanDatum === p.id || e.plekken.length === 1;
        }).length, 0);
        return { p, aantal, jaartallen };
    }).sort((a, b) => b.aantal - a.aantal || a.p.naam.localeCompare(b.p.naam));
    return `<button type="button" class="dt-sluit dt-knop">← Terug</button>
        <div class="dt-archief">
            <header>
                <p class="dt-kicker">Op doortocht · archief</p>
                <h1 id="verhaal-titel">Volledig archief</h1>
                <ul class="dt-tellers">
                    <li><strong>${EVENEMENTEN.reduce((n, e) => n + e.data.length, 0)}</strong>bijeenkomsten</li>
                    <li><strong>${gebruikt.length}</strong>plekken</li>
                    <li><strong>${EVENEMENTEN.filter((e) => e.plekken.length > 1).length}</strong>samenwerkingen</li>
                    ${sinds ? `<li>sinds <strong>${sinds}</strong></li>` : ''}
                </ul>
            </header>
            ${jaren.map((jaar) => `<section class="dt-jaar"><h2>${jaar}</h2><ol>
                ${perJaar[jaar].map((e) => `<li class="dt-archiefregel">
                    <time datetime="${e.data[0]}">${dataInJaar(e.data.filter((d) => d.startsWith(jaar)))}</time>
                    <div>
                        <h3><a href="#verhaal/${encodeURIComponent(e.id)}">${veilig(plekNamen(e))}</a>${komtNog(e) ? '<span class="dt-label">komt eraan</span>' : ''}</h3>
                        <p>${veilig(e.soort)}${e.data.filter((d) => d.startsWith(jaar)).length > 1 ? ` · ${e.data.filter((d) => d.startsWith(jaar)).length} bijeenkomsten` : ''}</p>
                        ${naamEnThemaHtml(e) ? `<p class="dt-archief-themas">${naamEnThemaHtml(e)}</p>` : ''}
                    </div>
                </li>`).join('')}
            </ol></section>`).join('')}
            <section class="dt-jaar dt-plekken-sectie"><h2>Plekken</h2>
                <ul class="dt-plekkenlijst">${plekken.map(({ p, aantal, jaartallen }) => `<li><strong>${veilig(p.naam)}</strong>
                    <span>${veilig(p.adres || '')}${p.adres ? '<br>' : ''}${aantal} ${aantal === 1 ? 'bijeenkomst' : 'bijeenkomsten'} · ${jaartallen.join(', ')}</span></li>`).join('')}</ul>
            </section>
        </div>`;
}

let overlayInhoud = null;  // 'archief' of het id van het verhaal
let vanuitPagina = false;   // true als de overlay via een klik op deze pagina is geopend
let focusTerug = null;

function openVerhaal(e) {
    vanuitPagina = true;
    location.hash = '#verhaal/' + encodeURIComponent(e.id);
}
document.addEventListener('click', (ev) => {
    if (ev.target.closest('a[href="#archief"], a[href^="#verhaal/"]')) vanuitPagina = true;
});

function sluitOverlay() {
    if (vanuitPagina && history.length > 1) history.back();
    else location.hash = '#kaart';
}

async function toonOverlay(soort, e) {
    const wasDicht = overlay.hidden;
    if (wasDicht) focusTerug = document.activeElement;
    // Vanaf de kaart eerst naar de plek vliegen; daarna schuift het verhaal eroverheen.
    if (soort === 'verhaal' && wasDicht && podium.dataset.stand === 'kaart' && !RUSTIG.matches) {
        pinkaart.hidden = true;
        vast = selectieVanEvenement(e); teken();
        await vliegNaar(rondPunten(e.plekken.map((p) => xyVan[p]), { rand: 90, minW: 320 }), 850);
    }
    overlay.innerHTML = soort === 'archief' ? archiefHtml() : verhaalHtml(e);
    overlayInhoud = soort === 'archief' ? 'archief' : e.id;
    overlay.hidden = false;
    overlay.scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    document.title = `${soort === 'archief' ? 'Volledig archief' : titelVan(e)} | Op doortocht | andere vragen`;
    overlay.querySelector('.dt-sluit').addEventListener('click', sluitOverlay);
    overlay.querySelector('.dt-sluit').focus({ preventScroll: true });
}

async function verbergOverlay() {
    if (overlay.hidden) return;
    overlay.classList.add('dicht');
    await new Promise((klaar) => setTimeout(klaar, RUSTIG.matches ? 0 : 280));
    overlay.hidden = true;
    overlay.classList.remove('dicht');
    overlay.innerHTML = '';
    overlayInhoud = null;
    document.documentElement.style.overflow = '';
    document.title = 'Op doortocht | andere vragen';
    vast = null; teken();
    focusTerug?.focus?.({ preventScroll: true });
}

// --- Routes ---------------------------------------------------------------------

async function volgHash({ eerste = false } = {}) {
    const h = location.hash;
    const verhaalId = decodeURIComponent((h.match(/^#verhaal\/(.+)$/) || [])[1] || '');
    const e = EVENEMENTEN.find((x) => x.id === verhaalId);

    if (h === '#archief') {
        if (overlayInhoud !== 'archief') await toonOverlay('archief');
        return;
    }
    if (e) {
        if (overlayInhoud === e.id) return;
        if (zetStand('kaart')) { svg.classList.remove('lijnwerk'); zetBeeld(overzicht()); }
        await toonOverlay('verhaal', e);
        return;
    }

    // Geen overlay: omslag of kaart.
    const naarKaart = h === '#kaart';
    await verbergOverlay();
    vanuitPagina = false;
    const bron = inktBron || [beeld.x + beeld.w / 2, beeld.y + beeld.h * 0.56];
    inktBron = null;
    const veranderd = zetStand(naarKaart ? 'kaart' : 'omslag');
    if (veranderd && naarKaart && !eerste) { pinsGolf(); kleurIn(bron); return; }
    if (veranderd && !naarKaart) svg.classList.add('lijnwerk');
    if (!naarKaart) svg.classList.add('lijnwerk'); else svg.classList.remove('lijnwerk');
    if (veranderd || eerste) vliegNaar(overzicht(), eerste ? 0 : 1300);
    else if (naarKaart) vliegNaar(overzicht(), 700);
}

window.addEventListener('hashchange', () => volgHash());
document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!overlay.hidden) sluitOverlay();
    else if (!pinkaart.hidden) sluitPinkaart();
});

let vorigeMaat = schermMaat().join();
AANRAAK.addEventListener('change', () => schaalPins());
new ResizeObserver(() => {
    const maat = schermMaat().join();
    if (maat === vorigeMaat) return;
    vorigeMaat = maat;
    zetBeeld(overzicht());
}).observe(kaartVak);

if (location.hash === '#kaart') history.replaceState(null, '', location.pathname + location.search);
podium.dataset.stand = '';
zetStand('omslag');
zetBeeld(overzicht());
kaartVak.removeAttribute('aria-busy'); // nu pas zichtbaar: in de goede stand en op de goede plek
volgHash({ eerste: true });
