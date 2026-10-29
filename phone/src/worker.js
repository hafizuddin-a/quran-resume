// Quran Resume phone server, on Cloudflare Workers.
//
// - Serves the phone app (public/, as static assets).
// - Sends each phone up to 3 reading reminders a day. Each phone row stores when
//   its next reminder is due (next_at, indexed). A Cron Trigger runs every
//   minute, reads only the phones that are due, and hands them out in small
//   batches, each sent by a separate Worker run, so every run stays well inside
//   the free plan's CPU and query limits however many phones there are. Once a reminder is acknowledged on the
//   phone, the rest of that day's are skipped; after the 3rd, nothing until
//   tomorrow. The server applies these rules because a browser expects every
//   push to show a notification, so a reminder that shouldn't appear must never
//   be sent.
// - Syncs the reading place between the phone app and the Quran Resume
//   extension, without accounts. The extension creates a pairing identified by a
//   long random code that only the paired devices hold. A phone joins with a
//   6-digit link code (also in a QR) that works once, for 10 minutes. Each side
//   sends its place with the time it was saved; the newest save wins.
//
// Storage is one D1 database with two tables (schema.sql): pairs and phones.

import { sendPush } from './push.js';

const DEFAULT_TIMES = ['08:00', '13:00', '20:00'];
const LATE_LIMIT_MIN = 60; // a reminder more than an hour late is skipped, not sent at an odd time
const LINK_TTL_MS = 10 * 60 * 1000;
const REMIND_BATCH = 5;    // phones per Worker run: a few pushes and ~25 queries, inside free-plan limits
const REMIND_BATCHES = 40; // batches per minute: 200 reminders a minute on the free plan
const MESSAGES = [
  'Pick up where you left off.', // sw.js adds how to stop today's reminders
  'Reminder 2 of 3. Your place is saved.',
  'Last reminder today. Even one verse counts.',
];

// Anyone may call the API: every request is authorised by a secret code
// (pairing or phone id), so where it comes from doesn't matter. This is what
// lets the extension call it without a host permission.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
});

const httpError = (status, message) => Object.assign(new Error(message), { status });

const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// ---- time ----

function localNow(timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date());
  } catch {
    return localNow('UTC');
  }
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}

const toMinutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const validTimes = t => Array.isArray(t) && t.length === 3 && t.every(x => /^([01]\d|2[0-3]):[0-5]\d$/.test(x));

// ---- phones (reminders) ----

// Reading a phone that was never saved returns the defaults without storing a
// row, so visitors who only look at Settings leave nothing behind.
async function getPhone(env, id, create = true) {
  if (typeof id !== 'string' || id.length < 16 || id.length > 64) throw httpError(400, 'Missing phone id.');
  let row = await env.DB.prepare('SELECT * FROM phones WHERE id = ?').bind(id).first();
  if (!row && !create) {
    return { id, subscription: null, enabled: 0, times: JSON.stringify(DEFAULT_TIMES), time_zone: 'UTC', day: localNow('UTC').date, sent: '[]', acked: 0 };
  }
  if (!row) {
    await env.DB.prepare('INSERT INTO phones (id, times) VALUES (?, ?)').bind(id, JSON.stringify(DEFAULT_TIMES)).run();
    row = await env.DB.prepare('SELECT * FROM phones WHERE id = ?').bind(id).first();
  }
  return rollDay(env, row);
}

// Starts a fresh day in the phone's time zone.
async function rollDay(env, row) {
  const { date } = localNow(row.time_zone);
  if (row.day !== date) {
    row.day = date; row.sent = '[]'; row.acked = 0;
    await env.DB.prepare('UPDATE phones SET day = ?, sent = ?, acked = 0 WHERE id = ?').bind(date, '[]', row.id).run();
  }
  return row;
}

const phoneStatus = (env, row) => ({
  publicKey: env.VAPID_PUBLIC_KEY,
  subscribed: !!row.subscription,
  settings: { enabled: !!row.enabled, times: JSON.parse(row.times), timeZone: row.time_zone },
  today: { date: row.day, sent: JSON.parse(row.sent), acked: !!row.acked },
});

const vapid = env => ({ publicKey: env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK), subject: env.VAPID_SUBJECT });

async function push(env, row, payload) {
  let status;
  try {
    status = await sendPush(JSON.parse(row.subscription), payload, vapid(env));
  } catch {
    return false; // the push service couldn't be reached
  }
  if (status === 404 || status === 410) {
    await env.DB.prepare('UPDATE phones SET subscription = NULL WHERE id = ?').bind(row.id).run(); // phone unsubscribed
  }
  return status >= 200 && status < 300;
}

