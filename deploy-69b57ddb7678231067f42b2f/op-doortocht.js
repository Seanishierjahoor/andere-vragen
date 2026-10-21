// Op doortocht (portfolio): pins, stippellijnen, legenda, kaartje en verhaal.
// Gegevens komen uit /.netlify/functions/get-doortocht (beheer: /beheer-doortocht.html).

import { tekenKaart, maakSvg } from './op-doortocht-kaart.js';

const VANDAAG = new Date().toLocaleDateString('sv-SE'); // JJJJ-MM-DD in lokale tijd
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

const kortDatum = (iso) => `${+iso.slice(8, 10)} ${MAANDEN[+iso.slice(5, 7) - 1].slice(0, 3).replace('maa', 'mrt')}`;
const langDatum = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
};
const opsomming = (lijst) => lijst.length < 2 ? lijst.join('') : lijst.slice(0, -1).join(', ') + ' en ' + lijst[lijst.length - 1];
const veilig = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fotoUrl = (id) => '/doortocht-foto/' + encodeURIComponent(id);
// Alinea's bij een lege regel, een enkele enter wordt een regelafbreking.
const alineas = (tekst) => String(tekst || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map((a) => `<p>${veilig(a).replace(/\n/g, '<br>')}</p>`).join('');

// Geheime ingang: drie keer snel op "(portfolio)" klikken opent het beheer.
let tikken = [];
document.querySelector('.dt-kop small')?.addEventListener('click', () => {
    const nu = Date.now();
    tikken = [...tikken.filter((t) => nu - t < 1200), nu];
    if (tikken.length >= 3) location.href = 'beheer-doortocht.html';
});

const kaartVak = document.getElementById('kaart');
const kaartje = document.getElementById('kaartje');
const legenda = document.getElementById('legenda');
const kaartweergave = document.getElementById('kaartweergave');
const verhaal = document.getElementById('verhaal');
const kop = document.querySelector('.dt-kop');

const [kaart, gegevens] = await Promise.all([
    tekenKaart(kaartVak),
    fetch('/.netlify/functions/get-doortocht').then((r) => r.json()).catch(() => null),
]);
kaartVak.removeAttribute('aria-busy');

const PLEKKEN = Object.fromEntries((gegevens?.plekken || []).map((p) => [p.id, p]));
const EVENEMENTEN = (gegevens?.evenementen || [])
    .map((e) => ({ ...e, plekken: e.plekken.filter((id) => PLEKKEN[id]), data: [...new Set(e.momenten.map((m) => m.datum))].sort() }))
    .filter((e) => e.plekken.length && e.data.length);
const komtNog = (e) => e.data[e.data.length - 1] >= VANDAAG;
const heeftVerhaal = (e) => e.blokken.length > 0 || e.omslag;

// --- Pins en lijnen ------------------------------------------------------

const { svg, BREED, naarKaart } = kaart;
const gebruikt = Object.values(PLEKKEN).filter((p) => EVENEMENTEN.some((e) => e.plekken.includes(p.id)));
const xyVan = Object.fromEntries(gebruikt.map((p) => [p.id, naarKaart(p.lat, p.lon)]));

const lijnen = maakSvg('g');
svg.appendChild(lijnen);
const lijnenVan = {};
for (const e of EVENEMENTEN) {
    const [eerste, ...rest] = e.plekken;
    lijnenVan[e.id] = rest.map((ander) => {
        const [x1, y1] = xyVan[eerste], [x2, y2] = xyVan[ander];
        const cx = (x1 + x2) / 2 - (y2 - y1) * 0.18, cy = (y1 + y2) / 2 + (x2 - x1) * 0.18;
        return lijnen.appendChild(maakSvg('path', { d: `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`, class: 'lijn' }));
    });
}

const bubbels = maakSvg('g');
svg.appendChild(bubbels);
const bubbelVan = {};
for (const p of gebruikt) {
    const [x, y] = xyVan[p.id];
    const data = EVENEMENTEN.filter((e) => e.plekken.includes(p.id)).flatMap((e) => e.data).sort();
    const komt = data.filter((d) => d >= VANDAAG);
    const regel = komt.length ? `Volgende: ${kortDatum(komt[0])}` : `Geweest: ${kortDatum(data[data.length - 1])}`;
    const g = maakSvg('g', {
        class: 'bubbel ' + (komt.length ? 'komt' : 'geweest'),
        transform: `translate(${x} ${y})`, tabindex: '0', role: 'button', 'aria-label': `${p.naam}, ${regel}`,
    });
    g.innerHTML = `<circle class="halo" r="26"/><circle class="raak" r="30"/><circle class="hart" r="13"/><circle class="ring" r="16"/>
        <g class="bordje"><rect rx="10"/><text class="naam">${veilig(p.naam)}</text><text class="regel">${regel}</text></g>`;
    bubbels.appendChild(g);
    const naam = g.querySelector('.naam'), sub = g.querySelector('.regel');
    const w = Math.max(naam.getBBox().width, sub.getBBox().width) + 32, hoogte = 80;
    const bx = x + 30 + w > BREED - 40 ? -30 - w : 30;
    Object.entries({ x: bx, y: -hoogte / 2, width: w, height: hoogte }).forEach(([k, v]) => g.querySelector('rect').setAttribute(k, v));
    naam.setAttribute('x', bx + 16); naam.setAttribute('y', -6);
    sub.setAttribute('x', bx + 16); sub.setAttribute('y', 26);
    bubbelVan[p.id] = g;
}

// --- Wat er oplicht ------------------------------------------------------
// Een plek (met de lijnen van haar samenwerkingen) of een bijeenkomst (al haar plekken).

const selectieVanPlek = (id) => {
    const samen = EVENEMENTEN.filter((e) => e.plekken.length > 1 && e.plekken.includes(id));
    return { sleutel: 'p:' + id, plekken: [id], partners: samen.flatMap((e) => e.plekken), evenementen: samen.map((e) => e.id), regels: EVENEMENTEN.filter((e) => e.plekken.includes(id)).map((e) => e.id) };
};
const selectieVanEvenement = (e) => ({ sleutel: 'e:' + e.id, plekken: e.plekken, partners: e.plekken, evenementen: [e.id], regels: [e.id] });

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
        if (plekken.has(id)) bubbels.appendChild(g); // bovenop de andere bubbels
    }
    for (const [id, lijst] of Object.entries(lijnenVan)) lijst.forEach((l) => l.classList.toggle('aan', evenementen.has(id)));
    legenda.querySelectorAll('[data-evenement]').forEach((k) => k.classList.toggle('open', regels.has(k.dataset.evenement)));
}
const zweefOp = (sel) => { zweef = sel; teken(); };
function zetVast(sel) {
    vast = vast && vast.sleutel === sel?.sleutel ? null : sel;
    teken();
    toonKaartje(vast);
}

