# Bartrrr — Trade, don't buy.

> A hyperlocal peer-to-peer trading app for the greater Memphis, TN metro area. No price tags. No cash. Just fair exchange between neighbors.

**Live repo:** [github.com/netfuel-bartrrr/bartrrr](https://github.com/netfuel-bartrrr/bartrrr)

---

## What is Bartrrr?

Bartrrr lets neighbors swap goods, services, and skills without any money changing hands. You list what you have, say what you want in return, and negotiate directly with people in your zip code. Once both parties agree, you sign a trade agreement and make the exchange.

---

## Service Area

Bartrrr is currently available exclusively in the **greater Memphis, TN metro area**.

Supported zip codes: `38103–38109`, `38111–38120`, `38125–38128`, `38131–38135`, `38138–38139`, `38141`, `38157`, `38016–38018`, `38027`, `38053`, `38060`

Signup uses **device geolocation** (via Mapbox reverse geocoding) to verify the user is within the service area. A manual zip code entry fallback is also available.

---

## Features

### Browse & Discover
- Filterable listing grid by category: **Goods**, **Services**, **Skills & Expertise**, **Outdoor & Garden**
- Toggle between grid view and an interactive **Mapbox GL JS map** with color-coded pins by category
- Search by keyword or neighborhood
- Distance display from your neighborhood

### Listing Details
- Photo gallery, condition badge, "looking for" section
- Direct **Make an Offer** flow from any listing

### Offer & Negotiation
- Multi-round offer/counter-offer system (up to 5 rounds)
- Inline **OfferTimeline** showing the full negotiation history
- Decline with reason, or counter with new items/terms
- Real-time message thread between the two parties

### Trade Agreements
- Formal trade agreement generated once an offer is accepted
- Both parties must sign digitally before the trade is confirmed
- Exchange method: in-person, drop-off, or service at location
- Optional special instructions and exchange date/location

### Reviews
- Post-trade star rating + written review
- Reviews visible on user profiles and listing cards

### Dashboard
Tabbed personal dashboard:
- **My Listings** — active listings with quick actions (renew, withdraw)
- **Incoming** — offers received on your listings
- **Outgoing** — offers you've made
- **Active Trades** — agreements in progress
- **History** — completed trades with dates

### Notifications
- Bell icon in header with unread count badge
- Dropdown showing the 10 most recent notifications
- Mark individual or all as read
- Deep links into the relevant offer or agreement

### Onboarding
4-step flow for new users:
1. Welcome
2. Neighborhood selection (16 Memphis neighborhoods)
3. Interest categories (min 3 of 16)
4. Done — redirects to Browse or Create Listing

Onboarding is tracked per-user so switching demo users re-triggers it correctly.

### Settings & Profile
- Edit display name, bio, neighborhood, avatar URL
- Public profile page with listings, reviews, and trade stats
- Log out

---

## Neighborhoods

Users and listings are seeded across these Memphis neighborhoods:

| Neighborhood | Area |
|---|---|
| Downtown Memphis | Core |
| Midtown | Core |
| Cooper-Young | Core |
| South Main Arts District | Core |
| Overton Square | Core |
| East Memphis | East |
| Germantown | East |
| Cordova | East |
| Bartlett | North |
| Binghampton | Mid-East |
| Whitehaven | South |
| Collierville | Southeast |
| Harbor Town | River |
| Frayser | North |
| Millington | North |
| Raleigh | North |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (with `persist` middleware) |
| Routing | React Router v7 |
| Map | Mapbox GL JS v3 |
| Icons | Lucide React |
| Linting | ESLint + `react-hooks` + `@typescript-eslint` |

---

## Project Structure

```
src/
├── components/
│   ├── bartrrr/       # Domain components (TradeCard, OfferThread, ListingsMap, etc.)
│   ├── layout/        # Shell, Sidebar, Header, BottomBar, NotificationDropdown
│   └── ui/            # Base components (Button, Input, Avatar, Badge, etc.)
├── data/              # Mock seed data (users, listings, offers, agreements)
├── lib/utils/         # cn, formatDistance, geolocation, zip validation
├── pages/             # One file per route
├── providers/         # AuthProvider + useAuth hook
├── stores/            # Zustand stores (auth, listings, offers, agreements, reviews, notifications, users)
├── styles/            # globals.css (Tailwind + design tokens)
└── types/             # Shared TypeScript types
```

---

## Design System

Earthy, warm color palette:

| Token | Value | Usage |
|---|---|---|
| `clay` | `#C05A35` | Primary actions, brand |
| `forest` | `#2D5016` | CTA sections, success |
| `teal` | `#3AABA6` | Services category |
| `gold` | `#C88A2A` | Skills category, ratings |
| `cream` | `#F5F0E8` | Page background |
| `ink` | `#1C1917` | Primary text |
| `sand` | `#D4C4A8` | Borders |

Typography uses a display serif for headings and system sans-serif for body.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Mapbox](https://mapbox.com) account and public token (for the map view)

### Install

```bash
npm install
```

### Environment

Create `.env.local` in the project root:

```env
VITE_MAPBOX_TOKEN=pk.your_token_here
```

Without a token the map view shows a setup prompt; all other features work normally.

### Run

```bash
npm run dev
```

### Lint & Type Check

```bash
npx eslint src --ext .ts,.tsx
npx tsc --noEmit
```

---

## Demo Users

The app ships with 8 pre-seeded demo users. On signup/login you pick one to explore as:

| Name | Neighborhood | Specialty |
|---|---|---|
| Jamie Oakley | Downtown Memphis | Gardening & furniture |
| Maria Santos | Midtown | Math tutoring |
| Alex Chen | Cooper-Young | Handyman & woodworking |
| Priya Patel | Germantown | Plants & pottery |
| Jordan Williams | Binghampton | Student swap |
| Sam Nguyen | Overton Square | Bike repair |
| Nina Rodriguez | South Main Arts District | Graphic design |
| Dave Morrison | East Memphis | Home cooking |

---

## Roadmap

- [ ] Smart matching ("Perfect Match" alerts based on interests)
- [ ] Neighborhood activity feed
- [ ] "First Trade" celebration animation
- [ ] Dark mode
- [ ] Supabase backend (auth, real-time offers, persistent data)
- [ ] Push notifications
- [ ] Expand to additional cities