// The latest slot whose time has passed, comes after the last one sent, and isn't stale.
function dueSlot(row) {
  const { minutes } = localNow(row.time_zone);
  const times = JSON.parse(row.times).map(toMinutes);
  const sent = JSON.parse(row.sent);
  const last = sent.length ? Math.max(...sent) : -1;
  for (let i = times.length - 1; i > last; i--) {
    if (times[i] <= minutes) return minutes - times[i] <= LATE_LIMIT_MIN ? i : null;
  }
  return null;
}

async function remind(env, row) {
  row = await rollDay(env, row);
  const sent = JSON.parse(row.sent);
  if (row.acked || sent.length >= 3) return;
  const slot = dueSlot(row);
  if (slot === null) return;
  const n = sent.length + 1;
  const ok = await push(env, row, {
    kind: 'reminder', phone: row.id, date: row.day, slot, n,
    title: 'Time to read the Quran', body: MESSAGES[Math.min(n - 1, 2)], explain: n === 1,
  });
  if (ok) {
    sent.push(slot);
    row.sent = JSON.stringify(sent);
    await env.DB.prepare('UPDATE phones SET sent = ? WHERE id = ?').bind(row.sent, row.id).run();
  }
}

// When this phone's next reminder is due (epoch ms, to the minute).
function nextAt(row) {
  const { date, minutes } = localNow(row.time_zone);
  const minuteStart = Math.floor(Date.now() / 60_000) * 60_000;
  const times = JSON.parse(row.times).map(toMinutes);
  const sameDay = row.day === date;
  const sent = sameDay ? JSON.parse(row.sent) : [];
  if (!(sameDay && row.acked) && sent.length < 3) {
    const last = sent.length ? Math.max(...sent) : -1;
    for (let i = last + 1; i < times.length; i++) {
      if (times[i] >= minutes - LATE_LIMIT_MIN) return minuteStart + Math.max(0, times[i] - minutes) * 60_000;
    }
  }
  return minuteStart + (1440 - minutes + times[0]) * 60_000; // tomorrow's first reminder
}

async function scheduleNext(env, id) {
  const row = await env.DB.prepare('SELECT * FROM phones WHERE id = ?').bind(id).first();
  if (row) await env.DB.prepare('UPDATE phones SET next_at = ? WHERE id = ?').bind(nextAt(row), id).run();
}

// One batch of due phones, run as its own Worker invocation. Each phone is
// claimed first, so two runs can never send the same reminder.
async function remindBatch(env, ids) {
  const now = Date.now();
  for (const id of ids.slice(0, REMIND_BATCH)) {
    const claimed = await env.DB.prepare('UPDATE phones SET next_at = ? WHERE id = ? AND (next_at IS NULL OR next_at <= ?)')
      .bind(now + 10 * 60_000, id, now).run();
    if (!claimed.meta.changes) continue;
    const row = await env.DB.prepare('SELECT * FROM phones WHERE id = ? AND enabled = 1 AND subscription IS NOT NULL').bind(id).first();
    if (row) {
      try { await remind(env, row); } catch {}
    }
    await scheduleNext(env, id);
  }
}

// ---- pairs (place sync) ----

let failedLinks = 0; // per Worker instance; a light brake on guessing 6-digit codes
let failedSince = Date.now();

async function getPair(env, code) {
  const pair = typeof code === 'string' && code.length >= 16
    && await env.DB.prepare('SELECT * FROM pairs WHERE code = ?').bind(code).first();
  if (!pair) throw httpError(404, 'This link was turned off. Link again from Quran Resume.');
  return pair;
}

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;

// Keeps the newer of the stored place and the incoming one. Devices send how
// long ago they saved (age, by their own clock) rather than a clock time, so a
// device whose clock is off can't win or lose wrongly; times are kept in this
// server's clock. A bare savedAt is still accepted.
async function mergePlace(env, pair, verseKey, savedAt, age) {
  if (verseKey === undefined) return pair;
  const m = VERSE_KEY.exec(String(verseKey));
  const t = Number.isFinite(Number(age)) && age !== null && Number(age) >= 0 ? Date.now() - Number(age) : Number(savedAt);
  if (!m || +m[1] < 1 || +m[1] > 114 || +m[2] < 1 || +m[2] > 286) throw httpError(400, 'Invalid verse.');
  if (!Number.isFinite(t) || t <= 0 || t > Date.now() + 5 * 60_000) throw httpError(400, 'Invalid time.');
  if (t <= pair.saved_at) return pair;
  await env.DB.prepare('UPDATE pairs SET verse_key = ?, saved_at = ? WHERE code = ? AND saved_at < ?')
    .bind(String(verseKey), t, pair.code, t).run();
  return { ...pair, verse_key: String(verseKey), saved_at: t };
}

