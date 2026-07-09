# Product Requirements Document (PRD)
# Bartr — Local Barter & Exchange Platform

**Version:** 1.0  
**Last Updated:** April 7, 2026  
**Status:** Draft  
**Author:** [Your Name]  
**Stakeholders:** [Product, Engineering, Design, Legal]

---

## 1. Executive Summary

Bartr is a hyperlocal web application that enables neighbors to barter goods and services without money changing hands. The platform replaces cash transactions with a structured offer/counter-offer system, real-time messaging, map-based discovery, and a formalized trade agreement between parties. The goal is to strengthen local communities by making person-to-person trading easy, trustworthy, and organized.

---

## 2. Problem Statement

People accumulate goods they no longer need and possess skills they could share, but there is no mainstream, trade-first platform to connect them with nearby neighbors. Existing marketplaces (Craigslist, Facebook Marketplace, OfferUp) are purchase-oriented, lack structured negotiation, and provide no framework for formalizing a trade. This results in usable goods going to waste and local skills going unshared.

**Key pain points this product addresses:**

- No dedicated platform exists for cashless, local-only barter.
- Existing tools provide no structured way to propose, negotiate, and finalize a trade.
- Users have no lightweight agreement mechanism to hold both parties accountable.
- Discovery of nearby tradeable goods/services is fragmented and inefficient.

---

## 3. Product Vision & Principles

**Vision:** Build the most trusted neighborhood-level trading platform where no money is needed — just fair exchange between neighbors. Bartr makes trading as easy as texting a neighbor.

**Core Principles:**

- **Trade, not buy.** Every interaction is an exchange. No price tags, no currency. Users offer something *in return* for something.
- **Local first.** All activity is scoped to a user's neighborhood. Discovery, matching, and meetups are designed for proximity.
- **Trust through transparency.** Reputation, trade history, and formalized agreements reduce friction and build confidence.
- **Simplicity over complexity.** The system should feel as easy as knocking on a neighbor's door and proposing a swap.

---

## 4. Target Users

### 4.1 Primary Personas

| Persona | Description | Motivation |
|---|---|---|
| **The Declutterer** | Has accumulated household items, furniture, kids' outgrown clothes, electronics, etc. | Wants to trade surplus items for things they actually need rather than deal with selling. |
| **The Skill Sharer** | Has a marketable skill (tutoring, handyman work, gardening, pet sitting, cooking). | Wants to exchange labor/expertise for goods or reciprocal services. |
| **The Community Builder** | Active in their neighborhood, organizes events, already trades informally. | Wants a centralized tool to formalize and scale what they already do. |
| **The Budget-Conscious Neighbor** | Tight on cash but rich in time, skills, or unused goods. | Wants access to things they need without spending money. |

### 4.2 Anti-Personas (Explicitly Out of Scope)

- Businesses looking for a commercial marketplace.
- Users looking to buy/sell for cash.
- Users seeking to trade across long distances or nationally.

---

## 5. Feature Requirements

### 5.1 User Accounts & Profiles

**Priority:** P0 (Must Have)

- **Registration/Login:** Email + password, or OAuth (Google, Apple). Phone number optional for verification.
- **Profile Page:** Display name, avatar, neighborhood, bio, and a "What I'm Looking For" section.
- **Trade Portfolio:** A gallery of items and services the user is offering for trade. Each listing includes photos, description, condition (for goods), and what they'd accept in return.
- **Reputation System:** After each completed trade, both parties leave a rating (1–5 stars) and a short review. Profiles display aggregate rating, total trades completed, and a badge system (e.g., "Verified Neighbor," "10+ Trades," "Top Trader").
- **Verification (Optional):** Address verification via postcard code or utility bill upload to earn a "Verified Local" badge.

### 5.2 Listings

**Priority:** P0 (Must Have)

- **Two Listing Types:**
  - **Goods:** Physical items. Fields: title, description, category, condition (New / Like New / Good / Fair), up to 6 photos, estimated trade value (optional, shown as a range like "I'd trade this for something worth roughly $20–$40 to help with matching — no money changes hands").
  - **Services:** Skills or labor. Fields: title, description, category, estimated time commitment, availability windows, skill level/credentials (optional).
