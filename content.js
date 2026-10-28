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

  // Flush immediately when the tab is hidden or closed, and have a linked phone
  // get it now rather than after the usual few seconds.
  function flush() {
    if (saveTimer !== null) clearTimeout(saveTimer);
    save();
    try {
      chrome.runtime.sendMessage({ type: "qr-phone-push" }).catch(() => {});
    } catch (err) {
      // Extension was reloaded while this page was open; ignore.
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
})();

// Prompt shown by the extension after its once-a-day return to the Quran, with a
// switch to turn that behaviour off.
(() => {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "qr-wake-prompt") showPrompt();
  });

  async function showPrompt() {
    if (document.getElementById("quran-resume-prompt")) return;
    const { wakeEnabled = true } = await chrome.storage.local.get("wakeEnabled");

    const host = document.createElement("div");
    host.id = "quran-resume-prompt";
    host.style.cssText = "position:fixed;top:8px;right:16px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    const icon = chrome.runtime.getURL("icons/icon32.png");
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .card { box-sizing: border-box; width: 320px; padding: 16px 20px 12px; border-radius: 12px;
                font: 13px/20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
                background: #fff; color: #1f1f1f; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.28); }
        .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .head img { width: 20px; height: 20px; border-radius: 4px; }
        .name { flex: 1; font-size: 15px; font-weight: 500; line-height: 22px; }
        .close { all: unset; cursor: pointer; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #444746; }
        .close:hover { background: rgba(0,0,0,.08); }
        .close svg { width: 16px; height: 16px; }
        p { margin: 0 0 14px; color: #444746; }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .toggle { position: relative; width: 34px; height: 20px; flex: none; }
        .toggle input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
        .track { position: absolute; left: 0; right: 0; top: 3px; height: 14px; border-radius: 7px; background: #c4c7c5; transition: background .15s; }
        .knob { position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; background: #747775;
                box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform .15s, background .15s; }
        input:checked ~ .track { background: #a8c7fa; }
        input:checked ~ .knob { background: #0b57d0; transform: translateX(14px); }
        input:focus-visible ~ .knob { outline: 2px solid #0b57d0; outline-offset: 2px; }
        .actions { display: flex; justify-content: flex-end; margin: 8px -8px 0 0; }
        .link { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 16px; color: #0b57d0; font-weight: 500; }
        .link:hover { background: rgba(11,87,208,.08); }
        @media (prefers-color-scheme: dark) {
          .card { background: #2d2e30; color: #e3e3e3; box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 4px 16px rgba(0,0,0,.6); }
          p { color: #c4c7c5; } .close { color: #c4c7c5; } .close:hover { background: rgba(255,255,255,.12); }
          .track { background: #5f6368; } .knob { background: #9aa0a6; }
          input:checked ~ .track { background: #0842a0; } input:checked ~ .knob { background: #a8c7fa; }
          .link { color: #a8c7fa; } .link:hover { background: rgba(168,199,250,.12); }
        }
      </style>
      <div class="card" role="dialog" aria-label="Quran Resume">
        <div class="head">
          <img src="${icon}" alt="">
          <div class="name">Quran Resume</div>
          <button class="close" aria-label="Close"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg></button>
        </div>
        <p>Opened after your computer woke from sleep, once a day. It also opens whenever Chrome starts.</p>
        <label class="row"><span>Open once a day after sleep</span>
          <span class="toggle"><input type="checkbox"><span class="track"></span><span class="knob"></span></span></label>
        <div class="actions"><button class="link" id="never">Don't ask again</button></div>
      </div>`;
    const box = root.querySelector("input");
    box.checked = wakeEnabled;
    box.addEventListener("change", () => chrome.storage.local.set({ wakeEnabled: box.checked }));
    root.querySelector(".close").addEventListener("click", () => host.remove());
    // Keep the once-a-day behaviour as it is, but stop showing this prompt.
    root.getElementById("never").addEventListener("click", () => {
      chrome.storage.local.set({ wakePromptHidden: true });
      host.remove();
    });
    (document.body || document.documentElement).appendChild(host);
    setTimeout(() => host.remove(), 20000);
  }
})();