for (const [id, g] of Object.entries(bubbelVan)) {
    g.addEventListener('mouseenter', () => zweefOp(selectieVanPlek(id)));
    g.addEventListener('mouseleave', () => zweefOp(null));
    g.addEventListener('click', () => zetVast(selectieVanPlek(id)));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zetVast(selectieVanPlek(id)); } });
}

// --- Legenda -------------------------------------------------------------

// Een reeks die deels geweest is, staat in beide groepen met de bijbehorende data.
const rijenVoor = (kies, volgorde) => EVENEMENTEN
    .map((e) => ({ e, data: e.data.filter(kies) }))
    .filter((r) => r.data.length)
    .sort((a, b) => volgorde * a.data[0].localeCompare(b.data[0]));
const groepen = [
    { kop: 'Komt eraan', soort: 'komt', rijen: rijenVoor((d) => d >= VANDAAG, 1) },
    { kop: 'Geweest', soort: 'geweest', rijen: rijenVoor((d) => d < VANDAAG, -1) },
];
for (const groep of groepen) {
    if (!groep.rijen.length) continue;
    const sectie = document.createElement('section');
    sectie.innerHTML = `<h2><span class="dt-stip ${groep.soort}" aria-hidden="true"></span>${groep.kop}</h2><ul></ul>`;
    for (const { e, data } of groep.rijen) {
        const losseNamen = e.plekken.map((id) => PLEKKEN[id].naam).filter((n) => !e.titel.includes(n));
        const li = document.createElement('li');
        li.innerHTML = `<button type="button" data-evenement="${veilig(e.id)}">
            <span class="datum">${opsomming(data.map(kortDatum))}</span>
            <span class="titel">${veilig(e.titel)}</span>
            ${e.ondertitel ? `<span class="sub">${veilig(e.ondertitel)}</span>` : ''}
            ${losseNamen.length ? `<span class="plek">${veilig(losseNamen.join(' × '))}</span>` : ''}</button>`;
        const knop = li.querySelector('button');
        knop.addEventListener('mouseenter', () => zweefOp(selectieVanEvenement(e)));
        knop.addEventListener('mouseleave', () => zweefOp(null));
        knop.addEventListener('focus', () => zweefOp(selectieVanEvenement(e)));
        knop.addEventListener('blur', () => zweefOp(null));
        knop.addEventListener('click', () => zetVast(selectieVanEvenement(e)));
        sectie.querySelector('ul').appendChild(li);
    }
    legenda.appendChild(sectie);
}
if (!EVENEMENTEN.length) legenda.innerHTML = '<p class="dt-leeg">Nog geen bijeenkomsten.</p>';

