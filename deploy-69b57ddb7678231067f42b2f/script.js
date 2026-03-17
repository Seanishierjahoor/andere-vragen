// Mobile Menu Toggle
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');
    if (mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        menuIcon.style.display = 'block';
        closeIcon.style.display = 'none';
    } else {
        mobileMenu.classList.add('active');
        menuIcon.style.display = 'none';
        closeIcon.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuLinks = document.querySelectorAll('.mobile-menu a');
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', function() { toggleMobileMenu(); });
    });

    window.scrollTo(0, 0);

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-desktop a, .mobile-menu a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) link.classList.add('active');
    });

    document.querySelectorAll('.footer-newsletter-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var formData = new FormData(form);
            fetch(form.action, {
                method: 'POST',
                body: new URLSearchParams(formData).toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }).then(function() {
                form.innerHTML = '<p style="font-size: 0.875rem; font-style: italic; color: var(--muted);">Bedankt. U ontvangt een bevestigingsmail.</p>';
            }).catch(function() {
                form.innerHTML = '<p style="font-size: 0.875rem; font-style: italic; color: var(--muted);">Bedankt. U ontvangt een bevestigingsmail.</p>';
            });
        });
    });

    // Scroll-triggered animations — page-sidebar uitgesloten om mobiel menu niet te blokkeren
    const isSubpage = currentPage !== 'index.html' && currentPage !== '';

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.08,
        rootMargin: isSubpage ? '0px 0px -50px 0px' : '0px 0px -40px 0px'
    });

    const selectors = isSubpage ? [
        // Subpage: animate individual elements so mobile gets a true unfolding feel
        '.section-label',
        '.page-sidebar',
        '.card', '.newsletter-title', '.newsletter-sub',
        '.page-content h1', '.page-content h2', '.page-content h3', '.page-content h4',
        '.page-content p',
        '.page-content > * > div',
        '.two-col-grid h1', '.two-col-grid h2', '.two-col-grid h3', '.two-col-grid h4',
        '.two-col-grid > * > p',
        '.two-col-grid > * > div > p',
        '.two-col-grid > * > div > div',
    ] : [
        '.hero-title', '.hero-subtitle', '.hero-quote', '.hero-actions',
        '.intro-text', '.intro-item', '.philosophy-title', '.philosophy-body',
        '.philosophy-image', '.section-label', '.pillar', '.closing-title',
        '.closing-labels', '.card', '.newsletter-title',
        '.newsletter-sub', '.two-col-grid > *', '.page-content > *'
    ];

    // Eerst klassen toevoegen zodat browser de beginstaat (opacity:0) kan renderen,
    // dan pas na één frame de observer starten zodat de transitie altijd speelt.
    const elementsToObserve = [];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, i) => {
            if (el.closest('#mobile-menu')) return; // mobiel menu nooit animeren
            el.classList.add('animate-on-scroll');
            if (isSubpage) el.classList.add('animate-subpage');
            const inGrid = el.closest('.pillars-grid, .cards-grid, .intro-grid, .two-col-grid, .page-content');
            const delay = isSubpage ? 0.08 : 0.1;
            if (inGrid) el.style.transitionDelay = (i % 6) * delay + 's';
            elementsToObserve.push(el);
        });
    });

    // Na één animatieframe starten: browser heeft beginstaat (opacity:0) dan al getekend
    // zodat de transitie ook voor elementen bovenaan de pagina zichtbaar is.
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            elementsToObserve.forEach(el => observer.observe(el));
        });
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
});

function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const successMessage = document.getElementById('success-message');
    const formContent = document.getElementById('form-content');
    const newsletterChecked = form.querySelector('input[name="newsletter"]')?.checked;
    const emailValue = form.querySelector('input[name="email"]')?.value;
    const formData = new FormData(form);
    fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
    })
    .then(() => {
        if (newsletterChecked && emailValue) {
            fetch('https://buttondown.com/api/emails/embed-subscribe/Anderevragen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'email=' + encodeURIComponent(emailValue)
            }).catch(() => {});
        }
        if (formContent) formContent.style.display = 'none';
        if (successMessage) {
            successMessage.style.display = 'block';
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    })
    .catch(() => {
        if (formContent) formContent.style.display = 'none';
        if (successMessage) successMessage.style.display = 'block';
    });
    return false;
}

function resetForm() {
    const successMessage = document.getElementById('success-message');
    const formContent = document.getElementById('form-content');
    if (successMessage && formContent) {
        formContent.style.display = 'block';
        successMessage.style.display = 'none';
        document.querySelector('form').reset();
    }
}

function handleNewsletterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    fetch(form.action, {
        method: 'POST',
        body: new URLSearchParams(formData).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    .then(() => {
        form.style.display = 'none';
        document.getElementById('newsletter-success').style.display = 'block';
    })
    .catch(() => {
        form.style.display = 'none';
        document.getElementById('newsletter-success').style.display = 'block';
    });
}
