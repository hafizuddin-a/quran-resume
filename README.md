# Quran Resume

<img src="icons/icon128.png" alt="Quran Resume logo" width="96" align="right">

A small browser extension that opens [quran.com](https://quran.com) as a pinned,
focused tab every time your browser starts, scrolled to the verse where you last
stopped reading.

Works in Chrome and other Chromium browsers (Edge, Brave, Ecosia, and so on).

## Features

- Opens the **whole surah** at your last verse, not a single-verse view.
- Remembers your place automatically as you scroll, so it survives however you
  close the tab or the browser.
- Reuses an existing quran.com tab if your browser restored one, instead of
  opening a duplicate.
- Re-asserts focus for a few seconds after startup, so the Quran tab is the one
  you see even when "continue where you left off" restores other tabs.
- Click the toolbar icon to jump to your last verse any time.
- No accounts, no analytics, no network requests of its own. See [PRIVACY.md](PRIVACY.md).

## Install

**From the Chrome Web Store:** link coming once it is listed.

**From source:**

1. Clone or download this repository.
2. Open `chrome://extensions` (or `ecosia://extensions`, `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.

## How it works

- `content.js` runs on quran.com and records the verse nearest the top of the
  screen (from the page's `data-verse-key` attributes, falling back to the URL)
  into `chrome.storage.local`. It only starts saving after you scroll, press a
  key, click, or touch, so a restored-but-untouched tab never overwrites your
  real position.
- `background.js` runs on browser startup, waits about 2 seconds for tab restore
  to finish, then reuses or creates a pinned quran.com tab at
  `https://quran.com/<surah>?startingVerse=<verse>` and re-activates it at 0, 1.5,
  3.5, and 6 seconds in case session restore tries to refocus another tab.

## If it stops tracking verses

quran.com can change its markup. The thing to adjust is `VERSE_SELECTOR` at the
top of `content.js`. Please open an issue if it breaks.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save the last verse locally. |
| `https://quran.com/*` | Read the current verse on quran.com pages, and find, open, or focus the quran.com tab. |

## Packaging for the Chrome Web Store

```sh
zip -r quran-resume-store.zip manifest.json background.js content.js icons
```

The `store/` folder (listing text and promo tile) is deliberately left out of
the package.

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by, or
sponsored by Quran.com or the Quran Foundation. The logo here is an original
design and is not derived from theirs.

The lettering in the logo (the word القرآن, "Al-Quran") is outlined from the
[Aref Ruqaa](https://fonts.google.com/specimen/Aref+Ruqaa) typeface, which is
licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).

## License

[MIT](LICENSE)