// --- Kaartje boven de kaart ----------------------------------------------

function itemHtml(e) {
    const komt = komtNog(e);
    // Per datum alleen tonen als er iets te vertellen is: wat er gebeurt, of waar (bij een samenwerking).
    const metPlek = e.plekken.length > 1;
    const momenten = e.momenten.length > 1 && e.momenten.some((m) => m.wat || (metPlek && m.plek))
        ? `<ul class="dt-momenten">${e.momenten.map((m) => `<li>${kortDatum(m.datum)}${m.wat ? ': ' + veilig(m.wat) : ''}${metPlek && m.plek && PLEKKEN[m.plek] ? ' bij ' + veilig(PLEKKEN[m.plek].naam) : ''}</li>`).join('')}</ul>`
        : '';
    const eersteTekst = e.blokken.find((b) => b.type === 'tekst')?.tekst || '';
    const samenvatting = e.samenvatting || (eersteTekst.length > 220 ? eersteTekst.slice(0, 220).replace(/\s+\S*$/, '') + '…' : eersteTekst);
    return `<div class="dt-item">
        ${e.omslag ? `<img src="${fotoUrl(e.omslag)}" alt="" loading="lazy">` : ''}
        <p class="dt-datumregel"><span class="dt-label ${komt ? 'komt' : ''}">${komt ? 'Komt eraan' : 'Geweest'}</span>${opsomming(e.data.map(kortDatum))}</p>
        <h3>${veilig(e.titel)}</h3>
        ${e.ondertitel ? `<p>${veilig(e.ondertitel)}</p>` : ''}
        ${e.thema ? `<p class="dt-thema">${veilig(e.thema)}</p>` : ''}
        ${momenten}
        ${samenvatting ? `<p>${veilig(samenvatting)}</p>` : ''}
        ${heeftVerhaal(e) ? `<a class="dt-verder" href="#verhaal/${encodeURIComponent(e.id)}">Lees het verhaal →</a>` : ''}
    </div>`;
}

