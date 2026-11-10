-- S-03 listing photo storage (migration 008).
-- The Storage API enforces the bucket's size and type limits from
-- storage.buckets and runs every insert / update / delete / list through the
-- storage.objects policies as the signed-in user, which is what's exercised here.

select tests.as('trusted');
insert into storage.buckets (id, name, public) values ('other-bucket', 'other-bucket', false);
insert into storage.objects (bucket_id, name) values
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/a1.webp'),
  ('listing-photos', 'bbbbbbbb-0000-0000-0000-000000000002/b1.webp'),
  ('listing-photos', 'bbbbbbbb-0000-0000-0000-000000000002/b2.jpg');

-- ─── Bucket limits ──────────────────────────────────────────────────────────
select tests.check('S-03', 'listing-photos bucket exists and is public (listing photos are public)',
  (select public from storage.buckets where id = 'listing-photos'));
select tests.check('S-03', 'size limit is 2 MB',
  (select file_size_limit = 2 * 1024 * 1024 from storage.buckets where id = 'listing-photos'),
  (select 'file_size_limit = ' || coalesce(file_size_limit::text, 'none') from storage.buckets where id = 'listing-photos'));
select tests.check('S-03', 'only WebP and JPEG are allowed',
  (select allowed_mime_types::text[] @> array['image/webp', 'image/jpeg']
          and array['image/webp', 'image/jpeg'] @> allowed_mime_types::text[]
     from storage.buckets where id = 'listing-photos'),
  (select 'allowed_mime_types = ' || coalesce(allowed_mime_types::text, 'any') from storage.buckets where id = 'listing-photos'));
select tests.check('S-03', 'no wildcard MIME types (image/*, */*) or SVG',
  (select not exists (select 1 from unnest(allowed_mime_types) m where m like '%*%' or m like '%svg%')
     from storage.buckets where id = 'listing-photos'));

