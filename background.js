// Quran Resume - background service worker
//
// On browser startup: open (or reuse) a pinned quran.com tab at the last saved
// verse and make it the active tab. Session restore may finish after this runs
// and switch focus back to an old tab, so activation is retried a few times.

importScripts("config.js");

const QURAN_MATCH = "https://quran.com/*";
const DEFAULT_URL = "https://quran.com/1";

// Delay before touching tabs, so Ecosia's "continue where you left off" has a
// chance to restore its tabs first (lets us reuse a restored quran.com tab
// instead of opening a duplicate).
const STARTUP_DELAY_MS = 2000;

// Moments (ms after we create/reuse the tab) at which we re-assert focus. Kept short so
// it never fights you if you click another tab right after the browser starts.
const ACTIVATE_AT_MS = [0, 1200];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function urlForVerse(verseKey) {
  // verseKey looks like "2:255"
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (!match) return DEFAULT_URL;
  // ?startingVerse= opens the whole surah positioned at that verse
  // (plain /2/9 opens a single-verse view instead).
  return `https://quran.com/${match[1]}?startingVerse=${match[2]}`;
}

async function getTargetUrl() {
  const { verseKey } = await chrome.storage.local.get("verseKey");
  return urlForVerse(verseKey);
}

async function activate(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch (err) {
    // Tab may have been closed by the user; nothing to do.
  }
}

async function openQuran() {
  await pullFromSync();
  await withTimeout(syncWithPhone(), 2500);
  const url = await getTargetUrl();
  const existing = await chrome.tabs.query({ url: QURAN_MATCH });

  let tabId;
  if (existing.length > 0) {
    // Reuse a restored quran.com tab, point it at the saved verse.
    tabId = existing[0].id;
    await chrome.tabs.update(tabId, { url, pinned: true, active: true });
  } else {
    const tab = await chrome.tabs.create({ url, pinned: true, active: true });
    tabId = tab.id;
  }

  // Re-assert focus a few times in case session restore steals it back.
  let elapsed = 0;
  for (const at of ACTIVATE_AT_MS) {
    await sleep(at - elapsed);
    elapsed = at;
    await activate(tabId);
  }
}

// ---- Sync the last verse across computers (chrome.storage.sync) ----
//
// The newest save wins. Pushes are delayed and merged by an alarm so scrolling
// never hits Chrome's sync write limits. Needs Chrome sync to be turned on;
// otherwise the data simply stays on this computer.

const SYNC_ALARM = "qr-sync-push";

async function syncIsOn() {
  const { syncEnabled = true } = await chrome.storage.local.get("syncEnabled");
  return syncEnabled;
}

async function pushToSync() {
  try {
    if (!(await syncIsOn())) return;
    const { verseKey, savedAt = 0 } = await chrome.storage.local.get(["verseKey", "savedAt"]);
    if (!verseKey) return;
    const remote = await chrome.storage.sync.get(["verseKey", "savedAt"]);
    if ((remote.savedAt || 0) >= savedAt) return;
    await chrome.storage.sync.set({ verseKey, savedAt });
  } catch (err) {
    // Sync unavailable or over quota: keep working locally.
  }
}

// Returns true if a newer place from another computer was applied.
async function pullFromSync() {
  try {
    if (!(await syncIsOn())) return false;
    const { verseKey, savedAt = 0 } = await chrome.storage.local.get(["verseKey", "savedAt"]);
    const remote = await chrome.storage.sync.get(["verseKey", "savedAt"]);
    if (remote.verseKey && (remote.savedAt || 0) > savedAt && remote.verseKey !== verseKey) {
      await chrome.storage.local.set({ verseKey: remote.verseKey, savedAt: remote.savedAt });
      return true;
    }
  } catch (err) {
    // ignore
  }
  return false;
}

// ---- Phone link (optional, off by default) ----
//
// Shares your last verse with the Quran Resume phone app through the server at
// PHONE_ORIGIN, newest save wins. Nothing is sent until you link a phone from the
// toolbar menu. The server allows the calls itself (CORS), so no permission is needed.

const withTimeout = (promise, ms) => Promise.race([promise, sleep(ms).then(() => false)]);

