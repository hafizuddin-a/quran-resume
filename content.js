// Quran Resume - content script (runs on quran.com)
//
// Continuously records the verse nearest the top of the screen to
// chrome.storage.local, so the position survives however the tab is closed.
//
// Saving only starts after you interact (scroll, key, click, touch). Without
// this, a freshly restored tab sitting at an old position would overwrite your
// real saved verse the moment it loads.

(() => {
  const VERSE_SELECTOR = "[data-verse-key]";
  const SAVE_THROTTLE_MS = 400;
  // A verse counts as "current" once its top edge is within this band from the
  // top of the viewport (leaves room for quran.com's sticky header).
  const TOP_BAND_PX = 140;

  let armed = false;
  let lastSaved = null;
  let saveTimer = null;

  function isVerseKey(value) {
    return /^\d{1,3}:\d{1,3}$/.test(value || "");
  }

  // Find the verse nearest the top of the viewport.
  function currentVerseFromDom() {
    const nodes = document.querySelectorAll(VERSE_SELECTOR);
    let best = null;
    let bestDistance = Infinity;
    for (const node of nodes) {
      const key = node.getAttribute("data-verse-key");
      if (!isVerseKey(key)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < TOP_BAND_PX) continue; // fully scrolled past
      const distance = Math.abs(rect.top - TOP_BAND_PX);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = key;
      }
    }
    return best;
  }

  // Fallback: a URL like /2/255 or /2:255 names a verse directly.
  function currentVerseFromUrl() {
    const m = /^\/(\d{1,3})(?:[/:](\d{1,3}))?\/?$/.exec(location.pathname);
    if (m && m[2]) return `${m[1]}:${m[2]}`;
    return null;
  }

  function save() {
    saveTimer = null;
    if (!armed) return;
    const key = currentVerseFromDom() || currentVerseFromUrl();
    if (!key || key === lastSaved) return;
    lastSaved = key;
    try {
      chrome.storage.local.set({ verseKey: key, savedAt: Date.now() });
    } catch (err) {
      // Extension was reloaded while this page was open; ignore.
    }
  }

  function scheduleSave() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(save, SAVE_THROTTLE_MS);
  }

  function arm() {
    if (armed) return;
    armed = true;
    scheduleSave();
  }

  // User intent signals that arm saving.
  for (const evt of ["wheel", "touchmove", "keydown", "mousedown"]) {
    window.addEventListener(evt, arm, { passive: true, capture: true });
  }

  // Positions change on scroll (including the long scrollable verse list).
  window.addEventListener("scroll", scheduleSave, { passive: true, capture: true });

  // Flush immediately when the tab is hidden or closed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (saveTimer !== null) clearTimeout(saveTimer);
      save();
    }
  });
  window.addEventListener("pagehide", () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    save();
  });
})();
