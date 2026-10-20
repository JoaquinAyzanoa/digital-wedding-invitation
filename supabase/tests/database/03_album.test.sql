-- Album: the photos go to Google Drive through the Apps Script, without Supabase. What is
-- left here: guests cannot upload to Storage, and the old script RPCs are gone.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(5);

delete from public.invitations;
update public.site_content
set public_data = '{"album": {"enabled": true, "opensAt": "2000-01-01", "closesAt": "2999-01-01"}}'
where id = 1;
insert into public.invitations (code, display_name) values ('tst2', 'Familia Test');

select hasnt_function('public', 'album_drive_check', 'the album check RPC is gone');
select hasnt_function('public', 'register_drive_photo', 'the photo register RPC is gone');
select hasnt_function('public', 'admin_set_album_upload_url', 'the upload URL is plain content now');

set local role anon;
select is(public.get_invitation('tst2', false) ? 'albumUploadUrl', false,
  'the guest view has no upload URL (it is in the public content)');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('album', 'tst2/11111111-1111-4111-8111-111111111111.webp')$$,
  '42501', null, 'guests cannot upload to Supabase Storage');
set local role postgres;

select * from finish();
rollback;
