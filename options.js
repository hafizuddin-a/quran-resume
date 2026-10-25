const box = document.getElementById("wake");
chrome.storage.local.get("wakeEnabled").then(({ wakeEnabled = true }) => {
  box.checked = wakeEnabled;
});
box.addEventListener("change", () => chrome.storage.local.set({ wakeEnabled: box.checked }));

const promptBox = document.getElementById("prompt");
chrome.storage.local.get("wakePromptHidden").then(({ wakePromptHidden }) => {
  promptBox.checked = !wakePromptHidden;
});
promptBox.addEventListener("change", () => chrome.storage.local.set({ wakePromptHidden: !promptBox.checked }));
