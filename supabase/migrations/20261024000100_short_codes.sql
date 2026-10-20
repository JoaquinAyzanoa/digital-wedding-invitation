-- Short codes: links like camilayjoaquin.com/?ubhd.
--
-- New invitations get 4-character codes (codes of 5 or 6 characters, already sent, keep
-- working). 4 characters are only ~923 000 combinations, so guessing them is throttled:
-- an IP address that asks for 20 codes that do not exist within 10 minutes gets
-- `rate_limited` until that window passes. Per IP, so nobody can lock the others out.

alter table public.invitations drop constraint invitations_code_check;
alter table public.invitations
  add constraint invitations_code_check check (code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{4,6}$');

create or replace function private.is_valid_code(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{4,6}$', false)
$$;

create or replace function private.set_invitation_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea;
  v_code text;
begin
  if new.code is not null and btrim(new.code) <> '' then
    new.code := lower(btrim(new.code));
    return new;
  end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..3 loop
      v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % 31 + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invitations where code = v_code);
  end loop;

  new.code := v_code;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guessing brake
-- ---------------------------------------------------------------------------

create table private.code_misses (
  ip text not null,
  at timestamptz not null default now()
);
create index code_misses_ip_at_idx on private.code_misses (ip, at);
revoke all on table private.code_misses from public, anon, authenticated;

/** The visitor's IP, as Supabase's gateway passes it ('' when there is none, e.g. locally). */
create function private.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''
  ), ',', 1))
$$;

create function private.check_code_rate()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (
    select count(*) from private.code_misses
    where ip = private.client_ip() and at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'rate_limited';
  end if;
end;
$$;

create function private.record_code_miss()
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into private.code_misses (ip) values (private.client_ip());
  -- Now and then, forget old misses.
  if random() < 0.02 then
    delete from private.code_misses where at < now() - interval '1 day';
  end if;
end;
$$;

create or replace function public.get_invitation(p_code text, p_track boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(btrim(p_code));
  v_id uuid;
begin
  if not private.is_valid_code(v_code) then
    return null;
  end if;
  perform private.check_code_rate();

  if coalesce(p_track, true) then
    update public.invitations
    set first_opened_at = coalesce(first_opened_at, now()),
        last_opened_at = now(),
        open_count = open_count + 1
    where code = v_code
    returning id into v_id;
  else
    select id into v_id from public.invitations where code = v_code;
  end if;

  if v_id is null then
    perform private.record_code_miss();
    return null;
  end if;

  return private.invitation_view(v_id);
end;
$$;

-- Unknown code: null instead of an error, so the miss is recorded (an error would roll it
-- back) and this RPC cannot be used to test codes without the brake.
create or replace function public.submit_rsvp(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.check_code_rate();
  select id into v_id
  from public.invitations
  where code = lower(btrim(p_code))
  for update;

  if v_id is null then
    perform private.record_code_miss();
    return null;
  end if;

  if not private.rsvp_is_open() then
    raise exception 'rsvp_closed';
  end if;

  perform private.apply_rsvp(v_id, p_payload);
  return private.invitation_view(v_id);
end;
$$;

-- New private helpers: no API role may call them directly.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
