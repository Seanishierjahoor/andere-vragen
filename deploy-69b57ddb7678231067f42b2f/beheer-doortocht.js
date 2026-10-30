// Beheerscherm voor Op doortocht: plekken (adres zoeken, pin slepen) en bijeenkomsten
// (gegevens, data, omslagfoto en een verhaal van blokken). Alles wordt in één keer
// opgeslagen via /.netlify/functions/beheer-doortocht; foto's gaan los naar /doortocht-foto.

import { tekenKaart, maakSvg } from './op-doortocht-kaart.js';
import { strookKaarten } from './op-doortocht-tekst.js';

const FUNCTIE = '/.netlify/functions/beheer-doortocht';
const MAX_FOTO = 2000; // langste zijde in pixels na verkleinen

let wachtwoord = '';
let gegevens = { versie: 2, plekken: [], bijeenkomsten: [] };
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
// Hoe een bijeenkomst in lijsten heet: de plekken, met de eigen naam of de soort.
const evenementLabel = (e) => `${kortDatum(e.datum)} · ${e.plekken.map(plekNaam).join(' × ') || '(nog geen plek)'}: ${e.naam || e.soort || 'zonder soort'}`;
const SOORTEN = ['Filosofisch gesprek', 'Filmvertoning', 'Vervolggesprek', 'Workshop', 'Wandeling'];
const VANDAAG = new Date().toLocaleDateString('sv-SE');

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
    // Link uit de schrijfherinnering: beheer-doortocht.html#bijeenkomst/<id> opent die bijeenkomst.
    const uitLink = decodeURIComponent((location.hash.match(/^#bijeenkomst\/(.+)$/) || [])[1] || '');
    gekozenEvenement = gegevens.bijeenkomsten.some((e) => e.id === uitLink) ? uitLink : (eerstVolgende() || gesorteerdeEvenementen()[0])?.id || null;
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
// Elke datum is een eigen bijeenkomst met een eigen verhaal. Bijeenkomsten die bij elkaar horen,
// krijgen dezelfde reeks (bijvoorbeeld "Te gast bij SAP"); in het archief staan ze dan samen.

const gesorteerdeEvenementen = () => [...gegevens.bijeenkomsten].sort((a, b) => b.datum.localeCompare(a.datum));
const eerstVolgende = () => [...gegevens.bijeenkomsten].filter((e) => e.datum >= VANDAAG).sort((a, b) => a.datum.localeCompare(b.datum))[0];
const reeksen = () => [...new Set(gegevens.bijeenkomsten.map((e) => e.reeks).filter(Boolean))].sort();
const heeftVerhaal = (e) => e.blokken.length > 0 || !!e.samenvatting.trim();

function tekenEvenementenLijst() {
    const lijst = $('lijst-bijeenkomsten');
    const knop = (e) => h('li', {},
        h('button', { type: 'button', 'aria-current': String(e.id === gekozenEvenement), onclick: () => { gekozenEvenement = e.id; tekenEvenementenLijst(); tekenEvenement(); } },
            h('small', { class: 'bh-datum', tekst: kortDatum(e.datum) }),
            h('span', { tekst: e.plekken.map(plekNaam).join(' × ') || '(nog geen plek)' }),
            h('small', { tekst: [e.naam || e.soort, e.thema && `Thema: ${e.thema}`].filter(Boolean).join(' · ') }),
            e.reeks ? h('small', { class: 'bh-reekslabel', tekst: e.reeks }) : null,
            e.datum < VANDAAG && !heeftVerhaal(e) ? h('span', { class: 'bh-nogschrijven', tekst: 'Nog geen verhaal' }) : null,
            e.zichtbaar === false ? h('span', { class: 'bh-verborgen', tekst: 'Verborgen' }) : null,
        ));
    const komt = [...gegevens.bijeenkomsten].filter((e) => e.datum >= VANDAAG).sort((a, b) => a.datum.localeCompare(b.datum));
    const geweest = gesorteerdeEvenementen().filter((e) => e.datum < VANDAAG);
    lijst.replaceChildren(
        ...(komt.length ? [h('li', { class: 'bh-lijstkop', tekst: 'Komt eraan' }), ...komt.map(knop)] : []),
        ...(geweest.length ? [h('li', { class: 'bh-lijstkop', tekst: 'Geweest' }), ...geweest.map(knop)] : []),
    );
}

function nieuweBijeenkomst(velden = {}) {
    const datum = velden.datum || VANDAAG;
    const basis = (velden.plekken?.[0] || 'bijeenkomst') + '-' + datum;
    const id = maakSleutel(basis, new Set(gegevens.bijeenkomsten.map((e) => e.id)));
    const e = {
        soort: 'Filosofisch gesprek', naam: '', vraag: '', thema: '', reeks: '', plekken: [], plek: '', wat: '',
        samenvatting: '', omslag: null, blokken: [], zichtbaar: false, ...velden, id, datum,
    };
    gegevens.bijeenkomsten.push(e);
    gekozenEvenement = id;
    markeerGewijzigd();
    tekenEvenementenLijst();
    tekenEvenement();
    return e;
}
$('nieuwe-bijeenkomst').addEventListener('click', () => { nieuweBijeenkomst(); $('bewerk-bijeenkomst').querySelector('input')?.select(); });

// Tekstveld dat direct in de bijeenkomst schrijft (zonder opnieuw te tekenen, dan blijft de focus).
function veld(obj, sleutel, label, { lang = false, hulp = '', naWijzig, lijst, type = 'text' } = {}) {
    const id = 'v-' + Math.random().toString(36).slice(2);
    const invoer = h(lang ? 'textarea' : 'input', {
        id, type: lang ? undefined : type, waarde: obj[sleutel] || '', list: lijst,
        [type === 'date' ? 'onchange' : 'oninput']: (e) => { obj[sleutel] = e.target.value; markeerGewijzigd(); naWijzig?.(); },
    });
    return h('div', {}, h('label', { for: id, tekst: label }), hulp ? h('p', { class: 'bh-hulp', tekst: hulp }) : null, lang ? opmaakBalk(invoer) : null, invoer);
}

// Knoppen voor vet, cursief en een link boven elk lang tekstveld. Ze zetten tekens rond de selectie
// (**vet**, *cursief*, [tekst](adres)); de site maakt daar opmaak van. Ook met Cmd/Ctrl+B en +I.
function voegIn(veld, tekst, selectieVan, selectieTot) {
    veld.focus();
    // insertText houdt Cmd+Z werkend; anders (oudere browsers) direct vervangen
    if (!document.execCommand('insertText', false, tekst)) veld.setRangeText(tekst, veld.selectionStart, veld.selectionEnd, 'end');
    if (selectieVan !== undefined) veld.setSelectionRange(selectieVan, selectieTot);
    veld.dispatchEvent(new Event('input', { bubbles: true }));
}
function omhul(veld, teken) {
    const { selectionStart: van, selectionEnd: tot, value } = veld;
    const gekozen = value.slice(van, tot);
    // Al omhuld? Dan haalt een tweede klik de opmaak weer weg.
    if (value.slice(van - teken.length, van) === teken && value.slice(tot, tot + teken.length) === teken
        && !(teken === '*' && value.slice(van - 2, van) === '**' && value.slice(van - 3, van) !== '***')) {
        veld.setSelectionRange(van - teken.length, tot + teken.length);
        voegIn(veld, gekozen, van - teken.length, tot - teken.length);
        return;
    }
    const woord = gekozen || (teken === '**' ? 'vette tekst' : 'schuine tekst');
    voegIn(veld, teken + woord + teken, van + teken.length, van + teken.length + woord.length);
}
function opmaakBalk(veld) {
    const linkVak = h('div', { class: 'bh-linkvak', hidden: true });
    const knop = (label, titel, actie, klasse) => h('button', { type: 'button', class: 'bh-opmaakknop ' + (klasse || ''), title: titel, 'aria-label': titel,
        onmousedown: (e) => e.preventDefault(), onclick: actie }, label);
    const openLink = () => {
        const { selectionStart: van, selectionEnd: tot } = veld;
        const zichtbaar = h('input', { type: 'text', waarde: veld.value.slice(van, tot), placeholder: 'bijvoorbeeld: Social Art Platform' });
        const adres = h('input', { type: 'text', inputmode: 'url', placeholder: 'https://…' });
        const fout = h('p', { class: 'bh-hulp bh-linkfout', hidden: true });
        const sluit = () => { linkVak.hidden = true; linkVak.replaceChildren(); veld.focus(); };
        const invoegen = () => {
            let url = adres.value.trim();
            if (url && !/^(https?:\/\/|mailto:|\/)/.test(url)) url = (url.includes('@') && !url.includes('/') ? 'mailto:' : 'https://') + url;
            if (!url || /\s|\)/.test(url)) { fout.hidden = false; fout.textContent = 'Vul een geldig webadres in.'; adres.focus(); return; }
            const tekst = (zichtbaar.value.trim() || url).replace(/[\[\]]/g, '');
            veld.setSelectionRange(van, tot);
            voegIn(veld, `[${tekst}](${url})`);
            sluit();
        };
        const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); invoegen(); } if (e.key === 'Escape') sluit(); };
        zichtbaar.addEventListener('keydown', enter); adres.addEventListener('keydown', enter);
        linkVak.replaceChildren(
            h('label', {}, h('span', { tekst: 'Tekst die je ziet' }), zichtbaar),
            h('label', {}, h('span', { tekst: 'Webadres' }), adres), fout,
            h('div', { class: 'bh-linkvak-knoppen' },
                h('button', { type: 'button', class: 'bh-knop bh-knop-klein', onclick: invoegen }, 'Link invoegen'),
                h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', onclick: sluit }, 'Annuleren')));
        linkVak.hidden = false;
        (zichtbaar.value ? adres : zichtbaar).focus();
    };
    veld.addEventListener('keydown', (e) => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); omhul(veld, '**'); }
        if (k === 'i') { e.preventDefault(); omhul(veld, '*'); }
        if (k === 'k') { e.preventDefault(); openLink(); }
    });
    return h('div', { class: 'bh-opmaak' },
        h('div', { class: 'bh-opmaakbalk', role: 'toolbar', 'aria-label': 'Opmaak' },
            knop(h('strong', {}, 'B'), 'Vet (Cmd+B)', () => omhul(veld, '**')),
            knop(h('em', {}, 'I'), 'Cursief (Cmd+I)', () => omhul(veld, '*')),
            knop('Link', 'Link toevoegen (Cmd+K)', openLink, 'bh-opmaakknop-link'),
            h('span', { class: 'bh-opmaakuitleg', tekst: '**vet**  *cursief*  [tekst](adres)' })),
        linkVak);
}

