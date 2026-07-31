(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const form = document.querySelector('[data-real-booking-form]');
  if (!form) return;

  const copy = lang === 'fr' ? {
    select: 'Sélectionnez',
    personal: 'Séance personnelle',
    single: 'Un module',
    full: 'Programme complet',
    topic: 'Décrivez ce que vous souhaitez aborder pendant votre séance.',
    module: 'Choisissez un module',
    fullNote: 'Le programme complet comprend tous les modules de cette catégorie.',
    loading: 'Chargement des programmes…',
    checking: 'Vérification des places…',
    remaining: (remaining, capacity) => `${remaining} place(s) restante(s) sur ${capacity}`,
    fullSlot: 'Cette séance est complète. Choisissez une autre plage.',
    submit: 'Enregistrer ma réservation',
    submitting: 'Enregistrement…',
    success: 'Votre demande a été enregistrée.',
    failed: 'Impossible d’enregistrer la réservation. Vérifiez les champs et réessayez.',
    duplicate: 'Cette adresse courriel possède déjà une réservation pour cette séance.',
    selectModule: 'Veuillez choisir un module.',
    selectDate: 'Veuillez choisir une date offerte pour ce programme.',
    paymentNotice: 'Le paiement Stripe n’est pas encore activé. Cette étape enregistre une demande de réservation; la confirmation finale sera envoyée séparément.'
  } : {
    select: 'Select',
    personal: 'Personal session',
    single: 'One module',
    full: 'Complete program',
    topic: 'Describe what you would like to discuss during your session.',
    module: 'Choose a module',
    fullNote: 'The complete program includes every module in this category.',
    loading: 'Loading programs…',
    checking: 'Checking available seats…',
    remaining: (remaining, capacity) => `${remaining} seat(s) remaining out of ${capacity}`,
    fullSlot: 'This session is full. Choose another time.',
    submit: 'Record my booking',
    submitting: 'Recording…',
    success: 'Your booking request has been recorded.',
    failed: 'The booking could not be recorded. Check the fields and try again.',
    duplicate: 'This email address already has a booking for this session.',
    selectModule: 'Please choose a module.',
    selectDate: 'Please choose an available date for this program.',
    paymentNotice: 'Stripe payment is not active yet. This step records a booking request; final confirmation will be sent separately.'
  };

  const els = {
    program: form.querySelector('#program-select'),
    type: form.querySelector('#format-select'),
    moduleWrap: form.querySelector('[data-module-wrap]'),
    module: form.querySelector('#module-select'),
    topicWrap: form.querySelector('[data-topic-wrap]'),
    topic: form.querySelector('#discussion-topic'),
    date: form.querySelector('#preferred-date'),
    time: form.querySelector('#preferred-time'),
    schedule: form.querySelector('[data-schedule-copy]'),
    price: form.querySelector('[data-price-summary]'),
    availability: form.querySelector('[data-availability]'),
    submit: form.querySelector('button[type="submit"]'),
    status: form.querySelector('[data-booking-status]'),
    otherWrap: form.querySelector('[data-other-meeting-wrap]'),
    other: form.querySelector('#other-meeting-method'),
    meeting: form.querySelector('#meeting-method'),
    paymentNotice: form.querySelector('[data-payment-notice]')
  };

  let programs = [];
  let activeProgram = null;
  let availabilityTimer;

  const money = cents => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Number(cents || 0) / 100);

  function easternToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function dayAllowed(programCode, dateValue) {
    if (!dateValue) return false;
    const day = new Date(`${dateValue}T12:00:00Z`).getUTCDay();
    if (programCode === 'personal') return day === 6;
    if (programCode === 'parenting' || programCode === 'wellness') return day === 1;
    if (programCode === 'business') return day === 0 || day === 6;
    return false;
  }

  function renderProgramOptions() {
    els.program.innerHTML = `<option value="">${copy.select}</option>`;
    programs.forEach(program => {
      const option = document.createElement('option');
      option.value = program.code;
      option.textContent = lang === 'fr' ? program.title_fr : program.title_en;
      els.program.appendChild(option);
    });
  }

  function renderTimes() {
    els.time.innerHTML = `<option value="">${copy.select}</option>`;
    (activeProgram?.time_slots || []).forEach(time => {
      const option = document.createElement('option');
      option.value = time;
      const [hour, minute] = time.split(':').map(Number);
      option.textContent = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
        hour: 'numeric', minute: '2-digit', hour12: lang !== 'fr', timeZone: 'UTC'
      }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
      els.time.appendChild(option);
    });
  }

  function renderModules() {
    els.module.innerHTML = `<option value="">${copy.module}</option>`;
    (activeProgram?.modules || []).forEach(module => {
      const option = document.createElement('option');
      option.value = module.id;
      option.textContent = lang === 'fr' ? module.title_fr : module.title_en;
      els.module.appendChild(option);
    });
  }

  function updatePrice() {
    if (!activeProgram) {
      els.price.textContent = '—';
      return;
    }
    if (activeProgram.code === 'personal' || els.type.value === 'single_module') {
      els.price.textContent = money(activeProgram.single_price_cents);
    } else {
      els.price.textContent = money(activeProgram.full_package_cents);
    }
  }

  function updateProgramUI() {
    activeProgram = programs.find(program => program.code === els.program.value) || null;
    els.availability.textContent = '';
    els.availability.className = 'booking-availability';

    if (!activeProgram) {
      els.type.innerHTML = `<option value="">${copy.select}</option>`;
      els.moduleWrap.hidden = true;
      els.topicWrap.hidden = true;
      els.schedule.textContent = '';
      renderTimes();
      updatePrice();
      return;
    }

    const isPersonal = activeProgram.code === 'personal';
    els.type.innerHTML = isPersonal
      ? `<option value="session">${copy.personal}</option>`
      : `<option value="single_module">${copy.single}</option><option value="full_program">${copy.full}</option>`;
    els.type.value = isPersonal ? 'session' : 'single_module';
    els.topicWrap.hidden = !isPersonal;
    els.topic.required = isPersonal;
    els.moduleWrap.hidden = isPersonal;
    els.module.required = !isPersonal;
    els.schedule.textContent = lang === 'fr' ? activeProgram.schedule_fr : activeProgram.schedule_en;
    renderTimes();
    renderModules();
    updateTypeUI();
  }

  function updateTypeUI() {
    if (!activeProgram) return;
    const isPersonal = activeProgram.code === 'personal';
    const isFull = els.type.value === 'full_program';
    els.moduleWrap.hidden = isPersonal || isFull;
    els.module.required = !isPersonal && !isFull;
    if (isFull) {
      els.module.value = '';
      els.availability.textContent = copy.fullNote;
      els.availability.className = 'booking-availability is-info';
    } else {
      els.availability.textContent = '';
      checkAvailability();
    }
    updatePrice();
  }

  async function checkAvailability() {
    clearTimeout(availabilityTimer);
    availabilityTimer = setTimeout(async () => {
      if (!activeProgram || !els.date.value || !els.time.value) return;
      if (!dayAllowed(activeProgram.code, els.date.value)) {
        els.availability.textContent = copy.selectDate;
        els.availability.className = 'booking-availability is-error';
        return;
      }
      if (activeProgram.code !== 'personal' && els.type.value === 'single_module' && !els.module.value) return;
      if (els.type.value === 'full_program') return;

      els.availability.textContent = copy.checking;
      els.availability.className = 'booking-availability is-info';
      const params = new URLSearchParams({
        program: activeProgram.code,
        date: els.date.value,
        time: els.time.value
      });
      if (els.module.value) params.set('module', els.module.value);

      try {
        const response = await fetch(`/api/availability?${params}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Availability error');
        els.availability.textContent = data.remaining > 0
          ? copy.remaining(data.remaining, data.capacity)
          : copy.fullSlot;
        els.availability.className = `booking-availability ${data.remaining > 0 ? 'is-success' : 'is-error'}`;
        els.submit.disabled = data.remaining <= 0;
      } catch {
        els.availability.textContent = copy.failed;
        els.availability.className = 'booking-availability is-error';
      }
    }, 250);
  }

  els.program.addEventListener('change', updateProgramUI);
  els.type.addEventListener('change', updateTypeUI);
  els.module.addEventListener('change', checkAvailability);
  els.date.addEventListener('change', checkAvailability);
  els.time.addEventListener('change', checkAvailability);
  els.meeting.addEventListener('change', () => {
    const isOther = els.meeting.value === 'other';
    els.otherWrap.hidden = !isOther;
    els.other.required = isOther;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    els.status.textContent = '';
    if (!activeProgram) return;
    if (!dayAllowed(activeProgram.code, els.date.value)) {
      els.status.textContent = copy.selectDate;
      els.status.className = 'form-status is-error';
      return;
    }
    if (activeProgram.code !== 'personal' && els.type.value === 'single_module' && !els.module.value) {
      els.status.textContent = copy.selectModule;
      els.status.className = 'form-status is-error';
      return;
    }

    const payload = {
      full_name: form.querySelector('#full-name').value,
      email: form.querySelector('#email').value,
      phone: form.querySelector('#phone').value,
      language: lang,
      program_code: activeProgram.code,
      booking_type: els.type.value,
      module_id: els.module.value || null,
      preferred_date: els.date.value,
      preferred_time: els.time.value,
      meeting_method: els.meeting.value,
      other_meeting_method: els.other.value,
      discussion_topic: els.topic.value,
      consent: form.querySelector('#booking-consent').checked,
      website: form.querySelector('#website-field').value
    };

    els.submit.disabled = true;
    els.submit.textContent = copy.submitting;
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data.error === 'DUPLICATE_BOOKING' ? copy.duplicate
          : data.error === 'SESSION_FULL' ? copy.fullSlot
          : copy.failed;
        throw new Error(message);
      }

      els.status.innerHTML = `<strong>${copy.success}</strong><br>${data.message}<br>${lang === 'fr' ? 'Numéro de réservation' : 'Booking number'}: <code>${data.booking_id}</code>`;
      els.status.className = 'form-status is-success';
      window.dispatchEvent(new Event('booking-created'));
      await checkAvailability();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      els.status.textContent = error.message || copy.failed;
      els.status.className = 'form-status is-error';
    } finally {
      els.submit.disabled = false;
      els.submit.textContent = copy.submit;
    }
  });

  async function loadPrograms() {
    els.status.textContent = copy.loading;
    try {
      const response = await fetch('/api/programs', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.programs)) throw new Error();
      programs = data.programs;
      renderProgramOptions();
      els.date.min = easternToday();
      els.status.textContent = '';
      if (els.paymentNotice) els.paymentNotice.textContent = copy.paymentNotice;
    } catch {
      els.status.textContent = copy.failed;
      els.status.className = 'form-status is-error';
      els.submit.disabled = true;
    }
  }

  loadPrograms();
})();
