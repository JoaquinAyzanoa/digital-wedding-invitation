-- Short codes (4 characters, older ones still valid) and the per-IP guessing brake.
begin;
-- `supabase test db --linked` connects as a NOINHERIT login role: act as postgres explicitly
-- (a no-op locally). Tests switch to anon/authenticated and back with `set local role`.
set local role postgres;
set local search_path to "$user", public, extensions;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.invitations;
delete from private.code_misses;
insert into public.invitations (display_name) values ('Nueva');
insert into public.invitations (code, display_name) values ('abc234', 'Antigua');
select set_config('test.new_code',
  (select code from public.invitations where display_name = 'Nueva'), true);

select matches((select code from public.invitations where display_name = 'Nueva'),
  '^[abcdefghjkmnpqrstuvwxyz23456789]{4}$', 'new invitations get a 4-character code');
select throws_ok($$insert into public.invitations (code, display_name) values ('abc', 'x')$$,
  '23514', null, 'codes shorter than 4 characters are rejected');

set local role anon;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', true);
select isnt(public.get_invitation(current_setting('test.new_code'), false),
  null, 'a 4-character code opens its invitation');
select isnt(public.get_invitation('abc234', false), null, 'a 6-character code still works');

-- 19 wrong guesses from one IP (the 20th comes from submit_rsvp)
create temporary table guesses as
select public.get_invitation('zzz' || substr('abcdefghjkmnpqrstuvwxyz23456789', g, 1), false) as answer
from generate_series(1, 19) g;
set local role postgres;
select is((select count(*)::int from private.code_misses where ip = '203.0.113.7'), 19,
  'misses are counted per IP (the first address of x-forwarded-for)');

set local role anon;
select is(public.submit_rsvp('zzzn', '{"attending": false}'), null,
  'an unknown code in submit_rsvp counts as a miss too');
select throws_ok($$select public.get_invitation('abc234', false)$$, 'P0001', 'rate_limited',
  'after 20 misses that IP is stopped, even for a real code');
select throws_ok($$select public.submit_rsvp('abc234', '{"attending": false}')$$,
  'P0001', 'rate_limited', 'and it cannot answer either');

-- another visitor is not affected
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.2"}', true);
select isnt(public.get_invitation('abc234', false), null, 'other IPs keep working');
set local role postgres;

-- the window passes
update private.code_misses set at = now() - interval '11 minutes';
set local role anon;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7"}', true);
select isnt(public.get_invitation('abc234', false), null, 'after 10 minutes the IP works again');
set local role postgres;

select * from finish();
rollback;