function tekenEvenement() {
    const vak = $('bewerk-bijeenkomst');
    const e = gegevens.bijeenkomsten.find((x) => x.id === gekozenEvenement);
    if (!e) { vak.replaceChildren(h('p', { class: 'bh-hulp', tekst: 'Kies links een bijeenkomst, of maak een nieuwe.' })); return; }
    const herteken = () => { markeerGewijzigd(); tekenEvenement(); tekenEvenementenLijst(); };
    const lijstBij = () => tekenEvenementenLijst();

    const algemeen = h('div', { class: 'bh-kaartvak' },
        h('div', { class: 'bh-kaartvak-kop' },
            h('h2', { tekst: 'Over de bijeenkomst' }),
            h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: 'Dupliceer voor een volgende datum', onclick: () => {
                // Handig bij een reeks: zelfde plek, soort en reeks, nieuwe datum, nog zonder verhaal.
                const volgende = new Date(e.datum + 'T12:00:00Z'); volgende.setUTCDate(volgende.getUTCDate() + 14);
                nieuweBijeenkomst({ soort: e.soort, reeks: e.reeks, plekken: [...e.plekken], plek: e.plek, datum: volgende.toISOString().slice(0, 10) });
                zetStatus('Kopie gemaakt, twee weken later. Pas de datum aan als dat niet klopt.');
            } }),
        ),
        h('div', { class: 'bh-velden' },
            h('div', { class: 'bh-rij2' },
                veld(e, 'datum', 'Datum', { type: 'date', naWijzig: lijstBij }),
                h('div', {}, h('datalist', { id: 'soorten' }, SOORTEN.map((naam) => h('option', { value: naam }))),
                    veld(e, 'soort', 'Soort bijeenkomst', { naWijzig: lijstBij, lijst: 'soorten' })),
            ),
            veld(e, 'vraag', 'De vraag van de avond', { naWijzig: lijstBij, hulp: 'Komt groot in beeld bovenaan het verhaal. Bijvoorbeeld "Zitten er in de simpelste dingen het grootste geluk?"' }),
            h('div', { class: 'bh-rij2' },
                veld(e, 'thema', 'Thema (optioneel)', { naWijzig: lijstBij, hulp: 'Eén of twee woorden, bijvoorbeeld "Simpel".' }),
                veld(e, 'naam', 'Eigen naam (optioneel)', { naWijzig: lijstBij, hulp: 'Bijvoorbeeld "Zwaan kleef aan".' }),
            ),
            h('div', {}, h('datalist', { id: 'reeksen' }, reeksen().map((naam) => h('option', { value: naam }))),
                veld(e, 'reeks', 'Reeks (optioneel)', { naWijzig: lijstBij, lijst: 'reeksen', hulp: 'Hoort deze bijeenkomst bij andere? Geef ze dezelfde reeks, bijvoorbeeld "Te gast bij SAP". In het archief staan ze dan samen.' })),
            h('div', { class: 'bh-vinkjes' },
                h('label', {}, h('input', { type: 'checkbox', checked: e.zichtbaar !== false, onchange: (ev) => { e.zichtbaar = ev.target.checked; markeerGewijzigd(); lijstBij(); } }), 'Zichtbaar op de site'),
            ),
        ),
    );

    // Nieuwe plek: naam + zoeker; na het kiezen staat hij op de kaart en is hij hier aangevinkt.
    const nieuw = { naam: '' };
    const nieuwePlek = h('div', { class: 'bh-nieuwe-plek', hidden: true },
        veld(nieuw, 'naam', 'Naam van de nieuwe plek', { hulp: 'Bijvoorbeeld "Filmlokaal Hammerstraat". Leeg laten mag: dan nemen we de naam uit de zoekresultaten.' }),
        h('div', {},
            h('label', { for: 'nieuwe-plek-zoek', tekst: 'Waar is het?' }),
            plekZoeker({
                id: 'nieuwe-plek-zoek',
                opKies: (r) => {
                    const naam = nieuw.naam.trim() || r.naam || r.adres.split(',')[0];
                    const id = maakSleutel(naam, new Set(gegevens.plekken.map((x) => x.id)));
                    gegevens.plekken.push({ id, naam, adres: r.adres, lat: r.lat, lon: r.lon, beschrijving: '' });
                    e.plekken = [...e.plekken, id];
                    herteken();
                    tekenPlekkenLijst();
                    zetStatus(`"${naam}" toegevoegd (nog opslaan). Een beschrijving van de plek schrijf je onder Plekken.`);
                },
            })),
    );

    const plekken = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Plek' }),
        h('p', { class: 'bh-hulp', tekst: 'Kies er meer dan één bij een samenwerking: dan komt er een stippellijn tussen. De beschrijving van de plek staat vanzelf onderaan het verhaal.' }),
        h('div', { class: 'bh-vinkjes' }, gegevens.plekken.map((p) => h('label', {},
            h('input', {
                type: 'checkbox', checked: e.plekken.includes(p.id),
                onchange: (ev) => {
                    e.plekken = ev.target.checked ? [...e.plekken, p.id] : e.plekken.filter((x) => x !== p.id);
                    if (!e.plekken.includes(e.plek)) e.plek = '';
                    herteken();
                },
            }), p.naam))),
        e.plekken.length > 1 ? h('div', { class: 'bh-rij2' },
            h('div', {}, h('label', { for: 'plek-van-dag', tekst: 'Waar was het die dag?' }),
                h('select', { id: 'plek-van-dag', onchange: (ev) => { e.plek = ev.target.value; markeerGewijzigd(); } },
                    h('option', { value: '', tekst: 'Op alle plekken' }),
                    e.plekken.map((id) => h('option', { value: id, selected: e.plek === id, tekst: plekNaam(id) })))),
            veld(e, 'wat', 'Wat gebeurde er (optioneel)', { hulp: 'Bijvoorbeeld "Filmvertoning".' }),
        ) : null,
        h('div', { class: 'bh-toevoegen' },
            h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: '+ Nieuwe plek', 'aria-expanded': 'false', onclick: (ev) => {
                nieuwePlek.hidden = !nieuwePlek.hidden;
                ev.target.setAttribute('aria-expanded', String(!nieuwePlek.hidden));
                if (!nieuwePlek.hidden) nieuwePlek.querySelector('input').focus();
            } })),
        nieuwePlek,
    );

    const samenvatting = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: e.datum >= VANDAAG ? 'Aankondiging' : 'Samenvatting' }),
        veld(e, 'samenvatting', e.datum >= VANDAAG ? 'Wat gaat er gebeuren?' : 'Hoe ging het, in een paar zinnen?', { lang: true,
            hulp: e.datum >= VANDAAG
                ? 'Staat bovenaan de pagina van deze bijeenkomst en in het kaartje op de kaart.'
                : 'Staat bovenaan het verhaal en in het kaartje op de kaart. Het uitgebreide verhaal schrijf je hieronder.' }),
    );

    const omslag = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Omslagfoto' }),
        fotoKiezer(e.omslag, (id) => { e.omslag = id; e.omslagFocus = { x: 50, y: 50 }; herteken(); }),
        e.omslag ? focusKiezer(e, 'omslag', 'omslagFocus', [['Bovenaan het verhaal', '16 / 7'], ['Kaartje in de index', '16 / 9']]) : null,
    );

    const blokken = h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Verhaal' }),
        h('p', { class: 'bh-hulp', tekst: 'Stapel blokken: tekst, foto\'s en citaten. Een lege regel in een tekstblok begint een nieuwe alinea.' }),
        h('div', { class: 'bh-blokken' }, e.blokken.map((b, i) => blokEditor(e, b, i, herteken))),
        h('div', { class: 'bh-toevoegen' },
            // Foto's gaan standaard in een strook (kaarten naast elkaar); een grote losse foto kan ook nog.
            [['tekst', '+ Tekst', { type: 'tekst', tekst: '' }], ['reeks', "+ Foto's", { type: 'reeks', fotos: [] }],
             ['citaat', '+ Citaat', { type: 'citaat', tekst: '', bron: '' }], ['foto', '+ Grote foto', { type: 'foto', foto: null, onderschrift: '' }]]
                .map(([, label, nieuw]) => h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: label, onclick: () => { e.blokken.push(structuredClone(nieuw)); herteken(); } })),
        ),
    );

    const weg = h('div', { class: 'bh-onderaan' },
        h('a', { class: 'bh-knop bh-knop-licht', href: `op-doortocht.html#verhaal/${encodeURIComponent(e.id)}`, target: '_blank', rel: 'noopener', tekst: 'Bekijk op de site (na opslaan)' }),
        h('button', { type: 'button', class: 'bh-knop bh-knop-gevaar', tekst: 'Bijeenkomst verwijderen', onclick: () => {
            if (!confirm(`"${evenementLabel(e)}" verwijderen? Dit wordt definitief na Opslaan.`)) return;
            gegevens.bijeenkomsten = gegevens.bijeenkomsten.filter((x) => x !== e);
            gekozenEvenement = gesorteerdeEvenementen()[0]?.id || null;
            markeerGewijzigd();
            tekenAlles();
        } }));

    vak.replaceChildren(algemeen, plekken, samenvatting, omslag, blokken, weg);
}

