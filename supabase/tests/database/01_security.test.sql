-- RLS, table privileges and function privileges.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(25);

delete from public.invitations;
insert into public.invitations (code, display_name, seats) values ('tst234', 'Familia Test', 2);

-- RLS is enabled on every table
select ok((select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
  'RLS enabled on invitations');
select ok((select relrowsecurity from pg_class where oid = 'public.attendees'::regclass),
  'RLS enabled on attendees');
select ok((select relrowsecurity from pg_class where oid = 'public.site_content'::regclass),
  'RLS enabled on site_content');
select ok((select relrowsecurity from pg_class where oid = 'public.album_photos'::regclass),
  'RLS enabled on album_photos');

-- anon has no table privileges at all
select table_privs_are('public', 'invitations', 'anon', array[]::text[],
  'anon has no privileges on invitations');
select table_privs_are('public', 'attendees', 'anon', array[]::text[],
  'anon has no privileges on attendees');
select table_privs_are('public', 'site_content', 'anon', array[]::text[],
  'anon has no privileges on site_content');
select table_privs_are('public', 'album_photos', 'anon', array[]::text[],
  'anon has no privileges on album_photos');
select table_privs_are('private', 'settings', 'authenticated', array[]::text[],
  'authenticated has no privileges on private.settings');

-- function privileges
select function_privs_are('public', 'admin_dashboard', array[]::name[], 'anon', array[]::text[],
  'anon cannot execute admin_dashboard');
select function_privs_are('public', 'export_for_sheet', array['text', 'text'], 'authenticated',
  array[]::text[], 'authenticated cannot execute export_for_sheet');
select function_privs_are('public', 'submit_rsvp', array['text', 'jsonb'], 'anon',
  array['EXECUTE'], 'anon can execute submit_rsvp');
select is(
  array(select p.proname::text from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and has_function_privilege('anon', p.oid, 'execute')
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    order by p.proname::text collate "C"),
  array['album_drive_check', 'export_for_sheet', 'get_content', 'get_invitation',
        'google_register_folder', 'ping', 'register_drive_photo', 'submit_rsvp'],
  'anon can execute only the guest RPCs and the Google script ones (behind the secret)');
select is(
  array(select p.proname::text from pg_proc p
    where p.pronamespace = 'private'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    order by p.proname::text collate "C"),
  array['is_admin'],
  'authenticated can execute only the private helper used by policies');

-- anon cannot read tables directly
set local role anon;
select throws_ok('select * from public.invitations', '42501', null,
  'anon cannot select invitations');
select throws_ok('select * from public.site_content', '42501', null,
  'anon cannot select site_content');
set local role postgres;

-- authenticated without the admin role sees and changes nothing
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_metadata": {}}',
  true);
select is((select count(*) from public.invitations), 0::bigint,
  'non-admin sees no invitations');
select is((select count(*) from public.site_content), 0::bigint,
  'non-admin sees no site_content');
select throws_ok($$insert into public.invitations (display_name) values ('x')$$, '42501', null,
  'non-admin cannot insert invitations');
select throws_ok('select public.admin_dashboard()', 'P0001', 'forbidden',
  'non-admin gets forbidden from admin_dashboard');

-- admin
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated", "app_metadata": {"role": "admin"}}',
  true);
select is((select count(*) from public.invitations), 1::bigint, 'admin sees invitations');
select lives_ok('select public.admin_dashboard()', 'admin can call admin_dashboard');
select lives_ok($$insert into public.invitations (display_name) values ('Nueva')$$,
  'admin can insert an invitation without a code');
select matches((select code from public.invitations where display_name = 'Nueva'),
  '^[abcdefghjkmnpqrstuvwxyz23456789]{4}$', 'generated code: 4 characters of the unambiguous alphabet');
select lives_ok($$update public.site_content set public_data = '{"a": 1}' where id = 1$$,
  'admin can update site_content');
set local role postgres;

select * from finish();
rollback;
