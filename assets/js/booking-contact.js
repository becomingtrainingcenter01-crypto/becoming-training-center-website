(() => {
  const form = document.querySelector('[data-real-booking-form]');
  if (!form || form.dataset.contactFieldsReady === 'true') return;
  form.dataset.contactFieldsReady = 'true';

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const phone = form.querySelector('#phone');
  const status = form.querySelector('[data-booking-status]');
  if (!phone) return;

  const countries = [
    ['', lang === 'fr' ? 'Sélectionnez le pays' : 'Select country'],
    ['US|+1', lang === 'fr' ? 'États-Unis (+1)' : 'United States (+1)'],
    ['CA|+1', `Canada (+1)`],
    ['HT|+509', `Haïti (+509)`],
    ['DO|+1', lang === 'fr' ? 'République dominicaine (+1)' : 'Dominican Republic (+1)'],
    ['PR|+1', `Puerto Rico (+1)`],
    ['JM|+1', lang === 'fr' ? 'Jamaïque (+1)' : 'Jamaica (+1)'],
    ['BS|+1', lang === 'fr' ? 'Bahamas (+1)' : 'Bahamas (+1)'],
    ['BB|+1', lang === 'fr' ? 'Barbade (+1)' : 'Barbados (+1)'],
    ['TT|+1', `Trinidad & Tobago (+1)`],
    ['LC|+1', `Sainte-Lucie / Saint Lucia (+1)`],
    ['GD|+1', `Grenade / Grenada (+1)`],
    ['DM|+1', `Dominique / Dominica (+1)`],
    ['AG|+1', `Antigua-et-Barbuda / Antigua & Barbuda (+1)`],
    ['KN|+1', `Saint-Kitts-et-Nevis / Saint Kitts & Nevis (+1)`],
    ['VC|+1', `Saint-Vincent-et-les-Grenadines (+1)`],
    ['KY|+1', `Îles Caïmans / Cayman Islands (+1)`],
    ['TC|+1', `Turks and Caicos (+1)`],
    ['VG|+1', `Îles Vierges britanniques (+1)`],
    ['VI|+1', `Îles Vierges américaines (+1)`],
    ['FR|+33', `France (+33)`],
    ['GP|+590', `Guadeloupe (+590)`],
    ['MQ|+596', `Martinique (+596)`],
    ['GF|+594', lang === 'fr' ? 'Guyane française (+594)' : 'French Guiana (+594)'],
    ['GB|+44', lang === 'fr' ? 'Royaume-Uni (+44)' : 'United Kingdom (+44)'],
    ['OTHER|', lang === 'fr' ? 'Autre pays' : 'Other country']
  ];

  const phoneLabel = phone.closest('.field');
  const countryLabel = document.createElement('label');
  countryLabel.className = 'field';
  countryLabel.innerHTML = `<span>${lang === 'fr' ? 'Pays et indicatif téléphonique' : 'Country and calling code'}</span><select id="phone-country">${countries.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>`;

  const contactLabel = document.createElement('label');
  contactLabel.className = 'field';
  contactLabel.innerHTML = `<span>${lang === 'fr' ? 'Meilleure façon de vous contacter' : 'Best way to contact you'}</span><select id="preferred-contact-method" required><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="telephone">${lang === 'fr' ? 'Appel téléphonique' : 'Phone call'}</option></select>`;

  phoneLabel.insertAdjacentElement('beforebegin', countryLabel);
  phoneLabel.insertAdjacentElement('afterend', contactLabel);
  const phoneTitle = phoneLabel.querySelector('span');
  if (phoneTitle) phoneTitle.textContent = lang === 'fr' ? 'Numéro de téléphone' : 'Phone number';
  phone.placeholder = lang === 'fr' ? 'Ex. 407 555 0123' : 'Example: 407 555 0123';
  phone.inputMode = 'tel';

  const help = document.createElement('small');
  help.style.display = 'block';
  help.style.marginTop = '7px';
  help.style.color = '#607887';
  help.textContent = lang === 'fr'
    ? 'Choisissez d’abord le pays. L’indicatif sera ajouté automatiquement.'
    : 'Choose the country first. The calling code will be added automatically.';
  phoneLabel.appendChild(help);

  const country = countryLabel.querySelector('#phone-country');
  const contact = contactLabel.querySelector('#preferred-contact-method');

  function updateRequiredState() {
    const phoneRequired = contact.value !== 'email';
    phone.required = phoneRequired;
    country.required = phoneRequired || Boolean(phone.value.trim());
  }

  contact.addEventListener('change', updateRequiredState);
  phone.addEventListener('input', updateRequiredState);
  country.addEventListener('change', updateRequiredState);
  updateRequiredState();

  form.addEventListener('submit', event => {
    updateRequiredState();
    const needsPhone = contact.value !== 'email';
    if ((needsPhone && (!phone.value.trim() || !country.value)) || (phone.value.trim() && !country.value)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (status) {
        status.textContent = lang === 'fr'
          ? 'Choisissez le pays et entrez un numéro valide pour WhatsApp ou les appels.'
          : 'Select the country and enter a valid number for WhatsApp or phone calls.';
        status.className = 'form-status is-error';
      }
    }
  }, true);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const target = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET').toUpperCase();

    if (method === 'POST' && target.includes('/api/bookings') && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        const [countryIso = '', callingCode = ''] = country.value.split('|');
        payload.phone_country_iso = countryIso;
        payload.phone_country_code = callingCode;
        payload.preferred_contact_method = contact.value;
        init = { ...init, body: JSON.stringify(payload) };
      } catch {
        // The booking API will return its normal validation error.
      }
    }

    return nativeFetch(input, init);
  };
})();
