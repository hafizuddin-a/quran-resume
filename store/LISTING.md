# Chrome Web Store listing

Copy these into the Developer Dashboard. Nothing here is submitted automatically.

## Name
Quran Resume

## Summary (max 132 characters)
Opens quran.com at the verse you stopped on, every time your browser starts.

## Category
Lifestyle (or Productivity)

## Language
English

## Description

Quran Resume opens quran.com for you every time your browser starts, as a pinned
tab scrolled to the verse where you last stopped reading.

How it works:
- Read on quran.com as normal. Your position is saved automatically as you scroll.
- Next time your browser starts, the Quran tab opens, focused, at your last verse.
- It opens the whole surah at that verse, so you can keep reading in either direction.
- If your browser restores your old tabs on startup, Quran Resume reuses an existing
  quran.com tab rather than opening a duplicate, and keeps focus on it.
- Once a day, the first time your computer wakes or is unlocked with the browser open, the Quran tab comes to the front and a small prompt offers a switch to turn this off, or to stop showing the prompt. It is on by default.
- On install, a short welcome page lets you pick your starting surah and verse.
- Press Alt+Shift+Q (Option+Shift+Q on a Mac) to jump to your last verse from anywhere (you can change the shortcut).
- Your place can follow you to your other computers through Chrome sync (switch in the menu).
- Optional: press "Get it on your phone" in the menu and scan a QR code. Your phone then opens quran.com at your last verse, and your place follows you between your phone and your computer. Off until you turn it on.
- Click the toolbar icon for a menu: your last chapter and verse, an Open Quran button, the once-a-day switch, and a link to message the developer.

Private by design:
- Your last verse is stored only on your device, in your browser's extension storage.
- No accounts, no analytics, no tracking, and no network requests unless you turn on the optional phone link (then only your last verse and its time are sent, under a random code).
- Open source (MIT): the full code is on GitHub.

Quran Resume is an independent project and is not affiliated with Quran.com or the
Quran Foundation.

## Single purpose
Reopen quran.com at the user's last-read verse when the browser starts.

## Permission justifications

**storage**
Stores the last-read verse (for example "2:9") and a few on/off settings locally, and in Chrome sync if the user leaves "Sync my place" on, so it can be restored on the next browser startup and on the user's other computers.

**idle**
Detects when the screen is unlocked, so the Quran tab can be brought forward once a day. No idle data is stored or sent.

**alarms**
A one-minute timer. A large gap between ticks shows the computer was asleep, which covers sleep without a lock screen. Used only for the same once-a-day return.

**Host permission: https://quran.com/***
A content script on quran.com reads which verse is near the top of the screen so the
user's place can be saved. The background script uses the same access to find an
existing quran.com tab on startup and to open or focus one at the saved verse.

**Optional host permission: the Quran Resume phone server (the address in config.js)**
Not granted at install. Requested only when the user presses "Get it on your phone", and removed when they turn it off. It lets the extension send the last verse and its time to the user's own pairing on that server, and read back a newer place saved on their phone.

**Remote code**
No. All code is bundled in the package.

## Data usage disclosures (Privacy tab)
- Collects user data: only if the user turns on the optional phone link. Then the last verse the user reached on a web page
  and its time are sent to the developer's server under a random pairing code. The closest category on the form is
  "User activity" (a reading position); tick it, say it is optional, and point to the privacy policy. Nothing else is collected.
  Without the phone link, the last verse stays on the device and, if the user leaves sync on, in Chrome's own sync storage.
  Check the form's wording when you fill it in, because the categories change from time to time.
- Certify: not sold to third parties; not used for purposes unrelated to the
  extension's single purpose; not used for creditworthiness or lending.

## Privacy policy URL
https://github.com/hafizuddin-a/quran-resume/blob/main/PRIVACY.md

## Assets
- Store icon 128x128: `icons/icon128.png`
- Small promo tile 440x280: `store/promo-440x280.png`
- Screenshots (1280x800 RGB PNG, at least 1): `store/screenshots/*.png` (sources in `store/screenshots/src/`).

## Submission checklist
1. Register as a Chrome Web Store developer (one-time US$5 fee, and 2-step
   verification must be on for your Google account).
2. Run `./release.sh` and upload `dist/quran-resume-<version>.zip` (the same file that goes on the GitHub release).
3. Fill in the Store listing, Privacy, and Distribution tabs from this file.
4. Submit for review. First reviews commonly take a few days.
