// Aanmelden voor de filosofische gesprekken: datumkeuze, aanmeldformulier,
// agenda-knoppen en de losse nieuwsbriefformulieren. Werkt voor de Nederlandse en
// de Engelse pagina; de taal komt uit <html lang="...">.
(function () {
    var LANG = document.documentElement.lang === 'en' ? 'en' : 'nl';
    var CONTACT = 'anderevragen@proton.me';

    var T = {
        nl: {
            locale: 'nl-NL',
            agendaTitel: 'Filosofische gesprekken, andere vragen',
            agendaTekst: 'Filosofisch gesprek in een kleine groep. https://andere-vragen.nl/samenkomsten.html',
            geenData: 'Op dit moment is er geen nieuwe datum gepland. Meld je aan voor de nieuwsbrief om niets te missen.',
            laadFout: 'De data konden niet geladen worden. Herlaad de pagina of mail naar ' + CONTACT + '.',
            kiesDatum: 'Kies een datum',
            wachtlijstOptie: ' · WACHTLIJST',
            knopAanmelden: 'Aanmelden',
            knopWachtlijst: 'Op de wachtlijst',
            thema: 'Thema: ',
            geenThema: 'Thema wordt nog aangekondigd',
            uur: ' uur · ',
            vol: 'Wachtlijst: deze avond is vol. Meld je aan, dan hoor je het zodra er een plek vrijkomt.',
            engels: 'Deze avond is in het Engels',
            engelsOptie: ' · Engels',
            eerstDatum: 'Kies eerst een datum.',
            fout: 'Er ging iets mis. Probeer het later opnieuw.',
            foutMail: 'Er ging iets mis. Probeer het later opnieuw of mail naar ' + CONTACT + '.',
            welTitel: 'Top, je bent aangemeld!',
            welSub: 'Zet het meteen in je agenda:',
            wachtTitel: 'Je staat op de wachtlijst.',
            wachtSub: 'Je hoort het zodra er een plek vrijkomt.',
            bezig: 'Bezig...',
            nbAl: 'Je stond al op de lijst voor de nieuwsbrief. Fijn!',
            nbGelukt: 'Gelukt! Je staat op de lijst voor de nieuwsbrief.'
        },
        en: {
            locale: 'en-GB',
            agendaTitel: 'Philosophical conversations, andere vragen',
            agendaTekst: 'Philosophical conversation in a small group. https://andere-vragen.nl/gatherings.html',
            geenData: 'No new date is planned right now. Sign up for the newsletter so you don\'t miss the next one.',
            laadFout: 'The dates could not be loaded. Reload the page or email ' + CONTACT + '.',
            kiesDatum: 'Pick a date',
            wachtlijstOptie: ' · WAITING LIST',
            knopAanmelden: 'Sign up',
            knopWachtlijst: 'Join the waiting list',
            thema: 'Theme: ',
            geenThema: 'Theme to be announced',
            uur: ' · ',
            vol: 'Waiting list: this evening is full. Sign up and you\'ll hear as soon as a spot opens up.',
            engels: 'This evening is in English',
            engelsOptie: ' · English',
            eerstDatum: 'Please pick a date first.',
            fout: 'Something went wrong. Please try again later.',
            foutMail: 'Something went wrong. Please try again later or email ' + CONTACT + '.',
            welTitel: 'Great, you\'re signed up!',
            welSub: 'Add it to your calendar right away:',
            wachtTitel: 'You\'re on the waiting list.',
            wachtSub: 'You\'ll hear from us as soon as a spot opens up.',
            bezig: 'Just a moment...',
            nbAl: 'You were already on the newsletter list. Lovely!',
            nbGelukt: 'Done! You\'re on the newsletter list.'
        }
    }[LANG];

    // ---------- Agenda ----------

    function toIcsUtc(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    function volledigeLocatie(ev) {
        return ev.adres ? ev.locatie + ', ' + ev.adres : ev.locatie;
    }

    function googleCalendarUrl(ev) {
        var start = new Date(ev.start);
        var end = new Date(start.getTime() + ev.duurMinuten * 60000);
        var params = new URLSearchParams({
            action: 'TEMPLATE',
            text: T.agendaTitel,
            dates: toIcsUtc(start) + '/' + toIcsUtc(end),
            details: T.agendaTekst,
            location: volledigeLocatie(ev)
        });
        return 'https://calendar.google.com/calendar/render?' + params.toString();
    }

    function icsTekst(text) {
        return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    }

    function icsDataUrl(ev) {
        var start = new Date(ev.start);
        var end = new Date(start.getTime() + ev.duurMinuten * 60000);
        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Andere Vragen//Samenkomsten//NL',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:' + ev.id + '@andere-vragen.nl',
            'DTSTAMP:' + toIcsUtc(new Date()),
            'DTSTART:' + toIcsUtc(start),
            'DTEND:' + toIcsUtc(end),
            'SUMMARY:' + icsTekst(T.agendaTitel),
            'LOCATION:' + icsTekst(volledigeLocatie(ev)),
            'DESCRIPTION:' + icsTekst(T.agendaTekst),
            'END:VEVENT',
            'END:VCALENDAR'
        ];
        return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
    }

    function formatDatumTijd(startISO) {
        var date = new Date(startISO);
        var datum = date.toLocaleDateString(T.locale, { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long' });
        return {
            datum: datum.charAt(0).toUpperCase() + datum.slice(1),
            tijd: date.toLocaleTimeString(T.locale, { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
        };
    }

    function maak(tag, className, tekst) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (tekst) el.textContent = tekst;
        return el;
    }

    // ---------- Aanmelden ----------

    var datePicker = document.getElementById('date-picker');
    var form = document.getElementById('samenkomst-form');

    if (datePicker && form) {
        var eventIdInput = document.getElementById('event_id');
        var formError = document.getElementById('form-error');
        var formContent = document.getElementById('form-content');
        var successMessage = document.getElementById('success-message');
        var resetButton = document.getElementById('reset-button');
        var submitBtn = form.querySelector('[type=submit]');
        var events = [];

        var hideError = function () { formError.style.display = 'none'; };
        var showError = function (message) {
            formError.textContent = message;
            formError.style.display = 'block';
        };

        var renderPicker = function () {
            eventIdInput.value = '';
            datePicker.innerHTML = '';
            if (!events.length) {
                datePicker.appendChild(maak('p', 'av-datum-leeg', T.geenData));
                return;
            }

            var select = maak('select');
            select.id = 'datum';
            select.setAttribute('aria-describedby', 'datum-details');
            // De eerstvolgende datum staat standaard geselecteerd (events zijn op datum gesorteerd).
            events.forEach(function (ev) {
                var option = maak('option', '', formatDatumTijd(ev.start).datum + (ev.engels ? T.engelsOptie : '') + (ev.status === 'vol' ? T.wachtlijstOptie : ''));
                option.value = ev.id;
                select.appendChild(option);
            });

            var details = maak('div', 'av-datumdetails');
            details.id = 'datum-details';
            details.setAttribute('aria-live', 'polite');

            var toonDetails = function () {
                var ev = events.filter(function (e) { return e.id === select.value; })[0];
                eventIdInput.value = ev ? ev.id : '';
                var vol = !!ev && ev.status === 'vol';
                submitBtn.textContent = vol ? T.knopWachtlijst : T.knopAanmelden;
                details.innerHTML = '';
                if (!ev) {
                    details.hidden = true;
                    return;
                }
                if (ev.engels) details.appendChild(maak('span', 'av-datum-taal', T.engels));
                details.appendChild(maak('span', 'av-datum-thema' + (ev.thema ? '' : ' leeg'), ev.thema ? T.thema + ev.thema : T.geenThema));
                details.appendChild(maak('span', '', formatDatumTijd(ev.start).tijd + T.uur + ev.locatie));
                if (ev.adres) {
                    var adres = maak('a', '', ev.adres);
                    adres.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.adres);
                    adres.target = '_blank';
                    adres.rel = 'noopener';
                    details.appendChild(adres);
                }
                if (vol) details.appendChild(maak('span', 'av-datum-status', T.vol));
                details.hidden = false;
                hideError();
            };

            select.addEventListener('change', toonDetails);
            datePicker.appendChild(select);
            datePicker.appendChild(details);
            toonDetails();
        };

        fetch('/.netlify/functions/get-samenkomsten')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                events = Array.isArray(data) ? data : [];
                renderPicker();
            })
            .catch(function () {
                datePicker.innerHTML = '';
                datePicker.appendChild(maak('p', 'av-datum-leeg', T.laadFout));
            });

        var showSuccess = function (data) {
            var isWaitlist = data.status === 'waitlist';
            var calendars = successMessage.querySelector('.av-agenda');

            successMessage.querySelector('.av-gelukt-titel').textContent = isWaitlist ? T.wachtTitel : T.welTitel;
            successMessage.querySelector('.av-gelukt-sub').textContent = isWaitlist ? T.wachtSub : T.welSub;

            if (!isWaitlist && data.event) {
                successMessage.querySelector('.av-agenda-google').href = googleCalendarUrl(data.event);
                successMessage.querySelector('.av-agenda-ics').href = icsDataUrl(data.event);
                calendars.hidden = false;
            } else {
                calendars.hidden = true;
            }

            formContent.hidden = true;
            successMessage.hidden = false;
            successMessage.querySelector('.av-gelukt-titel').focus();
        };

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            hideError();

            if (!eventIdInput.value) {
                showError(T.eerstDatum);
                return;
            }

            var payload = {};
            new FormData(form).forEach(function (value, key) { payload[key] = value; });
            payload.newsletter = form.querySelector('input[name="newsletter"]').checked ? 'ja' : 'nee';
            if (LANG === 'en') payload.lang = 'en';

            submitBtn.disabled = true;

            fetch('/.netlify/functions/signup-samenkomst', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
                .then(function (result) {
                    submitBtn.disabled = false;
                    if (!result.ok) {
                        showError((result.data && result.data.message) || T.fout);
                        return;
                    }
                    showSuccess(result.data);
                })
                .catch(function () {
                    submitBtn.disabled = false;
                    showError(T.foutMail);
                });
        });

        resetButton.addEventListener('click', function () {
            form.reset();
            successMessage.hidden = true;
            formContent.hidden = false;
            renderPicker();
            hideError();
        });
    }

    // ---------- Aanmeldbox glijdt mee ----------
    // Op brede schermen schuift de box soepel mee binnen de hoogte van de inhoud.
    // Is de box hoger dan het scherm, dan blijft de onderkant in beeld, zodat de
    // verzendknop bereikbaar blijft.

    (function () {
        var aside = document.querySelector('.av-aanmelden');
        var grid = document.querySelector('.av-grid');
        if (!aside || !grid) return;

        var breed = window.matchMedia('(min-width: 960px)');
        var rustig = window.matchMedia('(prefers-reduced-motion: reduce)');
        var BOVEN = 92; // vaste kop plus wat lucht
        var ONDER = 24;
        var huidig = 0;
        var doel = 0;
        var frame = null;

        function berekenDoel() {
            if (!breed.matches) {
                doel = 0;
                return;
            }
            var gridTop = grid.getBoundingClientRect().top + window.scrollY;
            var max = Math.max(0, grid.offsetHeight - aside.offsetHeight);
            var afstand = Math.min(BOVEN, window.innerHeight - aside.offsetHeight - ONDER);
            doel = Math.min(Math.max(window.scrollY + afstand - gridTop, 0), max);
        }

        function zet(y) {
            aside.style.transform = y ? 'translateY(' + y.toFixed(1) + 'px)' : '';
        }

        function stap() {
            var verschil = doel - huidig;
            if (Math.abs(verschil) < 0.5 || rustig.matches) {
                huidig = doel;
                zet(huidig);
                frame = null;
                return;
            }
            huidig += verschil * 0.12;
            zet(huidig);
            frame = requestAnimationFrame(stap);
        }

        function update() {
            berekenDoel();
            if (!frame) frame = requestAnimationFrame(stap);
        }

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        window.addEventListener('load', update);
        update();
    })();

    // ---------- Alleen de nieuwsbrief ----------

    document.querySelectorAll('[data-toggle-nieuwsbrief]').forEach(function (toggle) {
        var doel = document.getElementById(toggle.getAttribute('aria-controls'));
        toggle.addEventListener('click', function () {
            doel.hidden = !doel.hidden;
            toggle.setAttribute('aria-expanded', String(!doel.hidden));
            if (!doel.hidden) doel.querySelector('input[type=email]').focus();
        });
    });

    document.querySelectorAll('.js-nieuwsbrief').forEach(function (nbForm) {
        var melding = nbForm.querySelector('.av-melding');
        var knop = nbForm.querySelector('[type=submit]');
        var veld = nbForm.querySelector('input[type=email]');
        var bot = nbForm.querySelector('[name=bot-field]');

        var meld = function (tekst, fout) {
            melding.className = 'av-melding' + (fout ? ' fout' : '');
            melding.textContent = tekst;
        };

        nbForm.addEventListener('submit', function (e) {
            e.preventDefault();
            meld(T.bezig);
            knop.disabled = true;
            fetch('/.netlify/functions/nieuwsbrief-inschrijven', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: veld.value, lang: LANG, 'bot-field': bot ? bot.value : '' })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    knop.disabled = false;
                    if (!data.ok) {
                        meld(data.message || T.fout, true);
                        return;
                    }
                    meld(data.alIngeschreven ? T.nbAl : T.nbGelukt);
                    veld.value = '';
                })
                .catch(function () {
                    knop.disabled = false;
                    meld(T.fout, true);
                });
        });
    });
})();
