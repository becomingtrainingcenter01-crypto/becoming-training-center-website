import app from './password-reset-wrapper.js';

const PASSWORD_ITERATIONS = 600000;
const MIN_PASSWORD_LENGTH = 12;
const AUTH_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_EMAIL_ATTEMPTS = 8;
const MAX_LOGIN_IP_ATTEMPTS = 30;
const SENSITIVE_PATHS = new Set([
  '/account.html', '/account', '/account/',
  '/en/account.html', '/en/account', '/en/account/',
  '/forgot-password.html', '/forgot-password', '/forgot-password/',
  '/en/forgot-password.html', '/en/forgot-password', '/en/forgot-password/',
  '/reset-password.html', '/reset-password', '/reset-password/',
  '/en/reset-password.html', '/en/reset-password', '/en/reset-password/',
  '/member.html', '/member', '/member/',
  '/en/member.html', '/en/member', '/en/member/'
]);

let schemaPromise;

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeEmail(value) {
  return clean(value, 254).toLowerCase();
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
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

async function passwordDigest(password, salt) {
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
    iterations: PASSWORD_ITERATIONS
  }, key, 256);
  return new Uint8Array(bits);
}

function passwordProblem(password, email = '') {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return 'PASSWORD_TOO_SHORT';
  }
  if (password.length > 128) return 'PASSWORD_TOO_LONG';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'PASSWORD_TOO_WEAK';

  const lower = password.toLowerCase();
  const localPart = normalizeEmail(email).split('@')[0];
  const obvious = ['password', 'motdepasse', 'qwerty', '12345678', 'letmein', 'welcome123', 'admin123'];
  if (obvious.some(value => lower.includes(value))) return 'PASSWORD_TOO_COMMON';
  if (localPart.length >= 4 && lower.includes(localPart)) return 'PASSWORD_CONTAINS_EMAIL';
  return null;
}

async function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_auth_limits (
        limit_key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        window_started INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL DEFAULT 0
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_auth_limits_blocked
        ON vip_auth_limits(blocked_until)`)
    ]).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

async function limitState(db, key) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    SELECT attempts, window_started, blocked_until
    FROM vip_auth_limits WHERE limit_key = ?
  `).bind(key).first();
  return {
    row,
    now,
    blocked: Number(row?.blocked_until || 0) > now,
    retryAfter: Math.max(0, Number(row?.blocked_until || 0) - now)
  };
}

async function recordFailure(db, key, maximum) {
  const state = await limitState(db, key);
  const withinWindow = state.row && state.now - Number(state.row.window_started || 0) < AUTH_WINDOW_SECONDS;
  const attempts = withinWindow ? Number(state.row.attempts || 0) + 1 : 1;
  const windowStarted = withinWindow ? Number(state.row.window_started) : state.now;
  const blockedUntil = attempts >= maximum ? state.now + AUTH_WINDOW_SECONDS : 0;

  await db.prepare(`
    INSERT INTO vip_auth_limits (limit_key, attempts, window_started, blocked_until)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(limit_key) DO UPDATE SET
      attempts = excluded.attempts,
      window_started = excluded.window_started,
      blocked_until = excluded.blocked_until
  `).bind(key, attempts, windowStarted, blockedUntil).run();
}

async function clearLimit(db, key) {
  await db.prepare('DELETE FROM vip_auth_limits WHERE limit_key = ?').bind(key).run();
}

async function loginKeys(request, email) {
  const ip = clean(request.headers.get('CF-Connecting-IP') || 'unknown', 80);
  return {
    ipKey: await sha256(`login-ip:${ip}`),
    emailKey: await sha256(`login-email:${email}`)
  };
}

async function enforceLoginLimits(request, env, ctx) {
  let body;
  try {
    body = await request.clone().json();
  } catch {
    return app.fetch(request, env, ctx);
  }

  const email = normalizeEmail(body.email);
  await ensureSchema(env.DB);
  const keys = await loginKeys(request, email);
  const [ipState, emailState] = await Promise.all([
    limitState(env.DB, keys.ipKey),
    limitState(env.DB, keys.emailKey)
  ]);

  if (ipState.blocked || emailState.blocked) {
    const retryAfter = Math.max(ipState.retryAfter, emailState.retryAfter, 1);
    return json({ ok: false, error: 'TOO_MANY_ATTEMPTS', retry_after: retryAfter }, 429, {
      'Retry-After': String(retryAfter)
    });
  }

  const response = await app.fetch(request, env, ctx);
  if (response.ok) {
    ctx.waitUntil(Promise.all([
      clearLimit(env.DB, keys.ipKey),
      clearLimit(env.DB, keys.emailKey)
    ]));
  } else if (response.status === 401) {
    ctx.waitUntil(Promise.all([
      recordFailure(env.DB, keys.ipKey, MAX_LOGIN_IP_ATTEMPTS),
      recordFailure(env.DB, keys.emailKey, MAX_LOGIN_EMAIL_ATTEMPTS)
    ]));
  }
  return response;
}

async function upgradePasswordHash(env, email, password) {
  const account = await env.DB.prepare('SELECT id FROM vip_accounts WHERE email = ?')
    .bind(normalizeEmail(email)).first();
  if (!account?.id) return;

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await passwordDigest(password, salt);
  await env.DB.prepare(`
    UPDATE vip_accounts
    SET password_salt = ?, password_hash = ?, password_iterations = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    bytesToBase64Url(salt),
    bytesToBase64Url(digest),
    PASSWORD_ITERATIONS,
    account.id
  ).run();
}

async function enforceStrongPassword(request, env, ctx) {
  let body;
  try {
    body = await request.clone().json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const problem = passwordProblem(body.password, body.email);
  if (problem) return json({ ok: false, error: problem }, 400);

  const response = await app.fetch(request, env, ctx);
  if (!response.ok) return response;

  try {
    await upgradePasswordHash(env, body.email, body.password);
  } catch (error) {
    console.error('Unable to upgrade password work factor', error);
    return json({ ok: false, error: 'PASSWORD_SECURITY_UPDATE_FAILED' }, 500);
  }
  return response;
}

function withSecurityHeaders(request, response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Strict-Transport-Security', 'max-age=31536000');

  if (SENSITIVE_PATHS.has(url.pathname) || url.pathname.startsWith('/api/account/')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'"
    ].join('; '));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let response;

    try {
      if (url.pathname === '/api/account/login' && request.method === 'POST') {
        response = await enforceLoginLimits(request, env, ctx);
      } else if (
        request.method === 'POST' &&
        (url.pathname === '/api/account/register' || url.pathname === '/api/account/reset-password')
      ) {
        response = await enforceStrongPassword(request, env, ctx);
      } else {
        response = await app.fetch(request, env, ctx);
      }
    } catch (error) {
      console.error('Authentication hardening error', error);
      response = json({ ok: false, error: 'SERVER_ERROR' }, 500);
    }

    return withSecurityHeaders(request, response);
  }
};