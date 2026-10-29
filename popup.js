const INSTAGRAM_URL = "https://www.instagram.com/madebyhafiz/";

const $ = (id) => document.getElementById(id);

// Show the shortcut in words, with "Option" on a Mac (Chrome may return symbols like ⌥⇧Q there).
function prettyShortcut(s) {
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  const symbols = { "⌘": "Command", "⌥": "Option", "⇧": "Shift", "⌃": "Control" };
  if (/[⌘⌥⇧⌃]/.test(s)) {
    const parts = [];
    let key = "";
    for (const ch of s) {
      if (symbols[ch]) parts.push(symbols[ch]);
      else if (ch !== "+") key += ch;
    }
    return [...parts, key].filter(Boolean).join("+");
  }
  const words = s.split("+").map((w) => (isMac && w === "Alt" ? "Option" : isMac && w === "Ctrl" ? "Command" : w));
  return words.join("+");
}

async function render() {
  const { verseKey, wakeEnabled = true, startupEnabled = true, syncEnabled = true } =
    await chrome.storage.local.get(["verseKey", "wakeEnabled", "startupEnabled", "syncEnabled"]);
  $("wake").checked = wakeEnabled;
  $("startup").checked = startupEnabled;
  $("sync").checked = syncEnabled;

  // Some Chromium browsers (Ecosia, for one) do not offer the shortcuts API: hide the hint there.
  if (chrome.commands && chrome.commands.getAll) {
    const cmds = await chrome.commands.getAll();
    const open = cmds.find((c) => c.name === "open-quran");
    $("shortcut").textContent = open && open.shortcut ? `Shortcut ${prettyShortcut(open.shortcut)}` : "Set a shortcut";
  } else {
    $("shortcut").hidden = true;
  }

  const m = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (m && SURAH_NAMES[Number(m[1]) - 1]) {
    $("verse").textContent = `${m[1]}:${m[2]}`;
    $("verse-sub").textContent = `Surah ${SURAH_NAMES[Number(m[1]) - 1]}, verse ${m[2]}`;
  }
}

$("startup").addEventListener("change", (e) => chrome.storage.local.set({ startupEnabled: e.target.checked }));
$("sync").addEventListener("change", (e) => chrome.storage.local.set({ syncEnabled: e.target.checked }));
$("shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});
$("wake").addEventListener("change", (e) => chrome.storage.local.set({ wakeEnabled: e.target.checked }));

$("open").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "qr-open" });
  window.close();
});

// ---- On your phone ----
function phoneMessage(text) {
  $("phone-msg").textContent = text;
  $("phone-msg").hidden = !text;
}

const offlineText = "Can't reach the server. Check your connection and try again.";

// Draws the link as a QR code (dark squares on white, with the quiet border scanners need).
function drawQr(canvas, text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.floor((104 * dpr) / (n + quiet * 2)));
  const px = cell * (n + quiet * 2);
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
}

let phones = 0;
let codeUntil = 0; // while a link code is showing: when it expires
let watchTimer = null;

// Linked means a phone has joined. A pairing still waiting for its first phone
// shows as not linked, with its code if one is showing.
async function renderPhone() {
  const status = await chrome.runtime.sendMessage({ type: "qr-phone-status" });
  const linked = !!(status && status.linked && (status.offline || status.phones > 0));
  const showingCode = Date.now() < codeUntil;
  phones = (status && status.phones) || 0;
  $("phone-off").hidden = linked || showingCode;
  $("phone-on").hidden = !linked || showingCode;
  $("phone-code").hidden = !showingCode;
  $("phone-on-text").textContent = status && status.offline
    ? "Linked, but offline"
    : "Linked";
  return status;
}

async function showCode() {
  phoneMessage("");
  $("phone-link").disabled = $("phone-show").disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "qr-phone-code" });
  $("phone-link").disabled = $("phone-show").disabled = false;
  if (!result || !result.ok) {
    phoneMessage(result && result.offline ? offlineText : "Something went wrong. Please try again.");
    return;
  }
  const before = phones;
  codeUntil = result.expiresAt || Date.now() + 10 * 60 * 1000;
  $("code").textContent = result.linkCode.replace(/^(\d{3})(\d{3})$/, "$1 $2");
  drawQr($("qr"), `${PHONE_ORIGIN}/?link=${result.linkCode}`);
  await renderPhone();
  watchForPhone(before);
}

// While the code is showing, notice the phone joining, or the code running out.
function watchForPhone(before) {
  clearInterval(watchTimer);
  watchTimer = setInterval(async () => {
    const expired = Date.now() >= codeUntil;
    const status = await renderPhone();
    if (status && status.linked && status.phones > before) {
      codeUntil = 0;
      clearInterval(watchTimer);
      renderPhone();
    } else if (expired) {
      clearInterval(watchTimer);
      phoneMessage("The code expired. Get a new one when you're ready.");
    }
  }, 3000);
}

$("phone-link").addEventListener("click", showCode);

$("phone-show").addEventListener("click", showCode);

$("phone-stop").addEventListener("click", async () => {
  phoneMessage("");
  clearInterval(watchTimer);
  codeUntil = 0;
  $("phone-stop").disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "qr-phone-off" });
  $("phone-stop").disabled = false;
  if (result && result.ok) {
    renderPhone();
  } else {
    phoneMessage(offlineText);
  }
});

$("dev").addEventListener("click", () => {
  chrome.tabs.create({ url: INSTAGRAM_URL });
  window.close();
});

// A place synced in from the phone or another computer while the menu is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.verseKey) render();
});

render();
renderPhone();
