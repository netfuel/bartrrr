# Bartr — Project Brief for Claude Code

> Read this file at the start of every session. It contains the full product context,
> design system, component conventions, and coding standards for the Bartr project.

---

## 1. What is Bartr?

Bartr is a **hyperlocal web application** that lets neighbors trade goods and services
without money changing hands. It replaces cash transactions with a structured
offer/counter-offer system, real-time messaging, map-based discovery, and a
formalized trade agreement between parties.

**Core tagline:** "Trade, don't buy."

**The one-sentence pitch:** Bartr makes swapping with your neighbors as easy as
texting — no price tags, no cash, just fair exchange.

---

## 2. Product Principles

Every feature, component, and copy decision should be checked against these:

| Principle | What it means in practice |
|---|---|
| **Trade, not buy** | Never show price tags or currency. Every interaction is an exchange. Always show both sides of a trade. |
| **Local first** | Scope everything to proximity. Show distance, neighborhood names, and maps everywhere relevant. |
| **Trust through transparency** | Surface reputation scores, trade history, and formalized agreements. Reduce ambiguity at every step. |
| **Simplicity over complexity** | The flow should feel as easy as knocking on a neighbor's door. Avoid jargon ("initiate transaction" → "make an offer"). |

---

## 3. Target Users

### Primary personas
- **The Declutterer** — Has surplus household goods, wants to trade for things they actually need.
- **The Skill Sharer** — Has expertise (tutoring, handyman, gardening) to offer in exchange for goods or services.
- **The Community Builder** — Already trades informally; wants a centralized, organized tool.
- **The Budget-Conscious Neighbor** — Cash-poor but rich in time, skills, or unused stuff.

### Anti-personas (explicitly out of scope)
- Businesses or commercial sellers
- Users looking to buy/sell for cash
- Long-distance or national trades

---

## 4. Tech Stack

```
Framework:     Next.js 14 (App Router)
Styling:       Tailwind CSS with custom config
Fonts:         Fraunces (display) + Outfit (body) via next/font/google
Icons:         Lucide React
Maps:          Mapbox GL JS
Realtime:      Supabase Realtime (or Pusher — TBD)
Database:      Supabase (Postgres)
Auth:          Supabase Auth
Image upload:  Supabase Storage
State:         Zustand (global) + React Query (server state)
Forms:         React Hook Form + Zod
```

When adding new dependencies, prefer libraries already in this list before
reaching for something new. Ask before introducing a new major dependency.

---

## 5. Design System

### 5.1 Color Tokens

Add these to `tailwind.config.ts` under `theme.extend.colors`:

```ts
colors: {
  clay: {
    DEFAULT: '#C05A35',
    light:   '#F5E8E1',
    mid:     '#E8A88C',
    dark:    '#7A3318',
  },
  forest: {
    DEFAULT: '#2A5240',
    light:   '#E2EDE8',
    mid:     '#6A9E87',
    dark:    '#162E24',
  },
  teal: {
    DEFAULT: '#3AABA6',
    light:   '#DFF3F2',
    dark:    '#1D6662',
  },
  gold: {
    DEFAULT: '#C88A2A',
    light:   '#FAF0DC',
  },
  moss: {
    DEFAULT: '#7A9A3A',
    light:   '#EAF0DB',
  },
  sand: {
    DEFAULT: '#D4B896',
    light:   '#F5EDE0',
  },
  cream:  '#F8F3EC',
  ink: {
    DEFAULT: '#1A1714',
    2:       '#3D3830',
  },
  muted:  '#8A8278',
}
```

### 5.2 CSS Variables (globals.css)

```css
:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Outfit', system-ui, sans-serif;

  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   18px;
  --radius-xl:   28px;
  --radius-pill: 9999px;
}
```

### 5.3 Typography

| Token    | Font      | Size  | Weight | Notes                        |
|----------|-----------|-------|--------|------------------------------|
| display  | Fraunces  | 36px  | 700    | Hero moments, landing page   |
| h1       | Fraunces  | 28px  | 700    | Page titles                  |
| h2       | Fraunces  | 22px  | 600    | Section headings             |
| h3       | Outfit    | 17px  | 600    | Card titles, sub-sections    |
| body     | Outfit    | 15px  | 400    | Default prose, descriptions  |
| small    | Outfit    | 13px  | 400    | Metadata, timestamps         |
| label    | Outfit    | 11px  | 600    | Uppercase labels, caps 0.1em |

### 5.4 Spacing Scale

Use Tailwind's default spacing scale. Key landmarks:
- `p-3` (12px) — component internal padding (tight)
- `p-4` (16px) — component internal padding (default)
- `p-6` (24px) — card padding
- `gap-3` / `gap-4` — standard flex/grid gaps
- `mb-10` / `mb-16` — section separators

### 5.5 Border Radius

Always use the named radius tokens, never arbitrary values:

