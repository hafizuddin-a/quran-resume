# Privacy Policy

**Quran Resume** · Effective 10 November 2026

Also at https://quran-resume.hello-hafiz.workers.dev/privacy

## 1. About this policy

Quran Resume is a free Chrome extension and phone web app that keeps your place in the Quran. It is
made by Hafiz, an independent developer. It uses the **Quran Foundation APIs** (api.quran.com) for
Quran text, translations, tafsir, word meanings, fonts and recitations. Quran.com and QuranReflect
are services of the Quran Foundation. Quran Resume is not an official Quran Foundation, Quran.com or
QuranReflect app, and it does not use Quran.com or QuranReflect accounts.

This policy covers the extension, the phone app at quran-resume.hello-hafiz.workers.dev, and the
small server they share.

## 2. What we collect and why

There are no accounts. We never ask for your name, email or phone number, and there are no
analytics, ads or tracking.

| Where | What | Why |
| --- | --- | --- |
| Your computer (extension) | Your last verse and when you saved it, your menu settings, the date it last opened the Quran after your computer woke | To open quran.com at your place. If "Sync my place" is on and you use Chrome sync, Chrome copies your last verse to your other signed-in computers. |
| Your phone (phone app) | Your place, saved verses, reading settings, and your chosen translation, reciter and tafsir | To show the Quran the way you set it up. These stay on your phone. |
| Our server, only if you link a phone | A random code for your computer and another for your phone, your last verse, and when it was saved | To keep your place in sync between your computer and phone. |
| Our server, only if you turn on daily reminders | A random id for your phone, its push address from the browser's push service, your three reminder times, your time zone, and which reminders were sent or confirmed today | To send up to 3 reminders a day and stop them once you confirm you've read. |
| Our server, to stop abuse | Wrong link codes, counted per network address (for IPv6, only the first half of the address) | To stop anyone guessing link codes. Counts are deleted within an hour and aren't linked to your place. |

Quran text and its details come from the Quran Foundation APIs without us sending them any of your
data.

### Sensitive religious information

Your reading place, and confirming "I have read the Quran today", relate to religious practice, which
privacy laws such as the GDPR treat as sensitive personal data needing stronger protection. This data
leaves your device only with your explicit, opt-in consent, given by a clear action of your own:

- **Phone link:** you press **Link your phone** in the extension, then confirm **Link this computer?**
  on your phone.
- **Daily reminders:** you turn on **Daily reminders** and allow notifications.

Both are off until you choose them, neither is needed to read, and each is separate from anything
else you agree to. You can turn either off at any time.

### What we never do

- We never use your data to build advertising profiles.
- We never sell, rent, mine or repurpose your data beyond the features above.
- We never use your data or anything you do in the app to train AI models.

## 3. Who else handles data

| Service | What it does | Privacy policy |
| --- | --- | --- |
| Cloudflare | Hosts our server and database | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| Push services (Google, Apple, Mozilla or Microsoft, depending on your browser) | Deliver reminders to your phone. Each reminder is encrypted end to end, so they can't read it. | [Google](https://policies.google.com/privacy), [Apple](https://www.apple.com/legal/privacy/), [Mozilla](https://www.mozilla.org/privacy/), [Microsoft](https://www.microsoft.com/privacy/privacystatement) |
| Quran Foundation | The phone app loads Quran text, translations, tafsir, word meanings, fonts and recitations directly from its servers, which see your network address as any website would | [quran.com/privacy](https://quran.com/privacy) |
| Google Fonts | Serves the phone app's interface font | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Chrome sync (Google) | Copies your last verse between your computers, if you use it | [policies.google.com/privacy](https://policies.google.com/privacy) |

Cloudflare processes our server's data under its
[Customer Data Processing Addendum](https://www.cloudflare.com/cloudflare-customer-dpa/). The other
services act under their own terms when they deliver messages, content or fonts. We share your data
with no one else, and no one receives Quran text from us to reuse.

## 4. How we protect it

- **In transit:** every connection uses HTTPS (TLS).
- **At rest:** our database is encrypted at rest with AES-256 by Cloudflare.
- **Access:** only the developer can reach the server and its data.
- **Secrets:** server keys are replaced at least once a year, and at once if we suspect one has been
  exposed.
- **Incidents:** we start responding to a security incident within 24 hours of learning of it, and
  report any that involve the Quran Foundation APIs to the Quran Foundation within 24 hours, as its
  developer requirements ask (Security Rule 6.9).

## 5. Your choices and rights

- **No account to revoke:** Quran Resume doesn't sign you in to Quran.com or the Quran Foundation, so
  there are no OAuth tokens to revoke.
- **Delete my data (phone app):** Settings → **Delete my data** deletes your reminder record and phone
  link from our server, and clears everything the app kept on your phone.
- **Unlink (extension):** **Unlink** in the toolbar menu deletes your place and pairing from our
  server. Removing the extension deletes everything it kept on your computer.
- **Reminders off:** turning reminders off deletes your push address from our server at once.
- **Access and correction:** everything we keep is shown in the app or the extension menu. Email us
  for a copy of what our server holds about you, or to correct it.

## 6. How long we keep it

Data stays only while you use the feature it's for:

- **Phone link:** until you unlink. A pairing no phone joins is deleted after a day, and one with no
  new place for 6 months is deleted.
- **Push address:** until you turn reminders off.
- **Reminder times and time zone:** deleted a month after reminders are turned off.
- **Wrong link code counts:** deleted within an hour.

When you ask us to delete your data, it is deleted at once, and always within 30 days. Cloudflare
keeps a recovery history of our database for up to 7 days, after which deleted data is gone for good.

## 7. Children

Quran Resume is not directed at children under 13. There is no sign-up and we don't collect names or
ages, so we can't tell who is using it. A parent who wants a child's data removed can use **Delete my
data**, or email us.

## 8. International transfers

Our server runs on Cloudflare's worldwide network, so your data may be processed outside your
country. For these transfers we rely on Cloudflare's Data Processing Addendum, which includes the
EU's Standard Contractual Clauses, to protect your data to GDPR standards. We are responsible for
following the data protection laws that apply where our users are.

## 9. Changes

When this policy changes, we update the date at the top. Significant changes are also noted in the
extension's release notes and shown in the phone app.

## 10. Contact

Email **hafizddn.a@gmail.com** with any privacy question or request. We reply within 30 days.
