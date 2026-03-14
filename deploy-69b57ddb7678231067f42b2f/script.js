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

// Close mobile menu when clicking a link
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuLinks = document.querySelectorAll('.mobile-menu a');
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', function() {
            toggleMobileMenu();
        });
    });

    // Scroll to top on page load
    window.scrollTo(0, 0);

    // Active navigation state
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-desktop a, .mobile-menu a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    // Footer newsletter forms — AJAX submission to prevent page redirect
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
});

// Form submission - werkt met Netlify Forms
function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const successMessage = document.getElementById('success-message');
    const formContent = document.getElementById('form-content');
    const newsletterChecked = form.querySelector('input[name="newsletter"]')?.checked;
    const emailValue = form.querySelector('input[name="email"]')?.value;

    // Stuur naar Netlify
    const formData = new FormData(form);
    fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
    })
    .then(() => {
        // Inschrijven op nieuwsbrief als checkbox aangevinkt
        if (newsletterChecked && emailValue) {
            fetch('https://buttondown.com/api/emails/embed-subscribe/Anderevragen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'email=' + encodeURIComponent(emailValue)
            }).catch(() => {}); // stil falen is prima
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

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Newsletter signup
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
