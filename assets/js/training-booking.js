(() => {
  const form = document.querySelector('[data-real-booking-form]');
  if (!form || form.dataset.trainingBooking === 'true') return;
  form.dataset.trainingBooking = 'true';

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const trainingCodes = new Set(['cna', 'hha', 'med-tech', 'english', 'spanish']);
  const programSelect = form.querySelector('#program-select');
  const formatSelect = form.querySelector('#format-select');
  const moduleWrap = form.querySelector('[data-module-wrap]');
  const topicWrap = form.querySelector('[data-topic-wrap]');
  const dateInput = form.querySelector('#preferred-date');
  const timeSelect = form.querySelector('#preferred-time');
  const meetingSelect = form.querySelector('#meeting-method');
  const otherWrap = form.querySelector('[data-other-meeting-wrap]');
  const scheduleCopy = form.querySelector('[data-schedule-copy]');
  const availability = form.querySelector('[data-availability]');
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-booking-status]');
  const consent = form.querySelector('#booking-consent');
  const priceSummaries = document.querySelectorAll('[data-price-summary]');
  const summary = document.querySelector('.booking-summary');

  if (!programSelect || !formatSelect || !dateInput || !timeSelect || !meetingSelect) return;

  const dateWrap = dateInput.closest('.field');
  const timeWrap = timeSelect.closest('.field');
  const meetingWrap = meetingSelect.closest('.field');

  const copy = lang === 'fr' ? {
    enrollment: 'Inscription à la formation',
    online: 'Formation 100 % en ligne. Les prochaines dates et les instructions de paiement seront communiquées après votre demande.',
    submit: 'Envoyer ma demande d’inscription',
    submitting: 'Envoi de la demande…',
    success: 'Votre demande d’inscription a été enregistrée.',
    failed: 'Impossible d’enregistrer la demande. Vérifiez les champs et réessayez.',
    duplicate: 'Une demande active existe déjà pour cette formation avec cette adresse courriel.',
    summaryTitle: 'Formation en ligne',
    summaryText: 'Sélectionnez une formation et envoyez votre demande. L’équipe vous contactera avec les prochaines dates et les instructions de paiement.',
    summaryItems: ['CNA : 350 $', 'HHA : 250 $', 'Med Tech : 250 $', 'Anglais : 250 $', 'Espagnol : 250 $'],
    coachingSubmit: 'Enregistrer ma réservation'
  } : {
    enrollment: 'Training enrollment',
    online: '100% online training. Upcoming dates and payment instructions will be shared after your request.',
    submit: 'Send my enrollment request',
    submitting: 'Sending request…',
    success: 'Your enrollment request has been recorded.',
    failed: 'The request could not be recorded. Check the fields and try again.',
    duplicate: 'An active request already exists for this course with this email address.',
    summaryTitle: 'Online training',
    summaryText: 'Select a course and submit your request. The team will contact you with upcoming dates and payment instructions.',
    summaryItems: ['CNA: $350', 'HHA: $250', 'Med Tech: $250', 'English: $250', 'Spanish: $250'],
    coachingSubmit: 'Record my booking'
  };

  let programs = [];
  let trainingMode = false;
  let originalSummary = summary ? summary.innerHTML : '';

  const money = cents => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(cents || 0) / 100);

  function selectedProgram() {
    return programs.find(program => program.code === programSelect.value) || null;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.style.display = hidden ? 'none' : '';
  }

  function updateSummary(program) {
    if (!summary) return;
    if (!program) {
      summary.innerHTML = originalSummary;
      return;
    }
    summary.innerHTML = `<span class="kicker">${lang === 'fr' ? 'Résumé' : 'Summary'}</span><strong>${copy.summaryTitle}</strong><p>${copy.summaryText}</p><ul>${copy.summaryItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
  }

  function enterTrainingMode(program) {
    trainingMode = true;
    formatSelect.innerHTML = `<option value="full_program">${copy.enrollment}</option>`;
    formatSelect.value = 'full_program';
    formatSelect.required = true;

    setHidden(moduleWrap, true);
    setHidden(topicWrap, true);
    setHidden(dateWrap, true);
    setHidden(timeWrap, true);
    setHidden(meetingWrap, true);
    setHidden(otherWrap, true);

    dateInput.required = false;
    dateInput.value = '';
    timeSelect.required = false;
    timeSelect.value = '';
    meetingSelect.required = false;
    meetingSelect.value = 'other';

    const moduleSelect = form.querySelector('#module-select');
    const topic = form.querySelector('#discussion-topic');
    const other = form.querySelector('#other-meeting-method');
    if (moduleSelect) {
      moduleSelect.required = false;
      moduleSelect.value = '';
    }
    if (topic) {
      topic.required = false;
      topic.value = '';
    }
    if (other) {
      other.required = false;
      other.value = '100% online training';
    }

    if (scheduleCopy) scheduleCopy.textContent = lang === 'fr' ? program.schedule_fr : program.schedule_en;
    if (availability) {
      availability.textContent = copy.online;
      availability.className = 'booking-availability is-info';
    }
    priceSummaries.forEach(element => {
      element.textContent = money(program.single_price_cents);
    });
    submit.textContent = copy.submit;
    submit.disabled = false;
    updateSummary(program);
  }

  function leaveTrainingMode() {
    if (!trainingMode) return;
    trainingMode = false;
    setHidden(dateWrap, false);
    setHidden(timeWrap, false);
    setHidden(meetingWrap, false);
    dateInput.required = true;
    timeSelect.required = true;
    meetingSelect.required = true;
    meetingSelect.value = 'zoom';
    submit.textContent = copy.coachingSubmit;
    updateSummary(null);
    programSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncMode() {
    const program = selectedProgram();
    if (program && trainingCodes.has(program.code)) {
      enterTrainingMode(program);
    } else if (trainingMode) {
      leaveTrainingMode();
    }
  }

  programSelect.addEventListener('change', () => {
    queueMicrotask(syncMode);
  });

  form.addEventListener('submit', async event => {
    if (!trainingMode) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    status.textContent = '';
    status.className = 'form-status';
    if (!form.reportValidity() || !consent.checked) return;

    const program = selectedProgram();
    if (!program) return;

    const payload = {
      full_name: form.querySelector('#full-name').value,
      email: form.querySelector('#email').value,
      phone: form.querySelector('#phone').value,
      language: lang,
      program_code: program.code,
      booking_type: 'full_program',
      module_id: null,
      preferred_date: '',
      preferred_time: '',
      meeting_method: 'other',
      other_meeting_method: '100% online training',
      discussion_topic: '',
      consent: consent.checked,
      website: form.querySelector('#website-field').value
    };

    submit.disabled = true;
    submit.textContent = copy.submitting;
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error === 'DUPLICATE_BOOKING' ? copy.duplicate : copy.failed);
      }
      status.innerHTML = `<strong>${copy.success}</strong><br>${data.message}<br>${lang === 'fr' ? 'Numéro de demande' : 'Request number'}: <code>${data.booking_id}</code>`;
      status.className = 'form-status is-success';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error.message || copy.failed;
      status.className = 'form-status is-error';
    } finally {
      submit.disabled = false;
      submit.textContent = copy.submit;
    }
  }, true);

  async function loadPrograms() {
    try {
      const response = await fetch('/api/programs', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.programs)) return;
      programs = data.programs;
      syncMode();
    } catch (error) {
      console.error('Unable to initialize training booking options', error);
    }
  }

  loadPrograms();
})();