function toonKaartje(sel) {
    if (!sel) { kaartje.hidden = true; kaartje.innerHTML = ''; return; }
    const isPlek = sel.sleutel.startsWith('p:');
    const lijst = EVENEMENTEN.filter((e) => sel.regels.includes(e.id))
        .sort((a, b) => (komtNog(b) - komtNog(a)) || a.data[0].localeCompare(b.data[0]));
    kaartje.innerHTML = `<button type="button" class="dt-kaartje-sluit" aria-label="Sluiten">×</button>
        ${isPlek ? `<div class="dt-kaartje-kop"><h2>${veilig(PLEKKEN[sel.plekken[0]].naam)}</h2></div>` : ''}
        ${lijst.map(itemHtml).join('')}`;
    kaartje.hidden = false;
    kaartje.scrollTop = 0;
    // Klik je verder naar beneden in de legenda, dan schuift het kaartje in beeld.
    const vak = kaartje.getBoundingClientRect();
    if (vak.top < 80 || vak.top > innerHeight - 120) kaartje.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    kaartje.querySelector('.dt-kaartje-sluit').addEventListener('click', () => zetVast(null));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && vast) zetVast(null); });

// --- Verhaal (#verhaal/<id>) ---------------------------------------------

function blokHtml(b) {
    if (b.type === 'tekst') return alineas(b.tekst);
    if (b.type === 'foto') return `<figure><img src="${fotoUrl(b.foto)}" alt="${veilig(b.onderschrift)}" loading="lazy">${b.onderschrift ? `<figcaption>${veilig(b.onderschrift)}</figcaption>` : ''}</figure>`;
    if (b.type === 'reeks') return `<div class="dt-reeks">${b.fotos.map((f) => `<figure><a href="${fotoUrl(f.foto)}" target="_blank" rel="noopener"><img src="${fotoUrl(f.foto)}" alt="${veilig(f.onderschrift)}" loading="lazy"></a>${f.onderschrift ? `<figcaption>${veilig(f.onderschrift)}</figcaption>` : ''}</figure>`).join('')}</div>`;
    if (b.type === 'citaat') return `<blockquote><p>${veilig(b.tekst)}</p>${b.bron ? `<footer>${veilig(b.bron)}</footer>` : ''}</blockquote>`;
    return '';
}

function toonVerhaal() {
    const id = decodeURIComponent((location.hash.match(/^#verhaal\/(.+)$/) || [])[1] || '');
    const e = EVENEMENTEN.find((x) => x.id === id);
    if (!e) {
        verhaal.hidden = true;
        kaartweergave.hidden = false;
        kop.hidden = false;
        document.title = 'Op doortocht | andere vragen';
        return;
    }
    const momenten = e.momenten.map((m) => `<li>${langDatum(m.datum)}${m.wat ? ': ' + veilig(m.wat) : ''}${m.plek && PLEKKEN[m.plek] ? ' bij ' + veilig(PLEKKEN[m.plek].naam) : ''}</li>`).join('');
    verhaal.innerHTML = `<a class="dt-terug" href="#">← Terug naar de kaart</a>
        <h1>${veilig(e.titel)}</h1>
        ${e.ondertitel ? `<p class="dt-ondertitel">${veilig(e.ondertitel)}</p>` : ''}
        <ul class="dt-meta">${momenten}<li>${veilig(e.plekken.map((p) => PLEKKEN[p].naam).join(' × '))}</li></ul>
        ${e.omslag ? `<figure class="dt-omslag"><img src="${fotoUrl(e.omslag)}" alt=""></figure>` : ''}
        ${e.thema ? `<p class="dt-thema-groot">${veilig(e.thema)}</p>` : ''}
        ${e.blokken.map(blokHtml).join('')}`;
    kaartweergave.hidden = true;
    kop.hidden = true;
    verhaal.hidden = false;
    document.title = `${e.titel} | Op doortocht | andere vragen`;
    requestAnimationFrame(() => window.scrollTo(0, 0));
    verhaal.querySelector('h1').setAttribute('tabindex', '-1');
    verhaal.querySelector('h1').focus({ preventScroll: true });
}
window.addEventListener('hashchange', toonVerhaal);
toonVerhaal();
