// Quran Resume - sync service and phone page (Cloudflare Worker + D1).
//
// What it stores, per pairing code: the last verse ("2:9") and when it was saved. Nothing
// else: no accounts, no names, no IP addresses, no history. The code is a long random
// string that lives in the phone link and in the extension, so it is the only key.
//
//   POST   /api/pair             -> {code, verseKey, savedAt}   (optional body: {verseKey, savedAt})
//   GET    /api/place/:code      -> {verseKey, savedAt}
//   PUT    /api/place/:code      -> {verseKey, savedAt}         (newest save wins; reply is the winner)
//   DELETE /api/place/:code      -> 204                         (forget this pairing)
//   GET    /p/:code              -> the phone page
//   GET    /p/:code/manifest.webmanifest -> lets the page be added to the home screen at its own link

import { SURAH_VERSES } from "./surahs.mjs";
import APP_HTML from "./app.html";

const CODE_RE = /^[A-Za-z0-9_-]{22}$/;
const VERSE_RE = /^(\d{1,3}):(\d{1,3})$/;
const MAX_BODY = 512;
const DAY = 86400000;
const FORGET_AFTER = 400 * DAY; // pairings nobody has used for this long are deleted
const TOUCH_EVERY = 7 * DAY;    // reading counts as "used", but we only write this often

const SECURITY = {
  "Referrer-Policy": "no-referrer", // the link holds the code, so never leak it to quran.com
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY },
  });
}

const fail = (status, error) => json({ error }, status);

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// "2:9" is valid only if the surah exists and has that verse.
function validVerse(key) {
  if (typeof key !== "string") return false;
  const m = VERSE_RE.exec(key);
  if (!m) return false;
  const surah = Number(m[1]);
  const verse = Number(m[2]);
  return surah >= 1 && surah <= 114 && verse >= 1 && verse <= SURAH_VERSES[surah - 1];
}

function validTime(t, now) {
  return Number.isSafeInteger(t) && t > 0 && t <= now + DAY;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooBig: true };
  if (!text) return { body: {} };
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? { body } : { bad: true };
  } catch {
    return { bad: true };
  }
}

const place = (row) => ({ verseKey: row.verse_key || null, savedAt: row.saved_at || 0 });

async function getRow(env, code) {
  return env.DB.prepare("SELECT verse_key, saved_at, updated_at FROM places WHERE code = ?").bind(code).first();
}

async function pair(request, env) {
  const { body, tooBig, bad } = await readBody(request);
  if (tooBig) return fail(413, "too_big");
  if (bad) return fail(400, "bad_json");
  const now = Date.now();
  let verseKey = null;
  let savedAt = 0;
  if (body.verseKey !== undefined) {
    if (!validVerse(body.verseKey) || !validTime(body.savedAt, now)) return fail(400, "bad_place");
    verseKey = body.verseKey;
    savedAt = body.savedAt;
  }
  const code = newCode();
  await env.DB.prepare("INSERT INTO places (code, verse_key, saved_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(code, verseKey, savedAt, now)
    .run();
  return json({ code, verseKey, savedAt }, 201);
}

async function getPlace(env, code) {
  const row = await getRow(env, code);
  if (!row) return fail(404, "not_found");
  if (Date.now() - row.updated_at > TOUCH_EVERY) {
    await env.DB.prepare("UPDATE places SET updated_at = ? WHERE code = ?").bind(Date.now(), code).run();
  }
  return json(place(row));
}

async function putPlace(request, env, code) {
  const { body, tooBig, bad } = await readBody(request);
  if (tooBig) return fail(413, "too_big");
  if (bad) return fail(400, "bad_json");
  const now = Date.now();
  if (!validVerse(body.verseKey) || !validTime(body.savedAt, now)) return fail(400, "bad_place");

  const row = await getRow(env, code);
  if (!row) return fail(404, "not_found");

  // The newest save wins, so a stale computer can never undo a newer place.
  if (body.savedAt > row.saved_at) {
    await env.DB.prepare("UPDATE places SET verse_key = ?, saved_at = ?, updated_at = ? WHERE code = ?")
      .bind(body.verseKey, body.savedAt, now, code)
      .run();
    return json({ verseKey: body.verseKey, savedAt: body.savedAt });
  }
  return json(place(row));
}

async function deletePlace(env, code) {
  await env.DB.prepare("DELETE FROM places WHERE code = ?").bind(code).run();
  return new Response(null, { status: 204, headers: SECURITY });
}

async function api(request, env, url) {
  if (url.pathname === "/api/pair") {
    return request.method === "POST" ? pair(request, env) : fail(405, "method_not_allowed");
  }
  const m = /^\/api\/place\/([^/]+)$/.exec(url.pathname);
  if (!m) return fail(404, "not_found");
  const code = m[1];
  if (!CODE_RE.test(code)) return fail(404, "not_found");
  switch (request.method) {
    case "GET":
      return getPlace(env, code);
    case "PUT":
      return putPlace(request, env, code);
    case "DELETE":
      return deletePlace(env, code);
    default:
      return fail(405, "method_not_allowed");
  }
}

function page(url) {
  const m = /^\/p\/([^/]+)(\/manifest\.webmanifest)?\/?$/.exec(url.pathname);
  if (!m || !CODE_RE.test(m[1])) return null;
  const code = m[1];

  if (m[2]) {
    // The home-screen icon must open this person's own link, so the manifest is per code.
    const manifest = {
      name: "Quran Resume",
      short_name: "Quran",
      description: "Continue the Quran from the verse where you stopped.",
      start_url: `/p/${code}`,
      scope: `/p/${code}`,
      display: "standalone",
      background_color: "#f6f4ec",
      theme_color: "#f6f4ec",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    };
    return new Response(JSON.stringify(manifest), {
      headers: { "Content-Type": "application/manifest+json; charset=utf-8", ...SECURITY },
    });
  }

  return new Response(APP_HTML.replace("__MANIFEST__", `/p/${code}/manifest.webmanifest`), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SECURITY,
      // the page loads only its own script, style and images, and talks only to this server
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url);
    if (url.pathname.startsWith("/p/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "method_not_allowed");
      return page(url) || new Response("Not found", { status: 404, headers: SECURITY });
    }
    return new Response("Not found", { status: 404, headers: SECURITY });
  },

  async scheduled(event, env) {
    await env.DB.prepare("DELETE FROM places WHERE updated_at < ?").bind(Date.now() - FORGET_AFTER).run();
  },
};
