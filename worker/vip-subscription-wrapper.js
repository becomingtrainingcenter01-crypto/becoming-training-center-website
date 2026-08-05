import app from './training-stripe-wrapper.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const VIP_PRICE_ID = 'price_1U17lBRrFP56VRtGcGGWUYQI';
const CHECKOUT_TTL_SECONDS = 30 * 60;

let vipSchemaPromise;
let portalUrlCache;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function ensureVipSchema(db) {
  if (!vipSchemaPromise) {
    vipSchemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_memberships (
        stripe_customer_id TEXT PRIMARY KEY,
        stripe_subscription_id TEXT UNIQUE,
        email TEXT COLLATE NOCASE,
        status TEXT NOT NULL DEFAULT 'incomplete',
        current_period_end INTEGER,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        preferred_language TEXT NOT NULL DEFAULT 'fr',
        checkout_session_id TEXT,
        price_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_memberships_email
        ON vip_memberships(email)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_memberships_status
        ON vip_memberships(status)`)
    ]).catch(error => {
      vipSchemaPromise = undefined;
      throw error;
    });
  }
  return vipSchemaPromise;
}

async function stripeRequest(env, path, options = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_NOT_CONFIGURED');
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(options.headers || {})
    }
  });
  const result = await response.json();
  if (!response.ok) {
    console.error('Stripe API error', result?.error || result);
    throw new Error(result?.error?.code || 'STRIPE_API_ERROR');
  }
  return result;
}

async function createVipCheckout(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const origin = new URL(request.url).origin;
  if (requestOrigin && requestOrigin !== origin) {
    return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const language = body.language === 'en' ? 'en' : 'fr';
  const successPath = language === 'en' ? '/en/vip-success.html' : '/vip-success.html';
  const cancelPath = language === 'en' ? '/en/vip.html' : '/vip.html';

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', VIP_PRICE_ID);
  params.set('line_items[0][quantity]', '1');
  params.set('locale', language);
  params.set('success_url', `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}${cancelPath}?subscription=cancelled`);
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS));
  params.set('metadata[vip_club]', 'true');
  params.set('metadata[preferred_language]', language);
  params.set('metadata[price_id]', VIP_PRICE_ID);
  params.set('subscription_data[metadata][vip_club]', 'true');
  params.set('subscription_data[metadata][preferred_language]', language);
  params.set('subscription_data[metadata][price_id]', VIP_PRICE_ID);

  const session = await stripeRequest(env, '/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  return json({
    ok: true,
    checkout_session_id: session.id,
    checkout_url: session.url
  }, 201);
}

async function getPortalLoginUrl(request, env) {
  if (portalUrlCache) return portalUrlCache;

  const list = await stripeRequest(
    env,
    '/billing_portal/configurations?is_default=true&active=true&limit=1'
  );
  const config = list?.data?.[0];
  if (!config?.id) throw new Error('PORTAL_CONFIGURATION_NOT_FOUND');

  const cancellationEnabled = config.features?.subscription_cancel?.enabled === true;
  const cancellationAtPeriodEnd = config.features?.subscription_cancel?.mode === 'at_period_end';
  const loginEnabled = config.login_page?.enabled === true;

  let current = config;
  if (!loginEnabled || !cancellationEnabled || !cancellationAtPeriodEnd) {
    const params = new URLSearchParams();
    params.set('login_page[enabled]', 'true');
    params.set('features[subscription_cancel][enabled]', 'true');
    params.set('features[subscription_cancel][mode]', 'at_period_end');
    params.set('features[subscription_cancel][proration_behavior]', 'none');
    params.set('features[payment_method_update][enabled]', 'true');
    params.set('features[invoice_history][enabled]', 'true');
    params.set('default_return_url', `${new URL(request.url).origin}/vip.html`);

    current = await stripeRequest(env, `/billing_portal/configurations/${config.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
  }

  const portalUrl = current.login_page?.url;
  if (!portalUrl) throw new Error('PORTAL_LOGIN_LINK_NOT_AVAILABLE');
  portalUrlCache = portalUrl;
  return portalUrl;
}

function vipEvent(event) {
  const object = event?.data?.object || {};
  if (event?.type === 'checkout.session.completed') {
    return object.mode === 'subscription' && object.metadata?.vip_club === 'true';
  }
  if (event?.type?.startsWith('customer.subscription.')) {
    return object.metadata?.vip_club === 'true';
  }
  return ['invoice.paid', 'invoice.payment_failed'].includes(event?.type);
}

async function upsertMembership(db, values) {
  await db.prepare(`
    INSERT INTO vip_memberships (
      stripe_customer_id, stripe_subscription_id, email, status,
      current_period_end, cancel_at_period_end, preferred_language,
      checkout_session_id, price_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(stripe_customer_id) DO UPDATE SET
      stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, vip_memberships.stripe_subscription_id),
      email = COALESCE(excluded.email, vip_memberships.email),
      status = excluded.status,
      current_period_end = COALESCE(excluded.current_period_end, vip_memberships.current_period_end),
      cancel_at_period_end = excluded.cancel_at_period_end,
      preferred_language = COALESCE(excluded.preferred_language, vip_memberships.preferred_language),
      checkout_session_id = COALESCE(excluded.checkout_session_id, vip_memberships.checkout_session_id),
      price_id = COALESCE(excluded.price_id, vip_memberships.price_id),
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    values.customerId,
    values.subscriptionId || null,
    values.email || null,
    values.status || 'incomplete',
    values.currentPeriodEnd || null,
    values.cancelAtPeriodEnd ? 1 : 0,
    values.language || 'fr',
    values.checkoutSessionId || null,
    values.priceId || VIP_PRICE_ID
  ).run();
}

async function processVipEvent(event, env) {
  await ensureVipSchema(env.DB);
  const object = event?.data?.object || {};

  if (event.type === 'checkout.session.completed') {
    if (object.mode !== 'subscription' || object.metadata?.vip_club !== 'true') return;
    await upsertMembership(env.DB, {
      customerId: clean(object.customer, 100),
      subscriptionId: clean(object.subscription, 100),
      email: clean(object.customer_details?.email || object.customer_email, 254).toLowerCase(),
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      language: object.metadata?.preferred_language === 'en' ? 'en' : 'fr',
      checkoutSessionId: clean(object.id, 255),
      priceId: clean(object.metadata?.price_id, 255) || VIP_PRICE_ID
    });
    return;
  }

  if (event.type?.startsWith('customer.subscription.')) {
    const customerId = clean(object.customer, 100);
    if (!customerId) return;
    const existing = await env.DB.prepare(`
      SELECT stripe_customer_id FROM vip_memberships
      WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
    `).bind(customerId, clean(object.id, 100)).first();
    if (object.metadata?.vip_club !== 'true' && !existing) return;

    await upsertMembership(env.DB, {
      customerId,
      subscriptionId: clean(object.id, 100),
      email: null,
      status: clean(object.status, 40) || (event.type.endsWith('.deleted') ? 'canceled' : 'incomplete'),
      currentPeriodEnd: Number(object.current_period_end || 0) || null,
      cancelAtPeriodEnd: object.cancel_at_period_end === true,
      language: object.metadata?.preferred_language === 'en' ? 'en' : 'fr',
      checkoutSessionId: null,
      priceId: clean(object.items?.data?.[0]?.price?.id, 255) || VIP_PRICE_ID
    });
    return;
  }

  if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
    const customerId = clean(object.customer, 100);
    const subscriptionId = clean(object.subscription, 100);
    if (!customerId && !subscriptionId) return;
    const existing = await env.DB.prepare(`
      SELECT stripe_customer_id FROM vip_memberships
      WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
    `).bind(customerId, subscriptionId).first();
    if (!existing) return;

    await env.DB.prepare(`
      UPDATE vip_memberships
      SET status = ?,
          current_period_end = COALESCE(?, current_period_end),
          updated_at = CURRENT_TIMESTAMP
      WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
    `).bind(
      event.type === 'invoice.paid' ? 'active' : 'past_due',
      Number(object.lines?.data?.[0]?.period?.end || 0) || null,
      customerId,
      subscriptionId
    ).run();
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/vip-checkout' && request.method === 'POST') {
      try {
        return await createVipCheckout(request, env);
      } catch (error) {
        console.error('VIP Checkout error', error);
        return json({ ok: false, error: clean(error?.message, 100) || 'VIP_CHECKOUT_FAILED' }, 502);
      }
    }

    if (url.pathname === '/api/vip-portal-link' && request.method === 'GET') {
      try {
        const portalUrl = await getPortalLoginUrl(request, env);
        return json({ ok: true, portal_url: portalUrl });
      } catch (error) {
        console.error('VIP portal link error', error);
        return json({ ok: false, error: clean(error?.message, 100) || 'PORTAL_LINK_FAILED' }, 502);
      }
    }

    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      const webhookCopy = request.clone();
      const response = await app.fetch(request, env, ctx);
      if (!response.ok) return response;

      try {
        const event = await webhookCopy.json();
        if (vipEvent(event)) await processVipEvent(event, env);
      } catch (error) {
        console.error('VIP webhook processing error', error);
        return json({ ok: false, error: 'VIP_WEBHOOK_PROCESSING_FAILED' }, 500);
      }
      return response;
    }

    return app.fetch(request, env, ctx);
  }
};