# Quran Resume phone server

A small Cloudflare Worker with a D1 database. It does two things:

- stores one record per pairing code: the last verse (like `2:9`) and when it was saved;
- serves the phone page at `/p/<code>`, which shows that verse, opens quran.com at it, and lets you save a new place.

The extension talks to it only after the user presses **Get it on your phone**. There are no accounts. The pairing code is
a random 128-bit string that lives in the phone link, so it is the only key. Pairings unused for 400 days are deleted by a
daily scheduled job.

## API

| Request | Result |
|---------|--------|
| `POST /api/pair` (optional body `{verseKey, savedAt}`) | `201 {code, verseKey, savedAt}` |
| `GET /api/place/<code>` | `{verseKey, savedAt}`, or 404 |
| `PUT /api/place/<code>` with `{verseKey, savedAt}` | The newest save wins. The reply is the winning place |
| `DELETE /api/place/<code>` | 204 |

Verses are checked against the real surah lengths, `savedAt` can't be more than a day ahead, and bodies are capped at 512 bytes.

## Deploy your own

You need a free Cloudflare account and Node.js.

```bash
cd phone
npm install
npx wrangler login
npx wrangler d1 create quran-resume          # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute quran-resume --remote --file=schema.sql
npm run deploy                                # prints your address, https://quran-resume.<you>.workers.dev
```

Then put that address in [../config.js](../config.js) and in `optional_host_permissions` in [../manifest.json](../manifest.json),
and run `../release.sh`.

`npm run dev` runs it locally. `npm run sync-data` (run by `dev` and `deploy`) copies [../surahs.js](../surahs.js) so the
server and the phone page use the same surah names and lengths.

## Limits and abuse

On Cloudflare's free plan, D1 allows about 100,000 row writes a day, which is plenty for many readers: the extension writes at most
once every 30 seconds while someone is reading, and only when the verse changed. Anyone can create pairings, so
if it is ever abused, add a rate limiting rule for `/api/pair` in the Cloudflare dashboard (Security, WAF, Rate limiting rules).

## Privacy

The Worker does not log, and stores no IP addresses, names or emails. See [../PRIVACY.md](../PRIVACY.md).
