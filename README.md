# Bartrrr: Trade, don't buy

A hyperlocal trading app for the greater Memphis, TN metro. Neighbors swap goods, services and skills. No price tags, no cash.

Live at **https://bartrrr.app** · Repo: [github.com/netfuel/bartrrr](https://github.com/netfuel/bartrrr)

---

## What it does

You post a listing and say what you'd like in return. Neighbors make offers, you go back and forth with counter-offers (up to 5 rounds), and once someone accepts, you both sign a simple, non-binding trade agreement, make the swap, and leave each other a review.

- **Browse:** grid or Mapbox map of nearby listings, filter by category, search by keyword or neighborhood. Locations are neighborhood-level only (coordinates are rounded to ~1 km in the database).
- **Offers:** offer, counter-offer, accept or decline with a reason. Offers expire after 72 hours without a reply; the thread shows whose move it is and how many rounds are left.
- **Trade agreements:** drafted automatically when an offer is accepted. Each neighbor signs for themselves; both signatures make it ready to swap. Exchange method, date, place and notes live on the agreement.
- **Reviews and reputation:** star rating and comment after a completed trade. Ratings and trade counts are maintained by the database, never by the client.
- **Dashboard, feed, notifications:** your listings, offers in and out, agreements, neighborhood activity, in-app notifications (server-generated) and optional web push.
- **Onboarding:** name, neighborhood, interests. Signup checks you're in a supported Memphis-area ZIP code (device location via Mapbox, or manual entry).

## Sign-in

- **Continue with Google**
- **Continue with Apple** (Apple never returns a name on the web, so onboarding asks for one)
- **Email and password**, with email confirmation and password reset

All three run through Supabase Auth and return to `/auth/callback`. `VITE_AUTH_PROVIDERS` can limit which OAuth buttons show (for example `google` while Apple setup is pending).

**Demo mode** exists for development and design review only. It is compiled in only when the build sets `VITE_DEMO_MODE=true`: it adds sample neighbors, listings and offers, and a "log in as" picker. Without Supabase variables, demo mode runs fully offline in the browser. Production builds never include the picker or sample data.

## Tech stack

| Layer | Technology |
|---|---|
| App | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v7 |
| Backend | Supabase (Postgres with RLS, Auth, Realtime, Edge Functions) |
| Map | Mapbox GL JS v3 (loaded only when a map is shown) |
| Hosting | Cloudflare Pages |

## Getting started

Requires Node.js 22.

```sh
npm ci
cp .env.example .env.local   # then fill it in (see below)
npm run dev                  # http://localhost:5173
```

Quickest start with no backend: set only `VITE_DEMO_MODE=true` in `.env.local`.

### Environment variables

All are read at build time and ship to the browser. Never put a secret in a `VITE_*` variable. `.env.example` has the details.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes, unless demo mode | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes, unless demo mode | Supabase anon (public) key; RLS protects the data |
| `VITE_MAPBOX_TOKEN` | Recommended | Public `pk.` token for the map and location-based ZIP check |
| `VITE_SITE_URL` | Recommended | Canonical origin, defaults to `https://bartrrr.app` |
| `VITE_VAPID_PUBLIC_KEY` | Optional | Web push public key |
| `VITE_AUTH_PROVIDERS` | Optional | Comma-separated OAuth buttons to show (`google,apple`) |
| `VITE_DEMO_MODE` | Dev only | `true` enables sample data and the demo picker |
| `VITE_DEMO_PASSWORD` | Dev only | Password for seeded `*@bartrrr.demo` users when demo mode talks to a Supabase project |

If the required Supabase variables are missing in a non-demo build, the app shows a "We'll be right back" screen and logs which variables are missing to the console.

### Database

Schema and security rules live in `supabase/migrations/` (apply with `npx supabase db push`). Demo data is in `supabase/seed.sql` and only loads on a local `npx supabase db reset`, never in production.

### Checks

```sh
npm run typecheck
npm run lint
npm run build
```

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for the full checklist: Supabase project and auth URLs, Google and Apple sign-in setup, SMTP, push notifications, Cloudflare Pages build settings and domains, and the launch checklist.

## Project structure

```
src/
├── components/
│   ├── auth/          # OAuth buttons, demo picker (demo builds only)
│   ├── bartrrr/       # Domain components (TradeCard, OfferThread, ListingsMap…)
│   ├── layout/        # PageShell, Header, Sidebar, BottomBar, ProtectedRoute
│   ├── system/        # Error boundary, config error screen, route effects
│   └── ui/            # Button, Input, Modal, ConfirmDialog, Toast…
├── data/              # Demo-mode sample data and Memphis neighborhoods
├── lib/               # env, auth helpers, Supabase service, validation, utils
├── pages/             # One file per route
├── providers/         # AuthProvider
├── stores/            # Zustand stores
├── styles/            # globals.css (Tailwind and design tokens)
└── types/             # Shared types and user-facing labels
supabase/
├── migrations/        # Schema, RLS, triggers
├── functions/send-push/
└── seed.sql           # Local demo data
docs/content-style-guide.md   # Voice, terminology and UI copy rules
```

Copy follows [docs/content-style-guide.md](docs/content-style-guide.md): "Bartrrr", sentence case, no money language.

## Roadmap

- [ ] Smart matching ("Perfect Match" alerts based on what you're looking for)
- [ ] Safe meetup spot suggestions on the map
- [ ] Listing photo uploads (listings currently take image links)
- [ ] Dark mode
- [ ] Expand beyond Memphis