function blokEditor(e, b, i, herteken) {
    const namen = { tekst: 'Tekst', foto: 'Grote foto', reeks: 'Foto\'s (strook met kaarten)', citaat: 'Citaat' };
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
        // Strook: foto's en tekstkaarten naast elkaar, op de site naar links te vegen.
        const schuif = (j, stap) => { [b.fotos[j], b.fotos[j + stap]] = [b.fotos[j + stap], b.fotos[j]]; herteken(); };
        // Levend voorbeeld met dezelfde kaarten als de site; wordt bijgewerkt bij elke wijziging in deze strook.
        const voorbeeld = h('div', { class: 'bh-strook-voorbeeld dt-artikel' });
        const toonVoorbeeld = () => { voorbeeld.innerHTML = `<section class="dt-strook"><div class="dt-strook-baan">${strookKaarten(b.fotos)}</div></section>`; };
        toonVoorbeeld();
        inhoud = h('div', { class: 'bh-velden' },
            h('p', { class: 'bh-hulp', tekst: 'Zo ziet de strook eruit. Wijs een tekstkaart aan om te zien hoe hij omdraait.' }),
            voorbeeld,
            h('div', { class: 'bh-reeks' }, b.fotos.map((f, j) => h('div', { class: 'bh-reeks-foto' + (f.foto ? '' : ' bh-reeks-tekst') },
                f.foto ? h('img', { src: fotoUrl(f.foto), alt: '' }) : null,
                f.foto
                    ? h('input', { type: 'text', placeholder: 'Onderschrift', 'aria-label': 'Onderschrift', waarde: f.onderschrift, oninput: (ev) => { f.onderschrift = ev.target.value; markeerGewijzigd(); toonVoorbeeld(); } })
                    : veld(f, 'tekst', 'Tekstkaart', { lang: true, naWijzig: toonVoorbeeld }),
                h('div', { class: 'bh-reeks-knoppen' },
                    h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', 'aria-label': 'Naar links', tekst: '←', disabled: j === 0, onclick: () => schuif(j, -1) }),
                    h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', 'aria-label': 'Naar rechts', tekst: '→', disabled: j === b.fotos.length - 1, onclick: () => schuif(j, 1) }),
                    h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: 'Weghalen', onclick: () => { b.fotos.splice(j, 1); herteken(); } })),
            ))),
            h('div', { class: 'bh-reeks-toevoegen' },
                uploadKnop('+ Foto\'s toevoegen', true, (ids) => { b.fotos.push(...ids.map((foto) => ({ foto, onderschrift: '' }))); herteken(); }),
                h('button', { type: 'button', class: 'bh-knop bh-knop-licht', tekst: '+ Tekstkaart', onclick: () => { b.fotos.push({ tekst: '' }); herteken(); } })),
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