| Token       | Value  | Used for                        |
|-------------|--------|---------------------------------|
| `rounded-sm`  | 8px  | Badges, small chips, inputs     |
| `rounded-md`  | 12px | Buttons, form fields            |
| `rounded-lg`  | 18px | Cards, panels                   |
| `rounded-xl`  | 28px | Hero sections, large containers |
| `rounded-full`| pill | CTAs, avatar circles, tags      |

---

## 6. Component Library

### 6.1 Buttons

```tsx
// Primary CTA — always Clay
<Button variant="primary">Make an offer</Button>

// Confirmation — Teal (used after both parties agree)
<Button variant="confirm">Confirm trade ✓</Button>

// Secondary action — Forest
<Button variant="secondary">View on map</Button>

// Outline — Clay border, transparent fill
<Button variant="outline">Counter offer</Button>

// Ghost — subtle, low-emphasis
<Button variant="ghost">Skip</Button>
```

Rules:
- All buttons use `rounded-full` (pill shape)
- Font weight always 600
- Never use `disabled` styling as the only affordance — add helper text too
- Primary CTA should always be the rightmost / bottom action in a flow

### 6.2 Badges & Category Tags

Category color mapping — use consistently everywhere:

| Category          | Color   | Badge class          |
|-------------------|---------|----------------------|
| Goods             | Clay    | `badge-clay`         |
| Services          | Teal    | `badge-teal`         |
| Skills/Expertise  | Gold    | `badge-gold`         |
| Outdoor/Garden    | Moss    | `badge-moss`         |
| Trade active      | Green   | `badge-active`       |
| Closed            | Gray    | `badge-closed`       |

### 6.3 Trade Listing Card

The primary content unit. Always includes:
1. **Image area** — 140px tall, clay-light bg as fallback, category badge top-left
2. **Title** — Fraunces, 16px/600
3. **Meta row** — distance (📍), neighborhood name, dot separator
4. **Seeking section** — forest-light bg, shows what the poster wants in return
5. **Footer** — avatar + name + star rating on left, "Offer" CTA on right

The seeking section is **non-optional**. If a user hasn't filled it in,
show a prompt: "What would you like in return?" — never leave it blank.

### 6.4 Offer / Negotiation Thread

Message bubbles follow a strict visual grammar:
- **Their offer** — cream bg, border, `rounded-[18px_18px_18px_4px]`, left-aligned
- **Your counter** — clay bg, white text, `rounded-[18px_18px_4px_18px]`, right-aligned
- **Confirmed deal** — teal-light bg, teal border, left-aligned (same shape as theirs)

Above each bubble cluster, show a small uppercase label: "Jamie's offer" / "You".

### 6.5 Trade Agreement Card

Shown when both parties have accepted. Forest-light background.
Always shows **both directions** of the trade as separate rows:
```
[Avatar A] → [Item A gives]  ⇄  [Avatar B]
[Avatar B] → [Item B gives]  ⇄  [Avatar A]
```
CTA: "Sign agreement" in Teal. After both sign, show a confirmation state.

### 6.6 User Avatar

- Shape: always circle (`rounded-full`)
- Fallback: 2-letter initials, colored background based on user ID hash
- Sizes: sm (22px), md (32px), lg (44px), xl (64px)
- Show reputation score (⭐ 4.9) and trade count inline next to avatar in cards

---

## 7. Page Structure & Key Routes

```
/                        Landing / marketing page
/browse                  Map + listing grid view (main app)
/listing/[id]            Single listing detail
/listing/new             Create a new listing
/offers                  Inbox — all active trade threads
/offers/[id]             Single offer negotiation thread
/agreements              All signed/pending trade agreements
/agreements/[id]         Single agreement detail + signing
/profile/[username]      Public profile, trade history, reputation
/settings                Account settings
```

### Layout conventions
- **Sidebar nav** on desktop (240px), **bottom tab bar** on mobile
- Primary nav items: Browse, My Offers, Agreements, Profile
- Global search in header — searches listings by item name and neighborhood
- Map always visible on Browse page (split view: map left, cards right on desktop)

---

## 8. Voice & Copy Guidelines

### Always say → Never say
| ✅ Do | ❌ Don't |
|---|---|
| "Make an offer" | "Submit a bid" |
| "Propose a swap" | "Initiate a transaction" |
| "Your neighbor Jamie" | "User ID 8421" |
| "0.4 mi away" | "Approximate distance: 0.6km" |
| "Sign the agreement" | "Finalize the barter contract" |
| "What are you looking for?" | "Enter desired exchange item" |
| "Ready to swap?" | "Confirm trade completion" |

### Tone rules
- Write like a trusted neighbor, not a platform
- Short sentences. Conversational. No legal-speak.
- Celebrate trades: "🎉 Trade confirmed! Jamie's bike is yours." — moments of delight matter
- Empty states should be warm and encouraging, never just "No results found"

### Empty state copy examples
```
Browse (no nearby listings):   "Your neighbors haven't posted yet — be the first! Post something you'd love to trade."
Offers (empty inbox):          "No offers yet. Browse nearby listings and propose a swap."
Agreements (none):             "Your agreements will live here once you've confirmed a trade."
```

