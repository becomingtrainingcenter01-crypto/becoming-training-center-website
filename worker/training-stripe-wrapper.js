import app from './training-wrapper.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const CHECKOUT_TTL_SECONDS = 30 * 60;

const TRAINING_PRICE_IDS = {
  cna: 'price_1U16sZRrFP56VRtGXdAmEnHN',
  hha: 'price_1U16suRrFP56VRtGb56e0IVv',
  'med-tech': 'price_1U16tGRrFP56VRtGQQVfg8iH',
  english: 'price_1U16tbRrFP56VRtGBJWWvSzO',
  spanish: 'price_1U16tuRrFP56VRtGnoydpgxB'
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function createTrainingCheckoutSession(env, booking, origin) {
  const priceId = TRAINING_PRICE_IDS[booking.program_code];
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
  params.set('metadata[booking_type]', 'full_program');
  params.set('metadata[program_category]', 'training');
  params.set('payment_intent_data[metadata][booking_id]', booking.id);
  params.set('payment_intent_data[metadata][program_code]', booking.program_code);

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
    console.error('Training Stripe Checkout Session error', result?.error || result);
    throw new Error(result?.error?.code || 'STRIPE_CHECKOUT_FAILED');
  }
  return result;
}

async function attachTrainingCheckout(request, env, ctx) {
  let preview;
  try {
    preview = await request.clone().json();
  } catch {
    return app.fetch(request, env, ctx);
  }

  const programCode = clean(preview.program_code, 30);
  if (!Object.hasOwn(TRAINING_PRICE_IDS, programCode)) {
    return app.fetch(request, env, ctx);
  }

  const response = await app.fetch(request, env, ctx);
  if (!response.ok) return response;

  let enrollment;
  try {
    enrollment = await response.clone().json();
  } catch {
    return response;
  }
  if (!enrollment.booking_id) return response;

  const booking = await env.DB.prepare(`
    SELECT b.id, b.program_code, b.booking_type, b.amount_cents,
           b.status, b.payment_status, c.email, c.preferred_language
    FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.id = ?
  `).bind(enrollment.booking_id).first();

  if (!booking) {
    return json({ ok: false, error: 'BOOKING_NOT_FOUND' }, 500);
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await createTrainingCheckoutSession(env, booking, origin);

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
      ...enrollment,
      status: 'pending_payment',
      payment_status: 'unpaid',
      checkout_session_id: session.id,
      checkout_url: session.url,
      message: booking.preferred_language === 'en'
        ? 'Your enrollment is reserved temporarily. Complete the secure Stripe payment to confirm it.'
        : 'Votre inscription est retenue temporairement. Effectuez le paiement sécurisé Stripe pour la confirmer.'
    }, 201);
  } catch (error) {
    console.error('Unable to start training Stripe Checkout', error);
    await env.DB.prepare(`
      UPDATE bookings
      SET status = 'expired', payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'confirmed'
    `).bind(booking.id).run();
    return json({
      ok: false,
      error: clean(error?.message, 100) || 'STRIPE_CHECKOUT_FAILED'
    }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/bookings' && request.method === 'POST') {
      return attachTrainingCheckout(request, env, ctx);
    }

    return app.fetch(request, env, ctx);
  }
};