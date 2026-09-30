// Laat het aanmeldblok op brede schermen soepel meeglijden tijdens het scrollen,
// binnen de hoogte van de pagina-inhoud. (position: sticky werkt hier niet door
// overflow-x: hidden op body.)
(function () {
    var aside = document.querySelector('.sk-signup');
    var grid = document.querySelector('.sk-grid');
    if (!aside || !grid) return;

    var breed = window.matchMedia('(min-width: 960px)');
    var rustig = window.matchMedia('(prefers-reduced-motion: reduce)');
    var AFSTAND_TOT_BOVENKANT = 104; // header (80px) plus wat lucht
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
        doel = Math.min(Math.max(window.scrollY + AFSTAND_TOT_BOVENKANT - gridTop, 0), max);
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
