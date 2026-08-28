(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';

  const prices = {
    personal: { session: 50 },
    parenting: { module: 100, full: 550, modules: 6 },
    business: { module: 100, full: 550, modules: 6 },
    wellness: { module: 100, full: 650, modules: 8 }
  };
  window.BECOMING_PRICES = prices;

  const text = lang === 'fr' ? {
    personalDuration: 'Jusqu’à 45 minutes',
    personalDurationShort: 'Jusqu’à 45 min',
    moduleFrom: 'Dès $100',
    packageFrom: 'Dès $550',
    parentingPrice: '$550 complet / $100 module',
    businessPrice: '$550 complet / $100 module',
    wellnessPrice: '$650 complet / $100 module',
    packageRange: '$550–$650',
    packageRangeNote: 'Selon le programme',
    parentingModules: '6 modules',
    businessModules: '6 modules',
    wellnessModules: '8 modules',
    completePrograms: 'programmes complets',
    faqIntro: 'Réservez selon les disponibilités affichées. Les horaires sont en heure de l’Est, les paiements sont non remboursables, et toute annulation ou reprogrammation doit être demandée au moins 2 heures avant.',
    onlineAnswer: 'Lors de la réservation, vous pourrez choisir entre Zoom, le téléphone ou une autre option de rencontre. Les détails seront confirmés avec votre rendez-vous.',
    groupAnswer: 'Les modules parental et bien-être sont offerts le lundi de 10 h 30 à 17 h 30, heure de l’Est. Les modules d’affaires sont offerts le samedi et le dimanche de 11 h 30 à 19 h 30. Chaque séance de module dure 1 h 30.',
    moduleAnswer: 'Oui. Un module coûte 100 $. Le programme complet de coaching parental ou de coaching en affaires coûte 550 $. Le programme complet de coaching bien-être coûte 650 $.',
    paymentTerms: 'Les tarifs sont de 50 $ pour une séance de coaching personnel pouvant durer jusqu’à 45 minutes, 100 $ par module, 550 $ pour le programme complet de coaching parental ou de coaching en affaires, et 650 $ pour le programme complet de coaching bien-être.',
    bookingTerms: 'Les disponibilités, les dates, les horaires, la durée et le nombre de places sont affichés au moment de la réservation. Les horaires sont indiqués en heure de l’Est.',
    cancellationTerms: 'Toute annulation ou reprogrammation doit être demandée au moins 2 heures avant l’heure prévue. Les paiements sont définitifs et non remboursables.',
    legalIntro: 'Ces conditions présentent les règles de réservation, de paiement, d’annulation et d’utilisation des services de Becoming Training Center.',
    legalNote: 'Veuillez lire ces conditions avant de réserver ou d’effectuer un paiement.',
    bookingPolicyTitle: 'Réservations, annulations et remboursements',
    bookingPolicyHtml: '<h2>Réservations, annulations et remboursements</h2><p>Les séances de coaching personnel sont offertes du mardi au vendredi, de 9 h à 17 h, heure de l’Est, et peuvent durer jusqu’à 45 minutes. Le client peut choisir Zoom, le téléphone ou une autre option de rencontre.</p><p>Les modules parental et bien-être sont offerts le lundi, de 10 h 30 à 17 h 30. Les modules d’affaires sont offerts le samedi et le dimanche, de 11 h 30 à 19 h 30. Chaque séance de module dure 1 h 30 et peut accueillir jusqu’à 20 participants pour le même module et la même séance.</p><p>Un module coûte 100 $. Le programme complet parental ou affaires coûte 550 $, et le programme complet bien-être coûte 650 $. Toute annulation ou reprogrammation doit être demandée au moins 2 heures avant l’heure prévue. Tous les paiements sont définitifs et non remboursables.</p>',
    meetingLabel: 'Mode de rencontre',
    zoom: 'Zoom',
    phone: 'Téléphone',
    other: 'Autre'
  } : {
    personalDuration: 'Up to 45 minutes',
    personalDurationShort: 'Up to 45 min',
    moduleFrom: 'From $100',
    packageFrom: 'From $550',
    parentingPrice: '$550 full / $100 per module',
    businessPrice: '$550 full / $100 per module',
    wellnessPrice: '$650 full / $100 per module',
    packageRange: '$550–$650',
    packageRangeNote: 'Depending on the program',
    parentingModules: '6 modules',
    businessModules: '6 modules',
    wellnessModules: '8 modules',
    completePrograms: 'complete programs',
    faqIntro: 'Book according to the availability shown. Times are listed in Eastern Time, payments are non-refundable, and cancellations or rescheduling must be requested at least 2 hours in advance.',
    onlineAnswer: 'During booking, you may choose Zoom, telephone, or another meeting option. The final details will be confirmed with your appointment.',
    groupAnswer: 'Parenting and Wellness modules are offered Monday from 10:30 a.m. to 5:30 p.m. Eastern Time. Business modules are offered Saturday and Sunday from 11:30 a.m. to 7:30 p.m. Each module session lasts 90 minutes.',
    moduleAnswer: 'Yes. One module costs $100. The complete Parenting or Business Coaching program costs $550. The complete Wellness Coaching program costs $650.',
    paymentTerms: 'Pricing is $50 for a personal coaching session lasting up to 45 minutes, $100 per module, $550 for the complete Parenting or Business Coaching program, and $650 for the complete Wellness Coaching program.',
    bookingTerms: 'Availability, dates, times, duration, and remaining capacity are displayed during booking. All times are listed in Eastern Time.',
    cancellationTerms: 'Cancellation or rescheduling must be requested at least 2 hours before the scheduled time. All payments are final and non-refundable.',
    legalIntro: 'These terms explain the booking, payment, cancellation, and service-use rules for Becoming Training Center.',
    legalNote: 'Please read these terms before booking or making a payment.',
    bookingPolicyTitle: 'Bookings, cancellations, and refunds',
    bookingPolicyHtml: '<h2>Bookings, cancellations, and refunds</h2><p>Personal coaching is offered Tuesday through Friday from 9:00 a.m. to 5:00 p.m. Eastern Time and may last up to 45 minutes. The client may choose Zoom, telephone, or another meeting option.</p><p>Parenting and Wellness modules are offered Monday from 10:30 a.m. to 5:30 p.m. Business modules are offered Saturday and Sunday from 11:30 a.m. to 7:30 p.m. Each module session lasts 90 minutes and may include up to 20 participants booking the same module and session.</p><p>One module costs $100. The complete Parenting or Business program costs $550, and the complete Wellness program costs $650. Cancellation or rescheduling must be requested at least 2 hours before the scheduled time. All payments are final and non-refundable.</p>',
    meetingLabel: 'Meeting method',
    zoom: 'Zoom',
    phone: 'Telephone',
    other: 'Other'
  };

  function replaceExactText(from, to) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() === from ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { node.nodeValue = node.nodeValue.replace(from, to); });
  }

  function updateHome() {
    const proof = document.querySelectorAll('.proof-strip > div');
    if (proof[1]) {
      const amount = proof[1].querySelector('strong');
      if (amount) amount.textContent = text.personalDurationShort;
    }
    if (proof[2]) {
      const amount = proof[2].querySelector('strong');
      const label = proof[2].querySelector('span');
      if (amount) amount.textContent = lang === 'fr' ? '6 à 8 modules' : '6–8 modules';
      if (label) label.textContent = text.completePrograms;
    }

    const homePrograms = {
      personal: { duration: text.personalDurationShort, price: '$50' },
      parenting: { duration: text.parentingModules, price: text.moduleFrom },
      business: { duration: text.businessModules, price: text.moduleFrom },
      wellness: { duration: text.wellnessModules, price: text.moduleFrom }
    };
    Object.entries(homePrograms).forEach(([program, values]) => {
      const tile = document.querySelector(`.program-tile[href*="#${program}"]`);
      if (!tile) return;
      const duration = tile.querySelector('.tile-meta b');
      const price = tile.querySelector('.tile-meta strong');
      if (duration) duration.textContent = values.duration;
      if (price) price.textContent = values.price;
    });

    const faqIntro = document.querySelector('.faq-section .faq-grid > div:first-child p');
    if (faqIntro) faqIntro.textContent = text.faqIntro;

    const accordions = [...document.querySelectorAll('.faq-section .accordion')];
    const answers = [text.onlineAnswer, text.groupAnswer, text.moduleAnswer];
    accordions.slice(0, 3).forEach((accordion, index) => {
      const paragraph = accordion.querySelector('.accordion__panel p');
      if (paragraph) paragraph.textContent = answers[index];
    });
  }

  function updateCoaching() {
    const personal = document.querySelector('#personal');
    if (personal) {
      const facts = personal.querySelectorAll('.detail-facts strong');
      if (facts[0]) facts[0].textContent = text.personalDuration;
      if (facts[1]) facts[1].textContent = '$50';
    }

    const programData = {
      parenting: { duration: '1 h 30 par module', durationEn: '90 minutes per module', price: text.parentingPrice },
      business: { duration: '1 h 30 par module', durationEn: '90 minutes per module', price: text.businessPrice },
      wellness: { duration: '1 h 30 par module', durationEn: '90 minutes per module', price: text.wellnessPrice }
    };
    Object.entries(programData).forEach(([id, values]) => {
      const section = document.querySelector(`#${id}`);
      if (!section) return;
      const facts = section.querySelectorAll('.detail-facts strong');
      if (facts[0]) facts[0].textContent = lang === 'fr' ? values.duration : values.durationEn;
      if (facts[1]) facts[1].textContent = values.price;
    });

    const heroStats = document.querySelectorAll('.page-hero__stats strong');
    if (heroStats[0]) heroStats[0].textContent = '$50';
    if (heroStats[1]) heroStats[1].textContent = '$100';
    if (heroStats[2]) heroStats[2].textContent = text.packageFrom;

    const cards = [...document.querySelectorAll('.pricing-box')];
    const personalCard = cards.find(card => /séance individuelle|individual session/i.test(card.textContent));
    if (personalCard) {
      const amount = personalCard.querySelector('strong');
      const note = personalCard.querySelector('small');
      if (amount) amount.textContent = '$50';
      if (note) note.textContent = text.personalDuration;
    }
    const moduleCard = cards.find(card => /module individuel|individual module/i.test(card.textContent));
    if (moduleCard) {
      const amount = moduleCard.querySelector('strong');
      if (amount) amount.textContent = '$100';
    }
    const fullCard = cards.find(card => /programme complet|complete program/i.test(card.textContent));
    if (fullCard) {
      const amount = fullCard.querySelector('strong');
      const note = fullCard.querySelector('small');
      if (amount) amount.textContent = text.packageRange;
      if (note) note.textContent = text.packageRangeNote;
    }
  }

  function updateTerms() {
    if (!location.pathname.endsWith('terms.html')) return;

    const heroText = document.querySelector('.legal-hero p');
    if (heroText) heroText.textContent = text.legalIntro;
    const legalNote = document.querySelector('.legal-note p');
    if (legalNote) legalNote.textContent = text.legalNote;

    const sections = [...document.querySelectorAll('.legal-article section')];
    const bookingSection = sections.find(section => /^1\.|bookings|réservations/i.test(section.querySelector('h2')?.textContent.trim() || ''));
    const paymentSection = sections.find(section => /^2\.|payments|paiements/i.test(section.querySelector('h2')?.textContent.trim() || ''));
    const cancellationSection = sections.find(section => /^3\.|cancellation|annulation/i.test(section.querySelector('h2')?.textContent.trim() || ''));
    if (bookingSection?.querySelector('p')) bookingSection.querySelector('p').textContent = text.bookingTerms;
    if (paymentSection?.querySelector('p')) paymentSection.querySelector('p').textContent = text.paymentTerms;
    if (cancellationSection?.querySelector('p')) cancellationSection.querySelector('p').textContent = text.cancellationTerms;

    const policy = document.querySelector('.terms-booking-policy');
    if (policy) policy.innerHTML = text.bookingPolicyHtml;
  }

  function updateBooking() {
    const form = document.querySelector('[data-booking-form]');
    if (!form) return;

    const program = form.querySelector('#program-select');
    const format = form.querySelector('#format-select');
    const summary = form.querySelector('[data-price-summary]');

    const renderPrice = () => {
      if (!program || !summary) return;
      const selectedProgram = program.value || 'personal';
      const selectedFormat = format?.value || (selectedProgram === 'personal' ? 'session' : 'module');
      if (selectedProgram === 'personal') summary.textContent = '$50';
      else if (selectedFormat === 'full') summary.textContent = `$${prices[selectedProgram]?.full || 0}`;
      else summary.textContent = '$100';
    };

    if (program && !form.dataset.correctPriceListener) {
      program.addEventListener('change', renderPrice);
      format?.addEventListener('change', renderPrice);
      form.dataset.correctPriceListener = 'true';
    }
    renderPrice();

    if (!form.querySelector('#meeting-method')) {
      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      const field = document.createElement('label');
      field.className = 'field';
      field.innerHTML = `<span>${text.meetingLabel}</span><select id="meeting-method" name="meeting-method" required><option value="zoom">${text.zoom}</option><option value="telephone">${text.phone}</option><option value="other">${text.other}</option></select>`;
      if (submit) submit.insertAdjacentElement('beforebegin', field);
      else form.appendChild(field);
    }
  }

  function replaceOldCopy() {
    const replacements = lang === 'fr' ? [
      ['30 min', text.personalDurationShort],
      ['30 minutes', text.personalDuration],
      ['Dès $150', text.moduleFrom],
      ['$650 complet / $150 module', text.wellnessPrice],
      ['Le mode de rencontre final — Zoom, Google Meet, téléphone ou autre — sera confirmé au moment de la configuration du calendrier.', text.onlineAnswer],
      ['Une nouvelle cohorte est prévue le premier lundi de chaque mois. La date exacte sera confirmée lors de l’inscription.', text.groupAnswer],
      ['Oui. Les programmes parental, affaires et bien-être prévoient des modules individuels à 150 $ ainsi qu’un programme complet à 650 $.', text.moduleAnswer],
      ['Les modalités finales de réservation, de paiement et d’annulation seront affichées clairement avant le lancement public.', text.faqIntro]
    ] : [
      ['30 min', text.personalDurationShort],
      ['30 minutes', text.personalDuration],
      ['From $150', text.moduleFrom],
      ['Starting at $150', text.moduleFrom],
      ['$650 full / $150 module', text.wellnessPrice],
      ['The final meeting format — Zoom, Google Meet, phone, or another option — will be confirmed when the calendar is configured.', text.onlineAnswer],
      ['A new cohort is planned for the first Monday of every month. The exact date will be confirmed at enrollment.', text.groupAnswer],
      ['Yes. Parenting, business, and wellness programs offer individual modules at $150 and a complete program at $650.', text.moduleAnswer],
      ['Final booking, payment, and cancellation details will be clearly displayed before the public launch.', text.faqIntro]
    ];
    replacements.forEach(([from, to]) => replaceExactText(from, to));
  }

  function apply() {
    replaceOldCopy();
    updateHome();
    updateCoaching();
    updateTerms();
    updateBooking();
  }

  apply();
  [100, 350, 900, 1800, 3000].forEach(delay => setTimeout(apply, delay));
})();
