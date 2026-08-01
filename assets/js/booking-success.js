(() => {
  const root = document.querySelector('[data-booking-success]');
  if (!root) return;

  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') || '';
  const status = root.querySelector('[data-payment-status]');
  const detail = root.querySelector('[data-payment-detail]');
  const homeLink = root.querySelector('[data-home-link]');
  const bookingLink = root.querySelector('[data-booking-link]');

  const copy = lang === 'fr' ? {
    checking: 'Vérification du paiement…',
    checkingDetail: 'Stripe nous transmet la confirmation sécurisée. Cette étape peut prendre quelques secondes.',
    confirmed: 'Paiement confirmé',
    confirmedDetail: 'Votre réservation est confirmée. Becoming Training Center communiquera avec vous selon le mode de contact choisi.',
    pending: 'Paiement en cours de confirmation',
    pendingDetail: 'Le paiement a été reçu, mais la confirmation finale est toujours en traitement. Vous pouvez laisser cette page ouverte.',
    failed: 'Impossible de vérifier la réservation',
    failedDetail: 'Nous n’avons pas pu retrouver cette réservation. Veuillez communiquer avec Becoming Training Center.',
    home: 'Retour à l’accueil',
    booking: 'Faire une autre réservation'
  } : {
    checking: 'Checking your payment…',
    checkingDetail: 'Stripe is securely sending the confirmation. This can take a few seconds.',
    confirmed: 'Payment confirmed',
    confirmedDetail: 'Your booking is confirmed. Becoming Training Center will contact you using your selected contact method.',
    pending: 'Payment confirmation in progress',
    pendingDetail: 'The payment was received, but final confirmation is still processing. You may leave this page open.',
    failed: 'Unable to verify the booking',
    failedDetail: 'We could not find this booking. Please contact Becoming Training Center.',
    home: 'Return home',
    booking: 'Make another booking'
  };

  homeLink.textContent = copy.home;
  bookingLink.textContent = copy.booking;

  function render(title, message, state) {
    status.textContent = title;
    detail.textContent = message;
    root.dataset.state = state;
  }

  if (!sessionId.startsWith('cs_')) {
    render(copy.failed, copy.failedDetail, 'error');
    return;
  }

  render(copy.checking, copy.checkingDetail, 'loading');

  let attempts = 0;
  const maxAttempts = 15;

  async function check() {
    attempts += 1;
    try {
      const response = await fetch(`/api/booking-status?session_id=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok || !data.booking) throw new Error(data.error || 'STATUS_ERROR');

      if (data.booking.status === 'confirmed' && data.booking.payment_status === 'paid') {
        render(copy.confirmed, copy.confirmedDetail, 'success');
        return;
      }

      render(copy.pending, copy.pendingDetail, 'pending');
      if (attempts < maxAttempts) window.setTimeout(check, 2000);
    } catch {
      if (attempts < 3) {
        window.setTimeout(check, 1500);
      } else {
        render(copy.failed, copy.failedDetail, 'error');
      }
    }
  }

  check();
})();
