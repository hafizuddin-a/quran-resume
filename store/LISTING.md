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
- Click the toolbar icon for a menu: your last chapter and verse, an Open Quran button, the once-a-day switch, and a link to message the developer.
- New: link your phone. Scan a QR code from the menu to open the free Quran Resume phone app, which keeps your place in sync both ways and can send up to 3 gentle daily reading reminders. Optional, off by default, and it needs no extra permission.

Private by design:
- Your last verse is stored on your device, in your browser's extension storage.
- No accounts, no analytics, no tracking. Nothing is sent anywhere unless you link a phone, and then only your last verse and when you saved it.
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

**Phone link (no permission)**
The optional phone link calls the developer's server at quran-resume.hello-hafiz.workers.dev. The
server allows these requests itself (CORS), so no host permission is requested for it.

**Remote code**
No. All code is bundled in the package.

## Data usage disclosures (Privacy tab)
- Collects user data: **Website content** only, and only if the user turns on the optional phone
  link: the last-read verse on quran.com (for example "2:9") and when it was saved are sent to the
  developer's server (quran-resume.hello-hafiz.workers.dev) to sync with the user's phone. Nothing
  else, and nothing at all without the phone link.
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