---

## 9. Photography & Visual Language

When selecting or sourcing images for the UI (listing photos, onboarding,
marketing):

**Use:**
- Warm, golden-hour or natural window light
- Close crops on hands near objects — exchange, creation, touch
- Real, unpolished spaces: honest desks, real mess, everyday objects
- Community shots: people nearby, overhead angles, adjacency over eye-contact
- Earthy tones: terracotta, sand, warm wood, linen

**Avoid:**
- Cold, blue-toned studio lighting
- Stock handshakes or posed smiling portraits
- Any imagery suggesting cash, price tags, or commerce
- Generic "marketplace app" visual tropes

---

## 10. Illustration Style

Abstract mark-making in the earthy palette — inspired by loose paint strokes.
Used for: empty states, onboarding screens, background decorations.

Palette for illustrations:
- Clay `#C05A35`, Gold `#C88A2A`, Moss `#7A9A3A`, Forest Mid `#6A9E87`
- Brush stroke shapes, slightly rotated (±5°), layered with varying opacity
- On dark surfaces: same palette with ink `#1A1714` base

---

## 11. Coding Conventions

### File structure
```
src/
  app/                  Next.js App Router pages
  components/
    ui/                 Base components (Button, Badge, Avatar, Input...)
    bartr/              Domain components (TradeCard, OfferThread, AgreementCard...)
    layout/             Nav, Sidebar, BottomBar, PageShell
  lib/
    supabase/           Client, server, middleware helpers
    utils/              cn(), formatDistance(), hashToColor()...
  hooks/                useListings, useOffers, useLocation...
  types/                Shared TypeScript types
  styles/               globals.css
```

### Component conventions
- All components in `components/` are TypeScript `.tsx` files
- Use `cn()` (clsx + tailwind-merge) for conditional class names — never string concatenation
- Props interfaces named `[ComponentName]Props`
- Export components as named exports, not default exports (except pages)
- Co-locate component-specific types in the same file unless shared

### Tailwind conventions
- Never use arbitrary values `[#abc123]` for colors — use the design token names
- Never use arbitrary values for spacing unless truly one-off
- Responsive: mobile-first. `sm:` = 640px, `md:` = 768px, `lg:` = 1024px
- Dark mode: use `dark:` variant — dark mode base is `#1A1714`, not pure black

### Data & types
```ts
// Core domain types — always use these shapes

type Listing = {
  id: string
  title: string
  description: string
  category: 'goods' | 'services' | 'skills' | 'outdoor'
  seeking: string           // What the poster wants in return
  images: string[]
  userId: string
  location: { lat: number; lng: number; neighborhood: string }
  distanceMi?: number       // Computed client-side, not stored
  createdAt: string
  status: 'active' | 'pending' | 'closed'
}

type Offer = {
  id: string
  listingId: string
  fromUserId: string
  toUserId: string
  messages: OfferMessage[]
  status: 'pending' | 'countered' | 'accepted' | 'declined'
  createdAt: string
}

type TradeAgreement = {
  id: string
  offerId: string
  partyA: { userId: string; item: string; signed: boolean }
  partyB: { userId: string; item: string; signed: boolean }
  status: 'pending_signatures' | 'active' | 'completed'
  createdAt: string
}

type UserProfile = {
  id: string
  username: string
  avatarUrl?: string
  neighborhood: string
  reputationScore: number   // 0–5
  tradeCount: number
  joinedAt: string
}
```

### Utilities to always have available
```ts
// cn — conditional classnames
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs) { return twMerge(clsx(inputs)) }

// Format distance for display
export function formatDistance(mi: number): string {
  if (mi < 0.1) return 'Nearby'
  if (mi < 1) return `${(mi * 5280).toFixed(0)} ft away`
  return `${mi.toFixed(1)} mi away`
}

// Deterministic avatar color from user ID
const AVATAR_COLORS = ['#C05A35','#2A5240','#3AABA6','#C88A2A','#7A9A3A']
export function hashToColor(id: string): string {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}
```

---

## 12. What to Build First (Suggested Order)

1. **Design token setup** — Tailwind config, globals.css, font loading
2. **Base UI components** — Button, Badge, Avatar, Input, Chip
3. **TradeCard component** — The core listing unit
4. **Browse page** — Map + card grid layout (can mock data initially)
5. **Listing detail page** — Full listing + "Make an offer" CTA
6. **Offer thread** — The negotiation messaging UI
7. **Trade agreement** — The signing flow
8. **Auth** — Sign up / log in (Supabase Auth)
9. **Create listing flow** — Multi-step form
10. **User profile page**

---

## 13. What NOT to Build

- No payment processing of any kind
- No price fields, no currency, no monetary values anywhere in the UI
- No national or long-distance trading features
- No business/commercial seller accounts
- No ads, promoted listings, or monetization UI

If a feature request involves money or commerce, flag it as out of scope.

---

*Last updated from Bartr design session — style guide v2 with photo-influenced palette.*