// age: how long ago it was saved, for the device to place on its own clock.
const placeOf = pair => (pair.verse_key ? { verseKey: pair.verse_key, savedAt: pair.saved_at, age: Math.max(0, Date.now() - pair.saved_at) } : null);

async function newLinkCode(env, code) {
  for (let tries = 0; tries < 5; tries++) {
    const linkCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const expiresAt = Date.now() + LINK_TTL_MS;
    try {
      await env.DB.prepare('UPDATE pairs SET link_code = ?, link_expires = ? WHERE code = ?').bind(linkCode, expiresAt, code).run();
      return { linkCode, expiresAt };
    } catch {
      // that 6-digit code is in use by another pairing right now; pick another
    }
  }
  throw httpError(503, 'Try again in a moment.');
}

// ---- routes ----

// The app manifest with a pairing in its start address, for iPhone: a Home
// Screen app doesn't share Safari's storage, so this is how it arrives linked.
function manifestFor(pair) {
  const start = /^[\w-]{16,64}$/.test(pair || '') ? `/?pair=${pair}` : '/';
  return new Response(JSON.stringify({
    name: 'Quran Resume', short_name: 'Quran', start_url: start, scope: '/', display: 'standalone',
    background_color: '#f7f4ec', theme_color: '#2f6f5e',
    icons: [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"}, {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"}, {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
  }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } });
}

// Tajweed Mushaf page fonts (King Fahd Complex, QPC V4), as quran.com serves
// them. quran.com doesn't allow other sites to load its fonts, so they come
// through here; Cloudflare's cache keeps them, so each is fetched once.
const PAGE_FONT = /^\/qpc\/(colrv1|ot-svg\/light|ot-svg\/dark)\/p(\d{1,3})\.woff2$/;
async function pageFont(request, url, ctx) {
  const m = PAGE_FONT.exec(url.pathname);
  if (!m || +m[2] < 1 || +m[2] > 604) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(`https://quran.com/fonts/quran/hafs/v4/${m[1]}/woff2/p${m[2]}.woff2`);
  if (!res.ok) return new Response('Font unavailable', { status: 502 });
  const out = new Response(res.body, {
    headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' },
  });
  ctx.waitUntil(cache.put(request, out.clone()));
  return out;
}

