/* ==========================================================================
   Aegean Web Services — estimator.js
   Dynamic cost estimator for the #pricing section.

   All prices live in PRICING below (EUR, excluding VAT). Edit them here only:
   the hints next to each option and the total are rendered from this object.
   - type:      base price range { min, max }
   - content:   surcharge as a share of the base (0.25 = +25%)
   - languages: surcharge as a share of the base
   - addons:    fixed range { min, max }, added on top
   Option labels shown in the summary/email come from the HTML (.choice-title).
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
      eshop: { min: 1500, max: 2500 },
    },
    content: {
      provided: { pct: 0 },
      copy: { pct: 0.25 },
      full: { pct: 0.4 },
    },
    languages: {
      one: { pct: 0 },
      two: { pct: 0.3 },
      three: { pct: 0.55 },
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

  const eur = new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const round = (n) => Math.round(n / PRICING.roundTo) * PRICING.roundTo;
  const range = (min, max) => (min === max ? eur.format(min) : `${eur.format(min)} – ${eur.format(max)}`);

  const labelFor = (input) => input.closest('.choice').querySelector('.choice-title').textContent.trim();

  /* Price hints under each option ------------------------------------------ */
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

    const min = lines.reduce((sum, l) => sum + l.min, 0);
    const max = lines.reduce((sum, l) => sum + l.max, 0);

    return {
      lines,
      min,
      max,
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

  /* Render ------------------------------------------------------------------ */
  let current;

  function render() {
    current = calculate();
    totalEl.textContent = range(current.min, current.max);

    breakdownEl.replaceChildren(
      ...current.lines.map((line) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        const value = document.createElement('span');
        name.textContent = line.label;
        value.textContent = range(line.min, line.max);
        value.className = 'est-line-value';
        li.append(name, value);
        return li;
      })
    );

    const subject = `Αίτημα προσφοράς: ${current.choices.type}`;
    sendLink.href =
      `mailto:${PRICING.email}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(summaryText(current))}`;

    statusEl.textContent = '';
  }

  form.addEventListener('change', render);
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

  render();
})();
