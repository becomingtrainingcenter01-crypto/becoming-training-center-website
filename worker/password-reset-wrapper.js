import app from './vip-account-security-wrapper.js';

const RESEND_API = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Becoming Training Center <noreply@send.becomingedu.com>';
const PASSWORD_ITERATIONS = 210000;
const RESET_TTL_SECONDS = 30 * 60;
const RESET_WINDOW_SECONDS = 60 * 60;
const MAX_EMAIL_REQUESTS = 5;
const MAX_IP_REQUESTS = 20;

let resetSchemaPromise;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
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

function passwordError(password) {
  if (typeof password !== 'string' || password.length < 10) return 'PASSWORD_TOO_SHORT';
  if (password.length > 128) return 'PASSWORD_TOO_LONG';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'PASSWORD_TOO_WEAK';
  return null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function publicOrigin(request, env) {
  const configured = clean(env.PUBLIC_SITE_URL, 300).replace(/\/$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  if (url.hostname === 'becomingedu.com' || url.hostname === 'www.becomingedu.com') {
    return 'https://becomingedu.com';
  }
  return url.origin;
}

async function ensureBaseAccountSchema(request, env, ctx) {
  const url = new URL('/api/account/me', request.url);
  await app.fetch(new Request(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  }), env, ctx);
}

async function ensureResetSchema(db) {
  if (!resetSchemaPromise) {
    resetSchemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_password_resets (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        request_ip_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(account_id) REFERENCES vip_accounts(id) ON DELETE CASCADE
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_password_resets_account
        ON vip_password_resets(account_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_vip_password_resets_expiry
        ON vip_password_resets(expires_at)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS vip_password_reset_limits (
        limit_key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        window_started INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL DEFAULT 0
      )`)
    ]).catch(error => {
      resetSchemaPromise = undefined;
      throw error;
    });
  }
  return resetSchemaPromise;
}

async function checkAndIncrementLimit(db, key, maximum) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    SELECT attempts, window_started, blocked_until
    FROM vip_password_reset_limits WHERE limit_key = ?
  `).bind(key).first();

  if (Number(row?.blocked_until || 0) > now) return false;

  const withinWindow = row && now - Number(row.window_started || 0) < RESET_WINDOW_SECONDS;
  const attempts = withinWindow ? Number(row.attempts || 0) + 1 : 1;
  const windowStarted = withinWindow ? Number(row.window_started) : now;
  const blockedUntil = attempts > maximum ? now + RESET_WINDOW_SECONDS : 0;

  await db.prepare(`
    INSERT INTO vip_password_reset_limits (limit_key, attempts, window_started, blocked_until)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(limit_key) DO UPDATE SET
      attempts = excluded.attempts,
      window_started = excluded.window_started,
      blocked_until = excluded.blocked_until
  `).bind(key, attempts, windowStarted, blockedUntil).run();

  return blockedUntil === 0;
}

async function resetRequestAllowed(request, db, email) {
  const ip = clean(request.headers.get('CF-Connecting-IP') || 'unknown', 80);
  const ipHash = await sha256(`ip:${ip}`);
  const emailHash = await sha256(`email:${ip}:${email}`);
  const ipAllowed = await checkAndIncrementLimit(db, ipHash, MAX_IP_REQUESTS);
  const emailAllowed = await checkAndIncrementLimit(db, emailHash, MAX_EMAIL_REQUESTS);
  return { allowed: ipAllowed && emailAllowed, ipHash };
}

async function sendEmail(env, payload) {
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
      ...payload
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Resend API error', result);
    throw new Error(result?.message || 'EMAIL_SEND_FAILED');
  }
  return result;
}

function resetEmail(language, name, resetUrl) {
  const safeName = escapeHtml(name || (language === 'en' ? 'member' : 'membre'));
  const safeUrl = escapeHtml(resetUrl);
  if (language === 'en') {
    return {
      subject: 'Reset your Becoming VIP Club password',
      text: `Hello ${name || 'member'},\n\nUse this secure link to reset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this change, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0b2233"><h1 style="color:#073e68">Reset your password</h1><p>Hello ${safeName},</p><p>We received a request to reset your Becoming VIP Club password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#087ca5;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:700">Choose a new password</a></p><p>This secure link expires in 30 minutes and can only be used once.</p><p>If you did not request this change, you can safely ignore this email.</p><p>Becoming Training Center</p></div>`
    };
  }
  return {
    subject: 'Réinitialisez votre mot de passe Becoming VIP Club',
    text: `Bonjour ${name || 'membre'},\n\nUtilisez ce lien sécurisé pour réinitialiser votre mot de passe : ${resetUrl}\n\nCe lien expire dans 30 minutes. Si vous n’avez pas demandé ce changement, ignorez ce courriel.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0b2233"><h1 style="color:#073e68">Réinitialisez votre mot de passe</h1><p>Bonjour ${safeName},</p><p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Becoming VIP Club.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#087ca5;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:700">Choisir un nouveau mot de passe</a></p><p>Ce lien sécurisé expire dans 30 minutes et ne peut être utilisé qu’une seule fois.</p><p>Si vous n’avez pas demandé ce changement, vous pouvez ignorer ce courriel.</p><p>Becoming Training Center</p></div>`
  };
}

function changedEmail(language, name) {
  const safeName = escapeHtml(name || (language === 'en' ? 'member' : 'membre'));
  if (language === 'en') {
    return {
      subject: 'Your Becoming VIP Club password was changed',
      text: `Hello ${name || 'member'},\n\nYour password was changed successfully. If you did not make this change, contact Becoming Training Center immediately.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0b2233"><h1 style="color:#073e68">Password changed</h1><p>Hello ${safeName},</p><p>Your Becoming VIP Club password was changed successfully.</p><p>If you did not make this change, contact Becoming Training Center immediately.</p></div>`
    };
  }
  return {
    subject: 'Votre mot de passe Becoming VIP Club a été modifié',
    text: `Bonjour ${name || 'membre'},\n\nVotre mot de passe a été modifié avec succès. Si vous n’avez pas effectué ce changement, contactez immédiatement Becoming Training Center.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0b2233"><h1 style="color:#073e68">Mot de passe modifié</h1><p>Bonjour ${safeName},</p><p>Le mot de passe de votre compte Becoming VIP Club a été modifié avec succès.</p><p>Si vous n’avez pas effectué ce changement, contactez immédiatement Becoming Training Center.</p></div>`
  };
}

async function forgotPassword(request, env, ctx) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = normalizeEmail(body.email);
  const language = body.language === 'en' ? 'en' : 'fr';
  const neutralMessage = language === 'en'
    ? 'If an account exists for this email, a secure reset link has been sent.'
    : 'Si un compte existe pour ce courriel, un lien sécurisé de réinitialisation a été envoyé.';

  if (!validEmail(email)) return json({ ok: true, message: neutralMessage });

  await ensureBaseAccountSchema(request, env, ctx);
  await ensureResetSchema(env.DB);
  const limit = await resetRequestAllowed(request, env.DB, email);
  if (!limit.allowed) return json({ ok: true, message: neutralMessage });

  const account = await env.DB.prepare(`
    SELECT id, full_name, email, preferred_language
    FROM vip_accounts WHERE email = ?
  `).bind(email).first();

  if (account) {
    const token = randomToken();
    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + RESET_TTL_SECONDS;
    const preferredLanguage = language || account.preferred_language || 'fr';
    const resetPath = preferredLanguage === 'en' ? '/en/reset-password.html' : '/reset-password.html';
    const resetUrl = new URL(resetPath, publicOrigin(request, env));
    resetUrl.searchParams.set('token', token);
    resetUrl.searchParams.set('email', email);

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE vip_password_resets SET used_at = ?
        WHERE account_id = ? AND used_at IS NULL
      `).bind(now, account.id),
      env.DB.prepare(`
        INSERT INTO vip_password_resets (
          id, account_id, token_hash, expires_at, request_ip_hash
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), account.id, tokenHash, expiresAt, limit.ipHash)
    ]);

    try {
      const message = resetEmail(preferredLanguage, account.full_name, resetUrl.toString());
      await sendEmail(env, {
        to: [account.email],
        subject: message.subject,
        html: message.html,
        text: message.text
      });
    } catch (error) {
      console.error('Unable to send password reset email', error);
      await env.DB.prepare(`
        UPDATE vip_password_resets SET used_at = ? WHERE token_hash = ?
      `).bind(now, tokenHash).run();
    }
  }

  const now = Math.floor(Date.now() / 1000);
  ctx.waitUntil(env.DB.batch([
    env.DB.prepare('DELETE FROM vip_password_resets WHERE expires_at < ?').bind(now - 86400),
    env.DB.prepare('DELETE FROM vip_password_reset_limits WHERE window_started < ?').bind(now - 172800)
  ]));

  return json({ ok: true, message: neutralMessage });
}

