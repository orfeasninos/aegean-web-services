/* ==========================================================================
   Aegean Web Services — estimator.js
   Dynamic cost estimator for the #pricing section.

   All prices live in PRICING below (EUR, excluding VAT). Edit them here only:
   the hints on each option and the total are rendered from this object.
   - type:      base price range { min, max }
   - content:   surcharge as a share of the base (0.25 = +25%)
   - languages: surcharge as a share of the base
   - addons:    fixed range { min, max }, added on top
   Option labels shown in the summary/quote request come from the HTML (.choice-title).
   ========================================================================== */

(() => {
  'use strict';

  const PRICING = {
    email: 'contact@aegeanwebservices.gr',
    roundTo: 10,
    type: {
      onepager: { min: 350, max: 500 },
      corporate: { min: 650, max: 950 },
      corporatePlus: { min: 1000, max: 1500 },
    },
    content: {
      provided: { pct: 0 },
      copy: { pct: 0.25 },
      full: { pct: 0.4 },
    },
    languages: {
      one: { pct: 0 },
      two: { pct: 0.3 },
    },
    addons: {
      seo: { min: 120, max: 180 },
      forms: { min: 80, max: 150 },
      integrations: { min: 50, max: 90 },
      speed: { min: 100, max: 180 },
    },
  };

  const form = document.getElementById('estimator');
  if (!form) return;

  const totalEl = document.getElementById('est-total');
  const breakdownEl = document.getElementById('est-breakdown');
  const sendLink = document.getElementById('est-send');
  const copyBtn = document.getElementById('est-copy');
  const statusEl = document.getElementById('est-status');
  const bar = document.getElementById('est-bar');
  const barTotal = document.getElementById('est-bar-total');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const eur = new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const round = (n) => Math.round(n / PRICING.roundTo) * PRICING.roundTo;
  const range = (min, max) => (min === max ? eur.format(min) : `${eur.format(min)} – ${eur.format(max)}`);

  const labelFor = (input) => input.closest('.choice').querySelector('.choice-title').textContent.trim();

  /* Price hints on each option ---------------------------------------------- */
  form.querySelectorAll('[data-price-for]').forEach((el) => {
    const [group, key] = el.dataset.priceFor.split(':');
    const item = PRICING[group]?.[key];
    if (!item) return;

    if (group === 'type') el.textContent = `από ${eur.format(item.min)}`;
    else if (group === 'addons') el.textContent = `+ ${range(item.min, item.max)}`;
    else el.textContent = item.pct ? `+${Math.round(item.pct * 100)}% στη βασική τιμή` : 'Χωρίς επιπλέον κόστος';
  });

  /* Calculation ------------------------------------------------------------- */
  function calculate() {
    const type = form.querySelector('input[name="type"]:checked');
    const content = form.querySelector('input[name="content"]:checked');
    const languages = form.querySelector('input[name="languages"]:checked');
    const addons = [...form.querySelectorAll('input[name="addons"]:checked')];

    const base = PRICING.type[type.value];
    const lines = [{ label: labelFor(type), min: base.min, max: base.max }];

    [content, languages].forEach((input) => {
      const { pct } = PRICING[input.name][input.value];
      if (pct) lines.push({ label: labelFor(input), min: round(base.min * pct), max: round(base.max * pct) });
    });

    addons.forEach((input) => {
      const item = PRICING.addons[input.value];
      lines.push({ label: labelFor(input), min: item.min, max: item.max });
    });

    return {
      lines,
      min: lines.reduce((sum, l) => sum + l.min, 0),
      max: lines.reduce((sum, l) => sum + l.max, 0),
      choices: {
        type: labelFor(type),
        content: labelFor(content),
        languages: labelFor(languages),
        addons: addons.map(labelFor),
      },
    };
  }

  function summaryText(result) {
    const { choices } = result;
    return [
      'Γεια σας,',
      '',
      'Θα ήθελα προσφορά για ιστοσελίδα με τα εξής:',
      `• Τύπος: ${choices.type}`,
      `• Υλικό: ${choices.content}`,
      `• Γλώσσες: ${choices.languages}`,
      `• Επιπλέον: ${choices.addons.length ? choices.addons.join(', ') : 'Κανένα'}`,
      '',
      `Ενδεικτικό κόστος (υπολογιστής site): ${range(result.min, result.max)} + ΦΠΑ`,
      '',
      'Όνομα:',
      'Τηλέφωνο:',
      'Επιχείρηση / υπάρχον site:',
      'Λίγα λόγια για το έργο:',
      '',
    ].join('\r\n');
  }

  /* Total: counts smoothly from the previous value to the new one ----------- */
  let shown = null;
  let frame = 0;

  function showTotal(min, max) {
    cancelAnimationFrame(frame);
    const paint = (a, b) => {
      const text = range(round(a), round(b));
      totalEl.textContent = text;
      barTotal.textContent = text;
    };

    if (!shown || reducedMotion.matches) {
      paint(min, max);
      shown = { min, max };
      return;
    }

    const from = { ...shown };
    const start = performance.now();
    const duration = 450;
    shown = { min, max };

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - (1 - t) ** 3;
      paint(from.min + (min - from.min) * ease, from.max + (max - from.max) * ease);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  /* Render ------------------------------------------------------------------ */
  let current;

  function render() {
    current = calculate();
    showTotal(current.min, current.max);

    breakdownEl.replaceChildren(
      ...current.lines.map((line) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        const leader = document.createElement('span');
        const value = document.createElement('span');
        name.textContent = line.label;
        leader.className = 'est-leader';
        leader.setAttribute('aria-hidden', 'true');
        value.className = 'est-line-value';
        value.textContent = range(line.min, line.max);
        li.append(name, leader, value);
        return li;
      })
    );

    statusEl.textContent = '';
  }

  form.addEventListener('change', render);

  /* "Ζητήστε προσφορά": hands the choices to the contact form (js/main.js) -- */
  sendLink.addEventListener('click', () => {
    const { choices } = current;
    const items = [
      `Τύπος: ${choices.type}`,
      `Υλικό: ${choices.content}`,
      `Γλώσσες: ${choices.languages}`,
      `Επιπλέον: ${choices.addons.length ? choices.addons.join(', ') : 'Κανένα'}`,
    ];
    const total = range(current.min, current.max);
    document.dispatchEvent(new CustomEvent('estimate:request', {
      detail: { type: form.querySelector('input[name="type"]:checked').value, items, total, text: [...items, `Ενδεικτικό κόστος: ${total} + ΦΠΑ`].join('\n') },
    }));
    // The link's own #contact navigation then scrolls to the form
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  /* Copy summary (fallback for visitors without a mail app) ------------------ */
  copyBtn.addEventListener('click', async () => {
    statusEl.className = 'est-status';
    try {
      await navigator.clipboard.writeText(summaryText(current));
      statusEl.classList.add('is-success');
      statusEl.textContent = `Αντιγράφηκε! Επικολλήστε το σε email προς ${PRICING.email}.`;
    } catch {
      statusEl.classList.add('is-error');
      statusEl.textContent = `Δεν ήταν δυνατή η αντιγραφή. Στείλτε μας email στο ${PRICING.email}.`;
    }
  });

  /* Mobile bar: visible while choosing, hidden once the summary is on screen - */
  if (bar && 'IntersectionObserver' in window) {
    const options = document.getElementById('est-options');
    const summary = document.getElementById('est-summary');
    const state = { options: false, summary: false };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        state[entry.target === options ? 'options' : 'summary'] = entry.isIntersecting;
      });
      const visible = state.options && !state.summary;
      bar.classList.toggle('is-visible', visible);
      bar.inert = !visible;
    });
    observer.observe(options);
    observer.observe(summary);
  }

  render();
})();
