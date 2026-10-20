-- Album uploads: storage policy, can_upload_album and register_album_photo.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(14);

delete from public.invitations;
update public.site_content
set public_data = '{"album": {"enabled": true, "opensAt": "2000-01-01", "closesAt": "2999-01-01"}}'
where id = 1;
insert into public.invitations (code, display_name) values ('tst234', 'Familia Test');

select ok(private.can_upload_album('tst234/11111111-1111-4111-8111-111111111111.webp'),
  'valid code and name can upload');
select ok(not private.can_upload_album('zzzzzz/11111111-1111-4111-8111-111111111111.webp'),
  'unknown code cannot upload');
select ok(not private.can_upload_album('tst234/../11111111-1111-4111-8111-111111111111.webp'),
  'path traversal is rejected');
select ok(not private.can_upload_album('tst234/sub/11111111-1111-4111-8111-111111111111.webp'),
  'nested folders are rejected');

-- storage policies, as anon
set local role anon;
select lives_ok($$insert into storage.objects (bucket_id, name)
  values ('album', 'tst234/11111111-1111-4111-8111-111111111111.webp')$$,
  'anon can upload to its album folder');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('album', 'zzzzzz/22222222-2222-4222-8222-222222222222.webp')$$,
  '42501', null, 'anon cannot upload to an unknown code');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('site', 'x.webp')$$,
  '42501', null, 'anon cannot upload to the site bucket');
select is((select count(*) from storage.objects where bucket_id = 'album'), 0::bigint,
  'anon cannot list album photos');

-- register_album_photo
select lives_ok($$select public.register_album_photo('tst234',
  'tst234/11111111-1111-4111-8111-111111111111.webp', '{"width": 800, "height": 600, "bytes": 51200}')$$,
  'uploaded photo can be registered');
select throws_ok($$select public.register_album_photo('tst234',
  'tst234/33333333-3333-4333-8333-333333333333.webp')$$,
  'P0001', 'invalid_payload', 'photo must exist in storage');
select throws_ok($$select public.register_album_photo('tst234',
  'abc234/11111111-1111-4111-8111-111111111111.webp')$$,
  'P0001', 'invalid_payload', 'photo must be in the invitation folder');
set local role postgres;

select results_eq($$select width, height, bytes from public.album_photos$$,
  $$values (800, 600, 51200)$$, 'photo metadata is stored');

-- closed album
update public.site_content
set public_data = jsonb_set(public_data, '{album,enabled}', 'false') where id = 1;
select ok(not private.can_upload_album('tst234/44444444-4444-4444-8444-444444444444.webp'),
  'disabled album rejects uploads');
set local role anon;
select throws_ok($$select public.register_album_photo('tst234',
  'tst234/11111111-1111-4111-8111-111111111111.webp')$$,
  'P0001', 'album_closed', 'disabled album rejects registration');
set local role postgres;

select * from finish();
rollback;