async function phoneApi(path, body) {
  const res = await fetch(`${PHONE_ORIGIN}/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || String(res.status)), { status: res.status });
  return out;
}

async function linkedPhoneCode() {
  const { phoneCode } = await chrome.storage.local.get("phoneCode");
  return phoneCode || null;
}

// Sends this computer's place and takes the phone's if it is newer.
// Returns true if a newer place from the phone was applied.
async function syncWithPhone() {
  const code = await linkedPhoneCode();
  if (!code) return false;
  try {
    const { verseKey, savedAt = 0 } = await chrome.storage.local.get(["verseKey", "savedAt"]);
    const { place } = await phoneApi("sync", verseKey && savedAt ? { code, verseKey, savedAt } : { code });
    if (place && place.savedAt > savedAt && place.verseKey !== verseKey) {
      await chrome.storage.local.set({ verseKey: place.verseKey, savedAt: place.savedAt });
      // Move any open quran.com tab too, whatever noticed the change (menu, tab
      // switch, wake): reading on in a tab left at the old place would save over it.
      const url = urlForVerse(place.verseKey);
      for (const tab of await chrome.tabs.query({ url: QURAN_MATCH })) chrome.tabs.update(tab.id, { url });
      return true;
    }
  } catch (err) {
    if (err.status === 404) await chrome.storage.local.remove("phoneCode"); // the link was turned off
  }
  return false;
}

// Starts a pairing if needed and returns a 6-digit code for a phone to join with.
async function phoneLinkCode() {
  const { phoneCode, verseKey, savedAt = 0 } = await chrome.storage.local.get(["phoneCode", "verseKey", "savedAt"]);
  if (phoneCode) {
    try {
      return await phoneApi("pair/link-code", { code: phoneCode });
    } catch (err) {
      if (err.status !== 404) throw err; // 404: turned off elsewhere, so pair again below
    }
  }
  const out = await phoneApi("pair", verseKey && savedAt ? { verseKey, savedAt } : {});
  await chrome.storage.local.set({ phoneCode: out.code });
  return { linkCode: out.linkCode, expiresAt: out.expiresAt };
}

// Also takes a newer place from the phone, so the menu shows where you really are.
async function phoneStatus() {
  const code = await linkedPhoneCode();
  if (!code) return { linked: false };
  try {
    await syncWithPhone();
    const { phones } = await phoneApi("sync", { code });
    return { linked: true, phones };
  } catch (err) {
    if (err.status === 404) {
      await chrome.storage.local.remove("phoneCode");
      return { linked: false };
    }
    return { linked: true, offline: true };
  }
}

// Turning off deletes the place from the server.
async function unlinkPhone() {
  const { phoneCode } = await chrome.storage.local.get("phoneCode");
  if (phoneCode) {
    try {
      await phoneApi("unpair", { code: phoneCode });
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }
  await chrome.storage.local.remove("phoneCode");
}

// The phone link is event-driven, never polled: it sends 3 seconds after you
// stop on a verse, at once when you leave the quran.com tab, and checks the
// phone when you open the menu or come back to the tab. That is about one
// request per verse read, however many people use it. (The 30-second sync
// alarm below is the fallback if the service worker is stopped first.)
let phonePushTimer = null;
function phonePushSoon() {
  clearTimeout(phonePushTimer);
  phonePushTimer = setTimeout(syncWithPhone, 3000);
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.verseKey) {
    phonePushSoon();
    if (!(await chrome.alarms.get(SYNC_ALARM))) chrome.alarms.create(SYNC_ALARM, { delayInMinutes: 0.5 });
  } else if (area === "sync" && changes.verseKey) {
    pullFromSync();
  }
});

// Coming back to the Quran tab, or to the browser while it's showing, picks up
// a place read since on the phone and moves the tab there. At most every 10 s.
let lastPhoneCheck = 0;
async function checkPhoneForTab(tab) {
  if (!tab || !/^https:\/\/quran\.com\//.test(tab.url || "") || Date.now() - lastPhoneCheck < 10000) return;
  lastPhoneCheck = Date.now();
  syncWithPhone(); // moves the tab itself if the phone is ahead
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { checkPhoneForTab(await chrome.tabs.get(tabId)); } catch (err) { /* tab gone */ }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    checkPhoneForTab(tab);
  } catch (err) { /* ignore */ }
});


// ---- Once-a-day return to the Quran after the computer wakes ----
//
// The first time each calendar day that the computer wakes from sleep or is
// unlocked while the browser is open, bring the Quran tab to the front and show a
// small prompt on it with a switch to turn this off. Later wakes that day are left
// alone. On by default; also switchable on the options page.

const SLEEP_GAP_MS = 150 * 1000; // the 1-minute timer missing by this much means the computer slept
const TICK_ALARM = "qr-tick";

function todayKey() {
  const d = new Date(); // local calendar day, not a rolling 24 hours
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function markToday() {
  await chrome.storage.local.set({ lastOpenDay: todayKey() });
}

// Ask the content script on the Quran page to show the prompt. A newly opened
// tab may not have its script ready yet, so retry briefly.
async function showWakePrompt(tabId) {
  for (let i = 0; i < 12; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "qr-wake-prompt" });
      return;
    } catch (err) {
      await sleep(1000);
    }
  }
}

async function focusQuranOnce() {
  const { wakeEnabled = true, lastOpenDay } = await chrome.storage.local.get(["wakeEnabled", "lastOpenDay"]);
  if (!wakeEnabled || lastOpenDay === todayKey()) return;
  await markToday();
  const movedOnAnotherComputer = await pullFromSync();
  await withTimeout(syncWithPhone(), 2500);
  const existing = await chrome.tabs.query({ url: QURAN_MATCH });
  let tabId;
  if (existing.length > 0) {
    // Keep the tab as it is (it already shows your place), just bring it forward.
    // If you read further on another computer or your phone, move it to that place first.
    tabId = existing[0].id;
    if (movedOnAnotherComputer) await chrome.tabs.update(tabId, { url: await getTargetUrl() }); // syncWithPhone moved it already for the phone
    await activate(tabId);
  } else {
    await openQuran();
    tabId = (await chrome.tabs.query({ url: QURAN_MATCH }))[0]?.id;
  }
  const { wakePromptHidden } = await chrome.storage.local.get("wakePromptHidden");
  if (tabId !== undefined && !wakePromptHidden) await showWakePrompt(tabId);
}

function setUpWakeDetection() {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
}

// Screen unlocked (covers a lid close that locks the screen).
chrome.idle.onStateChanged.addListener(async (state) => {
  const { idleState } = await chrome.storage.local.get("idleState");
  await chrome.storage.local.set({ idleState: state });
  if (state === "active" && idleState === "locked") focusQuranOnce();
});

// Sleep without a lock screen: the 1-minute timer stops while the computer
// sleeps, so a gap between ticks means it just woke up.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM) return Promise.all([pushToSync(), syncWithPhone()]);
  if (alarm.name !== TICK_ALARM) return;
  const { lastTick } = await chrome.storage.local.get("lastTick");
  const now = Date.now();
  await chrome.storage.local.set({ lastTick: now });
  if (lastTick && now - lastTick > SLEEP_GAP_MS) focusQuranOnce();
});

chrome.runtime.onInstalled.addListener(setUpWakeDetection);

chrome.runtime.onStartup.addListener(async () => {
  setUpWakeDetection();
  const { startupEnabled = true } = await chrome.storage.local.get("startupEnabled");
  if (!startupEnabled) return;
  await sleep(STARTUP_DELAY_MS);
  await markToday(); // startup already opened the Quran for today
  await openQuran();
});

// The toolbar popup asks us to open the Quran at the last verse, or to manage the phone link.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "qr-open") openQuran();
  if (msg.type === "qr-phone-push") {
    // A moment's delay lets the tab's final save land in storage first.
    clearTimeout(phonePushTimer);
    phonePushTimer = setTimeout(syncWithPhone, 300);
    return;
  }
  const phone = { "qr-phone-code": phoneLinkCode, "qr-phone-status": phoneStatus, "qr-phone-off": unlinkPhone }[msg.type];
  if (!phone) return;
  phone()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, offline: !err.status, error: err.message }));
  return true; // answer asynchronously
});

// Keyboard shortcut (default Alt+Shift+Q, changeable at chrome://extensions/shortcuts).
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-quran") openQuran();
  });
}

// First install: open a short welcome page (not on updates).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
