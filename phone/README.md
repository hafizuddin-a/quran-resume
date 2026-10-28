# Quran Resume phone app

A small Quran reader for phones that remembers the verse you stopped on, sends up to three reading reminders a day,
and keeps the same place as the Quran Resume extension on your computer. It is a web app you add to the home screen,
so there is no app store. Live at <https://quran-resume.hello-hafiz.workers.dev>.

- **Reader.** Uthmani text and the Saheeh International translation from the Quran Foundation API. Your place is
  saved as you scroll, and the app opens there next time.
- **Reminders.** Up to three a day at times you pick. Tapping **I have read the Quran today** (or the notification
  itself on iPhone) skips the rest of that day's reminders.
- **Link with the extension.** In the extension's menu choose **Link your phone**, then scan the QR code, or type the
  6-digit code in the app's Settings. The newest place wins, in both directions.

## How it runs

Everything is one Cloudflare Worker on the free plan:

| Piece | What it does |
|-------|--------------|
| [public/](public) | The app itself, served as static files |
| [src/worker.js](src/worker.js) | The API: reminder settings, acknowledgements, pairing and place sync |
| [src/push.js](src/push.js) | Sends web push notifications with the Web Crypto API |
| Cron Trigger, every 5 minutes | Sends whatever reminders are due |
| D1 database `quran-resume` ([schema.sql](schema.sql)) | Two tables: `pairs` (shared place) and `phones` (reminders) |

The API allows calls from anywhere (CORS), so the extension needs no permission to reach it. Every request is
authorised by a secret: the pairing code, or the phone's random id.

## Deploy

```bash
cd phone
npm install
npx wrangler deploy
```

First time only: `npm run db:init` creates the tables, and `npx wrangler secret put VAPID_PRIVATE_JWK` stores the
private key that signs notifications. Its public half is `VAPID_PUBLIC_KEY` in [wrangler.toml](wrangler.toml). Changing
the key pair turns off everyone's reminders until they switch them on again.

`npm run dev` runs it locally with a local database, at `http://localhost:8787`.

## Still to do

- Register with Quran Foundation and call the API through the Worker with its credentials.
- The 6-digit code guess limit is kept per Worker instance, so it is a light brake rather than a hard limit.
