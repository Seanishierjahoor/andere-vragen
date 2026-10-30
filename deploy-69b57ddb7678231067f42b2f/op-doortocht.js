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
// Strookjes: namen van de plekken altijd zichtbaar, op elk scherm (sinds 30 okt ook met muis; daarvoor
// alleen op touchscreens). Op false zetten om terug te gaan naar pins met een bordje bij aanwijzen.
const STROOKJES = true;
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
// Plekfoto met het focuspunt uit het beheer (welk deel in beeld blijft als hij wordt bijgesneden)
const focusStijl = (f) => `object-position: ${f?.x ?? 50}% ${f?.y ?? 50}%`;
const omslagFoto = (e, klasse = '') => `<img${klasse ? ` class="${klasse}"` : ''} src="${fotoUrl(e.omslag)}" alt="" style="${focusStijl(e.omslagFocus)}" loading="lazy">`;
const plekFoto = (p, alt = '') => `<img src="${fotoUrl(p.foto)}" alt="${veilig(alt)}" style="object-position: ${p.focus?.x ?? 50}% ${p.focus?.y ?? 50}%" draggable="false">`;
// Opmaak uit het beheer: **vet**, *cursief* en [tekst](adres). Eerst veilig gemaakt, daarna omgezet,
// dus alleen deze drie dingen worden echte opmaak. Links naar andere sites openen in een nieuw tabblad.
const nadruk = (s) => s.replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, '<strong>$1</strong>').replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, '<em>$1</em>');
const opmaak = (tekst) => {
    const links = [];
    const s = veilig(tekst).replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g, (_, t, url) => {
        const extern = /^https?:/.test(url) && !/^https?:\/\/(www\.)?andere-vragen\.nl(\/|$)/.test(url);
        links.push(`<a href="${url}"${extern ? ' target="_blank" rel="noopener"' : ''}>${nadruk(t)}</a>`);
        return `\u0000${links.length - 1}\u0000`;
    });
    return nadruk(s).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
};
// Alinea's bij een lege regel, een enkele enter wordt een regelafbreking.
const alineas = (tekst) => String(tekst || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map((a) => `<p>${opmaak(a).replace(/\n/g, '<br>')}</p>`).join('');

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
// Elke bijeenkomst is één datum. Voor de rest van de code krijgt hij dezelfde vorm als vroeger
// (data en momenten met één datum), zodat index, kaartje en lijnen gewoon blijven werken.
const EVENEMENTEN = (gegevens?.bijeenkomsten || [])
    .map((b) => ({
        ...b, plekken: b.plekken.filter((id) => PLEKKEN[id]), data: [b.datum],
        momenten: [{ datum: b.datum, plek: b.plek, wat: b.wat, thema: b.thema }],
    }))
    .filter((e) => e.plekken.length)
    .sort((a, b) => a.datum.localeCompare(b.datum));
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
const titelVan = (e) => e.naam || e.vraag || e.soort;

// --- Beeld: zoomen en pannen via de viewBox -----------------------------------

const { svg, BREED, HOOG, naarKaart } = kaart;
svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
svg.classList.add('lijnwerk'); // de omslag is kleurloos

// --- Afbeeldingen van de kaart: tijdens bewegen schuift de browser een plaatje, geen vectorkaart ----

// De afbeeldingen staan als gewone <img> boven de tekening, niet erin. Zoomen, schuiven en het inkleurende
// rondje zijn dan alleen verschuivingen van kant-en-klare plaatjes: dat doet de grafische chip, zonder
// dat de browser iets opnieuw hoeft te tekenen. Op iPads en telefoons scheelt dat de laatste haperingen.
const rasterVak = document.createElement('div');
rasterVak.className = 'dt-raster';
rasterVak.innerHTML = '<img id="raster-lijn" alt="" draggable="false"><div class="dt-onthul"><img id="raster-kleur" alt="" draggable="false"></div>';
svg.after(rasterVak);
const rasterLijn = rasterVak.querySelector('#raster-lijn');
const rasterKleur = rasterVak.querySelector('#raster-kleur');
const onthul = rasterVak.querySelector('.dt-onthul');
for (const img of [rasterLijn, rasterKleur]) Object.assign(img.style, { width: BREED + 'px', height: HOOG + 'px' });
let inkt = null; // { cx, cy, r } in kaarteenheden, alleen tijdens het inkleuren

// Zet de plaatjes op dezelfde plek als de vectorkaart (het beeld heeft altijd de verhouding van het scherm).
function plaatsRaster() {
    if (kaartVak.dataset.laag !== 'raster') return;
    const k = schermMaat()[0] / beeld.w;
    const x = -beeld.x * k, y = -beeld.y * k;
    rasterLijn.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    if (inkt) {
        const cx = (inkt.cx - beeld.x) * k, cy = (inkt.cy - beeld.y) * k, r = Math.max(inkt.r * k, 0.5);
        Object.assign(onthul.style, { left: `${cx - r}px`, top: `${cy - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
        rasterKleur.style.transform = `translate3d(${x - (cx - r)}px, ${y - (cy - r)}px, 0) scale(${k})`;
    } else {
        Object.assign(onthul.style, { left: '0', top: '0', width: '100%', height: '100%' });
        rasterKleur.style.transform = rasterLijn.style.transform;
    }
}
function zetLaag(laag) {
    kaartVak.dataset.laag = laag;
    plaatsRaster();
}
const klaar = { lijn: false, kleur: false };
// De afbeeldingen zijn vooraf gemaakt (zelf tekenen kost een telefoon seconden rekenwerk). Ze worden pas
// geladen als de pagina klaar en rustig is, zodat ze het eerste beeld niet vertragen. Klein voor telefoons.
// Opnieuw maken na een kaartwijziging: zie andere-vragen-kaart/OPDRACHT-performance.md, en KAART_VERSIE ophogen.
const KAART_VERSIE = '2026-10-23';
let afbeeldingenBelofte = null;
function laadAfbeeldingen() {
    if (afbeeldingenBelofte) return afbeeldingenBelofte;
    // Groot alleen voor echt grote schermen (laptop, groot scherm); telefoons en tablets klein.
    const maat = Math.max(innerWidth, innerHeight) >= 1300 ? 'groot' : 'klein';
    const laad = (soort, image) => {
        const url = `beeld/kaart/kaart-${soort}-${maat}.webp?v=${KAART_VERSIE}`;
        const beeld = new Image();
        beeld.decoding = 'async';
        beeld.fetchPriority = 'low';
        beeld.src = url;
        return beeld.decode().then(() => { image.src = url; klaar[soort] = true; });
    };
    afbeeldingenBelofte = laad('lijn', rasterLijn).then(() => laad('kleur', rasterKleur)).then(warmVoor).catch(() => {});
    return afbeeldingenBelofte;
}
// De eerste keer dat een grote afbeelding zichtbaar wordt, moet de browser hem klaarzetten voor de
// grafische chip; dat geeft een hapering. Daarom tonen we ze één keer onzichtbaar op de omslag (het
// lijnwerk is daar identiek aan de vectorkaart, de kleur staat op doorzichtig).
function warmVoor() {
    if (podium.dataset.stand !== 'omslag' || kaartVak.classList.contains('overgang')) return;
    kaartVak.classList.add('opwarmen');
    zetLaag('raster');
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        kaartVak.classList.remove('opwarmen');
        if (!kaartVak.classList.contains('overgang')) zetLaag('vector');
    })));
}
// Meteen na het eerste beeld laden (met lage voorrang). Wachten op een rustig moment kan niet in Safari,
// en dan zijn ze er te laat als iemand snel op de knop drukt.
if (document.readyState === 'complete') laadAfbeeldingen(); else addEventListener('load', laadAfbeeldingen, { once: true });

// Tijdens bewegen het plaatje tonen; even stil, dan weer de scherpe vectorkaart.
let stilTimer = null;
function beweeg() {
    const nodig = podium.dataset.stand === 'kaart' ? klaar.kleur : klaar.lijn;
    if (!nodig && !kaartVak.classList.contains('overgang')) return;
    if (kaartVak.dataset.laag !== 'raster') zetLaag('raster');
    clearTimeout(stilTimer);
    stilTimer = setTimeout(() => { if (!kaartVak.classList.contains('overgang')) zetLaag('vector'); }, 220);
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
    pinlaag.setAttribute('viewBox', `${beeld.x} ${beeld.y} ${beeld.w} ${beeld.h}`);
    plaatsRaster();
    schaalPins();
    plaatsPinkaart();
    plaatsPlekkaartjes();
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

// Pins en lijnen staan op een eigen, lichte laag boven de kaart, met hetzelfde beeld. Zo hoeft de browser
// bij de ademende pins en de lopende stippellijn niet steeds de hele kaart met arceringen opnieuw te tekenen.
const pinlaag = maakSvg('svg', { class: 'dt-pinlaag', preserveAspectRatio: 'xMidYMid slice', viewBox: svg.getAttribute('viewBox') });
pinlaag.innerHTML = '<defs><filter id="knipsel-schaduw" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>';
kaartVak.appendChild(pinlaag);
const lijnen = maakSvg('g', { class: 'dt-lijnen' });
pinlaag.appendChild(lijnen);
const lijnenVan = {};
for (const e of EVENEMENTEN) {
    const [eerste, ...rest] = e.plekken;
    lijnenVan[e.id] = rest.map((ander) => {
        const [x1, y1] = xyVan[eerste], [x2, y2] = xyVan[ander];
        const cx = (x1 + x2) / 2 - (y2 - y1) * 0.18, cy = (y1 + y2) / 2 + (x2 - x1) * 0.18;
        // Een lichte baan eronder, en koraal stippen met een petrol rand: zo steekt de lijn af tegen de kaart.
        const d = `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`;
        const g = maakSvg('g', { class: 'lijn ' + (komtNog(e) ? 'komt' : 'geweest') });
        g.append(maakSvg('path', { d, class: 'lijn-baan' }), maakSvg('path', { d, class: 'lijn-rand' }), maakSvg('path', { d, class: 'lijn-stip' }));
        return lijnen.appendChild(g);
    });
}

const bubbels = maakSvg('g', { class: 'dt-pins' });
pinlaag.appendChild(bubbels);
const bubbelVan = {};

// Pins als papieren knipsels: een met de schaar geknipt rondje (net niet rond), een witte
// papierrand, een tikje scheef, een glimlijn waar het licht valt en een zachte schaduw eronder,
// zodat ze boven de kaart lijken te zweven. Bij aanwijzen komt het knipsel omhoog.
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
    const g = maakSvg('g', { class: 'bubbel ' + (komt.length ? 'komt' : 'geweest') + (komt.length ? ' heeft-komt' : '') + (komt.length < data.length ? ' heeft-geweest' : ''), tabindex: '-1', role: 'button', 'aria-label': `${p.naam}, ${regel}` });
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
    podium.classList.add('met-strookjes');
    const scherm = (id) => [(xyVan[id][0] - beeld.x) / u, (xyVan[id][1] - beeld.y) / u];
    const bezet = Object.keys(bubbelVan).map((id) => { const [x, y] = scherm(id); return { id, x: x - 15, y: y - 15, w: 30, h: 30 }; });
    // Ook de zoomknoppen, de indexknop en de legenda zijn bezet.
    const vak = kaartVak.getBoundingClientRect();
    for (const el of [document.querySelector('.dt-bediening'), $('index-knop'), document.querySelector('.dt-chips')]) {
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

// Elk blokje in de index heeft een eigen sleutel (bijeenkomst + datum), zodat bij een reeks
// alleen het aangewezen blokje oplicht.
const rijSleutel = (e, d) => `${e.id}|${d}`;
const sleutelsVan = (e) => e.data.map((d) => rijSleutel(e, d));
const selectieVanPlek = (id) => {
    const samen = EVENEMENTEN.filter((e) => e.plekken.length > 1 && e.plekken.includes(id));
    return { plekken: [id], partners: samen.flatMap((e) => e.plekken), evenementen: samen.map((e) => e.id), regels: EVENEMENTEN.filter((e) => e.plekken.includes(id)).flatMap(sleutelsVan) };
};
const selectieVanEvenement = (e, d = null) => ({ plekken: e.plekken, partners: e.plekken, evenementen: [e.id], regels: d ? [rijSleutel(e, d)] : sleutelsVan(e) });

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
    index.querySelectorAll('[data-rij]').forEach((k) => k.classList.toggle('open', regels.has(k.dataset.rij)));
}
const zweefOp = (sel) => { zweef = sel; teken(); };

// Chips bovenaan de kaart. "Komt eraan" en "Geweest" zijn de legenda en filteren tegelijk de pins, de lijnen
// en de index (nog een klik: weer alles). "Samenwerkingen" zet alle samenwerkingslijnen aan of uit.
const chips = document.querySelector('.dt-chips');
const alleLijnenKnop = chips.querySelector('.dt-samenwerkingen');
alleLijnenKnop.addEventListener('click', () => {
    const aan = alleLijnenKnop.getAttribute('aria-pressed') !== 'true';
    alleLijnenKnop.setAttribute('aria-pressed', String(aan));
    alleLijnenKnop.querySelector('span').textContent = aan ? 'Samenwerkingen' : 'Toon samenwerkingen';
    podium.classList.toggle('alle-lijnen', aan);
    podium.classList.remove('voorproef');
});
// Voorproefje: bij aanwijzen lichten de lijnen alvast zachtjes op.
alleLijnenKnop.addEventListener('mouseenter', () => podium.classList.add('voorproef'));
alleLijnenKnop.addEventListener('mouseleave', () => podium.classList.remove('voorproef'));
const filterKnoppen = [...chips.querySelectorAll('[data-filter]')];
for (const knop of filterKnoppen) knop.addEventListener('click', () => {
    const filter = podium.dataset.filter === knop.dataset.filter ? '' : knop.dataset.filter;
    const oud = podium.dataset.filter || '';
    podium.dataset.filter = filter;
    filterKnoppen.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.filter === filter)));
    sluitPinkaart();
    sluitRij();
    filterIndex(oud, filter);
});

// De index volgt het filter met een overgang: van alles naar één groep klapt de andere groep in,
// terug naar alles klapt hij weer uit, en van de ene groep naar de andere schuift de rij naar links weg
// en schuift de nieuwe van rechts in beeld.
const groepVak = (soort) => index.querySelector(`.dt-groep[data-groep="${soort}"]`);
const zichtbaarBij = (vak, filter) => !filter || vak.dataset.groep === filter;
function klap(vak, open) {
    if (!vak || vak.hidden === !open) return Promise.resolve();
    if (RUSTIG.matches) { vak.hidden = !open; return Promise.resolve(); }
    vak.hidden = false;
    const h = vak.scrollHeight;
    const frames = [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }];
    const anim = vak.animate(open ? frames : frames.reverse(), { duration: 380, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    vak.style.overflow = 'hidden';
    return anim.finished.then(() => { vak.style.overflow = ''; vak.hidden = !open; });
}
async function schuif(weg, erbij) {
    if (RUSTIG.matches) { weg.hidden = true; erbij.hidden = false; return; }
    await weg.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-48px)', opacity: 0 }],
        { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)' }).finished;
    weg.hidden = true;
    erbij.hidden = false;
    indexVak.querySelector('.dt-index-binnen').scrollTop = 0;
    await erbij.animate([{ transform: 'translateX(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 340, easing: 'cubic-bezier(.2, .7, .2, 1)' }).finished;
}
function filterIndex(oud, nieuw) {
    if (oud && nieuw && groepVak(oud) && groepVak(nieuw)) return schuif(groepVak(oud), groepVak(nieuw));
    for (const vak of index.querySelectorAll('.dt-groep')) klap(vak, zichtbaarBij(vak, nieuw));
}
// De eerste keer dat de kaart opengaat, lichten alle samenwerkingslijnen even op en geeft de chip een puls:
// zo zie je meteen wat hij doet en waar hij zit.
let alGeflitst = false;
function flitsSamenwerkingen() {
    if (alGeflitst || RUSTIG.matches || !lijnen.children.length) return;
    alGeflitst = true;
    setTimeout(() => {
        podium.classList.add('flits');
        setTimeout(() => podium.classList.remove('flits'), 1900);
    }, 900);
}

// --- Kaartje bij een pin ----------------------------------------------------------

let pinkaartPlek = null;

function toonPinkaart(plekId, alleen = null, alleenDatum = null) {
    sluitRij();
    const hier = alleen ? [alleen] : EVENEMENTEN.filter((e) => e.plekken.includes(plekId));
    // Komt eraan en geweest apart, en elke datum een eigen blokje.
    const rijen = DATUMRIJEN.filter((r) => hier.includes(r.e) && (!alleenDatum || r.d === alleenDatum));
    const komt = rijen.filter((r) => r.d >= VANDAAG);
    const geweest = rijen.filter((r) => r.d < VANDAAG).reverse();
    // Geen omslagfoto's van bijeenkomsten in dit kaartje: bovenaan staat alleen de foto van de plek zelf (als die er is),
    // anders lijkt de foto van één avond de foto van de plek.
    const item = ({ e, d, m, nr }, soort) => `<div class="dt-pinitem ${soort}">
        <span class="dt-bovenregel">${nr} · ${langDatum(d)}</span>
        <h3>${veilig(m.wat || e.soort)}</h3>
        ${e.vraag ? `<p class="thema">${veilig(e.vraag)}</p>` : ''}
        ${naamEnThemaHtml(e, [d]) ? `<p class="dt-pin-naam">${naamEnThemaHtml(e, [d])}</p>` : ''}
        ${e.plekken.length > 1 ? `<p>${veilig(plekNamen(e))}</p>` : ''}
        <button type="button" class="dt-meer dt-knop" data-evenement="${veilig(e.id)}">${soort === 'komt' ? 'Lees meer' : 'Terugblik'}</button>
    </div>`;
    const deel = (rijen, soort, kop) => rijen.length
        ? `<section class="dt-pindeel ${soort}"><h4><span class="dt-stip ${soort}" aria-hidden="true"></span>${kop}</h4>${rijen.map((r) => item(r, soort)).join('')}</section>`
        : '';
    const plek = PLEKKEN[plekId];
    pinkaart.innerHTML = `<div class="dt-pinkaart-kop${plek.foto ? ' met-foto' : ''}">
            ${plek.foto ? plekFoto(plek) : ''}<div class="dt-pinkaart-naam"><strong>${veilig(plek.naam)}</strong>${plek.ondertitel ? `<span>${veilig(plek.ondertitel)}</span>` : ''}</div>
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
    vast = alleen ? selectieVanEvenement(alleen, alleenDatum) : selectieVanPlek(plekId);
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

// --- Kaartje van de plek ---------------------------------------------------------
// Kies je een bijeenkomst in de index, dan zoomt de kaart in en verschijnt bij elke plek een kaartje:
// een foto van de plek met de naam erover (of alleen de naam), als een knipsel met plakband.
const plekkaartVak = document.createElement('div');
plekkaartVak.className = 'dt-plekkaartjes';
plekkaartVak.setAttribute('aria-hidden', 'true'); // de naam staat ook in de index
pinkaart.before(plekkaartVak);
let plekkaartIds = [];
function toonPlekkaartjes(ids) {
    verbergPlekkaartjes();
    plekkaartIds = ids;
    plekkaartVak.innerHTML = ids.map((id, i) => {
        const p = PLEKKEN[id];
        return `<figure class="dt-plekkaart${p.foto ? ' met-foto' : ''}" style="--draai: ${i % 2 ? 1.6 : -1.8}deg">
            ${p.foto ? plekFoto(p) : ''}
            <figcaption><strong>${veilig(p.naam)}</strong>${p.ondertitel || p.adres ? `<span>${veilig(p.ondertitel || p.adres.split(',')[0])}</span>` : ''}</figcaption>
            ${p.foto && p.fotocredit ? `<small>${veilig(p.fotocredit)}</small>` : ''}
            <span class="plakband"></span>
        </figure>`;
    }).join('');
    ids.forEach((id) => bubbelVan[id]?.classList.add('met-plekkaart'));
    plaatsPlekkaartjes();
    plekkaartVak.querySelectorAll('.dt-plekkaart').forEach((k, i) => setTimeout(() => k.classList.add('zichtbaar'), 30 + i * 140));
}
function verbergPlekkaartjes() {
    plekkaartIds.forEach((id) => bubbelVan[id]?.classList.remove('met-plekkaart'));
    plekkaartIds = [];
    plekkaartVak.replaceChildren();
}
// Boven de pin. Bij twee plekken gaat de linker naar links en de rechter naar rechts, zodat ze niet overlappen.
function plaatsPlekkaartjes() {
    if (!plekkaartIds.length) return;
    const u = eenheidPerPixel();
    const [cw] = schermMaat();
    // Niet onder de index, en op mobiel niet onder de legenda (bovenaan) en de zoomknoppen (rechts).
    const vak = kaartVak.getBoundingClientRect();
    const knoppen = document.querySelector('.dt-bediening').getBoundingClientRect();
    // (de zoomknoppen tellen alleen mee als ze er zijn; op een smal scherm zijn ze verborgen)
    const rechts = SMAL.matches && knoppen.width ? Math.min(cw * vrijVlak().x1, knoppen.left - vak.left - 4) : cw * vrijVlak().x1;
    const boven = document.querySelector('.dt-chips').getBoundingClientRect().bottom - vak.top + 10;
    const pos = plekkaartIds.map((id) => [(xyVan[id][0] - beeld.x) / u, (xyVan[id][1] - beeld.y) / u]);
    const minX = Math.min(...pos.map((q) => q[0]));
    plekkaartVak.querySelectorAll('.dt-plekkaart').forEach((k, i) => {
        const [px, py] = pos[i];
        const w = k.offsetWidth, h = k.offsetHeight;
        const links = pos.length > 1 ? px === minX : px + 18 + w > rechts;
        const left = Math.min(Math.max(links ? px - 18 - w : px + 18, 8), rechts - w - 8);
        const top = py - h - 20 < boven ? py + 26 : py - h - 20;
        k.style.left = left + 'px';
        k.style.top = top + 'px';
    });
}

// --- Index: een bijeenkomst openklappen -------------------------------------------
// Klik in de index: de regel klapt open (foto, vraag, begin van de samenvatting en een knop naar het verhaal),
// de kaart zoomt in op de plek(ken) en daar verschijnt het kaartje van de plek. Nog een klik klapt dicht.
const platteTekst = (t) => String(t || '').replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
const beginVan = (t, max = 230) => {
    const s = platteTekst(t);
    if (s.length <= max) return s;
    const kort = s.slice(0, max);
    return kort.slice(0, kort.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
};
function uitklapHtml(e, d) {
    const label = d >= VANDAAG ? 'Lees meer' : e.samenvatting || e.blokken.length ? 'Lees het verhaal' : 'Bekijk de bijeenkomst';
    return `<div class="dt-uitklap" id="uitklap-${veilig(e.id)}">
        ${e.omslag ? omslagFoto(e) : ''}
        ${e.vraag ? `<p class="dt-uitklap-vraag">${veilig(e.vraag)}</p>` : ''}
        ${e.samenvatting ? `<p class="dt-uitklap-tekst">${veilig(beginVan(e.samenvatting))}</p>` : ''}
        <a class="dt-knop dt-knop-klein" href="#verhaal/${encodeURIComponent(e.id)}">${label} →</a>
    </div>`;
}
let openRij = null;
function sluitRij() {
    if (!openRij) return;
    openRij.li.querySelector('.dt-uitklap')?.remove();
    openRij.li.classList.remove('uitgeklapt');
    openRij.knop.setAttribute('aria-expanded', 'false');
    openRij = null;
    vast = null;
    teken();
    verbergPlekkaartjes();
}
async function kiesRij(rij) {
    const zelfde = openRij?.knop === rij.knop;
    sluitRij();
    if (zelfde) return;
    pinkaart.hidden = true;
    pinkaartPlek = null;
    openRij = rij;
    const { e, d, m, li, knop } = rij;
    li.classList.add('uitgeklapt');
    knop.setAttribute('aria-expanded', 'true');
    li.insertAdjacentHTML('beforeend', uitklapHtml(e, d));
    li.scrollIntoView({ block: 'nearest', behavior: RUSTIG.matches ? 'auto' : 'smooth' });
    vast = selectieVanEvenement(e, d);
    teken();
    // De plek van die datum eerst (bij een samenwerking met een plek per datum).
    const ids = m.plek && PLEKKEN[m.plek] ? [m.plek, ...e.plekken.filter((p) => p !== m.plek)] : e.plekken;
    await vliegNaar(rondPunten(ids.map((p) => xyVan[p]), { rand: SMAL.matches ? 70 : 90, minW: 300 }), 800);
    if (openRij === rij) toonPlekkaartjes(ids);
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
svg.addEventListener('click', () => { if (!versleept) { sluitPinkaart(); sluitRij(); } });
kaartVak.addEventListener('wheel', (ev) => {
    if (podium.dataset.stand !== 'kaart') return;
    ev.preventDefault();
    cancelAnimationFrame(animatie);
    zetBeeld(zoomOm(Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), ev.clientX, ev.clientY));
}, { passive: false });

$('zoom-in').addEventListener('click', () => vliegNaar(zoomOm(0.65), 350));
$('zoom-uit').addEventListener('click', () => vliegNaar(zoomOm(1.5), 350));
$('zoom-alles').addEventListener('click', () => { sluitRij(); vliegNaar(overzicht(), 600); });

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
        li.innerHTML = `<button type="button" class="dt-regel" data-rij="${veilig(rijSleutel(e, d))}" aria-expanded="false" aria-controls="uitklap-${veilig(e.id)}">
            <span class="dt-nr" aria-hidden="true">${nr}</span>
            <span class="dt-bovenregel">${kortDatum(d)}</span>
            <span class="titel">${veilig(waar)}</span>
            <span class="sub">${veilig(m.wat || e.soort)}</span>
            ${namen ? `<span class="namen">${namen}</span>` : ''}
            ${e.omslag ? omslagFoto(e, 'dt-duim') : ''}</button>`;
        const knop = li.querySelector('button');
        knop.addEventListener('mouseenter', () => zweefOp(selectieVanEvenement(e, d)));
        knop.addEventListener('mouseleave', () => zweefOp(null));
        knop.addEventListener('focus', () => zweefOp(selectieVanEvenement(e, d)));
        knop.addEventListener('blur', () => zweefOp(null));
        knop.addEventListener('click', () => kiesRij({ e, d, m, li, knop }));
        lijst.appendChild(li);
    }
    // Elke groep in een eigen vak, zodat het filter hem kan laten inklappen of wegschuiven.
    const vak = document.createElement('section');
    vak.className = 'dt-groep dt-groep-' + groep.soort;
    vak.dataset.groep = groep.soort;
    vak.append(kop, lijst);
    index.append(vak);
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
    plaatsRaster();
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
    chips.inert = !opKaart;
    document.querySelector('.dt-start').inert = opKaart;
    document.querySelector('.dt-archieflink').inert = opKaart;
    $('naar-omslag').tabIndex = opKaart ? 0 : -1;
    Object.values(bubbelVan).forEach((g) => { g.tabIndex = opKaart ? 0 : -1; });
    if (!opKaart) { sluitPinkaart(); sluitRij(); }
    return true;
}

// De lappendeken vloeit als inkt vanuit de knop over de kaart; intussen zoomt de kaart in.
async function kleurIn(vanaf) {
    // Even wachten op de afbeeldingen (op een normale verbinding zijn ze er al).
    if (!klaar.kleur && !RUSTIG.matches) await Promise.race([laadAfbeeldingen(), new Promise((klaar) => setTimeout(klaar, 1500))]);
    if (!klaar.kleur || RUSTIG.matches) {
        // Rustige terugval zonder zware vectorzoom: de kaart staat meteen op zijn plek en vloeit in kleur in.
        svg.classList.remove('lijnwerk');
        zetBeeld(overzicht(), { stil: true });
        if (!RUSTIG.matches) svg.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
        return;
    }
    inkt = { cx: vanaf[0], cy: vanaf[1], r: 0 };
    kaartVak.classList.add('overgang');
    zetLaag('raster');
    // De inkt groeit tot de verste hoek van het beeld waar we heen zoomen (niet van de hele kaart),
    // anders is hij in beeld al klaar voordat je hem ziet.
    const doel = overzicht();
    const hoeken = [[beeld.x, beeld.y], [beeld.x + beeld.w, beeld.y + beeld.h], [doel.x, doel.y], [doel.x + doel.w, doel.y], [doel.x, doel.y + doel.h], [doel.x + doel.w, doel.y + doel.h]];
    const straal = Math.max(...hoeken.map(([x, y]) => Math.hypot(x - vanaf[0], y - vanaf[1]))) / 0.8;
    const duur = 2000, t0 = performance.now();
    const zacht = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const inktKlaar = new Promise((klaar) => {
        const stap = (nu) => {
            const t = Math.min((nu - t0) / duur, 1);
            inkt.r = straal * zacht(t);
            plaatsRaster();
            if (t < 1) requestAnimationFrame(stap); else klaar();
        };
        requestAnimationFrame(stap);
    });
    await Promise.all([inktKlaar, vliegNaar(overzicht(), 1500)]);
    inkt = null;
    svg.classList.remove('lijnwerk');
    kaartVak.classList.remove('overgang');
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
    if (b.type === 'reeks') return strookHtml(b.fotos);
    if (b.type === 'citaat') return `<blockquote><p>${opmaak(b.tekst).replace(/\n/g, '<br>')}</p>${b.bron ? `<footer>${veilig(b.bron)}</footer>` : ''}</blockquote>`;
    return '';
}

// Tekstkaart: een kaart die je omdraait. Voorkant: de eerste zin groot; ga je erheen, dan draait hij om naar de hele tekst.
// Een korte tekst (één zin, een citaat) heeft niets om te draaien en staat meteen groot op de kaart.
function tekstKaart(tekst) {
    const plat = platteTekst(tekst);
    if (plat.length <= 140) return `<div class="dt-strook-kaart dt-strook-tekst kort"><div class="dt-strook-tekst-binnen"><p>${opmaak(String(tekst).trim()).replace(/\n+/g, '<br>')}</p></div></div>`;
    const zin = plat.match(/^.{20,}?[.?!…](?=\s|$)/)?.[0] || beginVan(plat, 110);
    return `<div class="dt-strook-kaart dt-strook-tekst draait"><div class="dt-kaart-draai">
        <div class="dt-kaart-voor" aria-hidden="true"><p>${veilig(zin.length > 150 ? beginVan(zin, 140) : zin)}</p><span class="dt-kaart-hint">lees verder ↻</span></div>
        <div class="dt-strook-tekst-binnen dt-kaart-achter">${alineas(tekst)}</div>
    </div></div>`;
}

// Strook: foto's en tekstkaarten naast elkaar, naar links te vegen (of met de pijltjes).
function strookHtml(kaarten) {
    // Elke kaart heeft de vorm van een speelkaart; ga je erheen, dan wordt hij zo breed als de foto echt is (niets bijgesneden).
    const kaart = (k, i) => k.foto
        ? `<figure class="dt-strook-kaart dt-strook-foto"><img src="${fotoUrl(k.foto)}" alt="${veilig(k.onderschrift)}" loading="lazy" draggable="false">${k.onderschrift ? `<figcaption>${opmaak(k.onderschrift)}</figcaption>` : ''}</figure>`
        : tekstKaart(k.tekst);
    const meer = kaarten.length > 1;
    return `<section class="dt-strook breed" aria-roledescription="carrousel" aria-label="Foto's en tekst">
        <div class="dt-strook-baan" tabindex="0">${kaarten.map(kaart).join('')}</div>
        ${meer ? `<div class="dt-strook-bediening">
            <button type="button" class="dt-knop dt-knop-klein dt-strook-vorige" aria-label="Vorige">←</button>
            <div class="dt-strook-stippen" aria-hidden="true">${kaarten.map(() => '<span></span>').join('')}</div>
            <button type="button" class="dt-knop dt-knop-klein dt-strook-volgende" aria-label="Volgende">→</button>
        </div>` : ''}
    </section>`;
}

// Pijltjes, stippen en slepen met de muis voor elke strook in het verhaal. Vegen en scrollen doet de browser zelf.
function zetStrokenAan(vak) {
    for (const strook of vak.querySelectorAll('.dt-strook')) {
        const baan = strook.querySelector('.dt-strook-baan');
        const kaarten = [...baan.children];
        const stippen = [...strook.querySelectorAll('.dt-strook-stippen span')];
        const vorige = strook.querySelector('.dt-strook-vorige'), volgende = strook.querySelector('.dt-strook-volgende');
        const begin = () => kaarten[0].offsetLeft;
        const huidige = () => {
            const x = baan.scrollLeft + begin();
            return kaarten.reduce((best, k, i) => Math.abs(k.offsetLeft - x) < Math.abs(kaarten[best].offsetLeft - x) ? i : best, 0);
        };
        const ga = (i) => baan.scrollTo({ left: kaarten[Math.max(0, Math.min(kaarten.length - 1, i))].offsetLeft - begin(), behavior: RUSTIG.matches ? 'auto' : 'smooth' });
        // De kaart waar je bent, vouwt zich open; pas als het scrollen stilstaat, anders verspringt de rij.
        let rust = null;
        const vouw = (actief) => kaarten.forEach((k, j) => k.classList.toggle('open', j === actief));
        const bij = () => {
            const i = huidige(), eind = baan.scrollLeft >= baan.scrollWidth - baan.clientWidth - 4;
            const actief = eind ? kaarten.length - 1 : i;
            stippen.forEach((s, j) => s.classList.toggle('aan', j === actief));
            if (vorige) vorige.disabled = baan.scrollLeft < 4;
            if (volgende) volgende.disabled = eind;
            clearTimeout(rust);
            rust = setTimeout(() => vouw(actief), 160);
        };
        // De echte verhouding van elke foto, voor de opengevouwen breedte
        for (const img of baan.querySelectorAll('.dt-strook-foto img')) {
            const meet = () => img.naturalWidth && img.parentElement.style.setProperty('--verhouding', (img.naturalWidth / img.naturalHeight).toFixed(4));
            if (img.complete) meet(); else img.addEventListener('load', meet);
        }
        vorige?.addEventListener('click', () => ga(huidige() - 1));
        volgende?.addEventListener('click', () => ga(huidige() + 1));
        baan.addEventListener('scroll', bij, { passive: true });
        // Foto's laden pas later; daarna is de strook breder, dus opnieuw meten
        for (const img of baan.querySelectorAll('img')) img.addEventListener('load', bij);
        new ResizeObserver(bij).observe(baan);
        baan.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); ga(huidige() + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); ga(huidige() - 1); }
        });
        // Slepen met de muis (aanraken en trackpad werken al vanzelf)
        let sleep = null;
        baan.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            sleep = { x: e.clientX, links: baan.scrollLeft, bewogen: false, id: e.pointerId };
        });
        baan.addEventListener('pointermove', (e) => {
            if (!sleep) return;
            const dx = e.clientX - sleep.x;
            if (!sleep.bewogen && Math.abs(dx) > 4) { sleep.bewogen = true; baan.classList.add('sleept'); baan.setPointerCapture(sleep.id); }
            if (sleep.bewogen) baan.scrollLeft = sleep.links - dx;
        });
        baan.addEventListener('lostpointercapture', () => baan.dispatchEvent(new Event('pointerup')));
        baan.addEventListener('pointerup', () => {
            if (!sleep) return;
            const was = sleep.bewogen; sleep = null;
            if (was) { baan.classList.remove('sleept'); ga(huidige()); }
        });
        bij();
    }
}