- **Categories (initial set):** Household, Electronics, Furniture, Clothing & Accessories, Kids & Baby, Sports & Outdoors, Books & Media, Tools, Garden & Plants, Food & Homemade Goods, Tutoring & Lessons, Home Repair & Handyman, Pet Care, Tech Help, Creative Services, Transportation/Errands, Other.
- **"Looking For" Tags:** Users can tag each listing with what they'd accept in return (e.g., "Would trade for: gardening help, kids' books, or kitchen appliances").
- **Listing Status:** Active, Pending Trade, Traded, Expired, Withdrawn.
- **Expiration:** Listings auto-expire after 30 days with a renewal prompt.

### 5.3 Discovery & Map Integration

**Priority:** P0 (Must Have)

- **Map View (Primary Discovery):**
  - Default view centers on the user's registered neighborhood.
  - Listings appear as pins on the map, color-coded by category (goods vs. services) or by type.
  - Clicking a pin opens a preview card (photo thumbnail, title, what the user wants in return).
  - Users can adjust the discovery radius: 0.5 mi, 1 mi, 2 mi, 5 mi, 10 mi (default: 2 mi).
  - Location is shown at the neighborhood/zone level, never as an exact address, until both parties agree to a trade.
  - Map provider: Mapbox or Google Maps API.
- **List/Feed View (Secondary Discovery):**
  - Scrollable feed of listings sorted by proximity (default), recency, or relevance.
  - Filter by: category, goods vs. services, distance, listing age.
  - Search bar with keyword search across titles, descriptions, and tags.
- **Smart Matching (P1 — Should Have):**
  - The system identifies mutual matches: "You're offering X and looking for Y. This neighbor is offering Y and looking for X." Surface these as "Perfect Match" notifications.

### 5.4 Dashboard

**Priority:** P0 (Must Have)

The dashboard is the user's command center after login. It must surface all active trading activity at a glance.

**Dashboard Sections:**

- **My Listings:** Grid or list of all the user's active, pending, and completed listings with quick actions (edit, renew, withdraw, mark as traded).
- **Incoming Offers (Bids):** A dedicated feed of offers other users have made on the user's listings. Each offer card shows: the other user's profile snapshot (name, avatar, rating), what they're offering in return, any message attached, and action buttons (Accept / Counter / Decline / Message).
- **Outgoing Offers:** Offers the user has made on other people's listings, with status tracking (Pending, Accepted, Countered, Declined, Expired).
- **Active Trades:** Trades that have been accepted but not yet completed. Shows the trade agreement status, messaging thread link, and a "Mark as Complete" button.
- **Trade History:** Archive of all completed and cancelled trades with links to agreements and reviews.
- **Notifications Center:** Aggregated feed of new offers, counter-offers, messages, trade completions, review requests, and match alerts.
- **Quick Stats Bar:** Total trades completed, average rating, active listings count, pending offers count.

### 5.5 Offer System (Bids)

**Priority:** P0 (Must Have)

The offer system is the core transaction mechanism. It replaces "Add to Cart" with a structured negotiation flow.

**Offer Flow:**

1. **Initiate Offer:** User browses a listing and clicks "Make an Offer." They select one or more items/services from their own portfolio to offer in return, or describe a new offer inline. They can attach a message explaining why the trade is fair.
2. **Offer Received:** The listing owner receives a notification and sees the offer in their dashboard. They can:
   - **Accept** → moves to Trade Agreement phase.
   - **Decline** → optionally with a reason ("not interested," "looking for something else").
   - **Counter-Offer** → modify what they want in return, with a message. This sends a revised offer back.
3. **Negotiation Loop:** Counter-offers can go back and forth (capped at 5 rounds to prevent endless loops). At any point, either party can accept or walk away.
4. **Offer Expiration:** Offers expire after 72 hours if not responded to. The initiator is notified.
5. **Multi-Item Trades:** A single offer can bundle multiple items/services on either side (e.g., "I'll trade my lawnmower + 2 hours of tutoring for your mountain bike").

**Offer Card Data Model:**

- Offer ID
- Initiator (user ID, listing IDs offered)
- Recipient (user ID, listing ID being bid on)
- Items/services offered (from portfolio or described inline)
- Message
- Status: Pending → Accepted / Declined / Countered / Expired / Withdrawn
- Counter-offer chain (array of revisions)
- Timestamps (created, last updated, expires)

### 5.6 Messaging

**Priority:** P0 (Must Have)

