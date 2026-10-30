// Gedeeld door de pagina Op doortocht en het beheer: tekst veilig maken en opmaken, en de kaarten van een strook.
// Zo ziet het voorbeeld in het beheer er precies zo uit als de site.

export const veilig = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fotoUrl = (id) => '/doortocht-foto/' + encodeURIComponent(id);
// Focuspunt uit het beheer: welk deel van een bijgesneden foto in beeld blijft
export const focusStijl = (f) => `object-position: ${f?.x ?? 50}% ${f?.y ?? 50}%`;
// Opmaak uit het beheer: **vet**, *cursief* en [tekst](adres). Eerst veilig gemaakt, daarna omgezet,
// dus alleen deze drie dingen worden echte opmaak. Links naar andere sites openen in een nieuw tabblad.
const nadruk = (s) => s.replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, '<strong>$1</strong>').replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, '<em>$1</em>');
export const opmaak = (tekst) => {
    const links = [];
    const s = veilig(tekst).replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g, (_, t, url) => {
        const extern = /^https?:/.test(url) && !/^https?:\/\/(www\.)?andere-vragen\.nl(\/|$)/.test(url);
        links.push(`<a href="${url}"${extern ? ' target="_blank" rel="noopener"' : ''}>${nadruk(t)}</a>`);
        return `\u0000${links.length - 1}\u0000`;
    });
    return nadruk(s).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
};
// Alinea's bij een lege regel, een enkele enter wordt een regelafbreking.
export const alineas = (tekst) => String(tekst || '').trim().split(/\n\s*\n/).filter(Boolean)
    .map((a) => `<p>${opmaak(a).replace(/\n/g, '<br>')}</p>`).join('');

export const platteTekst = (t) => String(t || '').replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
export const beginVan = (t, max = 230) => {
    const s = platteTekst(t);
    if (s.length <= max) return s;
    const kort = s.slice(0, max);
    return kort.slice(0, kort.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
};

// Tekstkaart: een kaart die je omdraait. Voorkant: de eerste zin groot; ga je erheen, dan draait hij om naar de hele tekst.
// Een korte tekst (één zin, een citaat) heeft niets om te draaien en staat meteen groot op de kaart.
export function tekstKaart(tekst) {
    const plat = platteTekst(tekst);
    if (plat.length <= 140) return `<div class="dt-strook-kaart dt-strook-tekst kort"><div class="dt-strook-tekst-binnen"><p>${opmaak(String(tekst).trim()).replace(/\n+/g, '<br>')}</p></div></div>`;
    const zin = plat.match(/^.{20,}?[.?!…](?=\s|$)/)?.[0] || beginVan(plat, 110);
    // Een lang stuk tekst krijgt een bredere kaart, zodat hij niet in een smalle kolom wordt gepropt.
    return `<div class="dt-strook-kaart dt-strook-tekst draait${plat.length > 550 ? ' lang' : ''}"><div class="dt-kaart-draai">
        <div class="dt-kaart-voor" aria-hidden="true"><p>${veilig(zin.length > 150 ? beginVan(zin, 140) : zin)}</p><span class="dt-kaart-hint">lees verder ↻</span></div>
        <div class="dt-strook-tekst-binnen dt-kaart-achter">${alineas(tekst)}</div>
    </div></div>`;
}

// Foto: altijd helemaal te zien, met een papieren randje.
export const fotoKaart = (k) => `<figure class="dt-strook-kaart dt-strook-foto"><img src="${fotoUrl(k.foto)}" alt="${veilig(k.onderschrift)}" loading="lazy" draggable="false">${k.onderschrift ? `<figcaption>${opmaak(k.onderschrift)}</figcaption>` : ''}</figure>`;
// Citaat: een eigen kaart met grote aanhalingstekens en de bron eronder.
export const citaatKaart = (k) => `<div class="dt-strook-kaart dt-strook-citaat"><blockquote${platteTekst(k.citaat).length > 160 ? ' class="lang"' : ''}>
    <p>${opmaak(String(k.citaat).trim()).replace(/\n+/g, '<br>')}</p>${k.bron ? `<footer>${veilig(k.bron)}</footer>` : ''}</blockquote></div>`;
export const strookKaarten = (kaarten) => kaarten.map((k) => (k.foto ? fotoKaart(k) : k.citaat ? citaatKaart(k) : tekstKaart(k.tekst))).join('');