function verhaalHtml(e) {
    const kop = e.naam || e.soort;
    const plekVanDag = e.plek && PLEKKEN[e.plek] ? e.plek : null;
    const wanneer = `${langDatum(e.datum)}${e.wat ? ': ' + veilig(e.wat) : ''}`;
    const waar = (plekVanDag ? [plekVanDag, ...e.plekken.filter((p) => p !== plekVanDag)] : e.plekken).map((id) => veilig(PLEKKEN[id].naam)).join('<br>');
    const i = EVENEMENTEN.indexOf(e);
    const vorige = EVENEMENTEN[i - 1], volgende = EVENEMENTEN[i + 1];
    const titelLink = (x) => `${kortDatum(x.datum)} · ${x.naam || x.soort}${x.plekken.length === 1 ? ' ' : ' · '}${plekRegel(x)}`;
    const link = (x, richting) => x ? `<a href="#verhaal/${encodeURIComponent(x.id)}"><small class="dt-bovenregel">${richting}</small><span>${veilig(titelLink(x))}</span></a>` : '';
    const leeg = !e.blokken.length && !e.samenvatting;
    // Vaste beschrijving van de plek(ken), onderaan elke bijeenkomst daar.
    const overPlekken = e.plekken.map((id) => PLEKKEN[id]).filter((p) => p.beschrijving)
        .map((p) => `<section class="dt-overplek"><h2>Over ${veilig(p.naam)}</h2>${p.foto ? `<figure class="dt-overplek-foto">${plekFoto(p, p.naam)}${p.fotocredit ? `<figcaption>${veilig(p.fotocredit)}</figcaption>` : ''}</figure>` : ''}${alineas(p.beschrijving)}${p.adres ? `<p class="dt-overplek-adres">${veilig(p.adres)}</p>` : ''}</section>`).join('');
    return `<button type="button" class="dt-sluit dt-knop">← Terug</button>
        <header class="dt-held ${e.omslag ? 'met-foto' : ''}">
            ${e.omslag ? omslagFoto(e).replace(' loading="lazy"', '') : ''}
            <div class="dt-held-tekst">
                <p class="dt-bovenregel">${veilig(plekNamen(e))} · ${kortDatum(e.datum)}${e.reeks ? ` · ${veilig(e.reeks)}` : ''}</p>
                <h1 id="verhaal-titel">${veilig(kop)}</h1>
                <p class="dt-ondertitel">${kop === e.soort ? '' : veilig(e.soort) + (e.plekken.length === 1 ? ' ' : ' · ')}${veilig(plekRegel(e))}</p>
            </div>
        </header>
        <article class="dt-artikel">
            <ul class="dt-meta"><li><small>Wanneer</small>${wanneer}</li><li><small>Waar</small>${waar}</li>${e.thema ? `<li><small>Thema</small>${veilig(e.thema)}</li>` : ''}</ul>
            ${e.vraag ? `<p class="dt-thema-groot">${veilig(e.vraag)}</p>` : ''}
            ${e.samenvatting ? `<div class="dt-tekst dt-samenvatting">${alineas(e.samenvatting)}</div>` : ''}
            ${e.blokken.map(blokHtml).join('')}
            ${leeg ? `<p class="dt-geen-verhaal">${komtNog(e) ? 'Deze bijeenkomst komt nog.' : 'Het verhaal van deze bijeenkomst volgt nog.'}</p>` : ''}
            ${overPlekken}
            <nav class="dt-verder-lezen breed" aria-label="Andere bijeenkomsten">${link(vorige, 'Vorige')}${link(volgende, 'Volgende')}</nav>
        </article>`;
}

