import app from './auth-hardening-wrapper.js';

const RESEND_API = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Becoming Training Center <noreply@send.becomingedu.com>';
const ADMIN_RECIPIENTS = [
  'support@becomingedu.com',
  'becomingtrainingcenter01@gmail.com',
  'stephmvital@gmail.com'
];

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function bookingTypeLabel(value) {
  return {
    session: 'Session',
    single_module: 'Single module',
    full_program: 'Full program'
  }[value] || value || 'Booking';
}

function meetingMethodLabel(value, other) {
  if (value === 'zoom') return 'Zoom';
  if (value === 'telephone') return 'Telephone';
  if (value === 'other') return other || 'Other';
  return value || 'Not specified';
}

async function sendAdminEmail(env, payload) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY_NOT_CONFIGURED');

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'BecomingTrainingCenter/1.0'
    },
    body: JSON.stringify({
      from: clean(env.RESEND_FROM_EMAIL, 250) || DEFAULT_FROM,
      to: ADMIN_RECIPIENTS,
      ...payload
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Resend booking notification error', result);
    throw new Error(result?.message || 'EMAIL_SEND_FAILED');
  }
  return result;
}

async function ensureNotificationTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS booking_admin_notifications (
      notification_key TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      booking_id TEXT,
      notification_type TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function getBookingById(db, bookingId) {
  return db.prepare(`
    SELECT
      b.id,
      b.program_code,
      b.booking_type,
      b.preferred_date,
      b.preferred_time,
      b.meeting_method,
      b.other_meeting_method,
      b.amount_cents,
      b.status,
      b.payment_status,
      b.stripe_checkout_session_id,
      b.stripe_payment_intent_id,
      c.full_name,
      c.email,
      c.phone,
      c.preferred_language,
      p.title_en AS program_title_en,
      p.title_fr AS program_title_fr,
      m.title_en AS module_title_en,
      m.title_fr AS module_title_fr
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    LEFT JOIN programs p ON p.code = b.program_code
    LEFT JOIN modules m ON m.id = b.module_id
    WHERE b.id = ?
    LIMIT 1
  `).bind(bookingId).first();
}

async function notificationAlreadySent(db, key) {
  const row = await db.prepare(
    'SELECT notification_key FROM booking_admin_notifications WHERE notification_key = ?'
  ).bind(key).first();
  return Boolean(row?.notification_key);
}

async function recordNotification(db, key, eventId, bookingId, type) {
  await db.prepare(`
    INSERT OR IGNORE INTO booking_admin_notifications (
      notification_key, event_id, booking_id, notification_type, sent_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(key, eventId, bookingId || null, type).run();
}

function paidEmail(booking) {
  const program = booking.program_title_en || booking.program_code || 'Booking';
  const moduleTitle = booking.module_title_en || '';
  const phone = booking.phone || 'Not provided';
  const meetingMethod = meetingMethodLabel(booking.meeting_method, booking.other_meeting_method);
  const amount = formatMoney(booking.amount_cents);
  const date = booking.preferred_date || 'Not specified';
  const time = booking.preferred_time ? `${booking.preferred_time} ET` : 'Not specified';

  const rows = [
    ['Customer', booking.full_name],
    ['Email', booking.email],
    ['Phone', phone],
    ['Program', program],
    ['Booking type', bookingTypeLabel(booking.booking_type)],
    ['Module', moduleTitle || '—'],
    ['Date', date],
    ['Time', time],
    ['Meeting method', meetingMethod],
    ['Amount paid', amount],
    ['Booking ID', booking.id]
  ];

  const text = [
    'A customer has completed payment and the booking is confirmed.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value || '—'}`),
    '',
    'You can now contact this customer.'
  ].join('\n');

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-weight:700;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(value || '—')}</td>
    </tr>`).join('');

  return {
    subject: `PAID BOOKING — ${booking.full_name} — ${program}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0b2233">
      <h1 style="color:#073e68">New paid booking</h1>
      <p>Stripe confirmed the payment. This booking is ready for follow-up.</p>
      <table style="width:100%;border-collapse:collapse">${htmlRows}</table>
      <p style="margin-top:24px;font-weight:700">You can now contact this customer.</p>
      <p>Becoming Training Center</p>
    </div>`
  };
}

function cancelledEmail(booking) {
  const program = booking.program_title_en || booking.program_code || 'Booking';
  const amount = formatMoney(booking.amount_cents);
  const rows = [
    ['Customer', booking.full_name],
    ['Email', booking.email],
    ['Phone', booking.phone || 'Not provided'],
    ['Program', program],
    ['Booking type', bookingTypeLabel(booking.booking_type)],
    ['Date', booking.preferred_date || 'Not specified'],
    ['Time', booking.preferred_time ? `${booking.preferred_time} ET` : 'Not specified'],
    ['Original amount', amount],
    ['Booking ID', booking.id]
  ];

  const text = [
    'A previously paid booking was fully refunded in Stripe and has been marked cancelled.',
    '',
    ...rows.map(([label, value]) => `${label}: ${value || '—'}`)
  ].join('\n');

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-weight:700;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(value || '—')}</td>
    </tr>`).join('');

  return {
    subject: `BOOKING CANCELLED / REFUNDED — ${booking.full_name} — ${program}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0b2233">
      <h1 style="color:#8a1f11">Booking cancelled / refunded</h1>
      <p>A previously paid booking was fully refunded in Stripe and has been marked cancelled.</p>
      <table style="width:100%;border-collapse:collapse">${htmlRows}</table>
      <p>Becoming Training Center</p>
    </div>`
  };
}

