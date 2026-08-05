(() => {
  const page = document.body.dataset.accountPage;
  if (!page) return;

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const copy = lang === 'fr' ? {
    required: 'Veuillez remplir tous les champs.',
    password: 'Le mot de passe doit contenir au moins 10 caractères, avec une lettre et un chiffre.',
    mismatch: 'Les mots de passe ne correspondent pas.',
    exists: 'Un compte existe déjà avec cette adresse courriel. Connectez-vous.',
    invalid: 'Adresse courriel ou mot de passe incorrect.',
    attempts: 'Trop de tentatives. Réessayez dans environ 15 minutes.',
    generic: 'Une erreur est survenue. Veuillez réessayer.',
    creating: 'Création du compte…',
    signingIn: 'Connexion…',
    checkout: 'Ouverture du paiement sécurisé…',
    portal: 'Ouverture du portail de facturation…',
    logout: 'Déconnexion…',
    noMembership: 'Vous n’avez pas encore d’abonnement VIP actif.',
    active: 'Actif',
    trialing: 'Période d’essai',
    past_due: 'Paiement en retard',
    canceled: 'Annulé',
    incomplete: 'Paiement incomplet',
    unpaid: 'Impayé',
    cancelScheduled: 'Votre abonnement sera annulé à la fin de la période payée.',
    renews: 'Prochaine échéance',
    access: 'Accès membre actif',
    noAccess: 'Accès membre inactif',
    loading: 'Chargement de votre compte…'
  } : {
    required: 'Please complete all fields.',
    password: 'Your password must contain at least 10 characters, including a letter and a number.',
    mismatch: 'The passwords do not match.',
    exists: 'An account already exists with this email. Please sign in.',
    invalid: 'Incorrect email address or password.',
    attempts: 'Too many attempts. Please try again in about 15 minutes.',
    generic: 'Something went wrong. Please try again.',
    creating: 'Creating account…',
    signingIn: 'Signing in…',
    checkout: 'Opening secure checkout…',
    portal: 'Opening billing portal…',
    logout: 'Signing out…',
    noMembership: 'You do not have an active VIP membership yet.',
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Payment past due',
    canceled: 'Canceled',
    incomplete: 'Payment incomplete',
    unpaid: 'Unpaid',
    cancelScheduled: 'Your membership will end at the end of the paid billing period.',
    renews: 'Next billing date',
    access: 'Member access active',
    noAccess: 'Member access inactive',
    loading: 'Loading your account…'
  };

  const status = document.querySelector('[data-account-status]');
  const setStatus = (message, error = false) => {
    if (!status) return;
    status.textContent = message;
    status.className = `account-status ${error ? 'is-error' : 'is-success'}`;
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || 'REQUEST_FAILED');
      error.code = data.error;
      error.data = data;
      throw error;
    }
    return data;
  }

  function errorMessage(error) {
    if (error.code === 'ACCOUNT_EXISTS') return copy.exists;
    if (error.code === 'INVALID_CREDENTIALS') return copy.invalid;
    if (error.code === 'TOO_MANY_ATTEMPTS') return copy.attempts;
    if (['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'PASSWORD_TOO_WEAK'].includes(error.code)) return copy.password;
    return copy.generic;
  }

  if (page === 'auth') {
    const tabs = document.querySelectorAll('[data-auth-tab]');
    const panels = document.querySelectorAll('[data-auth-panel]');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      const target = tab.dataset.authTab;
      tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
      panels.forEach(panel => { panel.hidden = panel.dataset.authPanel !== target; });
      setStatus('');
    }));

    document.querySelector('[data-register-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const fullName = form.querySelector('[name="full_name"]').value.trim();
      const email = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;
      const confirm = form.querySelector('[name="confirm_password"]').value;
      if (!fullName || !email || !password || !confirm) return setStatus(copy.required, true);
      if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setStatus(copy.password, true);
      if (password !== confirm) return setStatus(copy.mismatch, true);
      button.disabled = true;
      setStatus(copy.creating);
      try {
        await api('/api/account/register', {
          method: 'POST',
          body: JSON.stringify({ full_name: fullName, email, password, language: lang })
        });
        location.assign(lang === 'en' ? '/en/member.html' : '/member.html');
      } catch (error) {
        setStatus(errorMessage(error), true);
        button.disabled = false;
      }
    });

    document.querySelector('[data-login-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const email = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;
      if (!email || !password) return setStatus(copy.required, true);
      button.disabled = true;
      setStatus(copy.signingIn);
      try {
        await api('/api/account/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        location.assign(lang === 'en' ? '/en/member.html' : '/member.html');
      } catch (error) {
        setStatus(errorMessage(error), true);
        button.disabled = false;
      }
    });
    return;
  }

  if (page === 'member') {
    const name = document.querySelector('[data-member-name]');
    const email = document.querySelector('[data-member-email]');
    const membershipBox = document.querySelector('[data-membership-box]');
    const joinButtons = document.querySelectorAll('[data-member-checkout]');
    const portalButtons = document.querySelectorAll('[data-member-portal]');

    function formatDate(seconds) {
      return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-US', {
        dateStyle: 'long'
      }).format(new Date(seconds * 1000));
    }

    function renderMembership(membership) {
      if (!membership) {
        membershipBox.innerHTML = `<h2>${copy.noMembership}</h2><p>${lang === 'fr' ? 'Créez votre abonnement mensuel pour activer les avantages du club.' : 'Start your monthly membership to activate your club benefits.'}</p>`;
        joinButtons.forEach(button => button.hidden = false);
        portalButtons.forEach(button => button.hidden = true);
        return;
      }
      const label = copy[membership.status] || membership.status;
      const dateLine = membership.current_period_end
        ? `<p><strong>${copy.renews}:</strong> ${formatDate(membership.current_period_end)}</p>`
        : '';
      const cancelLine = membership.cancel_at_period_end ? `<p class="membership-alert">${copy.cancelScheduled}</p>` : '';
      membershipBox.innerHTML = `<span class="membership-badge">${label}</span><h2>${membership.has_access ? copy.access : copy.noAccess}</h2>${dateLine}${cancelLine}`;
      joinButtons.forEach(button => button.hidden = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(membership.status));
      portalButtons.forEach(button => button.hidden = false);
    }

    async function loadAccount(attempt = 0) {
      setStatus(copy.loading);
      try {
        const data = await api('/api/account/me');
        name.textContent = data.account.full_name;
        email.textContent = data.account.email;
        renderMembership(data.membership);
        setStatus('');
        const params = new URLSearchParams(location.search);
        if (params.get('subscription') === 'success' && !data.membership && attempt < 5) {
          setTimeout(() => loadAccount(attempt + 1), 2000);
        }
      } catch (error) {
        if (error.code === 'AUTHENTICATION_REQUIRED') {
          location.replace(lang === 'en' ? '/en/account.html' : '/account.html');
          return;
        }
        setStatus(copy.generic, true);
      }
    }

    joinButtons.forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      setStatus(copy.checkout);
      try {
        const data = await api('/api/vip-checkout', {
          method: 'POST',
          body: JSON.stringify({ language: lang })
        });
        location.assign(data.checkout_url);
      } catch (error) {
        setStatus(error.code === 'MEMBERSHIP_ALREADY_EXISTS' ? (lang === 'fr' ? 'Un abonnement existe déjà. Utilisez le portail de facturation.' : 'A membership already exists. Use the billing portal.') : copy.generic, true);
        button.disabled = false;
      }
    }));

    portalButtons.forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      setStatus(copy.portal);
      try {
        const data = await api('/api/vip-portal-session', { method: 'POST', body: JSON.stringify({}) });
        location.assign(data.portal_url);
      } catch (error) {
        setStatus(error.code === 'MEMBERSHIP_NOT_FOUND' ? copy.noMembership : copy.generic, true);
        button.disabled = false;
      }
    }));

    document.querySelector('[data-account-logout]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      setStatus(copy.logout);
      try {
        await api('/api/account/logout', { method: 'POST', body: JSON.stringify({}) });
      } finally {
        location.replace(lang === 'en' ? '/en/vip.html' : '/vip.html');
      }
    });

    loadAccount();
  }
})();