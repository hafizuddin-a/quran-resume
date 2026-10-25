// Quran Resume - background service worker
//
// On browser startup: open (or reuse) a pinned quran.com tab at the last saved
// verse and make it the active tab. Session restore may finish after this runs
// and switch focus back to an old tab, so activation is retried a few times.

const QURAN_MATCH = "https://quran.com/*";
const DEFAULT_URL = "https://quran.com/1";

// Delay before touching tabs, so Ecosia's "continue where you left off" has a
// chance to restore its tabs first (lets us reuse a restored quran.com tab
// instead of opening a duplicate).
const STARTUP_DELAY_MS = 2000;

// Moments (ms after we create/reuse the tab) at which we re-assert focus.
const ACTIVATE_AT_MS = [0, 1500, 3500, 6000];

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

// ---- Once-a-day return to the Quran after sleep or a long break ----
//
// The first time you come back after a break (laptop lid opened, screen unlocked,
// or simply 15+ minutes away) on a calendar day, bring the Quran tab to the front.
// Later returns that day are left alone. Can be switched off on the options page.

const AWAY_SECONDS = 15 * 60; // how long counts as "away"
const TICK_ALARM = "qr-tick";

function todayKey() {
  const d = new Date(); // local calendar day, not a rolling 24 hours
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function markToday() {
  await chrome.storage.local.set({ lastOpenDay: todayKey() });
}

async function focusQuranOnce() {
  const { wakeEnabled = true, lastOpenDay } = await chrome.storage.local.get(["wakeEnabled", "lastOpenDay"]);
  if (!wakeEnabled || lastOpenDay === todayKey()) return;
  await markToday();
  const existing = await chrome.tabs.query({ url: QURAN_MATCH });
  if (existing.length > 0) {
    // Keep the tab as it is (it already shows your place), just bring it forward.
    await activate(existing[0].id);
  } else {
    await openQuran();
  }
}

function setUpWakeDetection() {
  chrome.idle.setDetectionInterval(AWAY_SECONDS);
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
}

// Screen unlock / back from idle.
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "active") focusQuranOnce();
});

// Sleep detection that needs no lock screen: the 1-minute timer stops while the
// laptop sleeps, so a large gap between ticks means we just woke up.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TICK_ALARM) return;
  const { lastTick } = await chrome.storage.local.get("lastTick");
  const now = Date.now();
  await chrome.storage.local.set({ lastTick: now });
  if (lastTick && now - lastTick > AWAY_SECONDS * 1000) focusQuranOnce();
});

chrome.runtime.onInstalled.addListener(setUpWakeDetection);

chrome.runtime.onStartup.addListener(async () => {
  setUpWakeDetection();
  await sleep(STARTUP_DELAY_MS);
  await markToday(); // startup already opened the Quran for today
  await openQuran();
});

// Clicking the toolbar icon runs the same flow, handy for testing without
// restarting the browser.
chrome.action.onClicked.addListener(() => {
  openQuran();
});