- **Contextual Threads:** Every offer automatically creates a messaging thread between the two parties, anchored to the specific trade. Messages appear alongside the offer details for context.
- **Standalone Messages:** Users can also message another user directly from their profile (e.g., to ask a question about a listing before making an offer).
- **Message Types:** Text, photo attachments (for showing item condition, etc.), and system messages (offer status changes, agreement milestones).
- **Read Receipts & Typing Indicators:** Shown in real-time.
- **Notifications:** Push notifications (browser) and email digests for new messages. Configurable frequency (instant, hourly digest, daily digest).
- **Blocking & Reporting:** Users can block another user (hides all their content and prevents messaging) or report a message for abuse.

### 5.7 Trade Agreement (Contract)

**Priority:** P0 (Must Have)

Once an offer is accepted, the system generates a structured Trade Agreement. This is not a legally binding contract, but a formalized, mutually acknowledged record of what was agreed upon. Its purpose is to reduce misunderstandings and create accountability.

**Agreement Generation Flow:**

1. Offer is accepted → System auto-generates a draft agreement populated with data from the accepted offer.
2. Both parties review the draft. Either party can suggest edits (which the other must approve).
3. Both parties digitally acknowledge the agreement (checkbox + "I Agree" button, not a legal e-signature).
4. Agreement is locked and timestamped. Both parties receive a copy (viewable in-app and downloadable as PDF).

**Agreement Contents:**

