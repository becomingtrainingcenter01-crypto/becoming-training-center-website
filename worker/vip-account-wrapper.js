import app from './vip-subscription-wrapper.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const VIP_PRICE_ID = 'price_1U17lBRrFP56VRtGcGGWUYQI';
const SESSION_COOKIE = 'btc_vip_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210000;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 8;

let accountSchemaPromise;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeEmail(value) {
  return clean(value, 254).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function passwordDigest(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations
  }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

function passwordError(password) {
  if (typeof password !== 'string' || password.length < 10) return 'PASSWORD_TOO_SHORT';
  if (password.length > 128) return 'PASSWORD_TOO_LONG';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'PASSWORD_TOO_WEAK';
  return null;
}

function parseCookies(request) {
  const cookies = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function ensureAccountSchema(db) {
  if (!accountSchemaPromise) {
    accountSchemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        preferred_language TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr','en')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_account_sessions (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at INTEGER NOT NULL,
        FOREIGN KEY(account_id) REFERENCES vip_accounts(id) ON DELETE CASCADE
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_account_sessions_account
        ON vip_account_sessions(account_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_account_sessions_expiry
        ON vip_account_sessions(expires_at)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_login_attempts (
        attempt_key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        window_started INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL DEFAULT 0
      )`)
    ]).catch(error => {
      accountSchemaPromise = undefined;
      throw error;
    });
  }
  return accountSchemaPromise;
}

async function createSession(db, accountId) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO vip_account_sessions (id, account_id, token_hash, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), accountId, tokenHash, now + SESSION_SECONDS, now).run();
  return token;
}

async function authenticatedAccount(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || token.length < 20 || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    SELECT a.id, a.full_name, a.email, a.preferred_language,
           s.id AS session_id, s.expires_at, s.last_seen_at
    FROM vip_account_sessions s
    JOIN vip_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, now).first();
  if (!row) return null;

  if (now - Number(row.last_seen_at || 0) > 3600) {
    await db.prepare(`
      UPDATE vip_account_sessions SET last_seen_at = ? WHERE id = ?
    `).bind(now, row.session_id).run();
  }
  return row;
}

async function membershipForEmail(db, email) {
  return db.prepare(`
    SELECT stripe_customer_id, stripe_subscription_id, email, status,
           current_period_end, cancel_at_period_end, preferred_language,
           price_id, updated_at
    FROM vip_memberships
    WHERE email = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(email).first();
}

function membershipPayload(row) {
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  const currentPeriodEnd = Number(row.current_period_end || 0) || null;
  const activeStatus = ['active', 'trialing'].includes(row.status);
  const hasAccess = activeStatus || (
    Boolean(row.cancel_at_period_end) && currentPeriodEnd && currentPeriodEnd > now
  );
  return {
    status: row.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    has_access: Boolean(hasAccess),
    price_id: row.price_id || VIP_PRICE_ID
  };
}

async function loginAttemptKey(request, email) {
  const ip = clean(request.headers.get('CF-Connecting-IP') || 'unknown', 80);
  return sha256(`${ip}|${email}`);
}

async function checkLoginLimit(request, db, email) {
  const key = await loginAttemptKey(request, email);
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    SELECT attempts, window_started, blocked_until
    FROM vip_login_attempts WHERE attempt_key = ?
  `).bind(key).first();
  if (Number(row?.blocked_until || 0) > now) {
    return { allowed: false, key, retryAfter: Number(row.blocked_until) - now };
  }
  return { allowed: true, key };
}

async function recordLoginFailure(db, key) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    SELECT attempts, window_started FROM vip_login_attempts WHERE attempt_key = ?
  `).bind(key).first();
  const withinWindow = row && now - Number(row.window_started) < LOGIN_WINDOW_SECONDS;
  const attempts = withinWindow ? Number(row.attempts || 0) + 1 : 1;
  const windowStarted = withinWindow ? Number(row.window_started) : now;
  const blockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_WINDOW_SECONDS : 0;

  await db.prepare(`
    INSERT INTO vip_login_attempts (attempt_key, attempts, window_started, blocked_until)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(attempt_key) DO UPDATE SET
      attempts = excluded.attempts,
      window_started = excluded.window_started,
      blocked_until = excluded.blocked_until
  `).bind(key, attempts, windowStarted, blockedUntil).run();
}

async function clearLoginFailures(db, key) {
  await db.prepare('DELETE FROM vip_login_attempts WHERE attempt_key = ?').bind(key).run();
}

async function register(request, env) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const fullName = clean(body.full_name, 120);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const language = body.language === 'en' ? 'en' : 'fr';
  const passwordProblem = passwordError(password);

  if (fullName.length < 2 || !validEmail(email)) {
    return json({ ok: false, error: 'INVALID_ACCOUNT_DETAILS' }, 400);
  }
  if (passwordProblem) return json({ ok: false, error: passwordProblem }, 400);

  const existing = await env.DB.prepare(
    'SELECT id FROM vip_accounts WHERE email = ?'
  ).bind(email).first();
  if (existing) return json({ ok: false, error: 'ACCOUNT_EXISTS' }, 409);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await passwordDigest(password, salt);

  try {
    const result = await env.DB.prepare(`
      INSERT INTO vip_accounts (
        full_name, email, password_salt, password_hash,
        password_iterations, preferred_language, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      fullName,
      email,
      bytesToBase64Url(salt),
      bytesToBase64Url(digest),
      PASSWORD_ITERATIONS,
      language
    ).run();

    const accountId = Number(result.meta?.last_row_id || 0);
    if (!accountId) throw new Error('ACCOUNT_CREATE_FAILED');
    const token = await createSession(env.DB, accountId);
    return json({
      ok: true,
      account: { id: accountId, full_name: fullName, email, preferred_language: language }
    }, 201, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE')) {
      return json({ ok: false, error: 'ACCOUNT_EXISTS' }, 409);
    }
    throw error;
  }
}

async function login(request, env) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validEmail(email) || !password) return json({ ok: false, error: 'INVALID_CREDENTIALS' }, 401);

  const limit = await checkLoginLimit(request, env.DB, email);
  if (!limit.allowed) {
    return json({ ok: false, error: 'TOO_MANY_ATTEMPTS', retry_after: limit.retryAfter }, 429);
  }

  const account = await env.DB.prepare(`
    SELECT id, full_name, email, password_salt, password_hash,
           password_iterations, preferred_language
    FROM vip_accounts WHERE email = ?
  `).bind(email).first();

  let valid = false;
  if (account) {
    try {
      const digest = await passwordDigest(
        password,
        base64UrlToBytes(account.password_salt),
        Number(account.password_iterations || PASSWORD_ITERATIONS)
      );
      valid = constantTimeEqual(digest, base64UrlToBytes(account.password_hash));
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    await recordLoginFailure(env.DB, limit.key);
    return json({ ok: false, error: 'INVALID_CREDENTIALS' }, 401);
  }

  await clearLoginFailures(env.DB, limit.key);
  const token = await createSession(env.DB, account.id);
  return json({
    ok: true,
    account: {
      id: account.id,
      full_name: account.full_name,
      email: account.email,
      preferred_language: account.preferred_language
    }
  }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function logout(request, env) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    const tokenHash = await sha256(token);
    await env.DB.prepare('DELETE FROM vip_account_sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

async function accountMe(request, env) {
  const account = await authenticatedAccount(request, env.DB);
  if (!account) return json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, 401);
  const membership = await membershipForEmail(env.DB, account.email);
  return json({
    ok: true,
    account: {
      id: account.id,
      full_name: account.full_name,
      email: account.email,
      preferred_language: account.preferred_language
    },
    membership: membershipPayload(membership)
  });
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
    console.error('Stripe account API error', result?.error || result);
    throw new Error(result?.error?.code || 'STRIPE_API_ERROR');
  }
  return result;
}

async function accountCheckout(request, env) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  const account = await authenticatedAccount(request, env.DB);
  if (!account) return json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const language = body.language === 'en' ? 'en' : account.preferred_language === 'en' ? 'en' : 'fr';
  const membership = await membershipForEmail(env.DB, account.email);
  const blockedStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);
  if (membership && blockedStatuses.has(membership.status)) {
    return json({ ok: false, error: 'MEMBERSHIP_ALREADY_EXISTS' }, 409);
  }

  const origin = new URL(request.url).origin;
  const successPath = language === 'en' ? '/en/member.html' : '/member.html';
  const cancelPath = language === 'en' ? '/en/vip.html' : '/vip.html';
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', VIP_PRICE_ID);
  params.set('line_items[0][quantity]', '1');
  params.set('locale', language);
  params.set('client_reference_id', String(account.id));
  params.set('success_url', `${origin}${successPath}?subscription=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}${cancelPath}?subscription=cancelled`);
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + 30 * 60));
  params.set('metadata[vip_club]', 'true');
  params.set('metadata[account_id]', String(account.id));
  params.set('metadata[account_email]', account.email);
  params.set('metadata[preferred_language]', language);
  params.set('metadata[price_id]', VIP_PRICE_ID);
  params.set('subscription_data[metadata][vip_club]', 'true');
  params.set('subscription_data[metadata][account_id]', String(account.id));
  params.set('subscription_data[metadata][account_email]', account.email);
  params.set('subscription_data[metadata][preferred_language]', language);
  params.set('subscription_data[metadata][price_id]', VIP_PRICE_ID);

  if (membership?.stripe_customer_id) {
    params.set('customer', membership.stripe_customer_id);
  } else {
    params.set('customer_email', account.email);
  }

  const session = await stripeRequest(env, '/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  return json({ ok: true, checkout_url: session.url, checkout_session_id: session.id }, 201);
}

async function portalSession(request, env) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  const account = await authenticatedAccount(request, env.DB);
  if (!account) return json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, 401);
  const membership = await membershipForEmail(env.DB, account.email);
  if (!membership?.stripe_customer_id) {
    return json({ ok: false, error: 'MEMBERSHIP_NOT_FOUND' }, 404);
  }

  const language = account.preferred_language === 'en' ? 'en' : 'fr';
  const returnPath = language === 'en' ? '/en/member.html' : '/member.html';
  const params = new URLSearchParams();
  params.set('customer', membership.stripe_customer_id);
  params.set('return_url', `${new URL(request.url).origin}${returnPath}`);

  const session = await stripeRequest(env, '/billing_portal/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  return json({ ok: true, portal_url: session.url }, 201);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      await ensureAccountSchema(env.DB);
      await env.DB.prepare('DELETE FROM vip_account_sessions WHERE expires_at <= ?')
        .bind(Math.floor(Date.now() / 1000)).run();

      if (url.pathname === '/api/account/register' && request.method === 'POST') {
        return await register(request, env);
      }
      if (url.pathname === '/api/account/login' && request.method === 'POST') {
        return await login(request, env);
      }
      if (url.pathname === '/api/account/logout' && request.method === 'POST') {
        return await logout(request, env);
      }
      if (url.pathname === '/api/account/me' && request.method === 'GET') {
        return await accountMe(request, env);
      }
      if (url.pathname === '/api/vip-checkout' && request.method === 'POST') {
        return await accountCheckout(request, env);
      }
      if (url.pathname === '/api/vip-portal-session' && request.method === 'POST') {
        return await portalSession(request, env);
      }
    } catch (error) {
      console.error('VIP account error', error);
      return json({ ok: false, error: clean(error?.message, 100) || 'SERVER_ERROR' }, 500);
    }

    return app.fetch(request, env, ctx);
  }
};