-- ─── Insert ─────────────────────────────────────────────────────────────────
select tests.as('ann');
select tests.ok('S-03', 'Ann uploads into her own folder',
  $$insert into storage.objects (bucket_id, name) values ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/a2.webp')$$);
select tests.no_effect('S-03', 'Ann can''t upload into Bob''s folder',
  $$insert into storage.objects (bucket_id, name) values ('listing-photos', 'bbbbbbbb-0000-0000-0000-000000000002/evil.webp')$$);
select tests.no_effect('S-03', 'Ann can''t upload to the bucket root',
  $$insert into storage.objects (bucket_id, name) values ('listing-photos', 'loose.webp')$$);
select tests.no_effect('S-03', 'Ann can''t upload into a folder that only starts with her id',
  $$insert into storage.objects (bucket_id, name) values ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001x/a.webp')$$);
select tests.no_effect('S-03', 'Ann can''t upload to another bucket',
  $$insert into storage.objects (bucket_id, name) values ('other-bucket', 'aaaaaaaa-0000-0000-0000-000000000001/a.webp')$$);

-- ─── Update (replace / move) ────────────────────────────────────────────────
select tests.ok('S-03', 'Ann replaces her own photo',
  $$update storage.objects set metadata = '{"size": 1}' where name = 'aaaaaaaa-0000-0000-0000-000000000001/a1.webp'$$);
select tests.no_effect('S-03', 'Ann can''t move her photo into Bob''s folder',
  $$update storage.objects set name = 'bbbbbbbb-0000-0000-0000-000000000002/moved.webp'
     where name = 'aaaaaaaa-0000-0000-0000-000000000001/a1.webp'$$);
select tests.no_effect('S-03', 'Ann can''t move her photo to another bucket',
  $$update storage.objects set bucket_id = 'other-bucket'
     where name = 'aaaaaaaa-0000-0000-0000-000000000001/a1.webp'$$);
select tests.no_effect('S-03', 'Ann can''t overwrite Bob''s photo',
  $$update storage.objects set metadata = '{"size": 1}' where name like 'bbbbbbbb-0000-0000-0000-000000000002/%'$$);
select tests.no_effect('S-03', 'Ann can''t take over Bob''s photo by renaming it into her folder',
  $$update storage.objects set name = 'aaaaaaaa-0000-0000-0000-000000000001/stolen.webp'
     where name = 'bbbbbbbb-0000-0000-0000-000000000002/b1.webp'$$);

-- ─── Delete and list ────────────────────────────────────────────────────────
select tests.no_effect('S-03', 'Ann can''t delete Bob''s photos',
  $$delete from storage.objects where bucket_id = 'listing-photos' and name like 'bbbbbbbb%'$$);
select tests.check('S-03', 'Ann lists only her own folder',
  (select count(*) = 2 and bool_and(name like 'aaaaaaaa-0000-0000-0000-000000000001/%') from storage.objects));
select tests.ok('S-03', 'Ann deletes her own photo',
  $$delete from storage.objects where name = 'aaaaaaaa-0000-0000-0000-000000000001/a2.webp'$$);

select tests.as('anon');
select tests.no_effect('S-03', 'anon can''t upload',
  $$insert into storage.objects (bucket_id, name) values ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/anon.webp')$$);
select tests.no_effect('S-03', 'anon can''t change any object',
  $$update storage.objects set metadata = '{}'$$);
select tests.no_effect('S-03', 'anon can''t delete any object',
  $$delete from storage.objects$$);
select tests.no_rows('S-03', 'anon can''t list objects through the table (public URLs only)',
  $$select * from storage.objects$$);

select tests.as('trusted');
select tests.check('S-03', 'after all attempts: Bob still has exactly his 2 photos, Ann her 1',
  (select count(*) = 2 from storage.objects where name in ('bbbbbbbb-0000-0000-0000-000000000002/b1.webp', 'bbbbbbbb-0000-0000-0000-000000000002/b2.jpg'))
  and (select count(*) = 1 from storage.objects where name like 'aaaaaaaa%')
  and (select count(*) = 3 from storage.objects));

-- ─── T-05 orphaned photos (migration 014) ───────────────────────────────────
-- public.orphaned_photo_paths() lists listing-photos files no listing or
-- profile points at, older than the cutoff, for scripts/sweep-orphan-photos.mjs.
select tests.as('trusted');
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/used-public.webp',  '{"size": 1000}', now() - interval '30 days'),
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/used-render.webp',  '{"size": 1000}', now() - interval '30 days'),
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/used-withdrawn.jpg','{"size": 1000}', now() - interval '30 days'),
  ('listing-photos', 'bbbbbbbb-0000-0000-0000-000000000002/avatar-1.webp',    '{"size": 500}',  now() - interval '30 days'),
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/draft-old.webp',   '{"size": 2048}', now() - interval '10 days'),
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/draft-3days.webp', '{"size": 2048}', now() - interval '3 days'),
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/draft-new.webp',   '{"size": 2048}', now() - interval '1 hour'),
  ('listing-photos', 'eeeeeeee-0000-0000-0000-000000000005/gone.webp',        '{"size": 300}',  now() - interval '60 days'),
  ('other-bucket',   'aaaaaaaa-0000-0000-0000-000000000001/elsewhere.webp',   '{"size": 1}',    now() - interval '60 days');
-- The files from the S-03 checks above (a1, b1, b2) are old and unused too
update storage.objects set created_at = now() - interval '20 days'
 where name in ('aaaaaaaa-0000-0000-0000-000000000001/a1.webp',
                'bbbbbbbb-0000-0000-0000-000000000002/b1.webp',
                'bbbbbbbb-0000-0000-0000-000000000002/b2.jpg');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood, status, images) values
  ('LP1', 'Kettle', 'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young', 'active',
   array['https://ref.supabase.co/storage/v1/object/public/listing-photos/aaaaaaaa-0000-0000-0000-000000000001/used-public.webp',
         'https://ref.supabase.co/storage/v1/render/image/public/listing-photos/aaaaaaaa-0000-0000-0000-000000000001/used-render.webp?width=400',
         'https://example.com/outside.jpg']),
  ('LP2', 'Old lamp', 'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young', 'withdrawn',
   array['https://ref.supabase.co/storage/v1/object/public/listing-photos/aaaaaaaa-0000-0000-0000-000000000001/used-withdrawn.jpg']);
update public.users
   set avatar_url = 'https://ref.supabase.co/storage/v1/object/public/listing-photos/bbbbbbbb-0000-0000-0000-000000000002/avatar-1.webp'
 where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.users set avatar_url = 'https://lh3.googleusercontent.com/a/photo' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select tests.as('service_role');
select tests.check('S-03', 'T-05 orphans (7 days): unused old files only, in path order',
  (select array_agg(path order by path) from public.orphaned_photo_paths())
  = array['aaaaaaaa-0000-0000-0000-000000000001/a1.webp',
          'aaaaaaaa-0000-0000-0000-000000000001/draft-old.webp',
          'bbbbbbbb-0000-0000-0000-000000000002/b1.webp',
          'bbbbbbbb-0000-0000-0000-000000000002/b2.jpg',
          'eeeeeeee-0000-0000-0000-000000000005/gone.webp'],
  (select string_agg(path, ', ' order by path) from public.orphaned_photo_paths()));
select tests.check('S-03', 'T-05 keeps files used by a listing (public or render URL, any status) or an avatar',
  not exists (select 1 from public.orphaned_photo_paths()
               where path like '%/used-%' or path like '%/avatar-%'));
select tests.check('S-03', 'T-05 skips recent uploads (an open Create listing page) and other buckets',
  not exists (select 1 from public.orphaned_photo_paths()
               where path like '%/draft-new.webp' or path like '%/draft-3days.webp' or path like '%/elsewhere.webp'));
select tests.check('S-03', 'T-05 a shorter cutoff (2 days) includes the 3-day-old draft, never the 1-hour one',
  exists (select 1 from public.orphaned_photo_paths(interval '2 days') where path like '%/draft-3days.webp')
  and not exists (select 1 from public.orphaned_photo_paths(interval '2 days') where path like '%/draft-new.webp'));
select tests.check('S-03', 'T-05 reports created_at and size in bytes',
  (select bytes = 2048 and tests.near(created_at, now() - interval '10 days')
     from public.orphaned_photo_paths() where path like '%/draft-old.webp'));
select tests.check('S-03', 'T-05 pages: max_rows, then after_path continues from the last path',
  (select array_agg(path order by path) from public.orphaned_photo_paths(interval '7 days', null, 2))
    = array['aaaaaaaa-0000-0000-0000-000000000001/a1.webp', 'aaaaaaaa-0000-0000-0000-000000000001/draft-old.webp']
  and (select array_agg(path order by path)
         from public.orphaned_photo_paths(interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001/draft-old.webp', 2))
    = array['bbbbbbbb-0000-0000-0000-000000000002/b1.webp', 'bbbbbbbb-0000-0000-0000-000000000002/b2.jpg']);
select tests.check('S-03', 'T-05 at most 1000 rows per call',
  (select count(*) = 5 from public.orphaned_photo_paths(interval '7 days', null, 100000)));
select tests.err('S-03', 'T-05 refuses a cutoff under 1 day (photos in an open form)',
  $$select * from public.orphaned_photo_paths(interval '1 hour')$$, 'at least 1 day');
select tests.check('S-03', 'T-05 listing never deletes: every object is still there',
  (select count(*) = 11 from storage.objects where bucket_id = 'listing-photos'),
  (select count(*) || ' objects' from storage.objects where bucket_id = 'listing-photos'));

select tests.as('ann');
select tests.err('S-03', 'T-05 signed-in neighbors can''t list orphans (every neighbor''s files)',
  $$select * from public.orphaned_photo_paths()$$, 'permission denied');
select tests.as('anon');
select tests.err('S-03', 'T-05 anon can''t list orphans',
  $$select * from public.orphaned_photo_paths()$$, 'permission denied');