async function resetPassword(request, env, ctx) {
  if (!validateOrigin(request)) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const email = normalizeEmail(body.email);
  const token = clean(body.token, 300);
  const password = typeof body.password === 'string' ? body.password : '';
  const language = body.language === 'en' ? 'en' : 'fr';
  const problem = passwordError(password);

  if (!validEmail(email) || token.length < 20) {
    return json({ ok: false, error: 'INVALID_OR_EXPIRED_TOKEN' }, 400);
  }
  if (problem) return json({ ok: false, error: problem }, 400);

  await ensureBaseAccountSchema(request, env, ctx);
  await ensureResetSchema(env.DB);
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const reset = await env.DB.prepare(`
    SELECT r.id, r.account_id, a.full_name, a.email, a.preferred_language
    FROM vip_password_resets r
    JOIN vip_accounts a ON a.id = r.account_id
    WHERE a.email = ? AND r.token_hash = ?
      AND r.used_at IS NULL AND r.expires_at > ?
    LIMIT 1
  `).bind(email, tokenHash, now).first();

  if (!reset) return json({ ok: false, error: 'INVALID_OR_EXPIRED_TOKEN' }, 400);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await passwordDigest(password, salt);

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE vip_accounts
      SET password_salt = ?, password_hash = ?, password_iterations = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      bytesToBase64Url(salt),
      bytesToBase64Url(digest),
      PASSWORD_ITERATIONS,
      reset.account_id
    ),
    env.DB.prepare(`
      UPDATE vip_password_resets SET used_at = ?
      WHERE account_id = ? AND used_at IS NULL
    `).bind(now, reset.account_id),
    env.DB.prepare('DELETE FROM vip_account_sessions WHERE account_id = ?')
      .bind(reset.account_id)
  ]);

  const preferredLanguage = reset.preferred_language === 'en' ? 'en' : language;
  const confirmation = changedEmail(preferredLanguage, reset.full_name);
  ctx.waitUntil(sendEmail(env, {
    to: [reset.email],
    subject: confirmation.subject,
    html: confirmation.html,
    text: confirmation.text
  }).catch(error => console.error('Unable to send password changed email', error)));

  return json({
    ok: true,
    message: language === 'en'
      ? 'Your password has been changed. You can now sign in.'
      : 'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.'
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/account/forgot-password' && request.method === 'POST') {
        return await forgotPassword(request, env, ctx);
      }
      if (url.pathname === '/api/account/reset-password' && request.method === 'POST') {
        return await resetPassword(request, env, ctx);
      }
    } catch (error) {
      console.error('Password reset error', error);
      return json({ ok: false, error: 'SERVER_ERROR' }, 500);
    }

    return app.fetch(request, env, ctx);
  }
};