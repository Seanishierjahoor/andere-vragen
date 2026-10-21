// Beheerscherm voor Op doortocht: plekken (adres zoeken, pin slepen) en bijeenkomsten
// (gegevens, data, omslagfoto en een verhaal van blokken). Alles wordt in één keer
// opgeslagen via /.netlify/functions/beheer-doortocht; foto's gaan los naar /doortocht-foto.

import { tekenKaart, maakSvg } from './op-doortocht-kaart.js';

const FUNCTIE = '/.netlify/functions/beheer-doortocht';
const MAX_FOTO = 2000; // langste zijde in pixels na verkleinen

let wachtwoord = '';
let gegevens = { plekken: [], evenementen: [] };
let gewijzigd = false;
let gekozenEvenement = null;
let gekozenPlek = null;
let kaart = null;

const $ = (id) => document.getElementById(id);

// Klein hulpje om elementen te bouwen zonder innerHTML (gebruikersinvoer blijft tekst).
function h(tag, attrs = {}, ...kinderen) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'tekst') el.textContent = v;
        else if (k === 'waarde') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const kind of kinderen.flat()) if (kind !== null && kind !== undefined && kind !== false) el.append(kind);
    return el;
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const kortDatum = (iso) => iso ? `${+iso.slice(8, 10)} ${MAANDEN[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : 'geen datum';
const fotoUrl = (id) => '/doortocht-foto/' + encodeURIComponent(id);
const plekNaam = (id) => gegevens.plekken.find((p) => p.id === id)?.naam || '?';

function maakSleutel(tekst, bestaand) {
    const basis = String(tekst || 'nieuw').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'nieuw';
    let sleutel = basis, n = 2;
    while (bestaand.has(sleutel)) sleutel = `${basis}-${n++}`;
    return sleutel;
}

// --- Status en opslaan ---------------------------------------------------

function zetStatus(tekst) { $('status').textContent = tekst; }
function markeerGewijzigd() {
    gewijzigd = true;
    $('opslaan').disabled = false;
    zetStatus('Niet opgeslagen wijzigingen');
}
window.addEventListener('beforeunload', (e) => { if (gewijzigd) { e.preventDefault(); e.returnValue = ''; } });

async function roep(actie, extra = {}) {
    const antwoord = await fetch(FUNCTIE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: wachtwoord, actie, ...extra }),
    });
    const data = await antwoord.json().catch(() => ({ ok: false, error: 'Geen geldig antwoord van de server.' }));
    if (!data.ok) throw new Error(data.error || 'Er ging iets mis.');
    return data;
}

$('opslaan').addEventListener('click', async () => {
    $('opslaan').disabled = true;
    zetStatus('Opslaan…');
    try {
        const data = await roep('opslaan', { gegevens });
        gegevens = data.gegevens;
        gewijzigd = false;
        zetStatus('Opgeslagen ✓ (de pagina is binnen een minuut bijgewerkt)');
        tekenAlles();
    } catch (fout) {
        $('opslaan').disabled = false;
        zetStatus('Niet opgeslagen: ' + fout.message);
    }
});

// --- Inloggen ------------------------------------------------------------

async function inloggen(ww) {
    wachtwoord = ww;
    const data = await roep('ophalen');
    gegevens = data.gegevens;
    try { sessionStorage.setItem('bh-ww', ww); } catch { /* privévenster: dan maar opnieuw inloggen */ }
    $('inloggen').hidden = true;
    $('werkplek').hidden = false;
    $('balk-acties').hidden = false;
    gekozenEvenement = gesorteerdeEvenementen()[0]?.id || null;
    gekozenPlek = gegevens.plekken[0]?.id || null;
    tekenAlles();
}

$('inloggen').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('inlog-fout').textContent = '';
    try { await inloggen($('wachtwoord').value); } catch (fout) { $('inlog-fout').textContent = fout.message; }
});

try {
    const bewaard = sessionStorage.getItem('bh-ww');
    if (bewaard) inloggen(bewaard).catch(() => sessionStorage.removeItem('bh-ww'));
} catch { /* geen opslag beschikbaar */ }

// --- Tabs ----------------------------------------------------------------

const tabs = { bijeenkomsten: $('tab-bijeenkomsten'), plekken: $('tab-plekken') };
for (const [naam, knop] of Object.entries(tabs)) {
    knop.addEventListener('click', () => {
        for (const [ander, k] of Object.entries(tabs)) {
            k.setAttribute('aria-selected', String(ander === naam));
            $('paneel-' + ander).hidden = ander !== naam;
        }
        tekenAlles();
    });
}

function tekenAlles() {
    tekenEvenementenLijst();
    tekenEvenement();
    tekenPlekkenLijst();
    tekenPlek();
    if (!$('paneel-plekken').hidden) tekenPins();
}

// --- Bijeenkomsten -------------------------------------------------------

const eersteDatum = (e) => e.momenten.map((m) => m.datum).filter(Boolean).sort()[0] || '';
const gesorteerdeEvenementen = () => [...gegevens.evenementen].sort((a, b) => eersteDatum(b).localeCompare(eersteDatum(a)));

function tekenEvenementenLijst() {
    const lijst = $('lijst-bijeenkomsten');
    lijst.replaceChildren(...gesorteerdeEvenementen().map((e) => h('li', {},
        h('button', { type: 'button', 'aria-current': String(e.id === gekozenEvenement), onclick: () => { gekozenEvenement = e.id; tekenEvenementenLijst(); tekenEvenement(); } },
            h('span', { tekst: e.titel || '(zonder titel)' }),
            h('small', { tekst: e.momenten.map((m) => kortDatum(m.datum)).join(', ') }),
            e.zichtbaar === false ? h('span', { class: 'bh-verborgen', tekst: 'Verborgen' }) : null,
        ),
    )));
}

$('nieuwe-bijeenkomst').addEventListener('click', () => {
    const id = maakSleutel('nieuwe-bijeenkomst', new Set(gegevens.evenementen.map((e) => e.id)));
    gegevens.evenementen.push({
        id, titel: 'Nieuwe bijeenkomst', ondertitel: '', thema: '', samenvatting: '',
        plekken: [], momenten: [{ datum: new Date().toLocaleDateString('sv-SE'), plek: '', wat: '' }],
        omslag: null, blokken: [], zichtbaar: false,
    });
    gekozenEvenement = id;
    markeerGewijzigd();
    tekenEvenementenLijst();
    tekenEvenement();
    $('bewerk-bijeenkomst').querySelector('input')?.select();
});

// Tekstveld dat direct in het evenement schrijft (zonder opnieuw te tekenen, dan blijft de focus).
function veld(obj, sleutel, label, { lang = false, hulp = '', naWijzig } = {}) {
    const id = 'v-' + Math.random().toString(36).slice(2);
    const invoer = h(lang ? 'textarea' : 'input', {
        id, type: lang ? undefined : 'text', waarde: obj[sleutel] || '',
        oninput: (e) => { obj[sleutel] = e.target.value; markeerGewijzigd(); naWijzig?.(); },
    });
    return h('div', {}, h('label', { for: id, tekst: label }), hulp ? h('p', { class: 'bh-hulp', tekst: hulp }) : null, invoer);
}

function tekenEvenement() {
    const vak = $('bewerk-bijeenkomst');
    const e = gegevens.evenementen.find((x) => x.id === gekozenEvenement);
    if (!e) { vak.replaceChildren(h('p', { class: 'bh-hulp', tekst: 'Kies links een bijeenkomst, of maak een nieuwe.' })); return; }
    const herteken = () => { markeerGewijzigd(); tekenEvenement(); tekenEvenementenLijst(); };
    const lijstBij = () => tekenEvenementenLijst();

    const algemeen = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Over de bijeenkomst' }),
        h('div', { class: 'bh-velden' },
            veld(e, 'titel', 'Titel', { naWijzig: lijstBij }),
            veld(e, 'ondertitel', 'Ondertitel', { hulp: 'Bijvoorbeeld "Filosofisch gesprek" of "Filmvertoning en vervolggesprek".' }),
            veld(e, 'thema', 'Thema of vraag', { hulp: 'Komt groot in beeld, bijvoorbeeld "Wanneer is iets van jou?"' }),
            veld(e, 'samenvatting', 'Korte samenvatting (optioneel)', { lang: true, hulp: 'Staat in het kaartje op de kaart. Leeg laten: dan nemen we het begin van het verhaal.' }),
            h('div', { class: 'bh-vinkjes' },
                h('label', {}, h('input', { type: 'checkbox', checked: e.zichtbaar !== false, onchange: (ev) => { e.zichtbaar = ev.target.checked; markeerGewijzigd(); lijstBij(); } }), 'Zichtbaar op de site'),
            ),
        ),
    );

    const plekken = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Plekken' }),
        h('p', { class: 'bh-hulp', tekst: 'Kies er meer dan één bij een samenwerking: dan komt er een stippellijn tussen. Een nieuwe plek maak je onder "Plekken".' }),
        h('div', { class: 'bh-vinkjes' }, gegevens.plekken.map((p) => h('label', {},
            h('input', {
                type: 'checkbox', checked: e.plekken.includes(p.id),
                onchange: (ev) => {
                    e.plekken = ev.target.checked ? [...e.plekken, p.id] : e.plekken.filter((x) => x !== p.id);
                    herteken();
                },
            }), p.naam))),
    );

    const momenten = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Data' }),
        h('p', { class: 'bh-hulp', tekst: 'Bij een reeks of samenwerking kun je per datum zeggen wat er gebeurt en waar.' }),
        h('div', { class: 'bh-momenten' }, e.momenten.map((m, i) => h('div', { class: 'bh-moment' },
            h('input', { type: 'date', 'aria-label': 'Datum', waarde: m.datum, onchange: (ev) => { m.datum = ev.target.value; markeerGewijzigd(); lijstBij(); } }),
            h('input', { type: 'text', 'aria-label': 'Wat gebeurt er', placeholder: 'Wat (optioneel), bijv. filmvertoning', waarde: m.wat, oninput: (ev) => { m.wat = ev.target.value; markeerGewijzigd(); } }),
            h('select', { 'aria-label': 'Plek', onchange: (ev) => { m.plek = ev.target.value; markeerGewijzigd(); } },
                h('option', { value: '', tekst: 'Plek (optioneel)' }),
                e.plekken.map((id) => h('option', { value: id, selected: m.plek === id, tekst: plekNaam(id) }))),
            h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', 'aria-label': 'Datum weghalen', disabled: e.momenten.length < 2, onclick: () => { e.momenten.splice(i, 1); herteken(); }, tekst: '×' }),
        ))),
        h('div', { class: 'bh-toevoegen' },
            h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: '+ Datum', onclick: () => {
                const laatste = e.momenten[e.momenten.length - 1];
                e.momenten.push({ datum: laatste?.datum || '', plek: '', wat: '' });
                herteken();
            } })),
    );

    const omslag = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Omslagfoto' }),
        fotoKiezer(e.omslag, (id) => { e.omslag = id; herteken(); }),
    );

    const blokken = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Verhaal' }),
        h('p', { class: 'bh-hulp', tekst: 'Stapel blokken: tekst, foto\'s en citaten. Een lege regel in een tekstblok begint een nieuwe alinea.' }),
        h('div', { class: 'bh-blokken' }, e.blokken.map((b, i) => blokEditor(e, b, i, herteken))),
        h('div', { class: 'bh-toevoegen' },
            [['tekst', '+ Tekst', { type: 'tekst', tekst: '' }], ['foto', '+ Foto', { type: 'foto', foto: null, onderschrift: '' }],
             ['reeks', '+ Fotoreeks', { type: 'reeks', fotos: [] }], ['citaat', '+ Citaat', { type: 'citaat', tekst: '', bron: '' }]]
                .map(([, label, nieuw]) => h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: label, onclick: () => { e.blokken.push(structuredClone(nieuw)); herteken(); } })),
        ),
    );

    const weg = h('div', { class: 'bh-onderaan' },
        h('button', { type: 'button', class: 'bh-knop bh-knop-gevaar', tekst: 'Bijeenkomst verwijderen', onclick: () => {
            if (!confirm(`"${e.titel}" verwijderen? Dit wordt definitief na Opslaan.`)) return;
            gegevens.evenementen = gegevens.evenementen.filter((x) => x !== e);
            gekozenEvenement = gesorteerdeEvenementen()[0]?.id || null;
            markeerGewijzigd();
            tekenAlles();
        } }));

    vak.replaceChildren(algemeen, plekken, momenten, omslag, blokken, weg);
}

function blokEditor(e, b, i, herteken) {
    const namen = { tekst: 'Tekst', foto: 'Foto', reeks: 'Fotoreeks', citaat: 'Citaat' };
    const verplaats = (r) => { const [x] = e.blokken.splice(i, 1); e.blokken.splice(i + r, 0, x); herteken(); };
    const kop = h('div', { class: 'bh-blok-kop' },
        h('strong', { tekst: namen[b.type] }),
        h('div', { class: 'bh-blok-knoppen' },
            h('button', { type: 'button', 'aria-label': 'Omhoog', disabled: i === 0, onclick: () => verplaats(-1), tekst: '↑' }),
            h('button', { type: 'button', 'aria-label': 'Omlaag', disabled: i === e.blokken.length - 1, onclick: () => verplaats(1), tekst: '↓' }),
            h('button', { type: 'button', 'aria-label': 'Blok weghalen', onclick: () => { if (confirm('Dit blok weghalen?')) { e.blokken.splice(i, 1); herteken(); } }, tekst: '×' }),
        ));
    let inhoud;
    if (b.type === 'tekst') inhoud = veld(b, 'tekst', 'Tekst', { lang: true });
    if (b.type === 'citaat') inhoud = h('div', { class: 'bh-velden' }, veld(b, 'tekst', 'Citaat', { lang: true }), veld(b, 'bron', 'Van wie (optioneel)'));
    if (b.type === 'foto') inhoud = h('div', { class: 'bh-velden' }, fotoKiezer(b.foto, (id) => { b.foto = id; herteken(); }), veld(b, 'onderschrift', 'Onderschrift (optioneel)'));
    if (b.type === 'reeks') {
        inhoud = h('div', { class: 'bh-velden' },
            h('div', { class: 'bh-reeks' }, b.fotos.map((f, j) => h('div', { class: 'bh-reeks-foto' },
                h('img', { src: fotoUrl(f.foto), alt: '' }),
                h('input', { type: 'text', placeholder: 'Onderschrift', 'aria-label': 'Onderschrift', waarde: f.onderschrift, oninput: (ev) => { f.onderschrift = ev.target.value; markeerGewijzigd(); } }),
                h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: 'Weghalen', onclick: () => { b.fotos.splice(j, 1); herteken(); } }),
            ))),
            uploadKnop('+ Foto\'s toevoegen', true, (ids) => { b.fotos.push(...ids.map((foto) => ({ foto, onderschrift: '' }))); herteken(); }),
        );
    }
    return h('div', { class: 'bh-blok' }, kop, inhoud);
}

// --- Foto's --------------------------------------------------------------

async function verklein(bestand) {
    const beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' });
    const schaal = Math.min(1, MAX_FOTO / Math.max(beeld.width, beeld.height));
    const doek = document.createElement('canvas');
    doek.width = Math.round(beeld.width * schaal);
    doek.height = Math.round(beeld.height * schaal);
    doek.getContext('2d').drawImage(beeld, 0, 0, doek.width, doek.height);
    const alsBlob = (soort, kwaliteit) => new Promise((klaar) => doek.toBlob(klaar, soort, kwaliteit));
    let blob = await alsBlob('image/webp', 0.82);
    if (!blob || blob.type !== 'image/webp') blob = await alsBlob('image/jpeg', 0.85); // Safari maakt geen webp
    return blob;
}

async function upload(bestand) {
    const blob = await verklein(bestand);
    const antwoord = await fetch('/doortocht-foto', {
        method: 'POST',
        headers: { 'Content-Type': blob.type, 'X-Wachtwoord': encodeURIComponent(wachtwoord) },
        body: blob,
    });
    const data = await antwoord.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'Uploaden mislukt.');
    return data.id;
}

async function uploadAlles(bestanden) {
    const lijst = [...bestanden].filter((f) => f.type.startsWith('image/'));
    const ids = [];
    for (const [n, f] of lijst.entries()) {
        zetStatus(`Foto ${n + 1} van ${lijst.length} uploaden…`);
        ids.push(await upload(f));
    }
    zetStatus(gewijzigd ? 'Niet opgeslagen wijzigingen' : '');
    return ids;
}

// Knop + sleepvlak voor foto's. `meer`: meerdere tegelijk.
function uploadKnop(label, meer, klaar, extraVlak) {
    const invoer = h('input', { type: 'file', accept: 'image/*', multiple: meer, hidden: true, onchange: async (ev) => {
        try { const ids = await uploadAlles(ev.target.files); if (ids.length) klaar(ids); } catch (fout) { zetStatus(fout.message); }
    } });
    const knop = h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: label, onclick: () => invoer.click() });
    const vak = h('div', { class: 'bh-toevoegen' }, knop, invoer);
    for (const doel of [vak, extraVlak].filter(Boolean)) {
        doel.addEventListener('dragover', (ev) => { ev.preventDefault(); doel.classList.add('bh-sleep-hier'); });
        doel.addEventListener('dragleave', () => doel.classList.remove('bh-sleep-hier'));
        doel.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            doel.classList.remove('bh-sleep-hier');
            try {
                const ids = await uploadAlles(meer ? ev.dataTransfer.files : [...ev.dataTransfer.files].slice(0, 1));
                if (ids.length) klaar(ids);
            } catch (fout) { zetStatus(fout.message); }
        });
    }
    return vak;
}

function fotoKiezer(huidig, wijzig) {
    const voorbeeld = huidig ? h('img', { src: fotoUrl(huidig), alt: '' }) : h('div', { class: 'bh-foto-leeg', tekst: 'Sleep een foto hierheen' });
    const vak = h('div', { class: 'bh-foto' }, voorbeeld);
    vak.append(uploadKnop(huidig ? 'Andere foto' : 'Kies foto', false, ([id]) => wijzig(id), vak));
    if (huidig) vak.append(h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: 'Weghalen', onclick: () => wijzig(null) }));
    return vak;
}

// --- Plekken -------------------------------------------------------------

function tekenPlekkenLijst() {
    $('lijst-plekken').replaceChildren(...gegevens.plekken.map((p) => h('li', {},
        h('button', { type: 'button', 'aria-current': String(p.id === gekozenPlek), onclick: () => kiesPlek(p.id) },
            h('span', { tekst: p.naam }),
            h('small', { tekst: p.adres || 'Geen adres' }),
        ),
    )));
}

function kiesPlek(id) {
    gekozenPlek = id;
    tekenPlekkenLijst();
    tekenPlek();
    tekenPins();
}

$('nieuwe-plek').addEventListener('click', () => {
    const id = maakSleutel('nieuwe-plek', new Set(gegevens.plekken.map((p) => p.id)));
    // Nieuwe plekken beginnen midden in het centrum; zoek daarna het adres of sleep de pin.
    gegevens.plekken.push({ id, naam: 'Nieuwe plek', adres: '', lat: 51.9205, lon: 4.4805 });
    markeerGewijzigd();
    kiesPlek(id);
    $('bewerk-plek').querySelector('input')?.select();
});

function tekenPlek() {
    const vak = $('bewerk-plek');
    const p = gegevens.plekken.find((x) => x.id === gekozenPlek);
    if (!p) { vak.replaceChildren(h('p', { class: 'bh-hulp', tekst: 'Kies links een plek, of maak een nieuwe.' })); return; }
    const gebruiktDoor = gegevens.evenementen.filter((e) => e.plekken.includes(p.id));

    const suggesties = h('ul', { class: 'bh-suggesties', hidden: true });
    let wacht;
    const zoek = h('input', {
        id: 'adres-zoek', type: 'search', placeholder: 'Bijvoorbeeld Hammerstraat 17 Rotterdam', autocomplete: 'off',
        oninput: (ev) => { clearTimeout(wacht); wacht = setTimeout(() => zoekAdres(ev.target.value, suggesties, p), 250); },
        onkeydown: (ev) => { if (ev.key === 'Escape') suggesties.hidden = true; },
    });

    vak.replaceChildren(h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Plek' }),
        h('div', { class: 'bh-velden' },
            veld(p, 'naam', 'Naam', { naWijzig: () => { tekenPlekkenLijst(); tekenPins(); } }),
            h('div', { class: 'bh-zoek' },
                h('label', { for: 'adres-zoek', tekst: 'Adres zoeken' }),
                h('p', { class: 'bh-hulp', tekst: p.adres ? `Nu: ${p.adres}` : 'Typ een adres en kies het juiste uit de lijst. Daarna kun je de pin nog slepen.' }),
                zoek, suggesties),
            h('p', { class: 'bh-hulp', tekst: gebruiktDoor.length ? `Gebruikt bij: ${gebruiktDoor.map((e) => e.titel).join(', ')}` : 'Nog bij geen enkele bijeenkomst gebruikt.' }),
        ),
        h('div', { class: 'bh-onderaan' },
            h('button', { type: 'button', class: 'bh-knop bh-knop-gevaar bh-knop-klein', tekst: 'Plek verwijderen', disabled: gebruiktDoor.length > 0,
                title: gebruiktDoor.length ? 'Haal de plek eerst weg bij de bijeenkomsten' : undefined,
                onclick: () => {
                    if (!confirm(`"${p.naam}" verwijderen?`)) return;
                    gegevens.plekken = gegevens.plekken.filter((x) => x !== p);
                    gekozenPlek = gegevens.plekken[0]?.id || null;
                    markeerGewijzigd();
                    tekenAlles();
                } })),
    ));
}

// Adressen zoeken via de Locatieserver van PDOK (gratis, zonder sleutel).
async function zoekAdres(tekst, lijst, plek) {
    if (tekst.trim().length < 3) { lijst.hidden = true; return; }
    try {
        const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=6&fl=weergavenaam,centroide_ll&q=' + encodeURIComponent(tekst);
        const docs = (await (await fetch(url)).json()).response?.docs || [];
        lijst.replaceChildren(...docs.map((d) => {
            const [lon, lat] = (d.centroide_ll.match(/POINT\(([-\d.]+) ([-\d.]+)\)/) || []).slice(1).map(Number);
            return h('li', {}, h('button', { type: 'button', tekst: d.weergavenaam, onclick: () => {
                if (!kaart?.binnenGebied(lat, lon)) zetStatus('Let op: dit adres valt buiten de kaart.');
                plek.adres = d.weergavenaam;
                plek.lat = +lat.toFixed(7);
                plek.lon = +lon.toFixed(7);
                lijst.hidden = true;
                markeerGewijzigd();
                tekenPlekkenLijst();
                tekenPlek();
                tekenPins();
            } }));
        }));
        if (!docs.length) lijst.replaceChildren(h('li', {}, h('span', { class: 'bh-hulp', tekst: 'Niets gevonden.' })));
        lijst.hidden = false;
    } catch {
        lijst.replaceChildren(h('li', {}, h('span', { class: 'bh-hulp', tekst: 'Zoeken lukt nu niet.' })));
        lijst.hidden = false;
    }
}

// --- Kaart met sleepbare pins ---------------------------------------------

let pinLaag = null;
async function tekenPins() {
    if (!kaart) {
        kaart = await tekenKaart($('beheer-kaart'));
        pinLaag = maakSvg('g');
        kaart.svg.appendChild(pinLaag);
    }
    pinLaag.replaceChildren();
    for (const p of gegevens.plekken) {
        const [x, y] = kaart.naarKaart(p.lat, p.lon);
        const g = maakSvg('g', { class: 'bubbel ' + (p.id === gekozenPlek ? 'komt open' : 'geweest'), transform: `translate(${x} ${y})` });
        g.innerHTML = `<circle class="raak" r="34"/><circle class="hart" r="13"/><circle class="ring" r="16"/><g class="bordje"><rect rx="10"/><text class="naam"></text></g>`;
        g.querySelector('.naam').textContent = p.naam;
        pinLaag.appendChild(g);
        const naam = g.querySelector('.naam');
        const w = naam.getBBox().width + 28, bx = x + 30 + w > kaart.BREED - 40 ? -30 - w : 30;
        Object.entries({ x: bx, y: -24, width: w, height: 48 }).forEach(([k, v]) => g.querySelector('rect').setAttribute(k, v));
        naam.setAttribute('x', bx + 14);
        naam.setAttribute('y', 11);
        maakSleepbaar(g, p);
    }
    const gekozen = pinLaag.querySelector('.open');
    if (gekozen) pinLaag.appendChild(gekozen);
}

function maakSleepbaar(g, p) {
    let bewogen = false;
    g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        g.setPointerCapture(ev.pointerId);
        g.classList.add('slepen');
        bewogen = false;
    });
    g.addEventListener('pointermove', (ev) => {
        if (!g.hasPointerCapture(ev.pointerId)) return;
        const [x, y] = kaart.schermNaarKaart(ev.clientX, ev.clientY);
        g.setAttribute('transform', `translate(${x} ${y})`);
        bewogen = true;
    });
    g.addEventListener('pointerup', (ev) => {
        g.releasePointerCapture(ev.pointerId);
        g.classList.remove('slepen');
        if (bewogen) {
            const { lat, lon } = kaart.vanKaart(...kaart.schermNaarKaart(ev.clientX, ev.clientY));
            p.lat = +lat.toFixed(7);
            p.lon = +lon.toFixed(7);
            markeerGewijzigd();
        }
        kiesPlek(p.id);
    });
}
