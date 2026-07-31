const TIME_ZONE = 'America/New_York';
const ACTIVE_BOOKING_STATUSES = ['requested', 'pending_payment', 'confirmed'];

const PROGRAMS = [
  {
    code: 'personal',
    title_fr: 'Coaching personnel',
    title_en: 'Personal coaching',
    single_price_cents: 5000,
    full_package_cents: null,
    duration_minutes: 45,
    capacity: 1,
    schedule_fr: 'Samedi, de 8 h à 12 h 30 (heure de l’Est)',
    schedule_en: 'Saturday, 8:00 a.m.–12:30 p.m. Eastern Time'
  },
  {
    code: 'parenting',
    title_fr: 'Coaching parental',
    title_en: 'Parenting coaching',
    single_price_cents: 10000,
    full_package_cents: 55000,
    duration_minutes: 90,
    capacity: 20,
    schedule_fr: 'Lundi, de 10 h 30 à 17 h 30 (heure de l’Est)',
    schedule_en: 'Monday, 10:30 a.m.–5:30 p.m. Eastern Time'
  },
  {
    code: 'business',
    title_fr: 'Coaching en affaires',
    title_en: 'Business coaching',
    single_price_cents: 10000,
    full_package_cents: 55000,
    duration_minutes: 90,
    capacity: 20,
    schedule_fr: 'Samedi et dimanche, de 11 h 30 à 19 h 30 (heure de l’Est)',
    schedule_en: 'Saturday and Sunday, 11:30 a.m.–7:30 p.m. Eastern Time'
  },
  {
    code: 'wellness',
    title_fr: 'Coaching bien-être',
    title_en: 'Wellness coaching',
    single_price_cents: 10000,
    full_package_cents: 65000,
    duration_minutes: 90,
    capacity: 20,
    schedule_fr: 'Lundi, de 10 h 30 à 17 h 30 (heure de l’Est)',
    schedule_en: 'Monday, 10:30 a.m.–5:30 p.m. Eastern Time'
  }
];

const MODULES = {
  parenting: [
    ['why-child-does-not-listen', 'Pourquoi mon enfant ne m’écoute-t-il jamais ?', 'Why does my child never listen to me?'],
    ['stop-yelling', 'Comment arrêter de crier sur son enfant ?', 'How can I stop yelling at my child?'],
    ['confidence-errors', 'Les 7 erreurs qui détruisent la confiance de votre enfant', 'The 7 mistakes that destroy your child’s confidence'],
    ['manage-anger', 'Comment gérer les colères sans perdre le contrôle ?', 'How can I manage anger without losing control?'],
    ['emotionally-strong-child', 'Comment élever un enfant émotionnellement fort dans un monde fragile ?', 'How can I raise an emotionally strong child in a fragile world?'],
    ['digital-safety', 'Comment protéger son enfant des dangers du monde numérique ?', 'How can I protect my child from the dangers of the digital world?']
  ],
  business: [
    ['launch-from-zero', 'Comment lancer une entreprise, même si vous partez de zéro ?', 'How can you launch a business even if you are starting from zero?'],
    ['find-clients', 'Pourquoi votre entreprise ne trouve-t-elle pas assez de clients ?', 'Why is your business not attracting enough clients?'],
    ['build-a-brand', 'Comment transformer votre idée en une marque que les clients choisissent naturellement ?', 'How can you turn your idea into a brand customers naturally choose?'],
    ['growth-errors', 'Les 7 erreurs qui empêchent une entreprise de grandir', 'The 7 mistakes preventing a business from growing'],
    ['ai-for-business', 'Comment utiliser l’intelligence artificielle pour travailler moins et gagner plus ?', 'How can you use artificial intelligence to work less and earn more?'],
    ['tax-errors', 'Comment éviter les erreurs fiscales qui coûtent des milliers de dollars aux entrepreneurs ?', 'How can entrepreneurs avoid tax mistakes that cost thousands of dollars?']
  ],
  wellness: [
    ['stress-exhaustion', 'Pourquoi suis-je toujours stressé(e) et épuisé(e) ?', 'Why am I always stressed and exhausted?'],
    ['lost-motivation', 'Pourquoi ai-je perdu toute motivation ?', 'Why have I lost all motivation?'],
    ['painful-relationships', 'Pourquoi mes relations finissent-elles toujours par me blesser ?', 'Why do my relationships always end up hurting me?'],
    ['heal-after-separation', 'Comment guérir après une séparation, un divorce ou une trahison ?', 'How can I heal after a breakup, divorce, or betrayal?'],
    ['move-through-grief', 'Comment traverser un deuil sans perdre le goût de vivre ?', 'How can I move through grief without losing the desire to live?'],
    ['difficulty-changing', 'Pourquoi est-il si difficile de changer malgré toute ma bonne volonté ?', 'Why is change so difficult despite my best intentions?'],
    ['self-doubt', 'Pourquoi est-ce que je doute constamment de moi-même ?', 'Why do I constantly doubt myself?'],
    ['take-back-control', 'Comment reprendre le contrôle de ma vie et retrouver un véritable épanouissement ?', 'How can I take control of my life and experience genuine fulfillment?']
  ]
};

