// Getekende lappendekenkaart van Rotterdam, gedeeld door /op-doortocht.html en het beheerscherm.
// De vormen komen uit beeld/kaart/kaart.svg (OpenStreetMap + CBS-buurten, gemaakt met
// claude-projects/andere-vragen-kaart/teken.mjs). Kleuren, arceringen en krijt komen hier.

const ns = 'http://www.w3.org/2000/svg';

// Kleurparen uit Seans tekening: [vlak, arcering].
const KLEUREN = [
    ['#F7C9CF', '#E8432E'], ['#A8D26B', '#2F7D3A'], ['#F5DF4D', '#E8432E'], ['#8EC5EA', '#2E50D0'],
    ['#F08A72', '#8C1F2B'], ['#3FB6C8', '#1E2A5A'], ['#C8A2D6', '#8C1F2B'], ['#FFFFFF', '#E8432E'],
    ['#3E9A4A', '#F5DF4D'], ['#E8432E', '#F7C9CF'], ['#F2A3B3', '#2E50D0'], ['#FBF3D6', '#3E9A4A'],
];
const MOTIEVEN = ['lijnen', 'kruis', 'krul', 'stip', 'golf'];
const RUST = { vlak: 0.45, inkt: 0.45 };

// Kleine tekening per arceringssoort, in een tegel van 14x14.
function motief(soort, inkt) {
    const s = `stroke="${inkt}" stroke-width="2" fill="none" stroke-linecap="round"`;
    switch (soort) {
        case 'lijnen': return `<path d="M7 -2V16" ${s}/>`;
        case 'kruis': return `<path d="M7 -2V16M-2 7H16" ${s} stroke-width="1.5"/>`;
        case 'krul': return `<path d="M-1 10c3 0 4-6 7-6s3 6 0 6-1-6 3-6 4 6 6 6" ${s} stroke-width="1.6"/>`;
        case 'stip': return `<circle cx="7" cy="7" r="2.2" fill="${inkt}"/>`;
        case 'golf': return `<path d="M-1 7q4-5 8 0t8 0" ${s}/>`;
    }
}

function maakPatroon(defs, id, vlak, inkt, soort, hoek, maat = 14, inktSterkte = 1) {
    const p = document.createElementNS(ns, 'pattern');
    Object.entries({ id, patternUnits: 'userSpaceOnUse', width: 14, height: 14, patternTransform: `rotate(${hoek}) scale(${maat / 14})` })
        .forEach(([k, v]) => p.setAttribute(k, v));
    p.innerHTML = `<rect width="14" height="14" fill="${vlak}"/><g opacity="${inktSterkte}">${motief(soort, inkt)}</g>`;
    defs.appendChild(p);
}

// Mengt een kleur met wit (t = 0 blijft gelijk, t = 1 is wit).
function licht(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const kanaal = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
    return '#' + kanaal(n >> 16) + kanaal((n >> 8) & 255) + kanaal(n & 255);
}

