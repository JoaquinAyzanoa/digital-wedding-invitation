-- Tables, triggers and row level security.
--
-- The remote project is created with "Automatically expose new tables" disabled, so every
-- privilege is granted explicitly here. The same statements make a local stack (which still
-- has Supabase's default grants) behave identically.

-- ---------------------------------------------------------------------------
-- Private schema: helpers and settings. Not exposed by the Data API.
-- ---------------------------------------------------------------------------

create schema if not exists private;

-- Note: Postgres gives EXECUTE on every new function to PUBLIC, and a per-schema
-- `alter default privileges ... revoke` cannot undo a global default. So each migration
-- that creates functions ends with explicit revoke/grant statements.

-- Needed so RLS and storage policies (evaluated as anon/authenticated) can call the few
-- helpers that are explicitly granted below. Tables in this schema stay unreadable.
grant usage on schema private to anon, authenticated;

create table private.settings (
  key text primary key,
  value text
);

insert into private.settings (key, value)
values
  ('sheet_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('last_sheet_sync_at', null);

create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ---------------------------------------------------------------------------
-- invitations: one row per invitation (a person or a group)
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  seats int not null default 1 check (seats between 1 and 20),
  side text not null default 'both' check (side in ('bride', 'groom', 'both')),
  group_name text check (char_length(group_name) <= 60),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 254),
  notes text check (char_length(notes) <= 2000),
  sent_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count int not null default 0 check (open_count >= 0),
  attending boolean,
  attends_ceremony boolean,
  attends_reception boolean,
  needs_transport boolean,
  needs_lodging boolean,
  contact_phone text check (char_length(contact_phone) <= 30),
  song_request text check (char_length(song_request) <= 200),
  message text check (char_length(message) <= 1000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitations_group_name_idx on public.invitations (group_name);

-- Fills `code` when the admin (or a CSV import) leaves it empty, and normalizes case.
-- The first 6 bytes of a v4 UUID are fully random; `% 31` has a negligible bias.
create function private.set_invitation_code()
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
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % 31 + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invitations where code = v_code);
  end loop;

  new.code := v_code;
  return new;
end;
$$;

create trigger invitations_set_code
  before insert on public.invitations
  for each row execute function private.set_invitation_code();

-- Visit tracking (get_invitation) updates the row on every open; that alone is not an edit.
create function private.touch_invitation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ignored constant text[] := array['first_opened_at', 'last_opened_at', 'open_count', 'updated_at'];
begin
  if (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function private.touch_invitation();

-- ---------------------------------------------------------------------------
-- attendees: confirmed people of each invitation
-- ---------------------------------------------------------------------------

create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  position int not null check (position between 1 and 20),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  kind text not null default 'adult' check (kind in ('adult', 'child')),
  age int check (age between 0 and 17),
  menu text check (char_length(menu) <= 60),
  dietary text check (char_length(dietary) <= 300),
  unique (invitation_id, position),
  check ((kind = 'adult' and age is null) or (kind = 'child' and age is not null))
);

-- ---------------------------------------------------------------------------
-- site_content: single row with all editable content
-- ---------------------------------------------------------------------------

create table public.site_content (
  id int primary key default 1 check (id = 1),
  public_data jsonb not null default '{}'::jsonb,
  private_data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id) values (1);

create function private.bump_content_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.public_data is distinct from old.public_data
     or new.private_data is distinct from old.private_data then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger site_content_bump_version
  before update on public.site_content
  for each row execute function private.bump_content_version();

-- ---------------------------------------------------------------------------
-- album_photos: photos uploaded by guests to the `album` bucket
-- ---------------------------------------------------------------------------

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  path text not null unique,
  width int check (width > 0),
  height int check (height > 0),
  bytes int check (bytes > 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index album_photos_invitation_id_idx on public.album_photos (invitation_id);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
--
-- anon: no table privileges at all; guests only use the RPCs in the next migration.
-- authenticated: table privileges, but RLS only lets admins (app_metadata.role = 'admin') in.
-- ---------------------------------------------------------------------------

revoke all on table
  public.invitations, public.attendees, public.site_content, public.album_photos
  from anon, authenticated;

grant select, insert, update, delete on table
  public.invitations, public.attendees, public.album_photos
  to authenticated;

grant select, update on table public.site_content to authenticated;

grant all on table
  public.invitations, public.attendees, public.site_content, public.album_photos
  to service_role;

revoke all on table private.settings from anon, authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.invitations enable row level security;
alter table public.attendees enable row level security;
alter table public.site_content enable row level security;
alter table public.album_photos enable row level security;

create policy "admin full access" on public.invitations
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin full access" on public.attendees
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin read" on public.site_content
  for select to authenticated
  using ((select private.is_admin()));

create policy "admin update" on public.site_content
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin full access" on public.album_photos
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