- **Header:** Agreement ID, date created, platform disclaimer ("This is a voluntary, non-legally-binding agreement between two parties facilitated by Bartr. It is intended to document the terms of a barter exchange and does not constitute a legal contract.").
- **Party A (Initiator):** Display name, profile link, verified status.
- **Party B (Listing Owner):** Display name, profile link, verified status.
- **Party A Provides:** Detailed description of item(s) and/or service(s) being traded, including condition, quantity, and any relevant specifications. Photos attached.
- **Party B Provides:** Same as above.
- **Condition Acknowledgment:** Both parties confirm they have accurately represented the condition of goods or scope of services.
- **Exchange Logistics:**
  - **Method:** In-person meetup / Drop-off / Service performed at location.
  - **Date & Time:** Agreed-upon date/time or window.
  - **Location:** Agreed-upon meetup point (public place recommended; the platform suggests nearby public meeting spots based on both users' neighborhoods).
  - **Special Instructions:** Freeform field for anything else (e.g., "Bring your own bags," "Service will take approximately 3 hours," "Item is heavy — bring a truck").
- **Dispute Clause:** "If either party believes the terms of this agreement were not met, they may flag the trade for review. Bartr will facilitate communication but does not arbitrate disputes or guarantee outcomes."
- **Cancellation Policy:** Either party may cancel before the exchange date. Cancellations within 24 hours of the scheduled exchange are noted on the cancelling party's profile (visible as a reliability metric).
- **Acknowledgment:** Checkbox + "I Agree to These Terms" button for each party. Timestamp of each acknowledgment recorded.
- **Post-Trade Confirmation:** After the exchange, both parties confirm completion in the app. This triggers the review prompt and moves the trade to history.

**Agreement States:** Draft → Under Review → Acknowledged (by both) → Active → Completed / Cancelled / Disputed.

### 5.8 Notifications & Alerts

**Priority:** P1 (Should Have)

- **In-App Notification Center:** Bell icon with unread count. Notification types: new offer, counter-offer, offer accepted/declined/expired, new message, agreement ready for review, trade completion prompt, review request, match alert.
- **Email Notifications:** Configurable per type. Default: immediate for offers and messages, daily digest for everything else.
- **Browser Push Notifications:** Opt-in at first login.

### 5.9 Safety & Moderation

**Priority:** P1 (Should Have)

- **Listing Moderation:** AI-assisted screening for prohibited items (weapons, controlled substances, counterfeit goods, etc.). Manual review queue for flagged listings.
- **Prohibited Items Policy:** Clearly defined and shown during listing creation. Items that cannot be legally exchanged, hazardous materials, live animals (except with specific community rules), etc.
- **User Reporting:** Report a user, listing, or message. Reports go to a moderation queue.
- **Safe Meetup Suggestions:** When an agreement is created, the platform suggests well-lit, public locations near both parties (parks, coffee shops, community centers) using the map integration.
- **Identity Verification Tiers:** Unverified → Email Verified → Phone Verified → Address Verified. Higher verification = more prominent trust badge.

---

## 6. Information Architecture

```
Bartr
├── Landing / Marketing Page
├── Sign Up / Log In
├── Dashboard (authenticated home)
│   ├── Quick Stats Bar
│   ├── My Listings
│   ├── Incoming Offers
│   ├── Outgoing Offers
│   ├── Active Trades
│   ├── Trade History
│   └── Notifications
├── Discover
│   ├── Map View (default)
│   ├── List/Feed View
│   ├── Search & Filters
│   └── Smart Matches
├── Listing Detail Page
│   ├── Photos & Description
│   ├── Owner Profile Snapshot
│   ├── "Make an Offer" CTA
│   └── Related Listings
├── Create / Edit Listing
├── Offer Flow
│   ├── Select Items to Offer
│   ├── Add Message
│   ├── Review & Send
│   └── Negotiation Thread
├── Trade Agreement
│   ├── Draft Review
│   ├── Edit / Suggest Changes
│   ├── Acknowledge
│   ├── Active Agreement View
│   └── PDF Download
├── Messages
│   ├── Conversation List
│   └── Thread View
├── Profile (own)
│   ├── Edit Profile
│   ├── Trade Portfolio
│   ├── Reviews & Ratings
│   └── Settings
├── Profile (other user)
│   ├── Portfolio
│   ├── Reviews
│   └── Message / Report
└── Settings
    ├── Notification Preferences
    ├── Privacy & Location
    ├── Blocked Users
    └── Account Management
```

---

## 7. Technical Architecture (High Level)

### 7.1 Frontend
- **Framework:** React (Next.js) or Vue (Nuxt.js) for SSR and SEO on public pages.
- **State Management:** Zustand or Pinia, depending on framework choice.
- **Map Integration:** Mapbox GL JS (preferred for customization and cost) or Google Maps JavaScript API.
- **Real-Time:** WebSocket connection (Socket.IO or native WS) for messaging, typing indicators, and live notifications.
- **Responsive Design:** Mobile-first. Must be fully functional on mobile browsers; native app is a future consideration (P2).

### 7.2 Backend
- **API:** RESTful API (or GraphQL if the team prefers) running on Node.js (Express/Fastify) or Python (FastAPI/Django).
- **Database:** PostgreSQL for relational data (users, listings, offers, agreements). Redis for caching, session management, and real-time presence.
- **File Storage:** AWS S3 or Cloudflare R2 for listing photos and agreement PDFs.
- **Search:** Elasticsearch or Meilisearch for full-text listing search with geo-filtering.
- **Geospatial:** PostGIS extension for PostgreSQL to handle radius queries and neighborhood scoping.
- **PDF Generation:** Puppeteer or a dedicated library (e.g., pdf-lib) for rendering trade agreements as downloadable PDFs.
- **Authentication:** JWT-based with refresh tokens. OAuth2 for social login.

### 7.3 Infrastructure
- **Hosting:** AWS (ECS/Fargate or Lambda), GCP (Cloud Run), or Vercel/Railway for faster iteration.
- **CDN:** Cloudflare or AWS CloudFront for static assets and image delivery.
- **CI/CD:** GitHub Actions or GitLab CI.
- **Monitoring:** Sentry (errors), Datadog or Grafana (metrics), LogRocket or PostHog (product analytics).

### 7.4 Key Data Models (Simplified)

**User:** id, email, display_name, avatar_url, bio, looking_for, neighborhood_id, location (lat/lng), verification_level, avg_rating, total_trades, created_at.

**Listing:** id, user_id, type (good/service), title, description, category, condition, photos[], looking_for_tags[], estimated_value_range, status, location (lat/lng — neighborhood-level), expires_at, created_at.

**Offer:** id, initiator_id, recipient_id, target_listing_id, offered_listing_ids[], offered_description, message, status, counter_chain[], expires_at, created_at.

**TradeAgreement:** id, offer_id, party_a_id, party_b_id, party_a_provides (JSON), party_b_provides (JSON), exchange_method, exchange_datetime, exchange_location, special_instructions, party_a_acknowledged_at, party_b_acknowledged_at, status, cancellation_note, completed_at, created_at.

**Message:** id, thread_id, sender_id, content, attachments[], type (text/system), read_at, created_at.

**Review:** id, trade_agreement_id, reviewer_id, reviewee_id, rating, comment, created_at.

---

## 8. Success Metrics

| Metric | Definition | Target (6-month) |
|---|---|---|
| **Registered Users** | Total accounts created | 10,000 |
| **Active Traders** | Users who complete ≥1 trade/month | 25% of registered users |
| **Listings Created** | Total active listings on platform | 30,000 |
| **Offer-to-Trade Conversion** | % of offers that result in a completed trade | ≥ 30% |
| **Agreement Completion Rate** | % of acknowledged agreements that reach "Completed" status | ≥ 75% |
| **Average Rating** | Mean trade rating across all reviews | ≥ 4.2 / 5.0 |
| **Time to First Trade** | Median time from account creation to first completed trade | ≤ 7 days |
| **Repeat Trader Rate** | % of users who complete ≥2 trades | ≥ 40% |
| **NPS** | Net Promoter Score from in-app survey | ≥ 50 |

---

## 9. Release Phases

### Phase 1 — MVP (Weeks 1–10)
- User registration, profiles, and basic reputation (ratings after trade).
- Goods and services listings with photos, categories, and "looking for" tags.
- Map-based discovery with radius filter and list view.
- Offer system: make, accept, decline, counter (up to 5 rounds).
- Contextual messaging threads tied to offers.
- Trade Agreement: auto-generated, reviewed, acknowledged by both parties, downloadable as PDF.
- Dashboard: my listings, incoming/outgoing offers, active trades, trade history.
- Basic notification system (in-app + email).

### Phase 2 — Growth & Trust (Weeks 11–18)
- Smart matching ("Perfect Match" alerts).
- Safe meetup location suggestions on the map.
- Enhanced moderation: AI screening for prohibited items, reporting and blocking.
- Address verification for "Verified Local" badge.
- Browser push notifications.
- Search improvements (Elasticsearch integration, typo tolerance, synonym matching).

### Phase 3 — Community & Scale (Weeks 19–26)
- Neighborhood groups/boards for community-specific trading.
- "Trade Circles" — multi-party trades (A gives to B, B gives to C, C gives to A).
- Public trade feed ("Recent trades in your neighborhood") for social proof.
- Mobile-optimized PWA or native app exploration.
- Analytics dashboard for community organizers.
- API for potential third-party integrations.

---

## 10. Open Questions & Risks

| # | Question / Risk | Status | Owner |
|---|---|---|---|
| 1 | Should we support a "trade credit" system (earn credits for giving, spend them later) or stay pure barter only? | Open — needs user research | Product |
| 2 | How do we handle trades where perceived value is very unequal? Do we intervene or leave it to users? | Open | Product / Design |
| 3 | Legal review: does the trade agreement need specific disclaimers per jurisdiction? | Open | Legal |
| 4 | Moderation staffing: at what user volume do we need dedicated moderators vs. community flagging? | Open | Operations |
| 5 | Risk: low initial supply. If not enough listings exist in a neighborhood, the platform feels dead. Mitigation: seed target neighborhoods, partner with community orgs, and launch neighborhood-by-neighborhood. | Identified | Growth |
| 6 | Risk: disputes over trade fairness or item misrepresentation. Mitigation: reputation system, condition photos required, and post-trade reviews create accountability over time. | Identified | Product |
| 7 | Privacy: how do we handle location data? Users should never have their exact home address exposed. | Resolved — neighborhood-level only until agreement phase | Engineering |

---

## 11. Appendix

### A. Competitive Landscape

| Platform | Model | Gap Bartr Fills |
|---|---|---|
| Craigslist / FB Marketplace | Cash-based sales | No trade-first flow, no structured negotiation |
| OfferUp / Letgo | Cash-based mobile sales | No barter system, no agreements |
| Bunz (Toronto) | Barter-focused | Limited geography, no formalized agreement system |
| Nextdoor | Neighborhood social network | Not trade-focused, no offer/bid system |
| Freecycle / Buy Nothing | Free-giving | One-directional (giving, not exchanging) |

### B. Glossary

- **Listing:** An item or service posted by a user for trade.
- **Offer (Bid):** A proposal from one user to another, offering something in return for a listing.
- **Counter-Offer:** A revised offer sent in response to an initial offer.
- **Trade Agreement:** The formalized, mutually acknowledged document recording the terms of an accepted trade.
- **Trade Portfolio:** The collection of a user's active listings.
- **Smart Match:** A system-detected mutual match where each user has what the other wants.
- **Discovery Radius:** The geographic range within which a user sees listings.

---

*This is a living document. Update as decisions are made and user research informs priorities.*
