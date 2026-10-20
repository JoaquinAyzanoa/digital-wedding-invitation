-- admin_save_rsvp / admin_reset_rsvp: RSVP on a guest's behalf from the admin.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.invitations;
-- RSVP closed for guests: the admin can still record answers.
update public.site_content
set public_data = '{
  "rsvp": {
    "deadline": "2000-01-01",
    "closed": true,
    "menuOptions": ["Carne"],
    "questions": { "transport": false, "lodging": false, "song": false, "parts": false }
  }
}'
where id = 1;
insert into public.invitations (id, code, display_name, seats)
values ('00000000-0000-4000-8000-0000000000b1', 'tst234', 'Familia Test', 2);

select function_privs_are('public', 'admin_save_rsvp', array['uuid', 'jsonb'], 'anon',
  array[]::text[], 'anon cannot execute admin_save_rsvp');
select function_privs_are('public', 'admin_reset_rsvp', array['uuid'], 'anon',
  array[]::text[], 'anon cannot execute admin_reset_rsvp');

-- guests are blocked by the deadline
set local role anon;
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": false}')$$,
  'P0001', 'rsvp_closed', 'guests cannot answer after closing');
set local role postgres;

-- a logged-in user without the admin role
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "app_metadata": {}}', true);
select throws_ok(
  $$select public.admin_save_rsvp('00000000-0000-4000-8000-0000000000b1', '{"attending": false}')$$,
  'P0001', 'forbidden', 'non-admins cannot save on behalf of a guest');
select throws_ok($$select public.admin_reset_rsvp('00000000-0000-4000-8000-0000000000b1')$$,
  'P0001', 'forbidden', 'non-admins cannot reset');

-- the admin
select set_config('request.jwt.claims',
  '{"role": "authenticated", "app_metadata": {"role": "admin"}}', true);
select throws_ok(
  $$select public.admin_save_rsvp('00000000-0000-4000-8000-0000000000b1',
    '{"attending": true, "attendees": [{"fullName": "A", "menu": "Pescado"}]}')$$,
  'P0001', 'invalid_attendees', 'the same validation applies to the admin');
select throws_ok(
  $$select public.admin_save_rsvp('00000000-0000-4000-8000-0000000000b2', '{"attending": false}')$$,
  'P0001', 'invitation_not_found', 'unknown invitation');
select is(
  public.admin_save_rsvp('00000000-0000-4000-8000-0000000000b1',
    '{"attending": true, "attendees": [{"fullName": "Ana", "menu": "Carne"},
      {"fullName": "Mateo", "kind": "child", "age": 4, "menu": "Carne"}]}') #>> '{response,attending}',
  'true', 'the admin can answer after the deadline');
select is((select count(*) from public.attendees), 2::bigint, 'attendees saved');

select lives_ok($$select public.admin_reset_rsvp('00000000-0000-4000-8000-0000000000b1')$$,
  'the admin can reset an answer');
set local role postgres;
select results_eq(
  $$select attending, responded_at, (select count(*) from public.attendees)
    from public.invitations where code = 'tst234'$$,
  $$values (null::boolean, null::timestamptz, 0::bigint)$$,
  'reset leaves the invitation pending, without attendees');

select * from finish();
rollback;
