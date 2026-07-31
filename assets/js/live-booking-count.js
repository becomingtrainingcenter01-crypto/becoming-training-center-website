(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const announcement = document.querySelector('.announcement__inner');
  if (!announcement || announcement.querySelector('[data-live-booking-count]')) return;

  const badge = document.createElement('span');
  badge.className = 'live-booking-count';
  badge.dataset.liveBookingCount = '';
  badge.setAttribute('aria-live', 'polite');
  badge.innerHTML = `<span class="live-booking-count__dot" aria-hidden="true"></span><strong>—</strong><span>${lang === 'fr' ? 'réservations enregistrées' : 'bookings recorded'}</span>`;
  announcement.insertBefore(badge, announcement.lastElementChild);

  const style = document.createElement('style');
  style.textContent = `
    .live-booking-count{display:inline-flex;align-items:center;gap:7px;margin-left:auto;padding:6px 11px;border:1px solid rgba(255,255,255,.2);border-radius:999px;color:#fff;font-size:.76rem;white-space:nowrap}
    .live-booking-count strong{font-size:.86rem;color:#9de880}
    .live-booking-count__dot{width:7px;height:7px;border-radius:50%;background:#67be45;box-shadow:0 0 0 4px rgba(103,190,69,.16)}
    @media(max-width:760px){.live-booking-count{order:3;width:100%;justify-content:center;margin:5px 0 0}.announcement__inner{flex-wrap:wrap}}
  `;
  document.head.appendChild(style);

  async function refresh() {
    try {
      const response = await fetch('/api/booking-counts', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Count unavailable');
      const data = await response.json();
      const count = Number(data.total || 0);
      badge.querySelector('strong').textContent = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(count);
      badge.title = lang === 'fr'
        ? `${count} demande(s) de réservation active(s)`
        : `${count} active booking request(s)`;
    } catch {
      badge.hidden = true;
    }
  }

  refresh();
  window.addEventListener('booking-created', refresh);
  setInterval(refresh, 60000);
})();