// Focuspunt: klik op de foto om te kiezen wat in beeld blijft als de foto op de kaart wordt bijgesneden.
// Ernaast twee voorbeelden in de maten van de kaartjes.
// Werkt voor de plekfoto (foto + focus) en de omslagfoto van een bijeenkomst (omslag + omslagFocus).
function focusKiezer(p, fotoSleutel = 'foto', focusSleutel = 'focus', maten = [['Kaartje bij de pin', '16 / 9'], ['Kaartje na klik in de index', '4 / 3']]) {
    p[focusSleutel] = p[focusSleutel] || { x: 50, y: 50 };
    const foto = fotoUrl(p[fotoSleutel]);
    const stip = h('span', { class: 'bh-focus-stip', 'aria-hidden': 'true' });
    const voorbeelden = maten.map(([naam, maat]) =>
        h('figure', {}, h('img', { src: foto, alt: '', style: `aspect-ratio: ${maat}` }), h('figcaption', { tekst: naam })));
    const zet = () => {
        const f = p[focusSleutel];
        stip.style.left = f.x + '%'; stip.style.top = f.y + '%';
        voorbeelden.forEach((v) => { v.querySelector('img').style.objectPosition = `${f.x}% ${f.y}%`; });
    };
    const groot = h('div', { class: 'bh-focus-foto', title: 'Klik op wat in beeld moet blijven' }, h('img', { src: foto, alt: '', draggable: 'false' }), stip);
    groot.addEventListener('click', (ev) => {
        const r = groot.getBoundingClientRect();
        p[focusSleutel] = { x: Math.round(((ev.clientX - r.left) / r.width) * 100), y: Math.round(((ev.clientY - r.top) / r.height) * 100) };
        zet();
        markeerGewijzigd();
    });
    zet();
    return h('div', { class: 'bh-focus' },
        h('p', { class: 'bh-hulp', tekst: 'Klik op de foto op wat in beeld moet blijven (bijvoorbeeld de gevel). Rechts zie je hoe de kaartjes de foto bijsnijden.' }),
        h('div', { class: 'bh-focus-rij' }, groot, h('div', { class: 'bh-focus-voorbeelden' }, voorbeelden)));
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
    gegevens.plekken.push({ id, naam: 'Nieuwe plek', adres: '', lat: 51.9205, lon: 4.4805, beschrijving: '' });
    markeerGewijzigd();
    kiesPlek(id);
    $('bewerk-plek').querySelector('input')?.select();
});