const routes = {
  'GET /api/config': env => ({ publicKey: env.VAPID_PUBLIC_KEY }),

  // Phone: reminder settings and today's state.
  'POST /api/status': async (env, { phone }) => phoneStatus(env, await getPhone(env, phone, false)),

  'POST /api/subscribe': async (env, { phone, subscription, settings = {} }) => {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) throw httpError(400, 'Missing subscription.');
    await getPhone(env, phone);
    await env.DB.prepare('UPDATE phones SET subscription = ?, enabled = 1, time_zone = COALESCE(?, time_zone) WHERE id = ?')
      .bind(JSON.stringify(subscription), settings.timeZone || null, phone).run();
    await scheduleNext(env, phone);
    return phoneStatus(env, await getPhone(env, phone));
  },

  'POST /api/settings': async (env, { phone, times, timeZone, enabled }) => {
    await getPhone(env, phone);
    if (times !== undefined) {
      if (!validTimes(times)) throw httpError(400, 'Times must be three HH:MM values.');
      await env.DB.prepare('UPDATE phones SET times = ? WHERE id = ?').bind(JSON.stringify([...times].sort()), phone).run();
    }
    if (timeZone) await env.DB.prepare('UPDATE phones SET time_zone = ? WHERE id = ?').bind(timeZone, phone).run();
    if (enabled !== undefined) await env.DB.prepare('UPDATE phones SET enabled = ? WHERE id = ?').bind(enabled ? 1 : 0, phone).run();
    await scheduleNext(env, phone);
    return phoneStatus(env, await getPhone(env, phone));
  },

  'POST /api/ack': async (env, { phone, kind, date }) => {
    const row = await getPhone(env, phone, false);
    if (kind === 'reminder' && date === row.day && !row.acked) {
      await env.DB.prepare('UPDATE phones SET acked = 1 WHERE id = ?').bind(phone).run();
      row.acked = 1;
      await scheduleNext(env, phone); // nothing more today
    }
    return phoneStatus(env, row);
  },

  'POST /api/test': async (env, { phone }) => {
    const row = await getPhone(env, phone, false);
    if (!row.subscription) throw httpError(400, 'Turn on reminders first.');
    const ok = await push(env, row, {
      kind: 'test', phone, title: 'Test reminder', body: 'Notifications are working. This one doesn’t affect today’s reminders.',
    });
    if (!ok) throw httpError(502, 'Couldn’t reach this phone. Turn reminders off and on again.');
    return phoneStatus(env, row);
  },

  // Extension: start a pairing (optionally with its current place).
  'POST /api/pair': async (env, { verseKey, savedAt, age }) => {
    const code = randomCode();
    await env.DB.prepare('INSERT INTO pairs (code, created_at) VALUES (?, ?)').bind(code, Date.now()).run();
    await mergePlace(env, { code, saved_at: 0 }, verseKey, savedAt, age);
    return { code, ...(await newLinkCode(env, code)) };
  },

  // Extension: a fresh link code for an existing pairing (to add a phone).
  'POST /api/pair/link-code': async (env, { code }) => newLinkCode(env, (await getPair(env, code)).code),

  // Phone: swap a 6-digit link code for the pairing code.
  'POST /api/link': async (env, { linkCode }) => {
    if (Date.now() - failedSince > 60_000) { failedLinks = 0; failedSince = Date.now(); }
    if (failedLinks >= 20) throw httpError(429, 'Too many tries. Wait a minute and try again.');
    const pair = /^\d{6}$/.test(String(linkCode))
      && await env.DB.prepare('SELECT * FROM pairs WHERE link_code = ? AND link_expires > ?').bind(String(linkCode), Date.now()).first();
    if (!pair) {
      failedLinks++;
      throw httpError(404, 'That code is wrong or has expired. Show a new one in Quran Resume.');
    }
    await env.DB.prepare('UPDATE pairs SET link_code = NULL, link_expires = NULL, phones = phones + 1 WHERE code = ?').bind(pair.code).run();
    return { code: pair.code, place: placeOf(pair) };
  },

  // Either side: send your place (or just the code, to read it) and get the newest.
  'POST /api/sync': async (env, { code, verseKey, savedAt, age }) => {
    const pair = await mergePlace(env, await getPair(env, code), verseKey, savedAt, age);
    return { place: placeOf(pair), phones: pair.phones };
  },

  // Phone: unlink this phone, so the extension stops showing it as linked.
  'POST /api/leave': async (env, { code }) => {
    await getPair(env, code);
    await env.DB.prepare('UPDATE pairs SET phones = MAX(phones - 1, 0) WHERE code = ?').bind(code).run();
    return { ok: true };
  },

  // Extension: turn the phone link off and delete the stored place.
  'POST /api/unpair': async (env, { code }) => {
    await getPair(env, code);
    await env.DB.prepare('DELETE FROM pairs WHERE code = ?').bind(code).run();
    return { ok: true };
  },
};

export default {
  // Static files in public/ are served before this runs; only /api/* reaches here.
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/manifest') return manifestFor(url.searchParams.get('pair'));
    if (request.method === 'GET' && url.pathname.startsWith('/qpc/')) return pageFont(request, url, ctx);
    // Called by the cron below through a service binding. Safe if called by
    // anyone else: it only sends reminders that are already due.
    if (request.method === 'POST' && url.pathname === '/internal/remind') {
      const ids = await request.json().catch(() => []);
      if (Array.isArray(ids)) await remindBatch(env, ids.filter(id => typeof id === 'string'));
      return new Response(null, { status: 204 });
    }
    const route = routes[`${request.method} ${url.pathname}`];
    if (!route) return json({ error: 'Not found' }, 404);
    try {
      let body = {};
      if (request.method === 'POST') {
        const text = await request.text();
        if (text.length > 10_000) throw httpError(413, 'Too large.');
        body = text ? JSON.parse(text) : {};
      }
      return json(await route(env, body));
    } catch (err) {
      return json({ error: err.message }, err.status || 400);
    }
  },

  // Every minute: find the phones that are due (one indexed query) and hand
  // them out in batches, each sent by its own Worker run.
  async scheduled(event, env, ctx) {
    const { results } = await env.DB.prepare(
      'SELECT id FROM phones WHERE enabled = 1 AND subscription IS NOT NULL AND (next_at IS NULL OR next_at <= ?) ORDER BY next_at LIMIT ?'
    ).bind(Date.now(), REMIND_BATCH * REMIND_BATCHES).all();
    const ids = results.map(r => r.id);
    const runs = [];
    for (let i = 0; i < ids.length; i += REMIND_BATCH) {
      runs.push(env.SELF.fetch('https://internal/internal/remind', { method: 'POST', body: JSON.stringify(ids.slice(i, i + REMIND_BATCH)) }));
    }
    ctx.waitUntil(Promise.allSettled(runs));
  },
};
