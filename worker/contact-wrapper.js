import bookingWorker from './index.js';

const ALLOWED_CONTACT_METHODS = new Set(['email', 'whatsapp', 'telephone']);
const NANP_AREA_CODES = {
  DO: ['809', '829', '849'],
  PR: ['787', '939'],
  BS: ['242'],
  BB: ['246'],
  JM: ['658', '876'],
  TT: ['868'],
  LC: ['758'],
  GD: ['473'],
  DM: ['767'],
  AG: ['268'],
  KN: ['869'],
  VC: ['784'],
  KY: ['345'],
  TC: ['649'],
  VG: ['284'],
  VI: ['340']
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function clean(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizePhone(rawPhone, countryIso, callingCode) {
  const rawDigits = clean(rawPhone, 40).replace(/\D/g, '');
  const dialDigits = clean(callingCode, 8).replace(/\D/g, '');
  const iso = clean(countryIso, 3).toUpperCase();

  if (!rawDigits) return { phone: '', countryIso: iso, callingCode: dialDigits ? `+${dialDigits}` : '' };
  if (!dialDigits || dialDigits.length > 4) return { error: 'INVALID_COUNTRY_CODE' };

  let national = rawDigits;
  if (national.startsWith(dialDigits) && national.length > dialDigits.length + 5) {
    national = national.slice(dialDigits.length);
  }

  if (dialDigits === '1') {
    if (national.length === 11 && national.startsWith('1')) national = national.slice(1);
    if (national.length !== 10) return { error: 'INVALID_PHONE' };
    const allowedAreas = NANP_AREA_CODES[iso];
    if (allowedAreas && !allowedAreas.includes(national.slice(0, 3))) {
      return { error: 'INVALID_AREA_CODE' };
    }
  } else if (iso === 'HT') {
    if (national.length !== 8) return { error: 'INVALID_PHONE' };
  } else if (iso === 'FR') {
    if (national.startsWith('0')) national = national.slice(1);
    if (national.length !== 9) return { error: 'INVALID_PHONE' };
  } else if (['GP', 'MQ', 'GF'].includes(iso)) {
    if (national.startsWith('0')) national = national.slice(1);
    if (national.length !== 9) return { error: 'INVALID_PHONE' };
  } else if (national.length < 6 || national.length > 14) {
    return { error: 'INVALID_PHONE' };
  }

  const phone = `+${dialDigits}${national}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return { error: 'INVALID_PHONE' };

  return {
    phone,
    countryIso: iso || 'OTHER',
    callingCode: `+${dialDigits}`
  };
}

async function ensureContactTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS booking_contacts (
      booking_id TEXT PRIMARY KEY,
      preferred_contact_method TEXT NOT NULL
        CHECK (preferred_contact_method IN ('email','whatsapp','telephone')),
      phone_country_iso TEXT,
      phone_country_code TEXT,
      phone_e164 TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `).run();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/bookings' || request.method !== 'POST') {
      return bookingWorker.fetch(request, env, ctx);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'INVALID_JSON' }, 400);
    }

    const preferredContactMethod = clean(body.preferred_contact_method, 20).toLowerCase();
    if (!ALLOWED_CONTACT_METHODS.has(preferredContactMethod)) {
      return json({ ok: false, error: 'INVALID_CONTACT_METHOD' }, 400);
    }

    const normalized = normalizePhone(
      body.phone,
      body.phone_country_iso,
      body.phone_country_code
    );

    if (normalized.error) {
      return json({ ok: false, error: normalized.error }, 400);
    }

    if (preferredContactMethod !== 'email' && !normalized.phone) {
      return json({ ok: false, error: 'PHONE_REQUIRED' }, 400);
    }

    body.phone = normalized.phone;
    body.phone_country_iso = normalized.countryIso;
    body.phone_country_code = normalized.callingCode;
    body.preferred_contact_method = preferredContactMethod;

    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.set('content-type', 'application/json');

    const forwardedRequest = new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const response = await bookingWorker.fetch(forwardedRequest, env, ctx);

    if (response.ok) {
      try {
        const result = await response.clone().json();
        if (result.booking_id) {
          await ensureContactTable(env.DB);
          await env.DB.prepare(`
            INSERT INTO booking_contacts (
              booking_id, preferred_contact_method, phone_country_iso,
              phone_country_code, phone_e164, updated_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(booking_id) DO UPDATE SET
              preferred_contact_method = excluded.preferred_contact_method,
              phone_country_iso = excluded.phone_country_iso,
              phone_country_code = excluded.phone_country_code,
              phone_e164 = excluded.phone_e164,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            result.booking_id,
            preferredContactMethod,
            normalized.countryIso || null,
            normalized.callingCode || null,
            normalized.phone || null
          ).run();
        }
      } catch (error) {
        console.error('Unable to save booking contact preference', error);
      }
    }

    return response;
  }
};