// Vaste "willekeur" per lap, zodat de deken elke keer hetzelfde ligt.
const hash = (tekst) => { let h = 2166136261; for (const c of String(tekst)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export const maakSvg = (tag, attrs = {}) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
};

// Tekent de kaart in `vak` en geeft hulpmiddelen terug om er pins en lijnen op te zetten.
export async function tekenKaart(vak, basis = 'beeld/kaart/') {
    const [svgTekst, maat] = await Promise.all([
        fetch(basis + 'kaart.svg').then((r) => r.text()),
        fetch(basis + 'kaart-maat.json').then((r) => r.json()),
    ]);
    vak.innerHTML = svgTekst;
    const svg = vak.querySelector('svg');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Getekende kaart van Rotterdam');
    svg.querySelectorAll('#bebouwd, #industrie').forEach((g) => g.remove());
    const { GEBIED, BREED, HOOG } = maat;

    const defs = maakSvg('defs');
    defs.innerHTML = `
        <filter id="krijt" x="-1%" y="-1%" width="102%" height="102%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="golf"/>
            <feDisplacementMap in="SourceGraphic" in2="golf" scale="6" xChannelSelector="R" yChannelSelector="G" result="wiebel"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="korrel"/>
            <feColorMatrix in="korrel" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 -0.55" result="gaatjes"/>
            <feComposite in="wiebel" in2="gaatjes" operator="in"/>
        </filter>
        <clipPath id="waterclip"></clipPath>`;
    svg.prepend(defs);

    maakPatroon(defs, 'p-papier', '#FBF7EE', '#D9C3E6', 'krul', 15, 22, 0.35);
    maakPatroon(defs, 'p-water', '#7DBDEA', '#FFFFFF', 'golf', -8, 40, 0.35);
    maakPatroon(defs, 'p-groen', licht('#A8D26B', 0.25), '#2F7D3A', 'lijnen', 35, 12, 0.45);
    const papier = maakSvg('rect', { width: BREED, height: HOOG, fill: 'url(#p-papier)' });
    svg.prepend(papier);

    // Lappen: elke buurt een eigen kleur, arcering en hoek.
    svg.querySelectorAll('#lappen path').forEach((pad, i) => {
        const h = hash(pad.dataset.id);
        const [vlak, inkt] = KLEUREN[h % KLEUREN.length];
        const soort = MOTIEVEN[(h >>> 8) % MOTIEVEN.length];
        const hoek = ((h >>> 16) % 12) * 15;
        maakPatroon(defs, 'p-lap-' + i, licht(vlak, RUST.vlak), inkt, soort, hoek, 14 + ((h >>> 4) % 3) * 4, RUST.inkt);
        pad.setAttribute('fill', `url(#p-lap-${i})`);
    });
    svg.querySelector('#groen path').setAttribute('fill', 'url(#p-groen)');

    // Water met diepte: de gele oever blijft zichtbaar aan de bovenrand, het water zakt iets.
    const waterGroep = svg.querySelector('#water');
    const waterPad = waterGroep.querySelector('path:not(.vaart)');
    svg.querySelector('#waterclip').appendChild(maakSvg('path', { d: waterPad.getAttribute('d'), 'clip-rule': 'evenodd', 'fill-rule': 'evenodd' }));
    const oever = waterPad.cloneNode();
    oever.setAttribute('class', 'oever');
    waterPad.before(oever);
    Object.entries({ fill: 'url(#p-water)', transform: 'translate(0 7)', 'clip-path': 'url(#waterclip)', stroke: 'none' })
        .forEach(([k, v]) => waterPad.setAttribute(k, v));
    const kader = oever.cloneNode();
    kader.setAttribute('class', 'waterkader');
    waterGroep.appendChild(kader);

    const groot = svg.querySelector('#wegen-groot');
    const rand = groot.cloneNode(true);
    rand.id = 'wegen-groot-rand';
    rand.setAttribute('class', 'rand-groot');
    groot.before(rand);

    // Alles behalve de achtergrond gaat door het krijtfilter.
    const getekend = maakSvg('g', { class: 'krijt' });
    [...svg.children].filter((c) => c !== defs && c !== papier).forEach((c) => getekend.appendChild(c));
    svg.appendChild(getekend);

    // Krulletjesrand rondom, zoals de rand van de tekening.
    maakPatroon(defs, 'p-rand', '#E9DDF0', '#FFFFFF', 'krul', 0, 20);
    const r = 34;
    svg.appendChild(maakSvg('path', {
        d: `M0 0H${BREED}V${HOOG}H0Z M${r} ${r}V${HOOG - r}H${BREED - r}V${r}Z`,
        fill: 'url(#p-rand)', 'fill-rule': 'evenodd', class: 'krijt',
    }));

    const naarKaart = (lat, lon) => [
        (lon - GEBIED.w) / (GEBIED.e - GEBIED.w) * BREED,
        (GEBIED.n - lat) / (GEBIED.n - GEBIED.s) * HOOG,
    ];
    const vanKaart = (x, y) => ({
        lat: GEBIED.n - (y / HOOG) * (GEBIED.n - GEBIED.s),
        lon: GEBIED.w + (x / BREED) * (GEBIED.e - GEBIED.w),
    });
    // Schermpositie (muis/vinger) naar kaartcoördinaten in de viewBox.
    const schermNaarKaart = (clientX, clientY) => {
        const p = svg.createSVGPoint();
        p.x = clientX;
        p.y = clientY;
        const uit = p.matrixTransform(svg.getScreenCTM().inverse());
        return [Math.min(Math.max(uit.x, 0), BREED), Math.min(Math.max(uit.y, 0), HOOG)];
    };
    const binnenGebied = (lat, lon) => lat >= GEBIED.s && lat <= GEBIED.n && lon >= GEBIED.w && lon <= GEBIED.e;

    return { svg, BREED, HOOG, naarKaart, vanKaart, schermNaarKaart, binnenGebied };
}
