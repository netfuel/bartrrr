-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Mirrors UserProfile type — synced with Supabase Auth
-- Note: ListingStatus in the app uses 'closed' but DB uses 'completed'/'withdrawn'
-- for richer semantics; the service layer maps between them.
create table public.users (
  id text primary key,  -- matches auth.users.id
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  neighborhood text not null default '',
  interests text[] default '{}',
  reputation_score numeric default 5.0,
  trade_count integer default 0,
  notification_prefs jsonb default '{"newOffers":true,"messages":true,"agreementUpdates":true,"tradeCompletions":true,"perfectMatches":true}',
  joined_at timestamptz default now()
);

-- ─── Listings ────────────────────────────────────────────────────────────────
-- Category: 'goods' | 'services' | 'skills' | 'outdoor'
-- Condition: 'new' | 'like_new' | 'good' | 'fair'
-- Status: 'active' | 'pending' | 'closed' (app) → 'active'|'pending'|'completed'|'withdrawn' (db)
create table public.listings (
  id text primary key default 'listing-' || replace(gen_random_uuid()::text, '-', ''),
  title text not null,
  description text not null,
  category text not null check (category in ('goods', 'services', 'skills', 'outdoor')),
  condition text check (condition in ('new', 'like_new', 'good', 'fair')),
  seeking text not null,
  images text[] default '{}',
  user_id text references public.users(id) on delete cascade not null,
  neighborhood text not null,
  lat numeric,
  lng numeric,
  distance_mi numeric default 0,
  status text default 'active' check (status in ('active', 'pending', 'completed', 'withdrawn')),
  created_at timestamptz default now()
);

-- ─── Offers ──────────────────────────────────────────────────────────────────
-- Status: 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'
create table public.offers (
  id text primary key default 'offer-' || replace(gen_random_uuid()::text, '-', ''),
  listing_id text references public.listings(id) on delete cascade not null,
  from_user_id text references public.users(id) not null,
  to_user_id text references public.users(id) not null,
  status text default 'pending' check (status in ('pending', 'countered', 'accepted', 'declined', 'withdrawn')),
  round integer default 1,
  max_rounds integer default 5,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Offer Messages ───────────────────────────────────────────────────────────
-- The timeline/thread for each offer (maps to Offer.messages in the app)
-- Type: 'offer' | 'counter' | 'accept' | 'decline' | 'message'
create table public.offer_messages (
  id text primary key default 'msg-' || replace(gen_random_uuid()::text, '-', ''),
  offer_id text references public.offers(id) on delete cascade not null,
  from_user_id text references public.users(id) not null,
  type text not null check (type in ('offer', 'counter', 'accept', 'decline', 'message')),
  content text not null,
  items text[] default '{}',
  created_at timestamptz default now()
);

-- ─── Trade Agreements ─────────────────────────────────────────────────────────
-- Status: 'draft' | 'under_review' | 'pending_signatures' | 'active' | 'completed' | 'cancelled' | 'disputed'
-- Exchange method: 'in_person' | 'dropoff' | 'service_at_location'
create table public.agreements (
  id text primary key default 'agreement-' || replace(gen_random_uuid()::text, '-', ''),
  offer_id text references public.offers(id) not null,
  party_a_user_id text references public.users(id) not null,
  party_a_item text not null default '',
  party_a_signed boolean default false,
  party_b_user_id text references public.users(id) not null,
  party_b_item text not null default '',
  party_b_signed boolean default false,
  status text default 'pending_signatures' check (
    status in ('draft', 'under_review', 'pending_signatures', 'active', 'completed', 'cancelled', 'disputed')
  ),
  exchange_method text check (exchange_method in ('in_person', 'dropoff', 'service_at_location')),
  exchange_date text,
  exchange_location text,
  special_instructions text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ─── Reviews ──────────────────────────────────────────────────────────────────
create table public.reviews (
  id text primary key default 'review-' || replace(gen_random_uuid()::text, '-', ''),
  agreement_id text references public.agreements(id) not null,
  reviewer_id text references public.users(id) not null,
  reviewee_id text references public.users(id) not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique(agreement_id, reviewer_id)
);

-- ─── Notifications ────────────────────────────────────────────────────────────
-- Type: 'new_offer' | 'counter_offer' | 'offer_accepted' | 'offer_declined' |
--       'new_message' | 'agreement_ready' | 'trade_complete' | 'review_request' | 'match'
create table public.notifications (
  id text primary key default 'notif-' || replace(gen_random_uuid()::text, '-', ''),
  user_id text references public.users(id) on delete cascade not null,
  type text not null check (
    type in ('new_offer', 'counter_offer', 'offer_accepted', 'offer_declined',
             'new_message', 'agreement_ready', 'trade_complete', 'review_request', 'match')
  ),
  title text not null,
  body text not null,
  data jsonb default '{}',
  read_at timestamptz,
  listing_id text references public.listings(id) on delete set null,
  offer_id text references public.offers(id) on delete set null,
  agreement_id text references public.agreements(id) on delete set null,
  created_at timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.offers enable row level security;
alter table public.offer_messages enable row level security;
alter table public.agreements enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- Users: public read, own write
create policy "Public read users"
  on public.users for select
  using (true);

create policy "Users insert own profile"
  on public.users for insert
  with check (auth.uid()::text = id);

create policy "Users update own profile"
  on public.users for update
  using (auth.uid()::text = id);

-- Listings: public read, owner write
create policy "Public read listings"
  on public.listings for select
  using (true);

create policy "Owner insert listing"
  on public.listings for insert
  with check (auth.uid()::text = user_id);

create policy "Owner update listing"
  on public.listings for update
  using (auth.uid()::text = user_id);

-- Offers: parties only
create policy "Offer parties read"
  on public.offers for select
  using (auth.uid()::text = from_user_id or auth.uid()::text = to_user_id);

create policy "Offer creator insert"
  on public.offers for insert
  with check (auth.uid()::text = from_user_id);

create policy "Offer parties update"
  on public.offers for update
  using (auth.uid()::text = from_user_id or auth.uid()::text = to_user_id);

-- Offer messages: parties of the parent offer only
create policy "Offer message parties read"
  on public.offer_messages for select
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_id
        and (auth.uid()::text = o.from_user_id or auth.uid()::text = o.to_user_id)
    )
  );

create policy "Offer message parties insert"
  on public.offer_messages for insert
  with check (auth.uid()::text = from_user_id);

-- Agreements: parties only
create policy "Agreement parties read"
  on public.agreements for select
  using (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id);

create policy "Agreement insert"
  on public.agreements for insert
  with check (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id);

create policy "Agreement parties update"
  on public.agreements for update
  using (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id);

-- Reviews: public read, reviewer write
create policy "Public read reviews"
  on public.reviews for select
  using (true);

create policy "Reviewer insert"
  on public.reviews for insert
  with check (auth.uid()::text = reviewer_id);

-- Notifications: own only
create policy "Own notifications"
  on public.notifications for all
  using (auth.uid()::text = user_id);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.offers;
alter publication supabase_realtime add table public.offer_messages;
alter publication supabase_realtime add table public.agreements;
alter publication supabase_realtime add table public.notifications;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index on public.listings(user_id);
create index on public.listings(status);
create index on public.listings(neighborhood);
create index on public.offers(listing_id);
create index on public.offers(from_user_id);
create index on public.offers(to_user_id);
create index on public.offer_messages(offer_id);
create index on public.agreements(party_a_user_id);
create index on public.agreements(party_b_user_id);
create index on public.notifications(user_id);
create index on public.notifications(user_id, read_at) where read_at is null;
create index on public.reviews(reviewee_id);
