# Deploying Bartrrr

Production: **https://bartrrr.app**, served by a Cloudflare Worker (static assets) and backed by a hosted Supabase project.
Replace `<ref>` below with your Supabase project ref (the subdomain of your project URL).

## Production at a glance

Set up October 2026. No secrets here: keys live in the dashboards named.

| Piece | Where | Status |
|---|---|---|
| Site | Cloudflare Worker `bartrrr`, Git-connected to `netfuel/bartrrr` `main`; every push builds and deploys | Live |
| Domains | `bartrrr.app`, `www.bartrrr.app`, route `*.bartrrr.app/*`; workers.dev URL `bartrrr.netfuel.workers.dev` | Live |
| Build variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `VITE_AUTH_PROVIDERS=google` | Set |
| Database + auth | Supabase project `bartrrr`, ref `uykknvmxntknclkyqvao`, East US (Ohio) `us-east-2` | Migrations 001–011 applied (008 photos, 009 agreement actions, 010 self-service deletion, 011 withdrawn notice) |
| Offer expiry | `pg_cron` job `bartrrr-expire-offers`, every 15 minutes | Active |
| Google sign-in | Google Cloud project `bartrrr`, OAuth client "Bartrrr web", app published (External) | Live |
| Apple sign-in | Not set up; hidden by `VITE_AUTH_PROVIDERS=google` | To do |
| Maps | MapLibre + OpenFreeMap tiles, no key | Live |
| Contact email | `hello@bartrrr.app` → netfuel@gmail.com via Cloudflare Email Routing | Live |
| Transactional email | Supabase Send Email hook → `bartrrr-mail` Worker → Cloudflare Email Service, from `no-reply@bartrrr.app` | Live (200/day account quota) |
| www → apex redirect | Redirect Rule "www to bartrrr.app": `https://www.*` → `https://${1}`, 301, query string kept | Live |

## 1. Supabase project

1. Create a project at supabase.com (region near Memphis: East US, `us-east-2` or `us-east-1`).
2. Link and push the schema from this repo:
   ```sh
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push          # applies supabase/migrations/001–008
   ```
   Migrations contain schema only. `002_seed_data.sql` is an intentional no-op (kept so numbering stays stable); the demo users and listings live in `supabase/seed.sql`, which only `supabase db reset` loads on a **local** database. `db push` never runs it, so a fresh production database starts empty.

   If a database already applied the old 002 with demo rows (an early staging project, say), clear them before launch:
   ```sql
   delete from public.listings where id like 'listing-0%';
   delete from public.users where id in (
     'bc668087-f272-44b7-9a58-00d36a31be93','3b6e23ce-2a48-41a6-b51a-5d6625c28d26',
     'cd4deb82-d7cc-46b3-b015-ba81e3d6034a','2b1d31a1-0348-484e-900b-5c3dc16f5b1c',
     'b7cc2650-df36-45f8-a920-9428089edbf9','8bf44cdb-55f5-4fdd-a048-eb0055fda110',
     'b4061c2d-7c98-4ddd-a086-95e12ec61e20','6daf679c-395c-4f64-a956-a71e72b08096');
   ```
3. **Database → Extensions:** enable `pg_cron`, then run once in the SQL editor, so offers expire after 72 hours even when nobody has the app open:
   ```sql
   select cron.schedule('bartrrr-expire-offers', '*/15 * * * *', 'select public.expire_stale_offers()');
   ```
   (Migration 004 does this automatically if `pg_cron` was already enabled.)
4. **Database → Replication:** confirm `offers`, `offer_messages`, `agreements` and `notifications` are in the `supabase_realtime` publication (migration 001 adds them).
5. **Authentication → URL Configuration**
   - Site URL: `https://bartrrr.app`
   - Redirect URLs (add each):
     - `https://bartrrr.app/**`
     - `https://www.bartrrr.app/**`
     - `https://*-bartrrr.netfuel.workers.dev/**` (Cloudflare preview versions, if you test sign-in on them)
     - `http://localhost:5173/**`
