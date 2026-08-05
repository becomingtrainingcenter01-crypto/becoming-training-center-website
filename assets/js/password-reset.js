(() => {
  const page = document.body.dataset.passwordPage;
  if (!page) return;

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const status = document.querySelector('[data-password-status]');
  const setStatus = (message, error = false) => {
    if (!status) return;
    status.textContent = message;
    status.className = `account-status ${error ? 'is-error' : 'is-success'}`;
  };

  async function api(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'REQUEST_FAILED');
      error.code = data.error;
      throw error;
    }
    return data;
  }

  if (page === 'forgot') {
    document.querySelector('[data-forgot-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const email = form.querySelector('[name="email"]').value.trim();
      if (!email) {
        setStatus(lang === 'en' ? 'Enter your email address.' : 'Entrez votre adresse courriel.', true);
        return;
      }
      button.disabled = true;
      setStatus(lang === 'en' ? 'Sending secure reset link…' : 'Envoi du lien sécurisé…');
      try {
        const data = await api('/api/account/forgot-password', { email, language: lang });
        setStatus(data.message || (lang === 'en'
          ? 'If an account exists, a reset link has been sent.'
          : 'Si un compte existe, un lien de réinitialisation a été envoyé.'));
        form.reset();
      } catch {
        setStatus(lang === 'en'
          ? 'Unable to send the reset link right now. Please try again.'
          : 'Impossible d’envoyer le lien maintenant. Veuillez réessayer.', true);
      } finally {
        button.disabled = false;
      }
    });
    return;
  }

  if (page === 'reset') {
    const params = new URLSearchParams(location.search);
    const token = params.get('token') || '';
    const email = params.get('email') || '';
    const form = document.querySelector('[data-reset-form]');

    if (!token || !email) {
      form.hidden = true;
      setStatus(lang === 'en'
        ? 'This password reset link is invalid or incomplete.'
        : 'Ce lien de réinitialisation est invalide ou incomplet.', true);
      return;
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const password = form.querySelector('[name="password"]').value;
      const confirm = form.querySelector('[name="confirm_password"]').value;
      if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setStatus(lang === 'en'
          ? 'Use at least 10 characters, including a letter and a number.'
          : 'Utilisez au moins 10 caractères, dont une lettre et un chiffre.', true);
        return;
      }
      if (password !== confirm) {
        setStatus(lang === 'en' ? 'The passwords do not match.' : 'Les mots de passe ne correspondent pas.', true);
        return;
      }

      button.disabled = true;
      setStatus(lang === 'en' ? 'Updating your password…' : 'Modification du mot de passe…');
      try {
        const data = await api('/api/account/reset-password', {
          token,
          email,
          password,
          language: lang
        });
        setStatus(data.message || (lang === 'en'
          ? 'Password changed. You can now sign in.'
          : 'Mot de passe modifié. Vous pouvez maintenant vous connecter.'));
        form.reset();
        setTimeout(() => {
          location.replace(lang === 'en' ? '/en/account.html' : '/account.html');
        }, 1800);
      } catch (error) {
        const expired = error.code === 'INVALID_OR_EXPIRED_TOKEN';
        setStatus(expired
          ? (lang === 'en' ? 'This reset link is invalid or has expired.' : 'Ce lien est invalide ou a expiré.')
          : (lang === 'en' ? 'Unable to change the password. Please try again.' : 'Impossible de modifier le mot de passe. Veuillez réessayer.'), true);
        button.disabled = false;
      }
    });
  }
})();