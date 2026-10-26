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
const PHONE_PERMISSION = { origins: [PHONE_ORIGIN + "/*"] };
const canAskPermission = !!(chrome.permissions && chrome.permissions.request && chrome.permissions.contains);

function phoneMessage(text) {
  $("phone-msg").textContent = text;
  $("phone-msg").hidden = !text;
}

// Draws the link as a QR code (dark squares on white, with the quiet border scanners need).
function drawQr(canvas, text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.floor((120 * dpr) / (n + quiet * 2)));
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

let phoneUrl = "";

async function renderPhone() {
  if (!canAskPermission) {
    $("phone").hidden = true;
    $("phone-sep").hidden = true;
    return;
  }
  const { phoneOn = false, phoneCode } = await chrome.storage.local.get(["phoneOn", "phoneCode"]);
  let granted = false;
  try { granted = await chrome.permissions.contains(PHONE_PERMISSION); } catch (e) { /* ignore */ }
  const on = !!(phoneOn && phoneCode && granted);

  // Set up on another computer? Then this one only needs to join.
  let elsewhere = false;
  if (!on) {
    try { elsewhere = !!(await chrome.storage.sync.get("phoneCode")).phoneCode; } catch (e) { /* ignore */ }
  }
  $("phone-off").hidden = on;
  $("phone-on").hidden = !on;
  $("phone-start").disabled = false;
  $("phone-off-text").textContent = elsewhere
    ? "Your phone is set up from another computer. Turn it on here too, so this computer carries on from your phone."
    : "Open the Quran on your phone at the verse where you stopped.";
  $("phone-start").textContent = elsewhere ? "Turn on here" : "Get it on your phone";
  if (on) {
    phoneUrl = `${PHONE_ORIGIN}/p/${phoneCode}`;
    drawQr($("qr"), phoneUrl);
  }
}

$("phone-start").addEventListener("click", async () => {
  phoneMessage("");
  $("phone-start").disabled = true;
  // Both calls go out straight away, before anything is awaited, so Chrome still counts the click.
  // If the permission prompt closes this menu, the background script finishes the pairing.
  chrome.storage.local.set({ phoneWanted: true });
  let granted = false;
  try { granted = await chrome.permissions.request(PHONE_PERMISSION); } catch (e) { /* ignore */ }
  if (!granted) {
    chrome.storage.local.remove("phoneWanted");
    phoneMessage("Without that permission the phone link can't work. You can try again any time.");
    $("phone-start").disabled = false;
    return;
  }
  const result = await chrome.runtime.sendMessage({ type: "qr-phone-enable" });
  if (result && result.ok) {
    renderPhone();
  } else {
    phoneMessage(result && result.error === "offline"
      ? "Couldn't reach the server. Check your connection and try again."
      : "Something went wrong on the server. Please try again later.");
    $("phone-start").disabled = false;
  }
});

$("phone-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(phoneUrl);
    $("phone-copy").textContent = "Copied";
    setTimeout(() => { $("phone-copy").textContent = "Copy link"; }, 1500);
  } catch (e) {
    phoneMessage("Couldn't copy. Scan the code instead.");
  }
});

$("phone-stop").addEventListener("click", async () => {
  phoneMessage("");
  $("phone-stop").disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "qr-phone-disable" });
  $("phone-stop").disabled = false;
  if (result && result.ok) {
    renderPhone();
  } else {
    phoneMessage("Couldn't reach the server to delete your place. Try again when you're online.");
  }
});

$("dev").addEventListener("click", () => {
  chrome.tabs.create({ url: INSTAGRAM_URL });
  window.close();
});

render();
renderPhone();
