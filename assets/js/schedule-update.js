(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';

  const copy = {
    fr: {
      personalSchedule: 'Tous les samedis, de 8 h à 12 h 30 (heure de l’Est). Chaque réservation bloque une plage pouvant aller jusqu’à 45 minutes. La séance peut se terminer plus tôt selon le sujet.',
      personalDuration: 'Jusqu’à 45 minutes',
      parentingSchedule: 'Choisissez librement le module que vous souhaitez suivre. Les modules sont offerts tous les lundis, de 10 h 30 à 17 h 30 (heure de l’Est).',
      businessSchedule: 'Choisissez librement le module que vous souhaitez suivre. Les modules d’affaires sont offerts le samedi et le dimanche, de 11 h 30 à 19 h 30 (heure de l’Est).',
      wellnessSchedule: 'Choisissez librement le module que vous souhaitez suivre. Les modules sont offerts tous les lundis, de 10 h 30 à 17 h 30 (heure de l’Est).',
      groupDuration: '1 h 30 par module',
      groupPrice: '$650 complet / $100 module',
      capacity: 'Jusqu’à 20 participants peuvent réserver le même module pour la même séance.',
      parentingAvailability: 'Lundi · 10 h 30 à 17 h 30 ET',
      wellnessAvailability: 'Lundi · 10 h 30 à 17 h 30 ET',
      businessAvailability: 'Samedi ou dimanche · 11 h 30 à 19 h 30 ET',
      exactTime: 'La plage exacte de 1 h 30 sera choisie dans le calendrier en direct.',
      bookingPolicy: '<h3>Informations de réservation</h3><ul><li>Tous les horaires sont affichés en heure de l’Est.</li><li>Coaching personnel : samedi, de 8 h à 12 h 30, jusqu’à 45 minutes.</li><li>Modules parental et bien-être : lundi, de 10 h 30 à 17 h 30.</li><li>Modules d’affaires : samedi et dimanche, de 11 h 30 à 19 h 30.</li><li>Chaque module dure 1 h 30 et peut accueillir jusqu’à 20 participants.</li><li>Les séances ont lieu sur Zoom ou WhatsApp.</li><li>Annulation ou reprogrammation au moins 2 heures avant.</li><li>Les paiements sont définitifs et non remboursables.</li></ul>',
      terms: '<h2>Réservations, annulations et remboursements</h2><p>Tous les rendez-vous sont affichés en heure de l’Est. Les séances de coaching personnel sont offertes le samedi, de 8 h à 12 h 30, et peuvent durer jusqu’à 45 minutes. Elles ont lieu sur Zoom ou WhatsApp.</p><p>Les clients peuvent choisir le module parental ou bien-être de leur choix le lundi, entre 10 h 30 et 17 h 30. Les modules d’affaires sont offerts le samedi et le dimanche, entre 11 h 30 et 19 h 30. Chaque module dure 1 h 30 et peut accueillir jusqu’à 20 participants pour le même module et la même séance.</p><p>Toute annulation ou reprogrammation doit être demandée au moins 2 heures avant l’heure prévue. Tous les paiements sont définitifs et non remboursables.</p>'
    },
    en: {
      personalSchedule: 'Every Saturday from 8:00 a.m. to 12:30 p.m. Eastern Time. Each booking reserves up to 45 minutes, although the session may end earlier depending on the topic.',
      personalDuration: 'Up to 45 minutes',
      parentingSchedule: 'Choose any module you would like to attend. Modules are available every Monday from 10:30 a.m. to 5:30 p.m. Eastern Time.',
      businessSchedule: 'Choose any module you would like to attend. Business modules are available Saturday and Sunday from 11:30 a.m. to 7:30 p.m. Eastern Time.',
      wellnessSchedule: 'Choose any module you would like to attend. Modules are available every Monday from 10:30 a.m. to 5:30 p.m. Eastern Time.',
      groupDuration: '1 hour 30 minutes per module',
      groupPrice: '$650 full / $100 module',
      capacity: 'Up to 20 participants may book the same module for the same session.',
      parentingAvailability: 'Monday · 10:30 a.m.–5:30 p.m. ET',
      wellnessAvailability: 'Monday · 10:30 a.m.–5:30 p.m. ET',
      businessAvailability: 'Saturday or Sunday · 11:30 a.m.–7:30 p.m. ET',
      exactTime: 'The exact 90-minute time slot will be selected in the live calendar.',
      bookingPolicy: '<h3>Booking information</h3><ul><li>All times are shown in Eastern Time.</li><li>Personal coaching: Saturday, 8:00 a.m.–12:30 p.m., up to 45 minutes.</li><li>Parenting and wellness modules: Monday, 10:30 a.m.–5:30 p.m.</li><li>Business modules: Saturday and Sunday, 11:30 a.m.–7:30 p.m.</li><li>Each module lasts 90 minutes and may include up to 20 participants.</li><li>Sessions take place through Zoom or WhatsApp.</li><li>Cancel or reschedule at least 2 hours in advance.</li><li>All payments are final and non-refundable.</li></ul>',
      terms: '<h2>Bookings, cancellations, and refunds</h2><p>All appointments are shown in Eastern Time. Personal coaching is available Saturday from 8:00 a.m. to 12:30 p.m. and may last up to 45 minutes. Sessions take place through Zoom or WhatsApp.</p><p>Clients may choose any parenting or wellness module on Monday between 10:30 a.m. and 5:30 p.m. Business modules are available Saturday and Sunday between 11:30 a.m. and 7:30 p.m. Each module lasts 90 minutes and may include up to 20 participants booking the same module for the same session.</p><p>Cancellation or rescheduling must be requested at least 2 hours before the scheduled time. All payments are final and non-refundable.</p>'
    }
  }[lang];

  function updateSection(id, schedule, duration, price, addCapacity = false) {
    const section = document.querySelector(id);
    if (!section) return;
    const intro = section.querySelector('.coaching-detail__intro');
    const paragraphs = intro?.querySelectorAll('p');
    if (paragraphs?.length) paragraphs[paragraphs.length - 1].textContent = schedule;
    const facts = intro?.querySelectorAll('.detail-facts strong');
    if (facts?.[0]) facts[0].textContent = duration;
    if (facts?.[1]) facts[1].textContent = price;
    const panel = section.querySelector('.module-panel');
    if (addCapacity && panel) {
      let note = panel.querySelector('.capacity-note');
      if (!note) {
        note = document.createElement('span');
        note.className = 'capacity-note';
        panel.appendChild(note);
      }
      note.textContent = copy.capacity;
    }
  }

  updateSection('#personal', copy.personalSchedule, copy.personalDuration, '$50');
  updateSection('#parenting', copy.parentingSchedule, copy.groupDuration, copy.groupPrice, true);
  updateSection('#business', copy.businessSchedule, copy.groupDuration, copy.groupPrice, true);
  updateSection('#wellness', copy.wellnessSchedule, copy.groupDuration, copy.groupPrice, true);

  document.querySelectorAll('.page-hero__stats strong, .pricing-box strong, .tile-meta strong').forEach((el) => {
    if (el.textContent.trim() === '$150') el.textContent = '$100';
  });
  document.querySelectorAll('.pricing-box small').forEach((el) => {
    if (/30 minutes/i.test(el.textContent)) el.textContent = copy.personalDuration;
  });

  const bookingForm = document.querySelector('[data-booking-form]');
  if (bookingForm) {
    const program = bookingForm.querySelector('#program-select');
    const moduleSelect = bookingForm.querySelector('#module-select');
    const slotHolder = bookingForm.querySelector('[data-slot-holder]') || bookingForm.querySelector('.time-slots') || bookingForm.querySelector('.time-grid');
    const policy = bookingForm.parentElement?.querySelector('.booking-policy-card');
    if (policy) policy.innerHTML = copy.bookingPolicy;

    const modules = {
      parenting: lang === 'fr' ? [
        'Pourquoi mon enfant ne m’écoute-t-il jamais ?',
        'Comment arrêter de crier sur son enfant ?',
        'Les 7 erreurs qui détruisent la confiance de votre enfant',
        'Comment gérer les colères sans perdre le contrôle ?',
        'Comment élever un enfant émotionnellement fort dans un monde fragile ?',
        'Comment protéger son enfant des dangers du monde numérique ?'
      ] : [
        'Why does my child never listen to me?',
        'How can I stop yelling at my child?',
        'The 7 mistakes that destroy your child’s confidence',
        'How can I manage anger without losing control?',
        'How can I raise an emotionally strong child in a fragile world?',
        'How can I protect my child from the dangers of the digital world?'
      ],
      business: lang === 'fr' ? [
        'Comment lancer une entreprise, même si vous partez de zéro ?',
        'Pourquoi votre entreprise ne trouve-t-elle pas assez de clients ?',
        'Comment transformer votre idée en une marque que les clients choisissent naturellement ?',
        'Les 7 erreurs qui empêchent une entreprise de grandir',
        'Comment utiliser l’intelligence artificielle pour travailler moins et gagner plus ?',
        'Comment éviter les erreurs fiscales qui coûtent des milliers de dollars aux entrepreneurs ?'
      ] : [
        'How can you launch a business even if you are starting from zero?',
        'Why is your business not attracting enough clients?',
        'How can you turn your idea into a brand customers naturally choose?',
        'The 7 mistakes preventing a business from growing',
        'How can you use artificial intelligence to work less and earn more?',
        'How can entrepreneurs avoid tax mistakes that cost thousands of dollars?'
      ],
      wellness: lang === 'fr' ? [
        'Pourquoi suis-je toujours stressé(e) et épuisé(e) ?',
        'Pourquoi ai-je perdu toute motivation ?',
        'Pourquoi mes relations finissent-elles toujours par me blesser ?',
        'Comment guérir après une séparation, un divorce ou une trahison ?',
        'Comment traverser un deuil sans perdre le goût de vivre ?',
        'Pourquoi est-il si difficile de changer malgré toute ma bonne volonté ?',
        'Pourquoi est-ce que je doute constamment de moi-même ?',
        'Comment reprendre le contrôle de ma vie et retrouver un véritable épanouissement ?'
      ] : [
        'Why am I always stressed and exhausted?',
        'Why have I lost all motivation?',
        'Why do my relationships always end up hurting me?',
        'How can I heal after a breakup, divorce, or betrayal?',
        'How can I move through grief without losing the desire to live?',
        'Why is change so difficult despite my best intentions?',
        'Why do I constantly doubt myself?',
        'How can I take control of my life and experience genuine fulfillment?'
      ]
    };

    function renderBookingDetails() {
      const selected = program?.value || 'personal';
      if (moduleSelect) {
        const options = modules[selected] || [];
        moduleSelect.innerHTML = '';
        if (selected === 'personal') {
          const option = document.createElement('option');
          option.value = 'custom';
          option.textContent = lang === 'fr' ? 'Sujet libre — à décrire ci-dessous' : 'Open topic — describe it below';
          moduleSelect.appendChild(option);
        } else {
          options.forEach((title, index) => {
            const option = document.createElement('option');
            option.value = `${selected}-${index + 1}`;
            option.textContent = title;
            moduleSelect.appendChild(option);
          });
        }
      }

      if (slotHolder) {
        const label = selected === 'personal'
          ? (lang === 'fr' ? 'Samedi · choisissez une heure de début' : 'Saturday · choose a start time')
          : selected === 'business' ? copy.businessAvailability
          : selected === 'wellness' ? copy.wellnessAvailability
          : copy.parentingAvailability;
        slotHolder.innerHTML = '';
        if (selected === 'personal') {
          ['8:00 AM', '8:45 AM', '9:30 AM', '10:15 AM', '11:00 AM', '11:45 AM'].forEach((time) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-slot';
            button.dataset.time = time;
            button.textContent = time;
            slotHolder.appendChild(button);
          });
        } else {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'time-slot selected';
          button.dataset.time = label;
          button.textContent = label;
          slotHolder.appendChild(button);
          const note = document.createElement('span');
          note.className = 'capacity-note';
          note.textContent = `${copy.groupDuration}. ${copy.capacity} ${copy.exactTime}`;
          slotHolder.appendChild(note);
        }
        slotHolder.querySelectorAll('.time-slot').forEach((button) => {
          button.addEventListener('click', () => {
            slotHolder.querySelectorAll('.time-slot').forEach((item) => item.classList.remove('selected'));
            button.classList.add('selected');
            const hidden = bookingForm.querySelector('[data-time-input]');
            if (hidden) hidden.value = button.dataset.time || '';
          });
        });
      }
    }

    program?.addEventListener('change', renderBookingDetails);
    setTimeout(renderBookingDetails, 0);
  }

  if (location.pathname.endsWith('terms.html')) {
    const policy = document.querySelector('.terms-booking-policy');
    if (policy) policy.innerHTML = copy.terms;
  }
})();
