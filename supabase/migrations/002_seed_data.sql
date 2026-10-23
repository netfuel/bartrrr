-- Intentionally empty.
--
-- This migration used to insert demo users and listings, which would have
-- shipped to production on `supabase db push`. The demo data now lives in
-- supabase/seed.sql and loads only on local `supabase db reset`.
--
-- The file is kept (as a no-op) so migration numbering stays stable:
-- databases that already applied 002 keep their history, and a fresh
-- production database applies nothing here.
select 1;
