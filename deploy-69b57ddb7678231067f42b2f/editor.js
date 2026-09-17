// Bewerk-modus: maakt tekst op de pagina direct klikbaar en slaat wijzigingen op
// als een echte commit naar GitHub, via de Netlify-functie save-edit.
(function () {
    var EDIT_SELECTOR = 'main h1, main h2, main h3, main h4, main p, main li, main label, main a, main .form-hint';
    var editing = false;
    var btn, bar, statusEl;

    function currentRepoPath() {
        var file = window.location.pathname.split('/').pop();
        if (!file) file = 'index.html';
        if (!/\.html?$/.test(file)) file = file + '.html';
        return 'deploy-69b57ddb7678231067f42b2f/' + file;
    }

    function setEditing(on) {
        editing = on;
        var targets = document.querySelectorAll(EDIT_SELECTOR);
        for (var i = 0; i < targets.length; i++) {
            targets[i].contentEditable = on;
            targets[i].classList.toggle('editing-target', on);
        }
        bar.style.display = on ? 'flex' : 'none';
        btn.textContent = on ? 'Bewerken actief' : 'Bewerken';
        if (on) statusEl.textContent = 'Klik op tekst om te bewerken. Vermijd Enter binnen een tekstblok.';
    }

    function save() {
        var password = window.prompt('Wachtwoord om op te slaan:');
        if (!password) return;
        statusEl.textContent = 'Opslaan...';

        var doctype = '<!DOCTYPE html>\n';
        var html = doctype + document.documentElement.outerHTML;

        fetch('/.netlify/functions/save-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentRepoPath(),
                html: html,
                password: password
            })
        })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
            .then(function (result) {
                if (result.ok && result.data.ok) {
                    statusEl.textContent = 'Opgeslagen op GitHub. Publiceer de nieuwe deploy in Netlify om het live te zetten.';
                } else {
                    statusEl.textContent = 'Fout: ' + (result.data && result.data.error ? result.data.error : 'onbekend.');
                }
            })
            .catch(function () {
                statusEl.textContent = 'Fout bij opslaan. Controleer je verbinding en probeer opnieuw.';
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Bewerken';
        btn.setAttribute('aria-label', 'Bewerk-modus aan- of uitzetten');
        btn.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9999;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;padding:0.75rem 1.25rem;background:#1a1a1a;color:#fcfaf7;border:none;cursor:pointer;opacity:0.85;font-family:system-ui,sans-serif;';
        btn.addEventListener('click', function () { setEditing(!editing); });
        document.body.appendChild(btn);

        bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;color:#fcfaf7;padding:1rem 1.5rem;display:none;align-items:center;justify-content:space-between;gap:1rem;z-index:9998;font-size:12px;font-family:system-ui,sans-serif;';

        statusEl = document.createElement('span');
        statusEl.style.cssText = 'flex:1;opacity:0.85;';
        bar.appendChild(statusEl);

        var actions = document.createElement('span');
        actions.style.cssText = 'display:flex;gap:0.75rem;flex-shrink:0;';

        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Opslaan';
        saveBtn.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.1em;padding:0.6rem 1.25rem;background:#fcfaf7;color:#1a1a1a;border:none;cursor:pointer;';
        saveBtn.addEventListener('click', save);

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Sluiten';
        closeBtn.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.1em;padding:0.6rem 1.25rem;background:transparent;color:#fcfaf7;border:1px solid rgba(255,255,255,0.3);cursor:pointer;';
        closeBtn.addEventListener('click', function () { setEditing(false); });

        actions.appendChild(saveBtn);
        actions.appendChild(closeBtn);
        bar.appendChild(actions);
        document.body.appendChild(bar);
    });
})();
