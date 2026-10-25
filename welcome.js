const surah = document.getElementById("surah");
const verse = document.getElementById("verse");
const saved = document.getElementById("saved");

SURAH_NAMES.forEach((name, i) => {
  const o = document.createElement("option");
  o.value = String(i + 1);
  o.textContent = `${i + 1}. ${name}`;
  surah.appendChild(o);
});

function clampVerse() {
  const max = SURAH_VERSES[Number(surah.value) - 1];
  verse.max = String(max);
  let v = Math.floor(Number(verse.value)) || 1;
  v = Math.min(Math.max(v, 1), max);
  verse.value = String(v);
  return v;
}

async function savePlace() {
  const v = clampVerse();
  const key = `${surah.value}:${v}`;
  await chrome.storage.local.set({ verseKey: key, savedAt: Date.now() });
  saved.hidden = false;
  saved.textContent = `Saved. Your Quran will open at Surah ${SURAH_NAMES[Number(surah.value) - 1]}, verse ${v}.`;
}

surah.addEventListener("change", () => { verse.value = "1"; savePlace(); });
verse.addEventListener("change", savePlace);

document.getElementById("open").addEventListener("click", async () => {
  await savePlace();
  await chrome.runtime.sendMessage({ type: "qr-open" });
});

// Start from whatever is already saved (nothing on a fresh install: Al-Fatihah).
chrome.storage.local.get("verseKey").then(({ verseKey }) => {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (m && SURAH_NAMES[Number(m[1]) - 1]) {
    surah.value = m[1];
    verse.value = m[2];
  }
  clampVerse();
});
