-- Push notification subscriptions table
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid()::text = user_id);
