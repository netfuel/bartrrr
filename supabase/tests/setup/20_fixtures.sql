-- Shared fixtures in the template database every test file starts from.
-- Four neighbors sign up; 004's auth trigger creates their profiles.
-- Each test file adds its own listings, offers and agreements.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ann@example.com', '{"full_name":"Ann Alpha"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com', '{"full_name":"Bob Beta"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'cat@example.com', '{"full_name":"Cat Gamma"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'dan@example.com', '{"full_name":"Dan Delta"}');

insert into auth.identities (user_id, provider) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'email'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'google'),
  ('cccccccc-0000-0000-0000-000000000003', 'email'),
  ('dddddddd-0000-0000-0000-000000000004', 'apple');

update public.users set neighborhood = 'Cooper-Young' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.users set neighborhood = 'Midtown'      where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.users set neighborhood = 'Binghampton'  where id = 'cccccccc-0000-0000-0000-000000000003';
update public.users set neighborhood = 'Crosstown'    where id = 'dddddddd-0000-0000-0000-000000000004';

-- Sanity: the profiles exist (a broken auth trigger would make every file fail)
do $$ begin
  if (select count(*) from public.users) <> 4 then
    raise exception 'fixtures: expected 4 profiles from the auth trigger, found %',
      (select count(*) from public.users);
  end if;
end $$;