function tekenPlek() {
    const vak = $('bewerk-plek');
    const p = gegevens.plekken.find((x) => x.id === gekozenPlek);
    if (!p) { vak.replaceChildren(h('p', { class: 'bh-hulp', tekst: 'Kies links een plek, of maak een nieuwe.' })); return; }
    const gebruiktDoor = gegevens.bijeenkomsten.filter((e) => e.plekken.includes(p.id));

    const zoeker = plekZoeker({
        id: 'adres-zoek',
        opKies: (r) => {
            p.adres = r.adres;
            p.lat = r.lat;
            p.lon = r.lon;
            if (r.naam && /^Nieuwe plek/.test(p.naam)) p.naam = r.naam;
            markeerGewijzigd();
            tekenPlekkenLijst();
            tekenPlek();
            tekenPins();
        },
    });

    vak.replaceChildren(h('div', { class: 'bh-kaartvak' },
        h('h2', { tekst: 'Plek' }),
        h('div', { class: 'bh-velden' },
            veld(p, 'naam', 'Naam', { naWijzig: () => { tekenPlekkenLijst(); tekenPins(); } }),
            h('div', {},
                h('label', { for: 'adres-zoek', tekst: 'Plek zoeken' }),
                h('p', { class: 'bh-hulp', tekst: p.adres ? `Nu: ${p.adres}` : 'Typ een adres, of een naam en klik op "Zoek op naam". Daarna kun je de pin nog slepen.' }),
                zoeker),
            veld(p, 'beschrijving', 'Over deze plek', { lang: true, hulp: 'Wat voor plek is dit? Deze tekst staat onderaan elke bijeenkomst die hier plaatsvindt. Een lege regel begint een nieuwe alinea.' }),
            h('div', {},
                h('label', { tekst: 'Foto van de plek' }),
                h('p', { class: 'bh-hulp', tekst: 'Verschijnt op de kaart als je een bijeenkomst kiest, met de naam erover, en bij "Over deze plek" in het verhaal. Liefst liggend, van de buitenkant of de ruimte.' }),
                fotoKiezer(p.foto, (id) => { p.foto = id; p.focus = { x: 50, y: 50 }; markeerGewijzigd(); tekenPlek(); }),
                p.foto ? focusKiezer(p) : null),
            veld(p, 'ondertitel', 'Regel onder de naam (optioneel)', { hulp: 'Bijvoorbeeld "museum voor architectuur" of "volkstuin in Noord". Staat op het kaartje van de plek, onder de naam. Leeg: dan staat daar de straat.' }),
            veld(p, 'fotocredit', 'Fotocredit (optioneel)', { hulp: 'Van wie is de foto? Verplicht bij foto\'s met een vrije licentie, bijvoorbeeld: Foto: Johannes Schwartz, CC BY 2.0.' }),
            h('p', { class: 'bh-hulp', tekst: gebruiktDoor.length ? `Gebruikt bij: ${gebruiktDoor.map(evenementLabel).join(', ')}` : 'Nog bij geen enkele bijeenkomst gebruikt.' }),
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

// Zoeker voor plekken: tijdens het typen adressen via de Locatieserver van PDOK (gratis, zonder
// sleutel); met Enter of "Zoek op naam" ook namen (TENT, Filmlokaal...) via OpenStreetMap/Nominatim.
// Nominatim alleen op verzoek, niet per toets: dat vraagt hun gebruiksbeleid.
function plekZoeker({ id, placeholder = 'Adres of naam, bijv. Hammerstraat 17 of TENT Rotterdam', opKies }) {
    const lijst = h('ul', { class: 'bh-suggesties', hidden: true });
    const melding = (tekst) => { lijst.replaceChildren(h('li', {}, h('span', { class: 'bh-hulp', tekst }))); lijst.hidden = false; };
    const toon = (resultaten) => {
        if (!resultaten.length) { melding('Niets gevonden. Probeer "Zoek op naam", of alleen straat en huisnummer.'); return; }
        lijst.replaceChildren(...resultaten.map((r) => h('li', {}, h('button', {
            type: 'button',
            onclick: () => {
                lijst.hidden = true;
                if (!kaart?.binnenGebied(r.lat, r.lon)) zetStatus('Let op: deze plek valt buiten de kaart.');
                opKies(r);
            },
        }, r.naam ? h('strong', { tekst: r.naam + ' ' }) : null, h('span', { tekst: r.adres })))));
        lijst.hidden = false;
    };

    async function adressen(tekst) {
        const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=6&fl=weergavenaam,centroide_ll&q=' + encodeURIComponent(tekst);
        const docs = (await (await fetch(url)).json()).response?.docs || [];
        return docs.map((d) => {
            const [lon, lat] = (d.centroide_ll.match(/POINT\(([-\d.]+) ([-\d.]+)\)/) || []).slice(1).map(Number);
            return { naam: '', adres: d.weergavenaam, lat: +lat.toFixed(7), lon: +lon.toFixed(7) };
        });
    }
    async function namen(tekst) {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=nl&accept-language=nl'
            + '&viewbox=4.30,51.98,4.62,51.84&q=' + encodeURIComponent(tekst);
        const rijen = await (await fetch(url)).json();
        return rijen.map((r) => {
            const a = r.address || {};
            const straat = [a.road, a.house_number].filter(Boolean).join(' ');
            const plaats = [a.postcode, a.city || a.town || a.village].filter(Boolean).join(' ');
            return { naam: r.name || '', adres: [straat, plaats].filter(Boolean).join(', ') || r.display_name, lat: +(+r.lat).toFixed(7), lon: +(+r.lon).toFixed(7) };
        });
    }

    let wacht;
    const invoer = h('input', {
        id, type: 'search', placeholder, autocomplete: 'off',
        oninput: (ev) => {
            clearTimeout(wacht);
            const tekst = ev.target.value.trim();
            if (tekst.length < 3) { lijst.hidden = true; return; }
            wacht = setTimeout(() => adressen(tekst).then(toon).catch(() => melding('Zoeken lukt nu niet.')), 250);
        },
        onkeydown: (ev) => {
            if (ev.key === 'Escape') lijst.hidden = true;
            if (ev.key === 'Enter') { ev.preventDefault(); zoekNaam(); }
        },
    });
    async function zoekNaam() {
        const tekst = invoer.value.trim();
        if (tekst.length < 2) return;
        clearTimeout(wacht);
        melding('Zoeken op naam…');
        try {
            const [opNaam, opAdres] = await Promise.all([namen(tekst), adressen(tekst).catch(() => [])]);
            toon([...opNaam, ...opAdres].slice(0, 8));
        } catch { melding('Zoeken op naam lukt nu niet. Probeer het adres.'); }
    }
    return h('div', { class: 'bh-zoek' },
        h('div', { class: 'bh-zoekrij' }, invoer, h('button', { type: 'button', class: 'bh-knop bh-knop-licht bh-knop-klein', tekst: 'Zoek op naam', onclick: zoekNaam })),
        lijst);
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
