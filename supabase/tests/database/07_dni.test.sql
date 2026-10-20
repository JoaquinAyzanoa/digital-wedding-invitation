-- DNI of each attendee: required for guests, optional for the admin, only the last 3 digits
-- back to the guest, kept when left empty for the same name, full in the Sheet.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(15);

delete from public.invitations;
delete from private.code_misses;
-- No "dni" key: the question is on by default.
update public.site_content
set public_data = '{
  "rsvp": {
    "deadline": "2999-01-01",
    "closed": false,
    "menuOptions": [],
    "questions": { "transport": false, "lodging": false, "song": false, "parts": false, "children": true }
  }
}'
where id = 1;
insert into public.invitations (id, code, display_name, seats)
values ('00000000-0000-4000-8000-0000000000d1', 'tst2', 'Familia DNI', 3);

set local role anon;
select throws_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult"}]}')$$,
  'P0001', 'invalid_attendees', 'a guest must give each DNI');
select throws_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult", "dni": "1234"}]}')$$,
  'P0001', 'invalid_attendees', 'a DNI has 8 digits');
select throws_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult", "dni": "12345678"},
                {"fullName": "Luis Pérez", "kind": "adult", "dni": "12345678"}]}')$$,
  'P0001', 'invalid_attendees', 'the same DNI cannot appear twice');
select throws_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult", "dni": "12345678"},
                {"fullName": "Mateo Pérez", "kind": "child", "age": 6}]}')$$,
  'P0001', 'invalid_attendees', 'children need a DNI too');

select lives_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult", "dni": "12345678"},
                {"fullName": "Mateo Pérez", "kind": "child", "age": 6, "dni": "07654321"}]}')$$,
  'a guest confirms with the DNIs');
select is(public.get_invitation('tst2', false) #> '{response,attendees}',
  '[{"fullName": "Ana Pérez", "kind": "adult", "age": null, "menu": null, "dietary": null, "dniHint": "678"},
    {"fullName": "Mateo Pérez", "kind": "child", "age": 6, "menu": null, "dietary": null, "dniHint": "321"}]'::jsonb,
  'the guest only gets the last 3 digits back');

-- changing the answer: an empty DNI keeps the one given for the same name
select lives_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": " ana pérez ", "kind": "adult"},
                {"fullName": "Mateo Pérez", "kind": "child", "age": 7}]}')$$,
  'changing the answer without retyping the DNIs');
select throws_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult"},
                {"fullName": "Rosa Pérez", "kind": "adult"}]}')$$,
  'P0001', 'invalid_attendees', 'a new person needs a DNI');
set local role postgres;

select results_eq($$select full_name, dni from public.attendees order by position$$,
  $$values ('ana pérez'::text, '12345678'::text), ('Mateo Pérez', '07654321')$$,
  'the DNIs were kept (leading zeros included)');

-- the Sheet gets them whole
select set_config('test.secret',
  (select value from private.settings where key = 'sheet_secret'), true);
set local role anon;
select is(public.export_for_sheet(current_setting('test.secret')) #>> '{attendees,1,dni}',
  '07654321', 'the Sheet export has the full DNI');
set local role postgres;

-- the admin may save without a DNI
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role": "authenticated", "app_metadata": {"role": "admin"}}', true);
select lives_ok($$select public.admin_save_rsvp('00000000-0000-4000-8000-0000000000d1',
  '{"attending": true, "attendees": [{"fullName": "Abuela Rosa", "kind": "adult"}]}')$$,
  'the admin records a phone confirmation without a DNI');
select throws_ok($$select public.admin_save_rsvp('00000000-0000-4000-8000-0000000000d1',
  '{"attending": true, "attendees": [{"fullName": "Abuela Rosa", "kind": "adult", "dni": "123"}]}')$$,
  'P0001', 'invalid_attendees', 'but a DNI it writes must be valid');
set local role postgres;
select is((select dni from public.attendees), null, 'stored without DNI');

-- question off: no DNI asked or kept
update public.site_content
set public_data = jsonb_set(public_data, '{rsvp,questions,dni}', 'false') where id = 1;
set local role anon;
select lives_ok($$select public.submit_rsvp('tst2', '{"attending": true,
  "attendees": [{"fullName": "Ana Pérez", "kind": "adult", "dni": "12345678"}]}')$$,
  'without the question a DNI is not needed');
set local role postgres;
select is((select dni from public.attendees), null, 'and not stored');

select * from finish();
rollback;
