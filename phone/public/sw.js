// App shell is precached; Quran API and font responses are cached as you read
// (stale-while-revalidate), so surahs you've opened work offline.
// The Quran Foundation Developer Terms cap cached Quran content at 1 week
// (font files are exempt), so API responses are timestamped and expire.
const SHELL = 'shell-v20';
const QURAN = 'quran-v1';
const FONTS = 'fonts-v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const STAMP = 'x-cached-at';
const SHELL_FILES = ['./', 'manifest.webmanifest', 'manifest-dark.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/UthmanicHafs1Ver18.woff2', 'fonts/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2'];

// The page is kept as 'index.html', and never as a redirect: /index.html redirects
// to /, and Safari won't open a page from a redirected response (so the app
// wouldn't open offline on iPhone).
const plain = res => (res && res.redirected ? res.blob().then(body => new Response(body, { status: res.status, headers: res.headers })) : res);
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(async c => {
    await c.addAll(SHELL_FILES);
    await c.put('index.html', await plain(await fetch('./')));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, QURAN, FONTS].includes(k)).map(k => caches.delete(k))))
      .then(purgeExpired)
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Opening the app (including ?chapter=…&verse=…) is served by the cached shell.
  // Other pages, like the privacy policy, come from the network as usual.
  if (req.mode === 'navigate' && url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
    e.waitUntil(purgeExpired()); // each app launch drops anything past 7 days
    // The network gets 2 seconds; after that (or offline) the saved copy opens
    // instead, so a slow connection never leaves a blank screen. A newer page
    // that arrives later is saved for next time.
    e.respondWith((async () => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(async c => c.put('index.html', await plain(copy))); }
        return res;
      });
      const slow = new Promise(r => setTimeout(r, 2000)).then(async () => (await plain(await caches.match('index.html'))) || net);
      try {
        return await Promise.race([net, slow]);
      } catch {
        return (await plain(await caches.match('index.html'))) || Response.error();
      }
    })());
    return;
  }

  // Tajweed page fonts, from the Quran Foundation's font address, are kept once
  // fetched so surahs read before work offline. The Developer Terms allow keeping
  // font files, with an active Developer Console account and credit in the app.
  if (url.hostname === 'verses.quran.foundation' && url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.open(FONTS).then(async cache => (await cache.match(req)) || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); // Safari asks for fonts without CORS
      return res;
    })));
    return;
  }

  if (url.origin === location.origin) {
    if (req.mode === 'navigate') return; // other pages of this site: straight from the network
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // Audio isn't touched here: it streams directly from its own hosts.
  if (url.hostname === 'api.quran.com') {
    e.respondWith(quranContent(req));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});

const isFresh = res => Date.now() - Number(res.headers.get(STAMP) || 0) < MAX_AGE;

async function quranContent(req) {
  const cache = await caches.open(QURAN);
  let hit = await cache.match(req);
  if (hit && !isFresh(hit)) {
    await cache.delete(req);
    hit = undefined;
  }
  const net = fetch(req).then(async res => {
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set(STAMP, String(Date.now()));
      await cache.put(req, new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers }));
    }
    return res;
  }).catch(() => hit || Response.error());
  return hit || net;
}

async function purgeExpired() {
  const cache = await caches.open(QURAN);
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (!res || !isFresh(res)) await cache.delete(req);
  }
}

// ---- daily reminders ----
// The server decides whether a reminder should go out; this just shows it and
// reports back when it's acknowledged.

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  // iPhone web notifications have no action buttons; tapping the notification
  // itself acknowledges there, so the instructions differ.
  const hasButtons = 'actions' in Notification.prototype && (Notification.maxActions ?? 1) > 0;
  const body = data.explain
    ? `${data.body} ${hasButtons ? 'Once you’ve read, tap below to stop today’s reminders.' : 'Once you’ve read, tap here to stop today’s reminders.'}`
    : data.body;
  // Close the previous reminder and post a brand-new one rather than updating it
  // in place: Android only pops a banner on screen for new notifications.
  // A test only replaces an earlier test, so it never takes away a real
  // reminder that is waiting to be acknowledged.
  e.waitUntil(self.registration.getNotifications().then(old => {
    old.filter(n => data.kind === 'reminder' || n.data?.kind !== 'reminder').forEach(n => n.close());
    return self.registration.showNotification(data.title || 'Time to read the Quran', {
      body,
      icon: 'icon-192.png',
      tag: `quran-${Date.now()}`,
      requireInteraction: true,
      data,
      // Only a reminder can be acknowledged; on a test the button would do nothing.
      actions: data.kind === 'reminder' ? [{ action: 'ack', title: 'I have read the Quran today' }] : [],
    });
  }).then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then(list => list.forEach(c => c.postMessage({ type: 'pushed', kind: data.kind })))); // lets the page see a test arrive
});

// "I have read the Quran today" acknowledges; tapping the notification itself also counts, and opens the app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { kind, date, phone } = e.notification.data || {};
  const ack = fetch('api/ack', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, date, phone }),
  }).catch(() => {});
  if (e.action === 'ack') {
    e.waitUntil(ack);
    return;
  }
  e.waitUntil(Promise.all([ack, self.clients.matchAll({ type: 'window' }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    return open ? open.focus() : self.clients.openWindow('./');
  })]));
});
