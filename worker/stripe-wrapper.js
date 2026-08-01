import app from './contact-wrapper-v2.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const CHECKOUT_TTL_SECONDS = 30 * 60;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const PRICE_IDS = {
  'personal:session': 'price_1TzQe8RrFP56VRtGYwZczDN9',
  'parenting:single_module': 'price_1TzUweRrFP56VRtGDbh9CVpo',
  'parenting:full_program': 'price_1TzUz2RrFP56VRtGp5Cq8yxp',
  'business:single_module': 'price_1TzUzqRrFP56VRtG3UDeUJ8w',
  'business:full_program': 'price_1TzV0yRrFP56VRtG3mLBs0e0',
  'wellness:single_module': 'price_1TzV21RrFP56VRtGxz6WJSjk',
  'wellness:full_program': 'price_1TzV2qRrFP56VRtGthzRTBDb'
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function safeString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseStripeSignature(header) {
  const values = { timestamp: null, signatures: [] };
  for (const item of safeString(header, 2000).split(',')) {
    const [key, value] = item.trim().split('=', 2);
    if (key === 't') values.timestamp = Number(value);
    if (key === 'v1' && value) values.signatures.push(value);
  }
  return values;
}

async function verifyWebhookSignature(payload, signatureHeader, secret) {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0 || !secret) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsed.timestamp}.${payload}`)
  );
  const expected = toHex(digest);
  return parsed.signatures.some(signature => constantTimeEqual(expected, signature));
}

async function createCheckoutSession(env, booking, origin) {
  const priceId = PRICE_IDS[`${booking.program_code}:${booking.booking_type}`];
  if (!priceId) throw new Error('PRICE_NOT_CONFIGURED');
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_NOT_CONFIGURED');

  const isEnglish = booking.preferred_language === 'en';
  const successPath = isEnglish ? '/en/booking-success.html' : '/booking-success.html';
  const cancelPath = isEnglish ? '/en/booking.html' : '/booking.html';

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('client_reference_id', booking.id);
  params.set('customer_email', booking.email);
  params.set('locale', isEnglish ? 'en' : 'fr');
  params.set('success_url', `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}${cancelPath}?payment=cancelled&booking_id=${encodeURIComponent(booking.id)}`);
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS));
  params.set('metadata[booking_id]', booking.id);
  params.set('metadata[program_code]', booking.program_code);
  params.set('metadata[booking_type]', booking.booking_type);
  params.set('payment_intent_data[metadata][booking_id]', booking.id);

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const result = await response.json();
  if (!response.ok || !result.id || !result.url) {
    console.error('Stripe Checkout Session error', result?.error || result);
    throw new Error(result?.error?.code || 'STRIPE_CHECKOUT_FAILED');
  }
  return result;
}

async function attachCheckoutToBooking(request, env, ctx) {
  const response = await app.fetch(request, env, ctx);
  if (!response.ok) return response;

  let bookingResult;
  try {
    bookingResult = await response.clone().json();
  } catch {
    return response;
  }
  if (!bookingResult.booking_id) return response;

  const booking = await env.DB.prepare(`
    SELECT b.id, b.program_code, b.booking_type, b.amount_cents,
           b.status, b.payment_status, c.email, c.preferred_language
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.id = ?
  `).bind(bookingResult.booking_id).first();

  if (!booking) {
    return json({ ok: false, error: 'BOOKING_NOT_FOUND' }, 500);
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await createCheckoutSession(env, booking, origin);

    await env.DB.prepare(`
      UPDATE bookings
      SET status = 'pending_payment',
          payment_status = 'unpaid',
          stripe_checkout_session_id = ?,
          expires_at = datetime('now', '+30 minutes'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(session.id, booking.id).run();

    return json({
      ...bookingResult,
      status: 'pending_payment',
      payment_status: 'unpaid',
      checkout_session_id: session.id,
      checkout_url: session.url,
      message: booking.preferred_language === 'en'
        ? 'Your booking is reserved temporarily. Complete the secure Stripe payment to confirm it.'
        : 'Votre réservation est retenue temporairement. Effectuez le paiement sécurisé Stripe pour la confirmer.'
    }, 201);
  } catch (error) {
    console.error('Unable to start Stripe Checkout', error);
    await env.DB.prepare(`
      UPDATE bookings
      SET status = 'expired', payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'confirmed'
    `).bind(booking.id).run();
    return json({ ok: false, error: safeString(error?.message, 100) || 'STRIPE_CHECKOUT_FAILED' }, 502);
  }
}

async function ensureStripeEventsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      payload_hash TEXT
    )
  `).run();
}

async function processStripeEvent(event, env) {
  await ensureStripeEventsTable(env.DB);
  const existing = await env.DB.prepare(
    'SELECT event_id FROM stripe_events WHERE event_id = ?'
  ).bind(event.id).first();
  if (existing) return;

  const session = event?.data?.object || {};
  const bookingId = safeString(session?.metadata?.booking_id || session?.client_reference_id, 100);

  if (bookingId) {
    if (
      event.type === 'checkout.session.async_payment_succeeded' ||
      (event.type === 'checkout.session.completed' && ['paid', 'no_payment_required'].includes(session.payment_status))
    ) {
      await env.DB.prepare(`
        UPDATE bookings
        SET status = 'confirmed',
            payment_status = 'paid',
            stripe_checkout_session_id = ?,
            stripe_payment_intent_id = ?,
            expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(session.id || null, session.payment_intent || null, bookingId).run();
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await env.DB.prepare(`
        UPDATE bookings
        SET status = 'cancelled', payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status != 'confirmed'
      `).bind(bookingId).run();
    } else if (event.type === 'checkout.session.expired') {
      await env.DB.prepare(`
        UPDATE bookings
        SET status = 'expired', payment_status = 'unpaid', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status != 'confirmed'
      `).bind(bookingId).run();
    }
  }

  await env.DB.prepare(`
    INSERT INTO stripe_events (event_id, event_type, processed_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(event.id, event.type).run();
}

async function handleWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, 503);
  }

  const payload = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';
  const valid = await verifyWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ ok: false, error: 'INVALID_SIGNATURE' }, 400);

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  await processStripeEvent(event, env);
  return json({ received: true });
}

async function bookingStatus(url, env) {
  const sessionId = safeString(url.searchParams.get('session_id'), 255);
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ ok: false, error: 'INVALID_SESSION_ID' }, 400);
  }

  const booking = await env.DB.prepare(`
    SELECT id, status, payment_status, program_code, booking_type
    FROM bookings
    WHERE stripe_checkout_session_id = ?
  `).bind(sessionId).first();

  if (!booking) return json({ ok: false, error: 'BOOKING_NOT_FOUND' }, 404);
  return json({ ok: true, booking });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      try {
        return await handleWebhook(request, env);
      } catch (error) {
        console.error('Stripe webhook error', error);
        return json({ ok: false, error: 'WEBHOOK_ERROR' }, 500);
      }
    }

    if (url.pathname === '/api/booking-status' && request.method === 'GET') {
      try {
        return await bookingStatus(url, env);
      } catch (error) {
        console.error('Booking status error', error);
        return json({ ok: false, error: 'SERVER_ERROR' }, 500);
      }
    }

    if (url.pathname === '/api/bookings' && request.method === 'POST') {
      return attachCheckoutToBooking(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};
