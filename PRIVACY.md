# Privacy Policy

**Quran Resume** does not collect, sell, or share any personal data. It sends nothing over the
network unless you turn on the optional phone link, described below.

## What the extension stores

The only thing it saves is the **last verse you were reading** (for example
`2:9`) and the time it was saved. This is kept in your browser's local extension
storage (`chrome.storage.local`) on your own device. The extension itself never
sends it anywhere. If "Sync my place" is on (the default) and you use Chrome sync,
Chrome also keeps a copy in `chrome.storage.sync`, which Chrome syncs to your other
signed-in browsers through your Google account. Turn this off in the toolbar menu.

## Phone link (optional, off by default)

If you choose **Link your phone** in the toolbar menu, the extension starts using the Quran Resume
server (quran-resume.hello-hafiz.workers.dev, run on Cloudflare). It needs no extra browser permission
for this. While the link is on:

- It sends your last verse, the time it was saved, and a random pairing code to that server, and
  reads back the newest place saved by your linked phone. Nothing else is sent: no account, name,
  email, browsing history or other tabs.
- The pairing code is created by the server and kept in the extension's local storage. It is not
  tied to your identity. A 6-digit code shown in the menu lets a phone join; it works once, for 10
  minutes.
- **Unlink** in the toolbar menu deletes your place and pairing from the server. A pairing that no
  phone joins is deleted automatically after a day. Removing the extension stops all sync but does
  not delete the server copy, so unlink first if you want it gone.
- To stop abuse (such as guessing link codes), the server counts wrong link codes per internet (IP)
  address. Those counts are kept for at most an hour and are not linked to your place.

## The Quran Resume phone app

The phone app (quran-resume.hello-hafiz.workers.dev) keeps your place and reading settings on the
phone itself. It loads Quran text from the Quran Foundation (api.quran.com) and fonts from Google
Fonts and the same server. If you turn on daily reminders, the server stores a random id for the
phone, its push address (from the browser's push service), your three reminder times, your time zone
and which reminders were sent or acknowledged today. Turning reminders off stops them; the phone
link works as described above.

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
- No network requests of its own unless you turn on the phone link, and no remote code.
- No accounts or sign-in.

## Your control

Remove the extension at any time and its stored data is deleted with it.

## Contact

Questions: open an issue on the project's GitHub repository.

The settings (the on/off switch for the once-a-day return, and whether to show its prompt) are on the extension's options page.

The toolbar menu has a "Talk to the developer" link that opens the developer's Instagram page in a new tab. It is a plain link; the extension sends nothing.

_Last updated: 29 October 2026 (version 1.6.0)_