function archiefHtml() {
    // Secties: een reeks (zelfde reeksnaam) of een losse bijeenkomst. Per jaar, nieuwste bovenaan.
    const secties = [];
    for (const e of EVENEMENTEN) {
        const sleutel = e.reeks ? 'r:' + e.reeks + '|' + e.datum.slice(0, 4) : 'e:' + e.id;
        let sectie = secties.find((x) => x.sleutel === sleutel);
        if (!sectie) secties.push(sectie = { sleutel, reeks: e.reeks, jaar: e.datum.slice(0, 4), leden: [] });
        sectie.leden.push(e);
    }
    secties.sort((a, b) => b.leden[b.leden.length - 1].datum.localeCompare(a.leden[a.leden.length - 1].datum));
    const jaren = [...new Set(secties.map((x) => x.jaar))].sort().reverse();
    const sinds = EVENEMENTEN[0]?.datum.slice(0, 4);
    const plekken = gebruikt.map((p) => {
        const hier = EVENEMENTEN.filter((e) => e.plekken.includes(p.id) && (!e.plek || e.plek === p.id || e.plekken.length === 1));
        return { p, aantal: hier.length, jaartallen: [...new Set(hier.map((e) => e.datum.slice(0, 4)))].sort() };
    }).filter((x) => x.aantal).sort((a, b) => b.aantal - a.aantal || a.p.naam.localeCompare(b.p.naam));
    const samenwerkingen = new Set(EVENEMENTEN.filter((e) => e.plekken.length > 1).map((e) => e.reeks || e.id)).size;
    const regel = (e) => {
        const plek = e.plekken.length > 1 && e.plek && PLEKKEN[e.plek] ? `bij ${PLEKKEN[e.plek].naam}` : '';
        const wat = [e.wat || (e.soort !== secties.find((x) => x.leden.includes(e)).leden[0].soort ? e.soort : ''), plek].filter(Boolean).join(' ');
        return `<li class="dt-archief-datum">
            <time datetime="${e.datum}">${+e.datum.slice(8, 10)} ${MAANDEN[+e.datum.slice(5, 7) - 1]}</time>
            <span>
                ${wat ? `<span class="dt-archief-wat">${veilig(wat)}</span>` : ''}
                ${e.thema ? `<span class="dt-archief-themas"><span class="dt-themalabel">Thema:</span> ${veilig(e.thema)}</span>` : ''}
                ${e.vraag ? `<a class="dt-archief-vraag" href="#verhaal/${encodeURIComponent(e.id)}">${veilig(e.vraag)}</a>` : `<a class="dt-archief-lees" href="#verhaal/${encodeURIComponent(e.id)}">Lees meer</a>`}
                ${e.datum >= VANDAAG ? '<span class="dt-label">komt eraan</span>' : '<span class="dt-label geweest">geweest</span>'}
            </span>
        </li>`;
    };
    const sectieHtml = (x) => {
        const eerste = x.leden[0];
        const kop = x.reeks || plekNamen(eerste);
        const onder = x.reeks
            ? `${veilig(plekNamen(eerste))}${x.leden.length > 1 ? ` · ${x.leden.length} bijeenkomsten` : ''}`
            : `${veilig(eerste.soort)}${eerste.naam ? ` · <em>${veilig(eerste.naam)}</em>` : ''}`;
        return `<li class="dt-archiefregel">
            <div class="dt-archiefkop"><h3><a href="#verhaal/${encodeURIComponent(eerste.id)}">${veilig(kop)}</a></h3><p>${onder}</p></div>
            <ol class="dt-archiefdata">${[...x.leden].reverse().map(regel).join('')}</ol>
        </li>`;
    };
    return `<button type="button" class="dt-sluit dt-knop">← Terug</button>
        <div class="dt-archief">
            <header>
                <p class="dt-kicker">Op doortocht · archief</p>
                <h1 id="verhaal-titel">Volledig archief</h1>
                <ul class="dt-tellers">
                    <li><strong>${EVENEMENTEN.length}</strong>bijeenkomsten</li>
                    <li><strong>${plekken.length}</strong>plekken</li>
                    <li><strong>${samenwerkingen}</strong>samenwerkingen</li>
                    ${sinds ? `<li>sinds <strong>${sinds}</strong></li>` : ''}
                </ul>
            </header>
            ${jaren.map((jaar) => `<section class="dt-jaar"><h2>${jaar}</h2><ol>${secties.filter((x) => x.jaar === jaar).map(sectieHtml).join('')}</ol></section>`).join('')}
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
    zetStrokenAan(overlay);
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
    if (veranderd && naarKaart && !eerste) { pinsGolf(); kleurIn(bron).then(flitsSamenwerkingen); return; }
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
