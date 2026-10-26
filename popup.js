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

$("dev").addEventListener("click", () => {
  chrome.tabs.create({ url: INSTAGRAM_URL });
  window.close();
});

render();
