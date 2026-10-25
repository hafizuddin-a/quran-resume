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
- Click the toolbar icon at any time to jump back to your last verse.

Private by design:
- Your last verse is stored only on your device, in your browser's extension storage.
- No accounts, no analytics, no tracking, no network requests of its own.
- Open source (MIT): the full code is on GitHub.

Quran Resume is an independent project and is not affiliated with Quran.com or the
Quran Foundation.

## Single purpose
Reopen quran.com at the user's last-read verse when the browser starts.

## Permission justifications

**storage**
Stores the last-read verse (for example "2:9") locally so it can be restored on the
next browser startup.

**Host permission: https://quran.com/***
A content script on quran.com reads which verse is near the top of the screen so the
user's place can be saved. The background script uses the same access to find an
existing quran.com tab on startup and to open or focus one at the saved verse.

**Remote code**
No. All code is bundled in the package.

## Data usage disclosures (Privacy tab)
- Collects user data: none of the listed categories are collected or transmitted.
  The last verse is stored locally only.
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
