(() => {
  const form = document.querySelector('[data-real-booking-form]');
  if (!form || form.dataset.contactEnhancements === 'true') return;
  form.dataset.contactEnhancements = 'true';

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const phoneInput = form.querySelector('#phone');
  if (!phoneInput) return;

  const copy = lang === 'fr' ? {
    phone: 'Numéro de téléphone',
    country: 'Pays / indicatif',
    contact: 'Meilleure façon de vous contacter',
    email: 'Courriel',
    whatsapp: 'WhatsApp',
    telephone: 'Appel téléphonique',
    phoneHint: 'Entrez seulement le numéro local. L’indicatif sélectionné sera ajouté automatiquement.',
    phoneRequired: 'Un numéro de téléphone valide est obligatoire pour WhatsApp ou un appel téléphonique.',
    invalidPhone: 'Vérifiez le pays, l’indicatif et le numéro de téléphone.',
    invalidArea: 'L’indicatif régional ne correspond pas au pays sélectionné.'
  } : {
    phone: 'Phone number',
    country: 'Country / calling code',
    contact: 'Best way to contact you',
    email: 'Email',
    whatsapp: 'WhatsApp',
    telephone: 'Phone call',
    phoneHint: 'Enter the local number only. The selected calling code will be added automatically.',
    phoneRequired: 'A valid phone number is required for WhatsApp or a phone call.',
    invalidPhone: 'Check the country, calling code, and phone number.',
    invalidArea: 'The area code does not match the selected country.'
  };

  const countries = [
    ['US', '+1', 'United States'],
    ['CA', '+1', 'Canada'],
    ['HT', '+509', 'Haiti'],
    ['DO', '+1', 'Dominican Republic'],
    ['PR', '+1', 'Puerto Rico'],
    ['BS', '+1', 'Bahamas'],
    ['BB', '+1', 'Barbados'],
    ['JM', '+1', 'Jamaica'],
    ['TT', '+1', 'Trinidad and Tobago'],
    ['LC', '+1', 'Saint Lucia'],
    ['GD', '+1', 'Grenada'],
    ['DM', '+1', 'Dominica'],
    ['AG', '+1', 'Antigua and Barbuda'],
    ['KN', '+1', 'Saint Kitts and Nevis'],
    ['VC', '+1', 'Saint Vincent and the Grenadines'],
    ['KY', '+1', 'Cayman Islands'],
    ['TC', '+1', 'Turks and Caicos Islands'],
    ['VG', '+1', 'British Virgin Islands'],
    ['VI', '+1', 'U.S. Virgin Islands'],
    ['GP', '+590', 'Guadeloupe'],
    ['MQ', '+596', 'Martinique'],
    ['GF', '+594', 'French Guiana'],
    ['FR', '+33', 'France'],
    ['GB', '+44', 'United Kingdom'],
    ['OTHER', '', lang === 'fr' ? 'Autre pays' : 'Other country']
  ];

  const originalPhoneLabel = phoneInput.closest('label');
  const countryLabel = document.createElement('label');
  countryLabel.className = 'field';
  countryLabel.innerHTML = `<span>${copy.country}</span><select id="phone-country" required></select>`;
  const countrySelect = countryLabel.querySelector('select');
  countries.forEach(([iso, code, name]) => {
    const option = document.createElement('option');
    option.value = iso;
    option.dataset.callingCode = code;
    option.textContent = code ? `${name} (${code})` : name;
    countrySelect.appendChild(option);
  });
  countrySelect.value = 'US';

  const contactLabel = document.createElement('label');
  contactLabel.className = 'field';
  contactLabel.innerHTML = `<span>${copy.contact}</span><select id="preferred-contact-method" required><option value="email">${copy.email}</option><option value="whatsapp">${copy.whatsapp}</option><option value="telephone">${copy.telephone}</option></select>`;
  const contactSelect = contactLabel.querySelector('select');

  originalPhoneLabel.parentElement.insertBefore(countryLabel, originalPhoneLabel);
  originalPhoneLabel.querySelector('span').textContent = copy.phone;
  phoneInput.placeholder = lang === 'fr' ? 'Ex. 6892290770' : 'Example: 6892290770';
  phoneInput.inputMode = 'tel';
  phoneInput.pattern = '[0-9 ()+.-]{6,20}';
  originalPhoneLabel.insertAdjacentHTML('beforeend', `<small style="display:block;margin-top:7px;color:#667b87">${copy.phoneHint}</small>`);
  originalPhoneLabel.insertAdjacentElement('afterend', contactLabel);

  function currentCallingCode() {
    return countrySelect.selectedOptions[0]?.dataset.callingCode || '';
  }

  function updatePhoneRequirement() {
    const needsPhone = contactSelect.value !== 'email';
    phoneInput.required = needsPhone;
    originalPhoneLabel.querySelector('span').textContent = `${copy.phone}${needsPhone ? ' *' : ''}`;
  }
  contactSelect.addEventListener('change', updatePhoneRequirement);
  updatePhoneRequirement();

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url === '/api/bookings' && String(init.method || 'GET').toUpperCase() === 'POST') {
      let payload;
      try {
        payload = JSON.parse(init.body || '{}');
      } catch {
        return originalFetch(input, init);
      }

      if (contactSelect.value !== 'email' && !phoneInput.value.trim()) {
        phoneInput.setCustomValidity(copy.phoneRequired);
        phoneInput.reportValidity();
        throw new Error(copy.phoneRequired);
      }
      phoneInput.setCustomValidity('');

      payload.phone = phoneInput.value.trim();
      payload.phone_country_iso = countrySelect.value;
      payload.phone_country_code = currentCallingCode();
      payload.preferred_contact_method = contactSelect.value;
      init = { ...init, body: JSON.stringify(payload) };
    }
    return originalFetch(input, init);
  };

  window.addEventListener('unhandledrejection', event => {
    const message = String(event.reason?.message || '');
    if (message === copy.phoneRequired) event.preventDefault();
  });

  const status = form.querySelector('[data-booking-status]');
  const observer = new MutationObserver(() => {
    const text = status?.textContent || '';
    if (text.includes('INVALID_PHONE') || text.includes('INVALID_COUNTRY_CODE')) {
      status.textContent = copy.invalidPhone;
    } else if (text.includes('INVALID_AREA_CODE')) {
      status.textContent = copy.invalidArea;
    } else if (text.includes('PHONE_REQUIRED')) {
      status.textContent = copy.phoneRequired;
    }
  });
  if (status) observer.observe(status, { childList: true, subtree: true, characterData: true });
})();
