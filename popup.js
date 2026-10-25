const INSTAGRAM_URL = "https://www.instagram.com/madebyhafiz/";

const $ = (id) => document.getElementById(id);

async function render() {
  const { verseKey, wakeEnabled = true } = await chrome.storage.local.get(["verseKey", "wakeEnabled"]);
  $("wake").checked = wakeEnabled;

  const m = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (m && SURAH_NAMES[Number(m[1]) - 1]) {
    $("verse").textContent = `${m[1]}:${m[2]}`;
    $("verse-sub").textContent = `Surah ${SURAH_NAMES[Number(m[1]) - 1]}, verse ${m[2]}`;
  }
}

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
