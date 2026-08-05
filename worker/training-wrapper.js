import app from './stripe-wrapper.js';

const TRAINING_PROGRAMS = [
  {
    code: 'cna',
    title_fr: 'CNA — Assistant(e) de soins certifié(e)',
    title_en: 'CNA — Certified Nursing Assistant',
    price_cents: 35000,
    schedule_fr: 'Formation 100 % en ligne. Les prochaines dates seront communiquées après la demande d’inscription.',
    schedule_en: '100% online training. Upcoming dates will be shared after the enrollment request.'
  },
  {
    code: 'hha',
    title_fr: 'HHA — Aide à domicile',
    title_en: 'HHA — Home Health Aide',
    price_cents: 25000,
    schedule_fr: 'Formation 100 % en ligne. Les prochaines dates seront communiquées après la demande d’inscription.',
    schedule_en: '100% online training. Upcoming dates will be shared after the enrollment request.'
  },
  {
    code: 'med-tech',
    title_fr: 'Med Tech — Technicien(ne) en administration de médicaments',
    title_en: 'Med Tech — Medication Technician',
    price_cents: 25000,
    schedule_fr: 'Formation 100 % en ligne. Les prochaines dates seront communiquées après la demande d’inscription.',
    schedule_en: '100% online training. Upcoming dates will be shared after the enrollment request.'
  },
  {
    code: 'english',
    title_fr: 'Anglais',
    title_en: 'English',
    price_cents: 25000,
    schedule_fr: 'Formation 100 % en ligne. Les prochaines dates seront communiquées après la demande d’inscription.',
    schedule_en: '100% online training. Upcoming dates will be shared after the enrollment request.'
  },
  {
    code: 'spanish',
    title_fr: 'Espagnol',
    title_en: 'Spanish',
    price_cents: 25000,
    schedule_fr: 'Formation 100 % en ligne. Les prochaines dates seront communiquées après la demande d’inscription.',
    schedule_en: '100% online training. Upcoming dates will be shared after the enrollment request.'
  }
];

const TRAINING_CODES = new Set(TRAINING_PROGRAMS.map(program => program.code));
const ALLOWED_CONTACT_METHODS = new Set(['email', 'whatsapp', 'telephone']);
const NANP_AREA_CODES = {
  DO: ['809', '829', '849'], PR: ['787', '939'], BS: ['242'], BB: ['246'],
  JM: ['658', '876'], TT: ['868'], LC: ['758'], GD: ['473'], DM: ['767'],
  AG: ['268'], KN: ['869'], VC: ['784'], KY: ['345'], TC: ['649'],
  VG: ['284'], VI: ['340']
};

let trainingProgramsPromise;

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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(rawPhone, countryIso, callingCode) {
  const rawDigits = clean(rawPhone, 40).replace(/\D/g, '');
  const dialDigits = clean(callingCode, 8).replace(/\D/g, '');
  const iso = clean(countryIso, 3).toUpperCase();

  if (!rawDigits) {
    return { phone: '', countryIso: iso, callingCode: dialDigits ? `+${dialDigits}` : '' };
  }
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
  return { phone, countryIso: iso || 'OTHER', callingCode: `+${dialDigits}` };
}

