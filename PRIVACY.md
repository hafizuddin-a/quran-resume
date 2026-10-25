# Privacy Policy

**Quran Resume** does not collect, transmit, sell, or share any personal data.

## What the extension stores

The only thing it saves is the **last verse you were reading** (for example
`2:9`) and the time it was saved. This is kept in your browser's local extension
storage (`chrome.storage.local`) on your own device. It is never sent anywhere.

## What the extension accesses

- **quran.com pages:** a content script reads which verse is near the top of the
  screen so it can remember your place. It does not read your account, your
  notes, bookmarks, or anything else on the page.
- **Idle state and a timer:** it checks whether the computer was asleep, locked or
  idle for 15+ minutes so it can bring the Quran tab forward once a day. This is
  used only for that, never stored beyond today's date, and never sent anywhere.
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

The one setting (the on/off switch for the return-from-break behaviour) is on the extension's options page.

_Last updated: 25 October 2026_
