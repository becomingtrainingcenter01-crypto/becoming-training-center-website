(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';

  const prices = {
    personal: { session: 50 },
    parenting: { module: 100, full: 550 },
    business: { module: 100, full: 550 },
    wellness: { module: 100, full: 650 }
  };
  window.BECOMING_PRICES = prices;

  const text = lang === 'fr' ? {
    life: 'Transformez votre vie.',
    from100: 'Dès $100',
    from550: 'Dès $550',
    parenting: '$550 complet / $100 module',
    business: '$550 complet / $100 module',
    wellness: '$650 complet / $100 module',
    range: '$550–$650',
    rangeNote: 'Selon le programme',
    paymentTerms: 'Les tarifs sont de 50 $ pour une séance de coaching personnel, 100 $ par module, 550 $ pour l’ensemble des modules de coaching parental ou de coaching en affaires, et 650 $ pour l’ensemble des modules de coaching bien-être.'
  } : {
    life: 'Transform your life.',
    from100: 'From $100',
    from550: 'From $550',
    parenting: '$550 full / $100 per module',
    business: '$550 full / $100 per module',
    wellness: '$650 full / $100 per module',
    range: '$550–$650',
    rangeNote: 'Depending on the program',
    paymentTerms: 'Pricing is $50 for a personal coaching session, $100 per module, $550 for the complete Parenting or Business Coaching program, and $650 for the complete Wellness Coaching program.'
  };

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function replaceExactText(from, to) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue.trim() === from ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = node.nodeValue.replace(from, to); });
  }

  function updateProgramSection(id, value) {
    const section = document.querySelector(id);
    if (!section) return;
    const facts = section.querySelectorAll('.detail-facts strong');
    if (facts[1]) facts[1].textContent = value;
  }

  function updateHomeTile(hash, value) {
    const tile = document.querySelector(`.program-tile[href*="${hash}"]`);
    const price = tile?.querySelector('.tile-meta strong');
    if (price) price.textContent = value;
  }

  function updatePricingCards() {
    const cards = [...document.querySelectorAll('.pricing-box')];
    if (!cards.length) return;

    const moduleCard = cards.find(card => /module/i.test(card.textContent));
    if (moduleCard) {
      const amount = moduleCard.querySelector('strong');
      if (amount) amount.textContent = '$100';
    }

    const fullCard = cards.find(card => /programme complet|complete program/i.test(card.textContent));
    if (fullCard) {
      const amount = fullCard.querySelector('strong');
      const note = fullCard.querySelector('small');
      if (amount) amount.textContent = text.range;
      if (note) note.textContent = text.rangeNote;
    }
  }

  function updateBookingPrice() {
    const form = document.querySelector('[data-booking-form]');
    if (!form) return;

    const program = form.querySelector('#program-select');
    const format = form.querySelector('#format-select');
    const summary = form.querySelector('[data-price-summary]');
    if (!program || !summary) return;

    const render = () => {
      const selectedProgram = program.value || 'personal';
      const selectedFormat = format?.value || (selectedProgram === 'personal' ? 'session' : 'module');
      let amount = '—';

      if (selectedProgram === 'personal') amount = '$50';
      else if (selectedFormat === 'full') amount = `$${prices[selectedProgram]?.full || 0}`;
      else if (['module', 'session'].includes(selectedFormat)) amount = '$100';

      summary.textContent = amount;
    };

    if (!form.dataset.pricingListenerInstalled) {
      program.addEventListener('change', render);
      format?.addEventListener('change', render);
      form.dataset.pricingListenerInstalled = 'true';
    }
    render();
  }

  function updateTerms() {
    if (!location.pathname.endsWith('terms.html')) return;
    const paymentSection = [...document.querySelectorAll('.legal-article section')]
      .find(section => /^2\.|payments|paiements/i.test(section.querySelector('h2')?.textContent.trim() || ''));
    const paragraph = paymentSection?.querySelector('p');
    if (paragraph) paragraph.textContent = text.paymentTerms;
  }

  function apply() {
    setText('.home-hero__copy h1 em', text.life);

    replaceExactText('Dès $150', text.from100);
    replaceExactText('From $150', text.from100);
    replaceExactText('Starting at $150', text.from100);

    updateHomeTile('#parenting', text.from100);
    updateHomeTile('#business', text.from100);
    updateHomeTile('#wellness', text.from100);

    updateProgramSection('#parenting', text.parenting);
    updateProgramSection('#business', text.business);
    updateProgramSection('#wellness', text.wellness);

    const heroStats = document.querySelectorAll('.page-hero__stats strong');
    if (heroStats[1]) heroStats[1].textContent = '$100';
    if (heroStats[2]) heroStats[2].textContent = text.from550;

    updatePricingCards();
    updateBookingPrice();
    updateTerms();
  }

  apply();
  [100, 350, 900, 1800].forEach(delay => setTimeout(apply, delay));
})();
