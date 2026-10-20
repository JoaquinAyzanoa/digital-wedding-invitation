-- get_invitation and submit_rsvp, called as anon like the public site does.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(30);

delete from public.invitations;
update public.site_content
set public_data = '{
  "rsvp": {
    "deadline": "2999-01-01",
    "closed": false,
    "menuOptions": ["Carne", "Infantil"],
    "questions": { "transport": true, "lodging": false, "song": true, "parts": false }
  },
  "album": { "enabled": false }
}'
where id = 1;
insert into public.invitations (code, display_name, seats, updated_at)
values ('tst234', 'Familia Test', 3, '2020-01-01');

-- get_invitation
set local role anon;
select is(public.get_invitation('zzzzzz'), null, 'unknown code returns null');
select is(public.get_invitation('bad'), null, 'malformed code returns null');
select is(public.get_invitation(' TST234 ') ->> 'displayName', 'Familia Test',
  'code is trimmed and case-insensitive');
select is(public.get_invitation('tst234', false) -> 'response', 'null'::jsonb,
  'response is null while pending');
select is((public.get_invitation('tst234', false) ->> 'rsvpOpen')::boolean, true,
  'rsvp is open before the deadline');
set local role postgres;

select is((select open_count from public.invitations where code = 'tst234'), 1,
  'tracked visit increments open_count');
select isnt((select first_opened_at from public.invitations where code = 'tst234'), null,
  'tracked visit sets first_opened_at');
select is((select updated_at from public.invitations where code = 'tst234'),
  '2020-01-01'::timestamptz, 'a visit alone does not change updated_at');

-- submit_rsvp: validation
set local role anon;
select is(public.submit_rsvp('zzzzzz', '{"attending": false}'), null,
  'unknown code: null (the miss counts towards the guessing brake)');
select throws_ok($$select public.submit_rsvp('tst234', '{}')$$,
  'P0001', 'invalid_payload', 'attending is required');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": "yes"}')$$,
  'P0001', 'invalid_payload', 'attending must be boolean');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": []}')$$,
  'P0001', 'invalid_attendees', 'at least one attendee');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "A", "menu": "Carne"}, {"fullName": "B", "menu": "Carne"},
    {"fullName": "C", "menu": "Carne"}, {"fullName": "D", "menu": "Carne"}]}')$$,
  'P0001', 'invalid_attendees', 'no more attendees than seats');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "  ", "menu": "Carne"}]}')$$,
  'P0001', 'invalid_attendees', 'fullName is required');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "A", "menu": "Sushi"}]}')$$,
  'P0001', 'invalid_attendees', 'menu must be a configured option');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "A", "kind": "child", "menu": "Infantil"}]}')$$,
  'P0001', 'invalid_attendees', 'child needs an age');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "A", "kind": "child", "age": 18, "menu": "Infantil"}]}')$$,
  'P0001', 'invalid_attendees', 'child age must be 0-17');
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": false, "message": 5}')$$,
  'P0001', 'invalid_payload', 'texts must be strings');

-- submit_rsvp: success, replace, decline
select lives_ok($$select public.submit_rsvp('tst234', '{
    "attending": true,
    "attendees": [
      {"fullName": "Ana Test", "kind": "adult", "menu": "Carne", "dietary": ""},
      {"fullName": "Mateo Test", "kind": "child", "age": 6, "menu": "Infantil", "dietary": "Maní"}
    ],
    "needsTransport": true,
    "needsLodging": true,
    "songRequest": "Una canción",
    "message": "¡Felicidades!"
  }')$$, 'valid rsvp is accepted');
set local role postgres;

select is((select count(*) from public.attendees a join public.invitations i on i.id = a.invitation_id
  where i.code = 'tst234'), 2::bigint, 'attendees are saved');
select is((select dietary from public.attendees where full_name = 'Ana Test'), null,
  'empty strings are stored as null');
select is((select updated_at from public.invitations where code = 'tst234'), now(),
  'an rsvp updates updated_at');
select results_eq(
  $$select attending, needs_transport, needs_lodging, attends_ceremony
    from public.invitations where code = 'tst234'$$,
  $$values (true, true, null::boolean, true)$$,
  'answers to disabled questions are dropped; parts default to both');

set local role anon;
select lives_ok($$select public.submit_rsvp('tst234', '{"attending": true, "attendees": [
    {"fullName": "Ana Test", "menu": "Carne"}]}')$$, 'rsvp can be changed');
select is(jsonb_array_length(public.get_invitation('tst234', false) #> '{response,attendees}'), 1,
  'a new rsvp replaces the attendees');
select is((public.submit_rsvp('tst234', '{"attending": false}') #>> '{response,attending}')::boolean,
  false, 'declining returns attending = false');
set local role postgres;

select is((select count(*) from public.attendees), 0::bigint, 'declining removes attendees');

-- closing
update public.site_content
set public_data = jsonb_set(public_data, '{rsvp,closed}', 'true') where id = 1;
set local role anon;
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": false}')$$,
  'P0001', 'rsvp_closed', 'manual close blocks rsvp');
set local role postgres;

update public.site_content
set public_data = jsonb_set(jsonb_set(public_data, '{rsvp,closed}', 'false'),
  '{rsvp,deadline}', '"2000-01-01"') where id = 1;
set local role anon;
select throws_ok($$select public.submit_rsvp('tst234', '{"attending": false}')$$,
  'P0001', 'rsvp_closed', 'past deadline blocks rsvp');
set local role postgres;

-- a bare-date deadline lasts until the end of that day in Lima (UTC-5)
select is(private.lima_instant('2027-04-15', true), '2027-04-16 05:00:00+00'::timestamptz,
  'date-only deadline ends at midnight Lima time');

select * from finish();
rollback;
