# Deploying Bartrrr

Production: **https://bartrrr.app** on Cloudflare Pages, backed by a hosted Supabase project.
Replace `<ref>` below with your Supabase project ref (the subdomain of your project URL).

## 1. Supabase project

1. Create a project at supabase.com (region near Memphis: `us-east-1`).
2. Link and push the schema from this repo:
   ```sh
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push          # applies supabase/migrations/001–004
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
     - `https://*.bartrrr.pages.dev/**` (Cloudflare preview deploys; adjust to your Pages project name)
     - `http://localhost:5173/**`
6. **Authentication → Providers → Email:** enabled, "Confirm email" on. Set minimum password length to 8.
7. **Authentication → Emails → SMTP:** configure a real SMTP sender (e.g. Resend, Postmark) from `no-reply@bartrrr.app`. Supabase's built-in sender is rate-limited to a few emails per hour, which isn't enough for launch.
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
2. **Google Auth Platform → Branding:** app name "Bartrrr", support email, logo; **Authorized domains:** `bartrrr.app` and `supabase.co`; privacy policy and terms URLs on bartrrr.app.
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

## 4. Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → `netfuel/bartrrr`.
2. Build settings:
   - Framework preset: *None* (or Vite)
   - Build command: `npm ci && npm run build` (or just `npm run build`; Pages installs from the lockfile)
   - Build output directory: `dist`
   - Root directory: `/`
   - Environment variable `NODE_VERSION` = `22`
3. **Settings → Variables and Secrets** (Production; repeat for Preview with preview values):

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |
   | `VITE_MAPBOX_TOKEN` | `pk.…` (restrict to bartrrr.app URLs in Mapbox) |
   | `VITE_SITE_URL` | `https://bartrrr.app` |
   | `VITE_VAPID_PUBLIC_KEY` | optional |
   | `VITE_AUTH_PROVIDERS` | optional, e.g. `google` until Apple is ready |

   Do **not** set `VITE_DEMO_MODE` in production. Variables are baked in at build time, so redeploy after changing any.
4. **Custom domains:** add `bartrrr.app` and `www.bartrrr.app` (the zone is already on Cloudflare, so DNS records are created for you).
5. **www → apex redirect:** Cloudflare → bartrrr.app zone → **Rules → Redirect Rules → Create** → template "Redirect from WWW to root", status 301, preserve query string. (`_redirects` can't do domain-level redirects.)
6. **SSL/TLS:** mode *Full (strict)*; enable *Always Use HTTPS*.
7. Don't add Cache Rules that cache HTML. `public/_headers` already sets immutable caching for `/assets/*` and `no-cache` for `/sw.js`.

What the repo ships for Pages:
- `public/_headers`: CSP and security headers, asset caching. If you add a new third-party origin (analytics, Sentry), add it to the CSP's `connect-src` / `script-src` or it will be blocked.
- `public/_redirects`: convenience redirects only. SPA routing works because there is no top-level `404.html`, so Pages serves `index.html` for unknown paths.
- `public/robots.txt` and `public/sitemap.xml`.

## 5. Launch checklist

- [ ] `npm run typecheck && npm run lint && npm run build` pass
- [ ] Migrations 001–004 applied; `select public.expire_stale_offers()` runs without error
- [ ] Production has no demo data: `supabase/seed.sql` is local-only; no `*@bartrrr.demo` auth users or `listing-0xx` rows (see step 1 if an old 002 was applied)
- [ ] Email signup: confirmation email arrives, link lands on `/auth/callback`, then onboarding
- [ ] Google: new account goes to onboarding with name and photo filled; returning account goes back to where it started
- [ ] Apple: new account is asked for a name in onboarding; "Hide my email" accounts work
- [ ] Password reset email arrives and `/auth/reset-password` sets a new password
- [ ] Deep link while signed out (e.g. `/offers/…`) returns there after login
- [ ] Browser console shows no CSP violations on `/`, `/browse` (map), `/auth/login`
- [ ] SMTP sender verified (SPF/DKIM on bartrrr.app)
- [ ] Apple secret expiry reminder set (6 months)

## Local development

```sh
cp .env.example .env.local     # fill in Supabase URL + anon key, or set VITE_DEMO_MODE=true
npm ci
npm run dev                    # http://localhost:5173
```

Full local stack with OAuth: copy `supabase/.env.example` to `supabase/.env`, fill in the provider secrets, then `npx supabase start`. Point `VITE_SUPABASE_URL` at `http://127.0.0.1:54321`.