async function notifyPaidBooking(env, event) {
  const session = event?.data?.object || {};
  const bookingId = clean(session?.metadata?.booking_id || session?.client_reference_id, 100);
  if (!bookingId) return;

  await ensureNotificationTable(env.DB);
  const key = `${event.id}:paid`;
  if (await notificationAlreadySent(env.DB, key)) return;

  const booking = await getBookingById(env.DB, bookingId);
  if (!booking || booking.payment_status !== 'paid' || booking.status !== 'confirmed') return;

  await sendAdminEmail(env, paidEmail(booking));
  await recordNotification(env.DB, key, event.id, booking.id, 'paid');
}

async function notifyRefundedBooking(env, event) {
  const charge = event?.data?.object || {};
  if (charge.refunded !== true) return;

  const paymentIntentId = clean(
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
    255
  );
  if (!paymentIntentId) return;

  await ensureNotificationTable(env.DB);
  const key = `${event.id}:refunded`;
  if (await notificationAlreadySent(env.DB, key)) return;

  const row = await env.DB.prepare(`
    SELECT id FROM bookings
    WHERE stripe_payment_intent_id = ?
    LIMIT 1
  `).bind(paymentIntentId).first();
  if (!row?.id) return;

  await env.DB.prepare(`
    UPDATE bookings
    SET status = 'cancelled',
        payment_status = 'refunded',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(row.id).run();

  const booking = await getBookingById(env.DB, row.id);
  if (!booking) return;

  await sendAdminEmail(env, cancelledEmail(booking));
  await recordNotification(env.DB, key, event.id, booking.id, 'refunded');
}

function isPaidCheckoutEvent(event) {
  if (event?.type === 'checkout.session.async_payment_succeeded') return true;
  if (event?.type !== 'checkout.session.completed') return false;
  const status = event?.data?.object?.payment_status;
  return status === 'paid' || status === 'no_payment_required';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      let event = null;
      try {
        event = await request.clone().json();
      } catch {
        // The inner Stripe handler will return the appropriate validation response.
      }

      const response = await app.fetch(request, env, ctx);
      if (!response.ok || !event?.id) return response;

      if (isPaidCheckoutEvent(event)) {
        ctx.waitUntil(notifyPaidBooking(env, event).catch(error => {
          console.error('Unable to send paid booking notification', error);
        }));
      } else if (event.type === 'charge.refunded') {
        ctx.waitUntil(notifyRefundedBooking(env, event).catch(error => {
          console.error('Unable to send refund/cancellation notification', error);
        }));
      }

      return response;
    }

    return app.fetch(request, env, ctx);
  }
};
