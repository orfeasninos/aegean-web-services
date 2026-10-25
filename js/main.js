/* ==========================================================================
   Aegean Web Services — main.js
   1. Mobile navigation drawer
   2. Header shadow on scroll
   3. Active nav link while scrolling
   4. Reveal-on-scroll animations
   5. Contact form validation
   6. Footer year
   7. Light/dark theme toggle
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Mobile navigation drawer
     ------------------------------------------------------------------------ */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const toggleLabel = toggle.querySelector('.visually-hidden');
  const desktopQuery = window.matchMedia('(min-width: 56em)');

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  document.body.appendChild(backdrop);

  const focusableSelector = 'a[href], button:not([disabled])';

  function openNav() {
    toggle.setAttribute('aria-expanded', 'true');
    toggleLabel.textContent = 'Κλείσιμο μενού';
    nav.classList.add('is-open');
    backdrop.classList.add('is-visible');
    document.body.classList.add('nav-locked');
    nav.querySelector(focusableSelector)?.focus();
  }

  function closeNav({ returnFocus = true } = {}) {
    toggle.setAttribute('aria-expanded', 'false');
    toggleLabel.textContent = 'Άνοιγμα μενού';
    nav.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('nav-locked');
    if (returnFocus) toggle.focus();
  }

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => (isOpen() ? closeNav() : openNav()));
  backdrop.addEventListener('click', () => closeNav());

  // Close after choosing a link
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && isOpen()) closeNav({ returnFocus: false });
  });

  // Escape closes; Tab is trapped inside the open drawer
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;

    if (e.key === 'Escape') {
      closeNav();
      return;
    }

    if (e.key === 'Tab') {
      const items = [toggle, ...nav.querySelectorAll(focusableSelector)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Reset drawer state when resizing to desktop
  desktopQuery.addEventListener('change', (e) => {
    if (e.matches && isOpen()) closeNav({ returnFocus: false });
  });

  /* ------------------------------------------------------------------------
     2. Header shadow on scroll
     ------------------------------------------------------------------------ */
  const header = document.querySelector('.site-header');
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', !entry.isIntersecting);
  }).observe(sentinel);

  /* ------------------------------------------------------------------------
     3. Active nav link while scrolling
     ------------------------------------------------------------------------ */
  const navLinks = [...document.querySelectorAll('.nav-list a[href^="#"]')];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );

  sections.forEach((section) => sectionObserver.observe(section));

  /* ------------------------------------------------------------------------
     4. Reveal-on-scroll animations
     ------------------------------------------------------------------------ */
  const revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );

    // Small stagger for siblings inside the same grid/list
    revealItems.forEach((item) => {
      const siblings = [...item.parentElement.children].filter((el) => el.classList.contains('reveal'));
      const index = siblings.indexOf(item);
      if (index > 0) item.style.transitionDelay = `${Math.min(index, 4) * 80}ms`;
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------------
     5. Contact form validation
     ------------------------------------------------------------------------ */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  const messages = {
    name: {
      valueMissing: 'Παρακαλώ συμπληρώστε το όνομά σας.',
      tooShort: 'Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες.',
    },
    email: {
      valueMissing: 'Παρακαλώ συμπληρώστε το email σας.',
      typeMismatch: 'Παρακαλώ εισάγετε ένα έγκυρο email.',
    },
    service: {
      valueMissing: 'Παρακαλώ επιλέξτε μια υπηρεσία.',
    },
    message: {
      valueMissing: 'Παρακαλώ γράψτε ένα μήνυμα.',
      tooShort: 'Το μήνυμα πρέπει να έχει τουλάχιστον 10 χαρακτήρες.',
    },
  };

  function validateField(field) {
    const errorEl = document.getElementById(`${field.id}-error`);
    const { validity } = field;
    let message = '';

    // Trim-aware length check (minlength ignores untouched/whitespace-only input)
    const trimmed = field.value.trim();
    if (field.required && !trimmed) {
      message = messages[field.name]?.valueMissing;
    } else if (field.minLength > 0 && trimmed.length < field.minLength) {
      message = messages[field.name]?.tooShort;
    } else if (validity.typeMismatch) {
      message = messages[field.name]?.typeMismatch;
    }

    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) field.setAttribute('aria-describedby', errorEl.id);
    else field.removeAttribute('aria-describedby');
    errorEl.textContent = message || '';
    return !message;
  }

  const fields = [...form.querySelectorAll('input, select, textarea')];

  fields.forEach((field) => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = '';

    const invalid = fields.filter((field) => !validateField(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    // No endpoint configured yet: set the form's action attribute to enable sending
    const endpoint = form.getAttribute('action');
    if (!endpoint || endpoint === '#') {
      status.classList.add('is-success');
      status.textContent = 'Η φόρμα είναι έγκυρη. Η αποστολή θα ενεργοποιηθεί σύντομα.';
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(response.statusText);

      form.reset();
      fields.forEach((field) => field.removeAttribute('aria-invalid'));
      status.classList.add('is-success');
      status.textContent = 'Ευχαριστούμε! Το μήνυμά σας εστάλη. Θα επικοινωνήσουμε σύντομα.';
    } catch {
      status.classList.add('is-error');
      status.textContent = 'Κάτι πήγε στραβά. Δοκιμάστε ξανά ή στείλτε μας email.';
    } finally {
      button.disabled = false;
    }
  });

  /* ------------------------------------------------------------------------
     6. Footer year
     ------------------------------------------------------------------------ */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------------
     7. Light/dark theme toggle (saved choice overrides the device setting)
     ------------------------------------------------------------------------ */
  const root = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const themeColors = { light: '#f5f3ee', dark: '#0e1726' };
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');

  const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

  function syncTheme() {
    const theme = currentTheme();
    themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    // Browser UI colour follows the chosen theme, not just the device
    if (root.dataset.theme) themeMetas.forEach((meta) => meta.setAttribute('content', themeColors[theme]));
  }

  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    syncTheme();
  });

  darkQuery.addEventListener('change', syncTheme);
  syncTheme();
})();
