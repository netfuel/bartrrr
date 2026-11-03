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
