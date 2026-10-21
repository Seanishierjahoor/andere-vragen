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

// Opmaak van de kaartlagen. Staat ín de SVG, zodat ook een afbeelding van de kaart (zie maakAfbeelding)
// er precies zo uitziet. Met de klasse "lijnwerk" op de svg is de kaart kleurloos: crème met dunne
// petrol lijnen en koraal water, in de kleuren van de huisstijl.
const KAART_STIJL = `
    #lappen path, #lappen-effen path { stroke: #2E50D0; stroke-width: 1.6; stroke-linejoin: round; stroke-opacity: .55; }
    #groen path { stroke: #2F7D3A; stroke-width: 1.6; }
    .oever { fill: #F5DF4D; stroke: none; }
    .waterkader { fill: none; stroke: #1E2A5A; stroke-width: 2.6; stroke-linejoin: round; }
    .vaart { fill: none; stroke: #6FB4E6; stroke-width: 3; }
    #spoor path { fill: none; stroke: #1E2A5A; stroke-width: 1.6; stroke-dasharray: 2 5; stroke-linecap: round; }
    #wegen-klein path { fill: none; stroke: #FFFDF6; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    #wegen-groot path { fill: none; stroke: #FFFDF6; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
    #wegen-groot-rand path { fill: none; stroke: #2E50D0; stroke-width: 8.5; stroke-linecap: round; stroke-linejoin: round; }

    .lijnwerk #papier { fill: #F3EFE6; }
    .lijnwerk #lappen, .lijnwerk .oever, .lijnwerk #wegen-groot-rand { display: none; }
    .lijnwerk #lappen-effen path { fill: #F3EFE6; stroke: #193B3A; stroke-opacity: .3; stroke-width: 1.1; }
    .lijnwerk #groen path { fill: #F3EFE6; stroke: #193B3A; stroke-opacity: .32; stroke-width: 1; }
    .lijnwerk .watervlak { fill: #F3EFE6; }
    .lijnwerk .waterkader { stroke: #E96A4B; stroke-width: 1.8; }
    .lijnwerk .vaart { stroke: #E96A4B; stroke-width: 1.4; }
    .lijnwerk #spoor path { stroke: #193B3A; stroke-opacity: .45; stroke-width: 1.2; }
    .lijnwerk #wegen-klein path { stroke: #193B3A; stroke-opacity: .2; stroke-width: 1.3; }
    .lijnwerk #wegen-groot path { stroke: #193B3A; stroke-opacity: .4; stroke-width: 2; }
`;

