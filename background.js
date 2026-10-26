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

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.verseKey) {
    if (!(await chrome.alarms.get(SYNC_ALARM))) chrome.alarms.create(SYNC_ALARM, { delayInMinutes: 0.5 });
  } else if (area === "sync" && changes.verseKey) {
    pullFromSync();
  }
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
  const existing = await chrome.tabs.query({ url: QURAN_MATCH });
  let tabId;
  if (existing.length > 0) {
    // Keep the tab as it is (it already shows your place), just bring it forward.
    // If you read further on another computer, move it to that place first.
    tabId = existing[0].id;
    if (movedOnAnotherComputer) await chrome.tabs.update(tabId, { url: await getTargetUrl() });
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
  if (alarm.name === SYNC_ALARM) return pushToSync();
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

// The toolbar popup asks us to open the Quran at the last verse.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "qr-open") openQuran();
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
