-- 008: listing photo uploads
--
-- Photos live in the public "listing-photos" bucket under a folder named for
-- the owner's user id: <user id>/<random id>.webp (or .jpg).
--
-- The browser resizes each photo (longest side 1600px) and re-encodes it
-- before upload, which also strips EXIF metadata such as GPS location.
-- The limits below are the server-side backstop.
--
-- Reads are public (listings are public). Only the signed-in owner can add,
-- replace or remove files in their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  2 * 1024 * 1024,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing photos: owner uploads" on storage.objects;
create policy "listing photos: owner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "listing photos: owner reads own" on storage.objects;
create policy "listing photos: owner reads own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "listing photos: owner updates" on storage.objects;
create policy "listing photos: owner updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "listing photos: owner deletes" on storage.objects;
create policy "listing photos: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
