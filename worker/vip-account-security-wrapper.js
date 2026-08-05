import app from './vip-account-entry-wrapper.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const SESSION_COOKIE = 'btc_vip_session';
let schemaPromise;

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return result;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_account_stripe_links (
        account_id INTEGER PRIMARY KEY,
        checkout_session_id TEXT UNIQUE,
        stripe_customer_id TEXT UNIQUE,
        stripe_subscription_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES vip_accounts(id) ON DELETE CASCADE
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_account_links_customer
        ON vip_account_stripe_links(stripe_customer_id)`)
    ]).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

async function accountFromSession(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(`
    SELECT a.id, a.email, a.preferred_language
    FROM vip_account_sessions s
    JOIN vip_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, now).first();
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
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code || 'STRIPE_API_ERROR');
  return data;
}

async function securePortal(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  }
  const account = await accountFromSession(request, env.DB);
  if (!account) return json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, 401);
  const link = await env.DB.prepare(`
    SELECT stripe_customer_id FROM vip_account_stripe_links WHERE account_id = ?
  `).bind(account.id).first();
  if (!link?.stripe_customer_id) return json({ ok: false, error: 'MEMBERSHIP_NOT_FOUND' }, 404);

  const returnPath = account.preferred_language === 'en' ? '/en/member.html' : '/member.html';
  const params = new URLSearchParams();
  params.set('customer', link.stripe_customer_id);
  params.set('return_url', `${new URL(request.url).origin}${returnPath}`);
  const session = await stripeRequest(env, '/billing_portal/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  return json({ ok: true, portal_url: session.url }, 201);
}

async function rememberCheckout(request, response, env) {
  if (!response.ok) return response;
  const account = await accountFromSession(request, env.DB);
  if (!account) return response;
  let data;
  try { data = await response.clone().json(); } catch { return response; }
  if (!data.checkout_session_id) return response;
  await env.DB.prepare(`
    INSERT INTO vip_account_stripe_links (account_id, checkout_session_id, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(account_id) DO UPDATE SET
      checkout_session_id = excluded.checkout_session_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(account.id, data.checkout_session_id).run();
  return response;
}

async function processCheckoutEvent(event, env) {
  if (event?.type !== 'checkout.session.completed') return;
  const session = event?.data?.object || {};
  if (session.mode !== 'subscription' || session.metadata?.vip_club !== 'true') return;
  const accountId = Number(session.metadata?.account_id || session.client_reference_id || 0);
  if (!accountId || !session.customer) return;
  await env.DB.prepare(`
    INSERT INTO vip_account_stripe_links (
      account_id, checkout_session_id, stripe_customer_id,
      stripe_subscription_id, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(account_id) DO UPDATE SET
      checkout_session_id = excluded.checkout_session_id,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    accountId,
    clean(session.id, 255),
    clean(session.customer, 100),
    clean(session.subscription, 100) || null
  ).run();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    await ensureSchema(env.DB);

    if (url.pathname === '/api/vip-portal-session' && request.method === 'POST') {
      try {
        return await securePortal(request, env);
      } catch (error) {
        console.error('Secure VIP portal error', error);
        return json({ ok: false, error: clean(error?.message, 100) || 'PORTAL_FAILED' }, 500);
      }
    }

    if (url.pathname === '/api/vip-checkout' && request.method === 'POST') {
      const response = await app.fetch(request, env, ctx);
      try {
        return await rememberCheckout(request, response, env);
      } catch (error) {
        console.error('Unable to link VIP checkout', error);
        return response;
      }
    }

    if (url.pathname === '/api/stripe/webhook' && request.method === 'POST') {
      const copy = request.clone();
      const response = await app.fetch(request, env, ctx);
      if (!response.ok) return response;
      try {
        const event = await copy.json();
        await processCheckoutEvent(event, env);
      } catch (error) {
        console.error('Unable to link VIP webhook event', error);
      }
      return response;
    }

    return app.fetch(request, env, ctx);
  }
};