async function ensureTrainingPrograms(request, env, ctx) {
  if (!trainingProgramsPromise) {
    trainingProgramsPromise = (async () => {
      const healthUrl = new URL('/api/health', request.url);
      const healthResponse = await app.fetch(new Request(healthUrl, { method: 'GET' }), env, ctx);
      if (!healthResponse.ok) throw new Error('BASE_SCHEMA_NOT_READY');

      await env.DB.batch(TRAINING_PROGRAMS.map(program => env.DB.prepare(`
        INSERT INTO programs (
          code, title_fr, title_en, single_price_cents, full_package_cents,
          duration_minutes, capacity, schedule_fr, schedule_en, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(code) DO UPDATE SET
          title_fr = excluded.title_fr,
          title_en = excluded.title_en,
          single_price_cents = excluded.single_price_cents,
          full_package_cents = excluded.full_package_cents,
          duration_minutes = 0,
          capacity = 1,
          schedule_fr = excluded.schedule_fr,
          schedule_en = excluded.schedule_en,
          active = 1,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        program.code,
        program.title_fr,
        program.title_en,
        program.price_cents,
        program.price_cents,
        program.schedule_fr,
        program.schedule_en
      )));
    })().catch(error => {
      trainingProgramsPromise = undefined;
      throw error;
    });
  }
  return trainingProgramsPromise;
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

async function createTrainingEnrollment(request, env) {
  const requestOrigin = request.headers.get('Origin');
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  if (clean(body.website, 100)) return json({ ok: true }, 202);

  const fullName = clean(body.full_name, 120);
  const email = normalizeEmail(body.email);
  const language = body.language === 'en' ? 'en' : 'fr';
  const programCode = clean(body.program_code, 30);
  const program = TRAINING_PROGRAMS.find(item => item.code === programCode);
  const consent = body.consent === true;
  const preferredContactMethod = clean(body.preferred_contact_method, 20).toLowerCase();

  if (!fullName || !isEmail(email) || !program || !consent) {
    return json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' }, 400);
  }
  if (!ALLOWED_CONTACT_METHODS.has(preferredContactMethod)) {
    return json({ ok: false, error: 'INVALID_CONTACT_METHOD' }, 400);
  }

  const normalized = normalizePhone(
    body.phone,
    body.phone_country_iso,
    body.phone_country_code
  );
  if (normalized.error) return json({ ok: false, error: normalized.error }, 400);
  if (preferredContactMethod !== 'email' && !normalized.phone) {
    return json({ ok: false, error: 'PHONE_REQUIRED' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO customers (full_name, email, phone, preferred_language, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      full_name = excluded.full_name,
      phone = excluded.phone,
      preferred_language = excluded.preferred_language,
      updated_at = CURRENT_TIMESTAMP
  `).bind(fullName, email, normalized.phone || null, language).run();

  const customer = await env.DB.prepare(
    'SELECT id FROM customers WHERE email = ?'
  ).bind(email).first();
  if (!customer?.id) return json({ ok: false, error: 'CUSTOMER_SAVE_FAILED' }, 500);

  const existing = await env.DB.prepare(`
    SELECT id FROM bookings
    WHERE customer_id = ? AND program_code = ? AND session_id IS NULL
      AND status IN ('requested','pending_payment','confirmed')
    LIMIT 1
  `).bind(customer.id, programCode).first();
  if (existing?.id) return json({ ok: false, error: 'DUPLICATE_BOOKING' }, 409);

  const bookingId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO bookings (
      id, customer_id, session_id, program_code, module_id, booking_type,
      preferred_date, preferred_time, meeting_method, other_meeting_method,
      discussion_topic, amount_cents, status, payment_status, source
    ) VALUES (?, ?, NULL, ?, NULL, 'full_program', NULL, NULL, 'other',
              '100% online training', NULL, ?, 'requested', 'unpaid', 'website')
  `).bind(bookingId, customer.id, programCode, program.price_cents).run();

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
    bookingId,
    preferredContactMethod,
    normalized.countryIso || null,
    normalized.callingCode || null,
    normalized.phone || null
  ).run();

  return json({
    ok: true,
    booking_id: bookingId,
    status: 'requested',
    payment_status: 'unpaid',
    amount_cents: program.price_cents,
    training_enrollment: true,
    message: language === 'fr'
      ? 'Votre demande d’inscription a été enregistrée. Les prochaines dates et les instructions de paiement vous seront communiquées séparément.'
      : 'Your enrollment request has been recorded. Upcoming dates and payment instructions will be shared separately.'
  }, 201);
}

async function enhanceProgramsResponse(request, env, ctx) {
  await ensureTrainingPrograms(request, env, ctx);
  const response = await app.fetch(request, env, ctx);
  if (!response.ok) return response;

  const data = await response.json();
  const order = ['personal', 'parenting', 'business', 'wellness', 'cna', 'hha', 'med-tech', 'english', 'spanish'];
  data.programs = (data.programs || [])
    .map(program => ({
      ...program,
      program_type: TRAINING_CODES.has(program.code) ? 'training' : 'coaching'
    }))
    .sort((left, right) => order.indexOf(left.code) - order.indexOf(right.code));
  return json(data, response.status);
}

function isBookingPage(url) {
  return ['/booking.html', '/booking', '/booking/', '/en/booking.html', '/en/booking', '/en/booking/']
    .includes(url.pathname);
}

async function enhanceBookingPage(response) {
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return new HTMLRewriter()
    .on('body', {
      element(element) {
        element.append(
          '<script src="/assets/js/training-booking.js?v=20260805-1" defer></script>',
          { html: true }
        );
      }
    })
    .transform(new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/programs' && request.method === 'GET') {
      try {
        return await enhanceProgramsResponse(request, env, ctx);
      } catch (error) {
        console.error('Unable to load training programs', error);
        return json({ ok: false, error: 'SERVER_ERROR' }, 500);
      }
    }

    if (url.pathname === '/api/bookings' && request.method === 'POST') {
      let preview;
      try {
        preview = await request.clone().json();
      } catch {
        return app.fetch(request, env, ctx);
      }

      if (TRAINING_CODES.has(clean(preview.program_code, 30))) {
        try {
          await ensureTrainingPrograms(request, env, ctx);
          return await createTrainingEnrollment(request, env);
        } catch (error) {
          console.error('Unable to create training enrollment', error);
          return json({ ok: false, error: 'SERVER_ERROR' }, 500);
        }
      }
    }

    const response = await app.fetch(request, env, ctx);
    if (request.method === 'GET' && isBookingPage(url)) {
      return enhanceBookingPage(response);
    }
    return response;
  }
};