6. **Authentication → Sign In / Providers:** "Confirm email" on. **Email** provider: minimum password length 8, password requirements "Letters and digits" (matches the signup form's helper text).
7. **Authentication → Auth Hooks → Send Email hook (HTTPS):** URL `https://bartrrr-mail.netfuel.workers.dev`, secret generated there and stored on the Worker as `SEND_EMAIL_HOOK_SECRET`. Custom SMTP stays **off**: the hook replaces it and Supabase's email templates. Copy and layout live in `workers/mail/src/templates.ts`; setup details in `workers/mail/README.md`. Cloudflare SMTP relay was tried and failed with Supabase, so don't switch back to it.
8. **Edge function (push notifications, optional):**
   ```sh
   npx web-push generate-vapid-keys
   npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… \
     VAPID_SUBJECT=mailto:hello@bartrrr.app \
     ALLOWED_ORIGINS=https://bartrrr.app,https://www.bartrrr.app
   npx supabase functions deploy send-push
   ```
   Put the same public key in `VITE_VAPID_PUBLIC_KEY`.

## 2. Google sign-in (covers Gmail accounts)

1. Google Cloud Console → create or select a project.
2. **Google Auth Platform → Branding:** app name "Bartrrr", support email, home page `https://bartrrr.app`, privacy policy `https://bartrrr.app/privacy`, terms `https://bartrrr.app/terms`. **Authorized domains:** `bartrrr.app` and `<ref>.supabase.co` (added automatically from the client below). Leave the logo empty unless you're ready for Google's brand verification: uploading one requires it, and it can take days.
3. **Audience:** User type *External*, then **Publish app** (in *Testing* only listed test users can sign in).
4. **Data access (scopes):** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. These are non-sensitive, so no Google verification review is needed.
5. **Clients → Create client → Web application**
   - Authorized JavaScript origins: `https://bartrrr.app`, `https://www.bartrrr.app`, `http://localhost:5173`
   - Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
     (local stack: also `http://127.0.0.1:54321/auth/v1/callback`)
6. Copy the Client ID and Client secret into **Supabase → Authentication → Providers → Google**, and enable it.

## 3. Apple sign-in

Requires a paid Apple Developer Program membership.

1. **Certificates, Identifiers & Profiles → Identifiers → App IDs:** create one (e.g. `app.bartrrr`) with the **Sign in with Apple** capability enabled. Leave the server-to-server notification endpoint blank.
2. **Identifiers → Services IDs:** create one (e.g. `app.bartrrr.signin`); this is the OAuth client ID. Enable Sign in with Apple → Configure:
   - Primary App ID: the App ID from step 1
   - Domains and Subdomains: `<ref>.supabase.co`
   - Return URLs: `https://<ref>.supabase.co/auth/v1/callback`
3. **Keys:** create a key with Sign in with Apple enabled, linked to the App ID. Download `AuthKey_XXXXXXXXXX.p8` (one download only; store it in your password manager). Note the Key ID and your Team ID (top right of the developer portal).
4. Generate the client secret JWT from the `.p8` with the generator on Supabase's "Login with Apple" docs page (runs in the browser; not Safari).
5. **Supabase → Authentication → Providers → Apple:** enable; Client IDs: the Services ID (list it first if you later add an iOS bundle ID); Secret Key: the JWT.
6. **Calendar a reminder: the Apple secret expires every 6 months.** When it does, Apple sign-in fails until you generate a new JWT from the same `.p8` and paste it in.
7. Optional, for private-relay emails to reach users: **Services → Sign in with Apple for Email Communication**, register `bartrrr.app` and the SMTP sender address.

Apple's web flow never returns the person's name; onboarding asks for it.

## 4. Cloudflare (Worker with static assets)

The site is an assets-only Cloudflare Worker named `bartrrr`, built by Workers Builds from GitHub. There's no `wrangler.jsonc` in the repo: on each deploy, `npx wrangler deploy` auto-configures the Vite project (assets from `dist`, `not_found_handling: "single-page-application"` so deep links like `/privacy` load the app).

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → `netfuel/bartrrr` (already done for production).
2. **Settings → Builds → Build configuration:**
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Version command: `npx wrangler versions upload`
   - Root directory: `/`, production branch `main`
3. **Settings → Builds → Variables and secrets** (build-time; Vite bakes them into the bundle):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys (Legacy) → **anon public**. Never `service_role`. |
   | `VITE_SITE_URL` | `https://bartrrr.app` |
   | `VITE_AUTH_PROVIDERS` | `google` until Apple is ready; then remove it or set `google,apple` |
   | `VITE_VAPID_PUBLIC_KEY` | optional, for push notifications |

   Maps need no key: tiles come from OpenFreeMap (OpenStreetMap data), and the signup ZIP check runs on the device.

   Do **not** set `VITE_DEMO_MODE` in production. Changing a variable doesn't redeploy: open the latest build under **Deployments** and click **Retry build**, or push a commit.
4. **Domains:** `bartrrr.app` and `www.bartrrr.app` are attached as Custom Domains on the Worker (Worker → Domains). The zone is on Cloudflare, so DNS and certificates are handled for you.
5. **www → apex redirect:** bartrrr.app zone → **Rules → Redirect Rules → Create** → template "Redirect from WWW to root", status 301, preserve query string. (`_redirects` can't redirect between hostnames.) Created as "www to bartrrr.app". Cloudflare warns that www may not be proxied: ignore it, the Worker custom domain is proxied and the rule works.
6. **SSL/TLS → Edge Certificates:** turn on *Always Use HTTPS*. (The SSL mode setting doesn't apply here: the Worker is the origin.)
7. Don't add Cache Rules that cache HTML. `public/_headers` already sets immutable caching for `/assets/*` and `no-cache` for `/sw.js`.
8. **Email Routing** (bartrrr.app → Email → Email Routing): MX, SPF and DKIM records added; rule `hello@bartrrr.app` → netfuel@gmail.com. Add more addresses the same way.
9. **Mail Worker** `bartrrr-mail`: Workers Builds from the same repo, root directory `/workers/mail`, no build command, deploy `npx wrangler deploy`. Binding `EMAIL` (send_email) and vars live in `workers/mail/wrangler.jsonc`; the one secret is `SEND_EMAIL_HOOK_SECRET`. `GET /health` returns `{"ok":true}`.
10. **Listing photos:** uploaded from the post and edit pages to the Supabase Storage bucket `listing-photos` (migration 008), at `<user id>/<random>.webp`. The browser resizes each photo to 1600px on the long side and re-encodes it, which strips EXIF data like GPS location; the bucket rejects anything over 2 MB or not WebP/JPEG. Only the owner can write to their folder; reads are public. Removed photos are deleted after the listing saves; photos from abandoned drafts are deleted when the page closes. Code: `src/lib/photos.ts`, `src/components/listings/PhotoPicker.tsx`.
11. **Social share image:** `public/og-image.jpg` (1200×630), referenced by absolute URL in `index.html`. Source is an HTML layout rendered with Playwright: homepage nav bar with the wordmark, the `homes-poster.jpg` hero with the walnut scrim, and "Trade, don’t buy." in Fraunces. After changing it, re-scrape in the Facebook Sharing Debugger and LinkedIn Post Inspector, which cache images.

If a deploy fails with `Internal authentication error ... [code: 10500]`, that's a Cloudflare API hiccup (often two deploys at once): retry the build.

What the repo ships for the Worker's static assets:
- `public/_headers`: CSP and security headers, asset caching. If you add a new third-party origin (analytics, Sentry), add it to the CSP's `connect-src` / `script-src` or it will be blocked.
- `public/_redirects`: same-host convenience redirects only.
- `public/robots.txt` and `public/sitemap.xml`.

## 5. Launch checklist

- [ ] `npm run typecheck && npm run lint && npm run build` pass
- [x] Migrations 001–007 applied; offer-expiry cron job active
- [x] Migration 008 applied: Storage shows a public `listing-photos` bucket (2 MB limit, WebP/JPEG); posting a listing with a photo works
- [ ] Migration 009 applied (`npx supabase db push`): on a test trade, set a time and place, cancel one agreement and flag another; the other neighbor gets a notification each time, and the flagged trade shows up in the query under "Flagged trades"
- [ ] Migration 011 applied: withdrawing an offer gives the listing owner an "Offer withdrawn" notification
- [ ] Migration 010 applied: `delete_my_account()` exists and only `authenticated` can execute it; delete a throwaway account from Settings and check its profile reads "Former neighbor" and its photo folder is gone
- [ ] Production has no demo data: `supabase/seed.sql` is local-only; no `*@bartrrr.demo` auth users or `listing-0xx` rows (see step 1 if an old 002 was applied)
- [ ] Email signup: confirmation email arrives, link lands on `/auth/callback`, then onboarding
- [ ] Google: new account goes to onboarding with name and photo filled; returning account goes back to where it started
- [ ] Apple: new account is asked for a name in onboarding; "Hide my email" accounts work
- [ ] Password reset email arrives and `/auth/reset-password` sets a new password
- [ ] Deep link while signed out (e.g. `/offers/…`) returns there after login
- [ ] Browser console shows no CSP violations on `/`, `/browse` (map, after login), `/auth/login`
- [ ] Sender domain onboarded in Cloudflare Email Service (cf-bounce, DKIM, DMARC on bartrrr.app); `bartrrr-mail` logs show `sent recovery <id>` after a reset
- [ ] Apple secret expiry reminder set (6 months)

## Local development

```sh
cp .env.example .env.local     # fill in Supabase URL + anon key, or set VITE_DEMO_MODE=true
npm ci
npm run dev                    # http://localhost:5173
```

Full local stack with OAuth: copy `supabase/.env.example` to `supabase/.env`, fill in the provider secrets, then `npx supabase start`. Point `VITE_SUPABASE_URL` at `http://127.0.0.1:54321`.

## Flagged trades

Either neighbor can flag an active or completed trade for review, with a short reason (migration 009). The agreement's status becomes `disputed`, the other neighbor is notified, and neither can mark it done, cancel it or reopen it from the app. Flagging doesn't change trade counts or ratings. Bartrrr doesn't decide disputes: the job is to help the two neighbors talk, per the agreement's dispute clause.

There's no admin screen yet. Check flagged trades in the SQL editor:

```sql
select a.id,
       a.disputed_at,
       flagger.display_name as flagged_by,
       a.dispute_reason,
       pa.display_name as party_a, a.party_a_item,
       pb.display_name as party_b, a.party_b_item,
       a.exchange_date, a.exchange_location,
       a.completed_at
  from public.agreements a
  join public.users pa on pa.id = a.party_a_user_id
  join public.users pb on pb.id = a.party_b_user_id
  left join public.users flagger on flagger.id = a.disputed_by
 where a.status = 'disputed'
 order by a.disputed_at desc nulls last;
```

To reach the neighbors, find their emails under Authentication → Users by id (`party_a_user_id`, `party_b_user_id`). Once it's settled, the SQL editor (a trusted context, so the app's rules don't apply) can move the agreement on:

```sql
-- Swap still to happen: back to "Ready to swap"
update public.agreements set status = 'active' where id = '<agreement id>';
-- It happened: mark it done (counts toward trade totals only the first time)
update public.agreements set status = 'completed' where id = '<agreement id>';
-- Called off
update public.agreements set status = 'cancelled' where id = '<agreement id>';
```

`dispute_reason`, `disputed_by` and `disputed_at` stay on the row as a record.

Late cancellations: `users.late_cancellations` counts cancellations made less than 24 hours before an agreed swap (both had signed), or after the swap time. The server works it out when the agreement is canceled; it shows on the neighbor's profile. To review: `select id, cancelled_by, cancelled_at, exchange_date from public.agreements where cancelled_late order by cancelled_at desc;`

## Legal pages

`/privacy` and `/terms` are public and indexed. The facts they depend on (operator name, contact email, minimum age, governing law, last-updated date) live in `src/lib/legal.ts`.

- `hello@bartrrr.app` forwards to netfuel@gmail.com (Cloudflare Email Routing). Both pages and the account-deletion process point to it.
- If you form an LLC or other entity, change `LEGAL_OPERATOR` to its legal name.
- Bump `LEGAL_UPDATED` whenever either document changes.
- Account deletion: neighbors delete their own account at the bottom of Settings (migration 010, `public.delete_my_account()`). The app first removes their files from `listing-photos/<user id>/`, then the function runs the 007 steps for the signed-in neighbor only: strips the profile, deletes or clears their listings, withdraws open offers, cancels unfinished agreements, removes their name from other neighbors' notifications, and deletes the sign-in identity, all in one transaction. Code: `src/lib/account-deletion.ts`, `src/components/settings/DeleteAccountSection.tsx`.
- Deletion requests by email (someone who can't sign in, or asks us to do it): don't delete the user from Supabase → Authentication, which leaves their profile behind. Instead, in the SQL editor run `select public.delete_account('<user id>');` (migration 007; it isn't callable from the app). Find the id under Authentication → Users by email. Then delete their photos: **Storage → listing-photos →** the folder named with their user id → select all → Delete. (Supabase blocks deleting storage files from SQL, so the function can't do this step.)
- Leftover photos: if the browser couldn't remove someone's photos during self-service deletion (dropped connection), their folder stays behind. Now and then, list folders that no longer belong to an account, then delete them in **Storage → listing-photos**:
  ```sql
  select distinct (storage.foldername(name))[1] as folder
    from storage.objects o
   where bucket_id = 'listing-photos'
     and not exists (select 1 from auth.users u where u.id::text = (storage.foldername(o.name))[1]);
  ```
