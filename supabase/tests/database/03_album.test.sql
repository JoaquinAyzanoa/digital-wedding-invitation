-- Album in Google Drive: the Apps Script's checks (album_drive_check, register_drive_photo,
-- google_register_folder), the admin's upload URL and the guest's albumUploadUrl.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(20);

delete from public.invitations;
update public.site_content
set public_data = '{"album": {"enabled": true, "opensAt": "2000-01-01", "closesAt": "2999-01-01"}}'
where id = 1;
insert into public.invitations (code, display_name) values ('tst234', 'Familia Test');
select set_config('test.secret',
  (select value from private.settings where key = 'sheet_secret'), true);
update private.settings set value = null where key in ('album_upload_url', 'album_folder_url');

-- the admin connects the web app
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "app_metadata": {}}', true);
select throws_ok(
  $$select public.admin_set_album_upload_url('https://script.google.com/macros/s/AKfy_x-1/exec')$$,
  'P0001', 'forbidden', 'a non-admin cannot set the upload URL');
select set_config('request.jwt.claims',
  '{"role": "authenticated", "app_metadata": {"role": "admin"}}', true);
select throws_ok($$select public.admin_set_album_upload_url('https://evil.example.com/exec')$$,
  'P0001', 'invalid_payload', 'only an Apps Script web app URL is accepted');
select lives_ok(
  $$select public.admin_set_album_upload_url('https://script.google.com/macros/s/AKfy_x-1/exec')$$,
  'the admin sets the web app URL');
set local role postgres;

-- guests get it with their invitation, only while the album is open
set local role anon;
select is(public.get_invitation('tst234', false) ->> 'albumUploadUrl',
  'https://script.google.com/macros/s/AKfy_x-1/exec', 'a guest gets the upload URL');

-- the script's checks need the secret
select throws_ok($$select public.album_drive_check('wrong', 'tst234')$$,
  'P0001', 'forbidden', 'the check needs the secret');
select throws_ok(
  format('select public.album_drive_check(%L, %L)', current_setting('test.secret'), 'zzzzzz'),
  'P0001', 'invitation_not_found', 'unknown codes are rejected');
select is(public.album_drive_check(current_setting('test.secret'), ' TST234 '),
  '{"code": "tst234", "displayName": "Familia Test", "count": 0}'::jsonb,
  'the check says who the photo is for');
select throws_ok($$select public.register_drive_photo('wrong', 'tst234', '1AbCdEfGhIjK', 'a.jpg', 10)$$,
  'P0001', 'forbidden', 'registering needs the secret');
select throws_ok(format('select public.register_drive_photo(%L, %L, %L, %L, 10)',
  current_setting('test.secret'), 'tst234', '../x', 'a.jpg'),
  'P0001', 'invalid_payload', 'Drive file ids are validated');
select lives_ok(format('select public.register_drive_photo(%L, %L, %L, %L, 4200000)',
  current_setting('test.secret'), 'tst234', '1AbCdEfGhIjK_-x', 'IMG_0001.JPG'),
  'the script records a saved photo');
select lives_ok(format('select public.register_drive_photo(%L, %L, %L, %L, 4200000)',
  current_setting('test.secret'), 'tst234', '1AbCdEfGhIjK_-x', 'IMG_0001.JPG'),
  'recording the same file twice is harmless');
select is((public.album_drive_check(current_setting('test.secret'), 'tst234') ->> 'count')::int, 1,
  'the check counts the photos');
select throws_ok(format('select public.google_register_folder(%L, %L)',
  current_setting('test.secret'), 'https://evil.example.com/x'),
  'P0001', 'invalid_payload', 'only a Drive folder link is accepted');
select lives_ok(format('select public.google_register_folder(%L, %L)',
  current_setting('test.secret'), 'https://drive.google.com/drive/folders/1AbC_dEf-123'),
  'the script registers its folder');
set local role postgres;

select results_eq($$select drive_file_id, file_name, bytes::int from public.album_photos$$,
  $$values ('1AbCdEfGhIjK_-x'::text, 'IMG_0001.JPG'::text, 4200000)$$,
  'the photo is stored once');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role": "authenticated", "app_metadata": {"role": "admin"}}', true);
select is(public.admin_sheet_settings() ->> 'albumFolderUrl',
  'https://drive.google.com/drive/folders/1AbC_dEf-123', 'the admin sees the folder link');
set local role postgres;

-- at most 300 photos per invitation
insert into public.album_photos (invitation_id, drive_file_id)
select (select id from public.invitations where code = 'tst234'), 'file' || g || 'xxxxxxxxxx'
from generate_series(1, 299) g;
set local role anon;
select throws_ok(
  format('select public.album_drive_check(%L, %L)', current_setting('test.secret'), 'tst234'),
  'P0001', 'album_full', 'a full album for the invitation is rejected');
set local role postgres;

-- closed album: no URL for guests, no saving
update public.site_content
set public_data = jsonb_set(public_data, '{album,enabled}', 'false') where id = 1;
delete from public.album_photos;
set local role anon;
select is(public.get_invitation('tst234', false) ->> 'albumUploadUrl', null,
  'no upload URL while the album is closed');
select throws_ok(
  format('select public.album_drive_check(%L, %L)', current_setting('test.secret'), 'tst234'),
  'P0001', 'album_closed', 'a closed album rejects photos');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('album', 'tst234/11111111-1111-4111-8111-111111111111.webp')$$,
  '42501', null, 'guests can no longer upload to Supabase Storage');
set local role postgres;

select * from finish();
rollback;
