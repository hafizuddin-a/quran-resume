// Quran Resume phone page. The pairing code is in the address: /p/<code>.
(function () {
  const $ = (id) => document.getElementById(id);
  const code = location.pathname.split("/")[2] || "";
  const API = "/api/place/" + encodeURIComponent(code);
  const CACHE = "qr-place:" + code;

  let current = null; // { verseKey, savedAt }

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };

  // ---- Showing the place ----
  function parse(verseKey) {
    const m = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
    return m && SURAH_NAMES[Number(m[1]) - 1] ? { surah: Number(m[1]), verse: Number(m[2]) } : null;
  }

  function show(place) {
    current = place;
    $("place").hidden = false;
    $("change").hidden = false;
    $("unpaired").hidden = true;
    const p = parse(place && place.verseKey);
    if (p) {
      $("verse").textContent = p.surah + ":" + p.verse;
      $("verse-sub").textContent = "Surah " + SURAH_NAMES[p.surah - 1] + ", verse " + p.verse;
      $("continue").href = "https://quran.com/" + p.surah + "?startingVerse=" + p.verse;
      surah.value = String(p.surah);
      verseInput.value = String(p.verse);
    } else {
      $("verse").textContent = "Not saved yet";
      $("verse-sub").textContent = "Pick where you are below, or start from the beginning.";
      $("continue").href = "https://quran.com/1";
    }
    capVerse();
  }

  function showUnpaired() {
    $("place").hidden = true;
    $("change").hidden = true;
    $("install").hidden = true;
    $("unpaired").hidden = false;
  }

  // ---- The picker ----
  const surah = $("surah");
  const verseInput = $("verse-input");
  SURAH_NAMES.forEach((name, i) => {
    const o = document.createElement("option");
    o.value = String(i + 1);
    o.textContent = (i + 1) + ". " + name;
    surah.appendChild(o);
  });

  // Never allow a verse past the end of the chosen surah, even while typing.
  function capVerse() {
    const max = SURAH_VERSES[Number(surah.value) - 1];
    verseInput.max = String(max);
    if (verseInput.value !== "" && Number(verseInput.value) > max) verseInput.value = String(max);
  }
  verseInput.addEventListener("input", capVerse);
  verseInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && Number(verseInput.value) >= SURAH_VERSES[Number(surah.value) - 1]) e.preventDefault();
  });
  surah.addEventListener("change", () => { verseInput.value = "1"; capVerse(); });

  $("save").addEventListener("click", async () => {
    capVerse();
    const max = SURAH_VERSES[Number(surah.value) - 1];
    const v = Math.min(Math.max(Math.floor(Number(verseInput.value)) || 1, 1), max);
    verseInput.value = String(v);
    const body = { verseKey: surah.value + ":" + v, savedAt: Date.now() };
    const saved = $("saved");
    saved.hidden = false;
    try {
      const res = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 404) return showUnpaired();
      if (!res.ok) throw new Error("save failed");
      const winner = await res.json();
      store.set(CACHE, JSON.stringify(winner));
      show(winner);
      saved.textContent = "Saved. Your computer will open at " + winner.verseKey + " next time.";
    } catch (e) {
      saved.textContent = "Couldn't save. Check your connection and try again.";
    }
  });

  // ---- Adding to the home screen ----
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvent = null;
  if (!standalone) {
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) {
      $("install-text").textContent = "Tap the Share button, then Add to Home Screen. After that, one tap opens the Quran at your verse.";
      $("install").hidden = false;
    } else {
      // Android and others: offer a button when the browser says it can install this page.
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        installEvent = e;
        $("install-btn").hidden = false;
        $("install").hidden = false;
      });
    }
  }
  $("install-btn").addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $("install").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("install").hidden = true; });

  // ---- Start: show the last known place at once, then ask the server ----
  async function load() {
    const cached = store.get(CACHE);
    if (cached) {
      try { show(JSON.parse(cached)); } catch (e) { /* ignore a bad cache */ }
    }
    try {
      const res = await fetch(API, { cache: "no-store" });
      if (res.status === 404) { store.remove(CACHE); return showUnpaired(); }
      if (!res.ok) throw new Error("bad status");
      const place = await res.json();
      store.set(CACHE, JSON.stringify(place));
      $("offline").hidden = true;
      show(place);
    } catch (e) {
      if (!cached) show({ verseKey: null, savedAt: 0 });
      $("offline").hidden = false;
    }
  }

  // Coming back to the page after reading: check for a newer place.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  load();
})();
