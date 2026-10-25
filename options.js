const box = document.getElementById("wake");
chrome.storage.local.get("wakeEnabled").then(({ wakeEnabled = true }) => {
  box.checked = wakeEnabled;
});
box.addEventListener("change", () => chrome.storage.local.set({ wakeEnabled: box.checked }));
