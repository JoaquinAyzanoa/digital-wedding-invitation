-- get_content, admin_dashboard, export_for_sheet and ping.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.invitations;
update public.site_content
set public_data = '{"couple": {"bride": "A", "groom": "B"}}',
    private_data = '{"gifts": [{"label": "Banco", "lines": ["secret-line"]}]}'
where id = 1;
insert into public.invitations (id, code, display_name, seats, side, attending, needs_transport)
values
  ('00000000-0000-4000-8000-0000000000a1', 'tst234', 'Familia Test', 3, 'bride', true, true),
  ('00000000-0000-4000-8000-0000000000a2', 'tst567', 'Solo', 1, 'groom', false, null),
  ('00000000-0000-4000-8000-0000000000a3', 'tst892', 'Pendiente', 2, 'groom', null, null);
insert into public.attendees (invitation_id, position, full_name, kind, age, menu, dietary)
values
  ('00000000-0000-4000-8000-0000000000a1', 1, 'Ana', 'adult', null, 'Carne', null),
  ('00000000-0000-4000-8000-0000000000a1', 2, 'Mateo', 'child', 6, 'Infantil', 'Maní');

select set_config('test.secret',
  (select value from private.settings where key = 'sheet_secret'), true);

set local role anon;
select is(public.get_content(), '{"couple": {"bride": "A", "groom": "B"}}'::jsonb,
  'get_content returns public_data only');
select is(public.ping(), 1, 'ping works for anon');
select throws_ok($$select public.export_for_sheet('wrong')$$, 'P0001', 'forbidden',
  'wrong secret is rejected');
select throws_ok($$select public.export_for_sheet(null)$$, 'P0001', 'forbidden',
  'missing secret is rejected');
select is(jsonb_array_length(public.export_for_sheet(current_setting('test.secret')) -> 'attendees'),
  2, 'export returns attendees with the right secret');
reset role;

select isnt((select value from private.settings where key = 'last_sheet_sync_at'), null,
  'export records the sync time');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role": "authenticated", "app_metadata": {"role": "admin"}}', true);
select is(public.admin_dashboard() -> 'invitations',
  '{"total": 3, "sent": 0, "opened": 0, "responded": 2, "pending": 1, "accepted": 1, "declined": 1, "seats": 6}'::jsonb,
  'dashboard invitation counts');
select is(public.admin_dashboard() -> 'people',
  '{"confirmed": 2, "adults": 1, "children": 1}'::jsonb, 'dashboard people counts');
select is(public.admin_dashboard() #> '{logistics,transport}',
  '{"invitations": 1, "people": 2}'::jsonb, 'dashboard transport counts');
select is(public.admin_dashboard() -> 'dietary',
  '[{"fullName": "Mateo", "invitation": "Familia Test", "dietary": "Maní"}]'::jsonb,
  'dashboard lists dietary restrictions with names');
select isnt(public.admin_dashboard() #>> '{sheet,lastSyncAt}', null,
  'dashboard shows the last sheet sync');
reset role;

select * from finish();
rollback;
