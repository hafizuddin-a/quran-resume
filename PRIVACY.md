# Privacy Policy

**Quran Resume** does not collect, transmit, sell, or share any personal data.

## What the extension stores

The only thing it saves is the **last verse you were reading** (for example
`2:9`) and the time it was saved. This is kept in your browser's local extension
storage (`chrome.storage.local`) on your own device. The extension itself never
sends it anywhere. If "Sync my place" is on (the default) and you use Chrome sync,
Chrome also keeps a copy in `chrome.storage.sync`, which Chrome syncs to your other
signed-in browsers through your Google account. Turn this off in the toolbar menu.

## What the extension accesses

- **quran.com pages:** a content script reads which verse is near the top of the
  screen so it can remember your place. It does not read your account, your
  notes, bookmarks, or anything else on the page.
- **Unlock and sleep detection:** it notices when the screen is unlocked or the
  computer wakes from sleep, so it can bring the Quran tab forward once a day. Only
  the date of the last time it did so is stored. Nothing is sent anywhere.
- **Browser tabs:** on startup it looks for an open quran.com tab and opens or
  focuses one. It does not read or record any other tab.

## What the extension does not do

- No analytics, tracking, advertising, or telemetry.
- No network requests of its own, and no remote code.
- No accounts or sign-in.

## Your control

Remove the extension at any time and its stored data is deleted with it.

## Contact

Questions: open an issue on the project's GitHub repository.

The settings (the on/off switch for the once-a-day return, and whether to show its prompt) are on the extension's options page.

The toolbar menu has a "Talk to the developer" link that opens the developer's Instagram page in a new tab. It is a plain link; the extension sends nothing.

_Last updated: 26 October 2026_