// Tekent de kaart in `vak` en geeft hulpmiddelen terug om er pins en lijnen op te zetten.
export async function tekenKaart(vak, { basis = 'beeld/kaart/', rand = true, lijnwerk = false } = {}) {
    const [svgTekst, maat] = await Promise.all([
        fetch(basis + 'kaart.svg').then((r) => r.text()),
        fetch(basis + 'kaart-maat.json').then((r) => r.json()),
    ]);
    vak.innerHTML = svgTekst;
    const svg = vak.querySelector('svg');
    // Meteen in de goede stand, nog voordat de browser iets tekent (anders flitst de kleur even).
    if (lijnwerk) svg.classList.add('lijnwerk');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Getekende kaart van Rotterdam');
    svg.querySelectorAll('#bebouwd, #industrie').forEach((g) => g.remove());
    const { GEBIED, BREED, HOOG } = maat;

    const defs = maakSvg('defs');
    defs.innerHTML = `<style>${KAART_STIJL}</style><clipPath id="waterclip"></clipPath>`;
    svg.prepend(defs);

    maakPatroon(defs, 'p-papier', '#FBF7EE', '#D9C3E6', 'krul', 15, 22, 0.35);
    maakPatroon(defs, 'p-water', '#7DBDEA', '#FFFFFF', 'golf', -8, 40, 0.35);
    maakPatroon(defs, 'p-groen', licht('#A8D26B', 0.25), '#2F7D3A', 'lijnen', 35, 12, 0.45);
    const papier = maakSvg('rect', { id: 'papier', width: BREED, height: HOOG, fill: 'url(#p-papier)' });

    // Lappen: elke buurt een eigen kleur, arcering en hoek. Daaronder een effen laag in zachte
    // tinten (en in lijnwerk de crème vlakken met dunne lijnen).
    const lappen = svg.querySelector('#lappen');
    const effen = lappen.cloneNode(true);
    effen.id = 'lappen-effen';
    lappen.before(effen);
    const effenPaden = [...effen.querySelectorAll('path')];
    lappen.querySelectorAll('path').forEach((pad, i) => {
        const h = hash(pad.dataset.id);
        const [vlak, inkt] = KLEUREN[h % KLEUREN.length];
        const soort = MOTIEVEN[(h >>> 8) % MOTIEVEN.length];
        const hoek = ((h >>> 16) % 12) * 15;
        maakPatroon(defs, 'p-lap-' + i, licht(vlak, RUST.vlak), inkt, soort, hoek, 14 + ((h >>> 4) % 3) * 4, RUST.inkt);
        pad.setAttribute('fill', `url(#p-lap-${i})`);
        effenPaden[i].setAttribute('fill', licht(vlak, 0.62));
    });
    svg.querySelector('#groen path').setAttribute('fill', 'url(#p-groen)');

    // Water met diepte: de gele oever blijft zichtbaar aan de bovenrand, het water zakt iets.
    const waterGroep = svg.querySelector('#water');
    const waterPad = waterGroep.querySelector('path:not(.vaart)');
    svg.querySelector('#waterclip').appendChild(maakSvg('path', { d: waterPad.getAttribute('d'), 'clip-rule': 'evenodd', 'fill-rule': 'evenodd' }));
    const oever = waterPad.cloneNode();
    oever.setAttribute('class', 'oever');
    waterPad.before(oever);
    Object.entries({ fill: 'url(#p-water)', transform: 'translate(0 7)', 'clip-path': 'url(#waterclip)', stroke: 'none', class: 'watervlak' })
        .forEach(([k, v]) => waterPad.setAttribute(k, v));
    const kader = oever.cloneNode();
    kader.setAttribute('class', 'waterkader');
    waterGroep.appendChild(kader);

    const groot = svg.querySelector('#wegen-groot');
    const wegRand = groot.cloneNode(true);
    wegRand.id = 'wegen-groot-rand';
    wegRand.removeAttribute('class');
    groot.before(wegRand);

    // Alle getekende lagen samen in één groep, zodat de pagina ze in één keer kan wisselen
    // met een afbeelding (tijdens bewegen).
    const vector = maakSvg('g', { class: 'kaartvector' });
    [...svg.children].filter((c) => c !== defs).forEach((c) => vector.appendChild(c));
    vector.prepend(papier);
    svg.appendChild(vector);

    // Krulletjesrand rondom, zoals de rand van de tekening (niet als de kaart schermvullend is).
    if (rand) {
        maakPatroon(defs, 'p-rand', '#E9DDF0', '#FFFFFF', 'krul', 0, 20);
        const r = 34;
        svg.appendChild(maakSvg('path', {
            d: `M0 0H${BREED}V${HOOG}H0Z M${r} ${r}V${HOOG - r}H${BREED - r}V${r}Z`,
            fill: 'url(#p-rand)', 'fill-rule': 'evenodd',
        }));
    }

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

    // Maakt een afbeelding (blob-URL) van de getekende kaart, in kleur of als lijnwerk.
    // Een afbeelding verschuiven en schalen is voor de browser veel lichter dan de vectorkaart.
    async function maakAfbeelding({ lijnwerk = false, schaal = 1.5 } = {}) {
        const kopie = maakSvg('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${BREED} ${HOOG}`, width: Math.round(BREED * schaal), height: Math.round(HOOG * schaal), class: lijnwerk ? 'lijnwerk' : '' });
        kopie.append(defs.cloneNode(true), vector.cloneNode(true));
        const bron = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(kopie)], { type: 'image/svg+xml' }));
        try {
            const beeld = new Image();
            beeld.src = bron;
            await beeld.decode();
            const doek = document.createElement('canvas');
            doek.width = kopie.getAttribute('width');
            doek.height = kopie.getAttribute('height');
            doek.getContext('2d').drawImage(beeld, 0, 0, doek.width, doek.height);
            const blob = await new Promise((klaar) => doek.toBlob(klaar, 'image/webp', 0.9));
            return URL.createObjectURL(blob);
        } finally {
            URL.revokeObjectURL(bron);
        }
    }

    return { svg, BREED, HOOG, naarKaart, vanKaart, schermNaarKaart, binnenGebied, maakAfbeelding };
}