const TIME_SLOTS = {
  personal: ['08:00', '08:45', '09:30', '10:15', '11:00', '11:45'],
  parenting: ['10:30', '12:00', '13:30', '15:00'],
  wellness: ['10:30', '12:00', '13:30', '15:00'],
  business: ['11:30', '13:00', '14:30', '16:00', '17:30']
};

let schemaPromise;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeEmail(value) {
  return cleanString(value, 254).toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function easternDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dayOfWeek(dateString) {
  return new Date(`${dateString}T12:00:00Z`).getUTCDay();
}

function validSchedule(programCode, dateString, startTime) {
  const day = dayOfWeek(dateString);
  if (!TIME_SLOTS[programCode]?.includes(startTime)) return false;
  if (programCode === 'personal') return day === 6;
  if (programCode === 'parenting' || programCode === 'wellness') return day === 1;
  if (programCode === 'business') return day === 0 || day === 6;
  return false;
}

function programByCode(code) {
  return PROGRAMS.find(program => program.code === code);
}

async function initializeSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      phone TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr','en')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS programs (
      code TEXT PRIMARY KEY,
      title_fr TEXT NOT NULL,
      title_en TEXT NOT NULL,
      single_price_cents INTEGER NOT NULL,
      full_package_cents INTEGER,
      duration_minutes INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      schedule_fr TEXT NOT NULL,
      schedule_en TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_code TEXT NOT NULL,
      slug TEXT NOT NULL,
      title_fr TEXT NOT NULL,
      title_en TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(program_code, slug),
      FOREIGN KEY(program_code) REFERENCES programs(code) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL UNIQUE,
      program_code TEXT NOT NULL,
      module_id INTEGER,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      duration_minutes INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(program_code) REFERENCES programs(code),
      FOREIGN KEY(module_id) REFERENCES modules(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      session_id INTEGER,
      program_code TEXT NOT NULL,
      module_id INTEGER,
      booking_type TEXT NOT NULL CHECK (booking_type IN ('session','single_module','full_program')),
      preferred_date TEXT,
      preferred_time TEXT,
      meeting_method TEXT NOT NULL CHECK (meeting_method IN ('zoom','telephone','other')),
      other_meeting_method TEXT,
      discussion_topic TEXT,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pending_payment','confirmed','cancelled','expired')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded','failed')),
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      source TEXT NOT NULL DEFAULT 'website',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(session_id) REFERENCES sessions(id),
      FOREIGN KEY(program_code) REFERENCES programs(code),
      FOREIGN KEY(module_id) REFERENCES modules(id),
      UNIQUE(customer_id, session_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS booking_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK (change_type IN ('cancel','reschedule')),
      old_session_id INTEGER,
      new_session_id INTEGER,
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      within_policy INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'requested',
      notes TEXT,
      FOREIGN KEY(booking_id) REFERENCES bookings(id),
      FOREIGN KEY(old_session_id) REFERENCES sessions(id),
      FOREIGN KEY(new_session_id) REFERENCES sessions(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      payload_hash TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_program ON bookings(program_code)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date, program_code)`),
    db.prepare(`CREATE TRIGGER IF NOT EXISTS prevent_overbooking_insert
      BEFORE INSERT ON bookings
      WHEN NEW.session_id IS NOT NULL AND NEW.status IN ('requested','pending_payment','confirmed')
      BEGIN
        SELECT CASE WHEN (
          SELECT COUNT(*) FROM bookings
          WHERE session_id = NEW.session_id
            AND status IN ('requested','pending_payment','confirmed')
        ) >= (
          SELECT capacity FROM sessions WHERE id = NEW.session_id
        ) THEN RAISE(ABORT, 'SESSION_FULL') END;
      END`),
    db.prepare(`CREATE TRIGGER IF NOT EXISTS prevent_overbooking_update
      BEFORE UPDATE OF status, session_id ON bookings
      WHEN NEW.session_id IS NOT NULL
        AND NEW.status IN ('requested','pending_payment','confirmed')
        AND (OLD.session_id IS NOT NEW.session_id OR OLD.status NOT IN ('requested','pending_payment','confirmed'))
      BEGIN
        SELECT CASE WHEN (
          SELECT COUNT(*) FROM bookings
          WHERE session_id = NEW.session_id
            AND id != NEW.id
            AND status IN ('requested','pending_payment','confirmed')
        ) >= (
          SELECT capacity FROM sessions WHERE id = NEW.session_id
        ) THEN RAISE(ABORT, 'SESSION_FULL') END;
      END`)
  ]);

  const programStatements = PROGRAMS.map(program => db.prepare(`
    INSERT INTO programs (
      code, title_fr, title_en, single_price_cents, full_package_cents,
      duration_minutes, capacity, schedule_fr, schedule_en, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET
      title_fr = excluded.title_fr,
      title_en = excluded.title_en,
      single_price_cents = excluded.single_price_cents,
      full_package_cents = excluded.full_package_cents,
      duration_minutes = excluded.duration_minutes,
      capacity = excluded.capacity,
      schedule_fr = excluded.schedule_fr,
      schedule_en = excluded.schedule_en,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    program.code,
    program.title_fr,
    program.title_en,
    program.single_price_cents,
    program.full_package_cents,
    program.duration_minutes,
    program.capacity,
    program.schedule_fr,
    program.schedule_en
  ));
  await db.batch(programStatements);

  const moduleStatements = [];
  Object.entries(MODULES).forEach(([programCode, modules]) => {
    modules.forEach(([slug, titleFr, titleEn], index) => {
      moduleStatements.push(db.prepare(`
        INSERT INTO modules (program_code, slug, title_fr, title_en, sort_order, active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(program_code, slug) DO UPDATE SET
          title_fr = excluded.title_fr,
          title_en = excluded.title_en,
          sort_order = excluded.sort_order,
          active = 1
      `).bind(programCode, slug, titleFr, titleEn, index + 1));
    });
  });
  await db.batch(moduleStatements);

  await db.prepare(`
    INSERT INTO schema_meta (key, value, updated_at)
    VALUES ('schema_version', '1', CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run();
}

async function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = initializeSchema(db).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

async function getPrograms(db) {
  const programsResult = await db.prepare(`
    SELECT code, title_fr, title_en, single_price_cents, full_package_cents,
           duration_minutes, capacity, schedule_fr, schedule_en
    FROM programs WHERE active = 1 ORDER BY CASE code
      WHEN 'personal' THEN 1 WHEN 'parenting' THEN 2 WHEN 'business' THEN 3 ELSE 4 END
  `).all();
  const modulesResult = await db.prepare(`
    SELECT id, program_code, slug, title_fr, title_en, sort_order
    FROM modules WHERE active = 1 ORDER BY program_code, sort_order
  `).all();
  const modules = modulesResult.results || [];
  return (programsResult.results || []).map(program => ({
    ...program,
    time_slots: TIME_SLOTS[program.code] || [],
    modules: modules.filter(module => module.program_code === program.code)
  }));
}

async function bookingCounts(db) {
  const total = await db.prepare(`
    SELECT COUNT(*) AS count FROM bookings
    WHERE status IN ('requested','pending_payment','confirmed')
  `).first();
  const confirmed = await db.prepare(`
    SELECT COUNT(*) AS count FROM bookings WHERE status = 'confirmed'
  `).first();
  const byProgram = await db.prepare(`
    SELECT program_code, COUNT(*) AS count FROM bookings
    WHERE status IN ('requested','pending_payment','confirmed')
    GROUP BY program_code
  `).all();
  return {
    total: Number(total?.count || 0),
    confirmed: Number(confirmed?.count || 0),
    by_program: Object.fromEntries((byProgram.results || []).map(row => [row.program_code, Number(row.count)]))
  };
}

async function availability(db, params) {
  const programCode = cleanString(params.get('program'), 30);
  const moduleId = Number(params.get('module') || 0) || null;
  const date = cleanString(params.get('date'), 10);
  const time = cleanString(params.get('time'), 5);
  const program = programByCode(programCode);

  if (!program || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: 'INVALID_AVAILABILITY_REQUEST', status: 400 };
  }
  if (!validSchedule(programCode, date, time)) {
    return { error: 'TIME_NOT_AVAILABLE', status: 400 };
  }
  const key = `${programCode}:${moduleId || 'personal'}:${date}:${time}`;
  const row = await db.prepare(`
    SELECT s.id, s.capacity,
      (SELECT COUNT(*) FROM bookings b
       WHERE b.session_id = s.id
         AND b.status IN ('requested','pending_payment','confirmed')) AS booked
    FROM sessions s WHERE s.session_key = ?
  `).bind(key).first();
  const booked = Number(row?.booked || 0);
  const capacity = Number(row?.capacity || program.capacity);
  return { capacity, booked, remaining: Math.max(0, capacity - booked) };
}

async function createBooking(request, db) {
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

  if (cleanString(body.website, 100)) return json({ ok: true }, 202);

  const fullName = cleanString(body.full_name, 120);
  const email = normalizeEmail(body.email);
  const phone = cleanString(body.phone, 40);
  const language = body.language === 'en' ? 'en' : 'fr';
  const programCode = cleanString(body.program_code, 30);
  const bookingType = cleanString(body.booking_type, 30);
  const date = cleanString(body.preferred_date, 10);
  const time = cleanString(body.preferred_time, 5);
  const meetingMethod = cleanString(body.meeting_method, 20);
  const otherMeetingMethod = cleanString(body.other_meeting_method, 120);
  const topic = cleanString(body.discussion_topic, 1500);
  const consent = body.consent === true;
  const moduleId = Number(body.module_id || 0) || null;
  const program = programByCode(programCode);

  if (!fullName || !isEmail(email) || !program || !consent) {
    return json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' }, 400);
  }
  if (!['zoom', 'telephone', 'other'].includes(meetingMethod)) {
    return json({ ok: false, error: 'INVALID_MEETING_METHOD' }, 400);
  }
  if (meetingMethod === 'other' && !otherMeetingMethod) {
    return json({ ok: false, error: 'OTHER_MEETING_METHOD_REQUIRED' }, 400);
  }

  const expectedType = programCode === 'personal' ? 'session' : bookingType;
  if (programCode === 'personal' && !topic) {
    return json({ ok: false, error: 'DISCUSSION_TOPIC_REQUIRED' }, 400);
  }
  if (programCode !== 'personal' && !['single_module', 'full_program'].includes(expectedType)) {
    return json({ ok: false, error: 'INVALID_BOOKING_TYPE' }, 400);
  }

  const isScheduledBooking = programCode === 'personal' || expectedType === 'single_module';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < easternDateString()) {
    return json({ ok: false, error: 'INVALID_DATE' }, 400);
  }
  if (!validSchedule(programCode, date, time)) {
    return json({ ok: false, error: 'TIME_NOT_AVAILABLE' }, 400);
  }

  let module = null;
  if (programCode !== 'personal' && expectedType === 'single_module') {
    module = await db.prepare(`
      SELECT id, program_code FROM modules WHERE id = ? AND program_code = ? AND active = 1
    `).bind(moduleId, programCode).first();
    if (!module) return json({ ok: false, error: 'INVALID_MODULE' }, 400);
  }

  await db.prepare(`
    INSERT INTO customers (full_name, email, phone, preferred_language, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      full_name = excluded.full_name,
      phone = excluded.phone,
      preferred_language = excluded.preferred_language,
      updated_at = CURRENT_TIMESTAMP
  `).bind(fullName, email, phone || null, language).run();

  const customer = await db.prepare(`SELECT id FROM customers WHERE email = ?`).bind(email).first();
  if (!customer?.id) return json({ ok: false, error: 'CUSTOMER_SAVE_FAILED' }, 500);

  let sessionId = null;
  let sessionKey = null;
  if (isScheduledBooking) {
    sessionKey = `${programCode}:${module?.id || 'personal'}:${date}:${time}`;
    await db.prepare(`
      INSERT OR IGNORE INTO sessions (
        session_key, program_code, module_id, session_date, start_time,
        timezone, duration_minutes, capacity, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `).bind(
      sessionKey,
      programCode,
      module?.id || null,
      date,
      time,
      TIME_ZONE,
      program.duration_minutes,
      program.capacity
    ).run();
    const session = await db.prepare(`SELECT id, status FROM sessions WHERE session_key = ?`).bind(sessionKey).first();
    if (!session?.id || session.status !== 'open') {
      return json({ ok: false, error: 'SESSION_UNAVAILABLE' }, 409);
    }
    sessionId = session.id;
  }

  const amountCents = programCode === 'personal'
    ? program.single_price_cents
    : expectedType === 'full_program'
      ? program.full_package_cents
      : program.single_price_cents;
  const bookingId = crypto.randomUUID();

  try {
    await db.prepare(`
      INSERT INTO bookings (
        id, customer_id, session_id, program_code, module_id, booking_type,
        preferred_date, preferred_time, meeting_method, other_meeting_method,
        discussion_topic, amount_cents, status, payment_status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', 'unpaid', 'website')
    `).bind(
      bookingId,
      customer.id,
      sessionId,
      programCode,
      module?.id || null,
      programCode === 'personal' ? 'session' : expectedType,
      date,
      time,
      meetingMethod,
      meetingMethod === 'other' ? otherMeetingMethod : null,
      topic || null,
      amountCents
    ).run();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes('SESSION_FULL')) {
      return json({ ok: false, error: 'SESSION_FULL' }, 409);
    }
    if (message.includes('UNIQUE constraint failed')) {
      return json({ ok: false, error: 'DUPLICATE_BOOKING' }, 409);
    }
    throw error;
  }

  const counts = await bookingCounts(db);
  let sessionAvailability = null;
  if (sessionKey) {
    const row = await db.prepare(`
      SELECT s.capacity,
        (SELECT COUNT(*) FROM bookings b
         WHERE b.session_id = s.id
           AND b.status IN ('requested','pending_payment','confirmed')) AS booked
      FROM sessions s WHERE s.session_key = ?
    `).bind(sessionKey).first();
    sessionAvailability = {
      capacity: Number(row?.capacity || program.capacity),
      booked: Number(row?.booked || 1)
    };
    sessionAvailability.remaining = Math.max(0, sessionAvailability.capacity - sessionAvailability.booked);
  }

  return json({
    ok: true,
    booking_id: bookingId,
    status: 'requested',
    payment_status: 'unpaid',
    amount_cents: amountCents,
    total_bookings: counts.total,
    availability: sessionAvailability,
    message: language === 'fr'
      ? 'Votre demande de réservation a été enregistrée. Le paiement et la confirmation finale seront ajoutés à la prochaine étape.'
      : 'Your booking request has been recorded. Payment and final confirmation will be added in the next step.'
  }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      await ensureSchema(env.DB);

      if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

      if (url.pathname === '/api/health' && request.method === 'GET') {
        const programCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM programs').first();
        return json({
          ok: true,
          service: 'becoming-training-center-website',
          database: 'connected',
          schema: 'ready',
          programs: Number(programCount?.count || 0)
        });
      }

      if (url.pathname === '/api/programs' && request.method === 'GET') {
        return json({ ok: true, programs: await getPrograms(env.DB) });
      }

      if (url.pathname === '/api/booking-counts' && request.method === 'GET') {
        return json({ ok: true, ...(await bookingCounts(env.DB)) });
      }

      if (url.pathname === '/api/availability' && request.method === 'GET') {
        const result = await availability(env.DB, url.searchParams);
        if (result.error) return json({ ok: false, error: result.error }, result.status);
        return json({ ok: true, ...result });
      }

      if (url.pathname === '/api/bookings' && request.method === 'POST') {
        return createBooking(request, env.DB);
      }

      return json({ ok: false, error: 'NOT_FOUND' }, 404);
    } catch (error) {
      console.error('Booking API error', error);
      return json({ ok: false, error: 'SERVER_ERROR' }, 500);
    }
  }
};
