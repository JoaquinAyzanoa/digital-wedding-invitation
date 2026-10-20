-- No children: with rsvp.questions.children off (or missing) everyone is an adult.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(3);

delete from public.invitations;
delete from private.code_misses;
-- No "children" key: off. No menu options: no menu asked.
update public.site_content
set public_data = '{
  "rsvp": {
    "deadline": "2999-01-01",
    "closed": false,
    "menuOptions": [],
    "questions": { "transport": false, "lodging": false, "song": false, "parts": false, "dni": false }
  }
}'
where id = 1;
insert into public.invitations (code, display_name, seats) values ('tst2', 'Familia', 2);

set local role anon;
select lives_ok($$select public.submit_rsvp('tst2', '{"attending": true, "attendees": [
  {"fullName": "Ana", "kind": "adult", "menu": "Pescado"},
  {"fullName": "Mateo", "kind": "child", "age": 6}]}')$$,
  'a payload with a child is accepted');
set local role postgres;

select results_eq($$select full_name, kind, age, menu from public.attendees order by position$$,
  $$values ('Ana'::text, 'adult'::text, null::int, null::text), ('Mateo', 'adult', null, null)$$,
  'but everyone is stored as an adult without age, and without a menu');

update public.site_content
set public_data = jsonb_set(public_data, '{rsvp,questions,children}', 'true') where id = 1;
set local role anon;
select lives_ok($$select public.submit_rsvp('tst2', '{"attending": true, "attendees": [
  {"fullName": "Mateo", "kind": "child", "age": 6}]}')$$,
  'with children allowed, a child is a child again');
set local role postgres;

select * from finish();
rollback;
