-- RPCs. Guests never touch tables: they call these `security definer` functions with their
-- invitation code, and every input is validated here.
--
-- Errors are raised with a stable message the frontend maps to a type:
-- invitation_not_found, rsvp_closed, invalid_attendees, invalid_payload, album_closed, forbidden.
-- (The 300-photos-per-invitation limit is enforced by the storage policy: the upload gets a 403.)

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

-- Parses a date or datetime from the content JSON. A bare date (YYYY-MM-DD) is read in
-- America/Lima: the start of that day, or the end of it when p_end_of_day is true.
create function private.lima_instant(p_value text, p_end_of_day boolean default false)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when p_value ~ '^\d{4}-\d{2}-\d{2}$' then
      ((p_value::date + case when p_end_of_day then 1 else 0 end)::timestamp
        at time zone 'America/Lima')
    else p_value::timestamptz
  end
$$;

create function private.rsvp_is_open()
returns boolean
language sql
stable
set search_path = ''
as $$
  select not coalesce((c.public_data #>> '{rsvp,closed}')::boolean, false)
    and coalesce(now() < private.lima_instant(c.public_data #>> '{rsvp,deadline}', true), true)
  from public.site_content c
  where c.id = 1
$$;

create function private.album_is_open()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((c.public_data #>> '{album,enabled}')::boolean, false)
    and coalesce(now() >= private.lima_instant(c.public_data #>> '{album,opensAt}'), true)
    and coalesce(now() < private.lima_instant(c.public_data #>> '{album,closesAt}', true), true)
  from public.site_content c
  where c.id = 1
$$;

-- Optional string field: JSON null/missing -> null, trimmed, '' -> null.
create function private.opt_text(p_value jsonb, p_max int, p_error text default 'invalid_payload')
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception '%', p_error;
  end if;
  v_text := btrim(p_value #>> '{}');
  if char_length(v_text) > p_max then
    raise exception '%', p_error;
  end if;
  return nullif(v_text, '');
end;
$$;

create function private.opt_bool(p_value jsonb, p_error text default 'invalid_payload')
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'boolean' then
    raise exception '%', p_error;
  end if;
  return (p_value #>> '{}')::boolean;
end;
$$;

create function private.opt_int(p_value jsonb, p_error text default 'invalid_payload')
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_number numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'number' then
    raise exception '%', p_error;
  end if;
  v_number := (p_value #>> '{}')::numeric;
  if v_number <> trunc(v_number) or abs(v_number) > 2147483647 then
    raise exception '%', p_error;
  end if;
  return v_number::int;
end;
$$;

-- What a guest sees of their invitation. `response` is null while pending.
create function private.invitation_view(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', i.code,
    'displayName', i.display_name,
    'seats', i.seats,
    'rsvpOpen', private.rsvp_is_open(),
    'albumOpen', private.album_is_open(),
    'response', case when i.attending is null then null else jsonb_build_object(
      'attending', i.attending,
      'parts', jsonb_build_object('ceremony', i.attends_ceremony, 'reception', i.attends_reception),
      'needsTransport', i.needs_transport,
      'needsLodging', i.needs_lodging,
      'contactPhone', i.contact_phone,
      'songRequest', i.song_request,
      'message', i.message,
      'respondedAt', i.responded_at,
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object(
          'fullName', a.full_name,
          'kind', a.kind,
          'age', a.age,
          'menu', a.menu,
          'dietary', a.dietary
        ) order by a.position)
        from public.attendees a
        where a.invitation_id = i.id
      ), '[]'::jsonb)
    ) end,
    'private', (select c.private_data from public.site_content c where c.id = 1)
  )
  from public.invitations i
  where i.id = p_id
$$;

create function private.is_valid_code(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}$', false)
$$;

-- ---------------------------------------------------------------------------
-- Guest RPCs
-- ---------------------------------------------------------------------------

create function public.get_content()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.public_data from public.site_content c where c.id = 1
$$;

create function public.get_invitation(p_code text, p_track boolean default true)
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
    return null;
  end if;

  return private.invitation_view(v_id);
end;
$$;

create function public.submit_rsvp(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_rsvp jsonb;
  v_questions jsonb;
  v_menu_options jsonb;
  v_attending boolean;
  v_attendees jsonb;
  v_item jsonb;
  v_position int := 0;
  v_name text;
  v_kind text;
  v_age int;
  v_menu text;
  v_ceremony boolean;
  v_reception boolean;
  v_contact_phone text;
begin
  select * into v_inv
  from public.invitations
  where code = lower(btrim(p_code))
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if not private.rsvp_is_open() then
    raise exception 'rsvp_closed';
  end if;

  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  v_attending := private.opt_bool(p_payload -> 'attending');
  if v_attending is null then
    raise exception 'invalid_payload';
  end if;

  select c.public_data -> 'rsvp' into v_rsvp from public.site_content c where c.id = 1;
  v_questions := coalesce(v_rsvp -> 'questions', '{}'::jsonb);
  v_menu_options := case
    when jsonb_typeof(v_rsvp -> 'menuOptions') = 'array' then v_rsvp -> 'menuOptions'
    else '[]'::jsonb
  end;

  v_contact_phone := private.opt_text(p_payload -> 'contactPhone', 30);
  if v_contact_phone is not null and v_contact_phone !~ '^[0-9+() -]{6,30}$' then
    raise exception 'invalid_payload';
  end if;

  delete from public.attendees where invitation_id = v_inv.id;

  if not v_attending then
    update public.invitations
    set attending = false,
        attends_ceremony = null,
        attends_reception = null,
        needs_transport = null,
        needs_lodging = null,
        contact_phone = v_contact_phone,
        song_request = null,
        message = private.opt_text(p_payload -> 'message', 1000),
        responded_at = now()
    where id = v_inv.id;

    return private.invitation_view(v_inv.id);
  end if;

  -- Attending: 1..seats attendees.
  v_attendees := p_payload -> 'attendees';
  if jsonb_typeof(v_attendees) is distinct from 'array'
     or jsonb_array_length(v_attendees) not between 1 and v_inv.seats then
    raise exception 'invalid_attendees';
  end if;

  for v_item in select value from jsonb_array_elements(v_attendees) loop
    v_position := v_position + 1;

    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_attendees';
    end if;

    v_name := private.opt_text(v_item -> 'fullName', 120, 'invalid_attendees');
    if v_name is null then
      raise exception 'invalid_attendees';
    end if;

    v_kind := coalesce(private.opt_text(v_item -> 'kind', 10, 'invalid_attendees'), 'adult');
    if v_kind not in ('adult', 'child') then
      raise exception 'invalid_attendees';
    end if;

    if v_kind = 'child' then
      v_age := private.opt_int(v_item -> 'age', 'invalid_attendees');
      if v_age is null or v_age not between 0 and 17 then
        raise exception 'invalid_attendees';
      end if;
    else
      v_age := null;
    end if;

    v_menu := private.opt_text(v_item -> 'menu', 60, 'invalid_attendees');
    if jsonb_array_length(v_menu_options) > 0 then
      if v_menu is null or not (v_menu_options ? v_menu) then
        raise exception 'invalid_attendees';
      end if;
    else
      v_menu := null;
    end if;

    insert into public.attendees (invitation_id, position, full_name, kind, age, menu, dietary)
    values (
      v_inv.id,
      v_position,
      v_name,
      v_kind,
      v_age,
      v_menu,
      private.opt_text(v_item -> 'dietary', 300, 'invalid_attendees')
    );
  end loop;

  -- Which parts of the event (only when the question is enabled; otherwise both).
  if coalesce((v_questions ->> 'parts')::boolean, false) then
    v_ceremony := coalesce(private.opt_bool(p_payload #> '{parts,ceremony}'), false);
    v_reception := coalesce(private.opt_bool(p_payload #> '{parts,reception}'), false);
    if not (v_ceremony or v_reception) then
      raise exception 'invalid_payload';
    end if;
  else
    v_ceremony := true;
    v_reception := true;
  end if;

  update public.invitations
  set attending = true,
      attends_ceremony = v_ceremony,
      attends_reception = v_reception,
      needs_transport = case when coalesce((v_questions ->> 'transport')::boolean, false)
        then private.opt_bool(p_payload -> 'needsTransport') end,
      needs_lodging = case when coalesce((v_questions ->> 'lodging')::boolean, false)
        then private.opt_bool(p_payload -> 'needsLodging') end,
      contact_phone = v_contact_phone,
      song_request = case when coalesce((v_questions ->> 'song')::boolean, false)
        then private.opt_text(p_payload -> 'songRequest', 200) end,
      message = private.opt_text(p_payload -> 'message', 1000),
      responded_at = now()
  where id = v_inv.id;

  return private.invitation_view(v_inv.id);
end;
$$;

-- Used by the `album` bucket insert policy (see the storage migration) and by
-- register_album_photo. Object names must be `<code>/<uuid>.<ext>`.
create function private.can_upload_album(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := split_part(p_name, '/', 1);
begin
  if p_name is null
     or p_name !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$' then
    return false;
  end if;

  return exists (select 1 from public.invitations where code = v_code)
    and private.album_is_open()
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'album' and o.name like v_code || '/%'
    ) < 300;
end;
$$;

create function public.register_album_photo(p_code text, p_path text, p_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(btrim(p_code));
  v_invitation_id uuid;
begin
  select id into v_invitation_id from public.invitations where code = v_code;
  if v_invitation_id is null then
    raise exception 'invitation_not_found';
  end if;

  if not private.album_is_open() then
    raise exception 'album_closed';
  end if;

  if split_part(p_path, '/', 1) <> v_code
     or p_path !~ '^[a-z2-9]{6}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$'
     or not exists (
       select 1 from storage.objects o where o.bucket_id = 'album' and o.name = p_path
     ) then
    raise exception 'invalid_payload';
  end if;

  if jsonb_typeof(coalesce(p_meta, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_payload';
  end if;

  insert into public.album_photos (invitation_id, path, width, height, bytes)
  values (
    v_invitation_id,
    p_path,
    private.opt_int(p_meta -> 'width'),
    private.opt_int(p_meta -> 'height'),
    private.opt_int(p_meta -> 'bytes')
  )
  on conflict (path) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC
-- ---------------------------------------------------------------------------

create function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;

  return (
    with inv as (
      select
        i.*,
        case when i.attending then
          (select count(*) from public.attendees a where a.invitation_id = i.id)
        else 0 end as people
      from public.invitations i
    ),
    confirmed as (
      select a.*, i.display_name
      from public.attendees a
      join public.invitations i on i.id = a.invitation_id
      where i.attending
    )
    select jsonb_build_object(
      'invitations', (
        select jsonb_build_object(
          'total', count(*),
          'sent', count(*) filter (where sent_at is not null),
          'opened', count(*) filter (where first_opened_at is not null),
          'responded', count(*) filter (where attending is not null),
          'pending', count(*) filter (where attending is null),
          'accepted', count(*) filter (where attending),
          'declined', count(*) filter (where not attending),
          'seats', coalesce(sum(seats), 0)
        )
        from inv
      ),
      'people', (
        select jsonb_build_object(
          'confirmed', count(*),
          'adults', count(*) filter (where kind = 'adult'),
          'children', count(*) filter (where kind = 'child')
        )
        from confirmed
      ),
      'bySide', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'side', side, 'invitations', n, 'seats', seats, 'confirmed', people
        ) order by side), '[]'::jsonb)
        from (
          select side, count(*) as n, sum(seats) as seats, sum(people) as people
          from inv group by side
        ) s
      ),
      'byGroup', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'group', group_name, 'invitations', n, 'seats', seats, 'confirmed', people
        ) order by group_name nulls last), '[]'::jsonb)
        from (
          select group_name, count(*) as n, sum(seats) as seats, sum(people) as people
          from inv group by group_name
        ) g
      ),
      'menu', (
        select coalesce(jsonb_agg(jsonb_build_object('menu', menu, 'count', n)
          order by n desc, menu), '[]'::jsonb)
        from (select menu, count(*) as n from confirmed group by menu) m
      ),
      'dietary', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'fullName', full_name, 'invitation', display_name, 'dietary', dietary
        ) order by display_name, position), '[]'::jsonb)
        from confirmed
        where dietary is not null
      ),
      'logistics', (
        select jsonb_build_object(
          'transport', jsonb_build_object(
            'invitations', count(*) filter (where needs_transport),
            'people', coalesce(sum(people) filter (where needs_transport), 0)
          ),
          'lodging', jsonb_build_object(
            'invitations', count(*) filter (where needs_lodging),
            'people', coalesce(sum(people) filter (where needs_lodging), 0)
          )
        )
        from inv
        where attending
      ),
      'messages', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'invitation', display_name, 'attending', attending,
          'message', message, 'respondedAt', responded_at
        ) order by responded_at desc), '[]'::jsonb)
        from inv
        where message is not null
      ),
      'songs', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'invitation', display_name, 'song', song_request
        ) order by responded_at desc), '[]'::jsonb)
        from inv
        where song_request is not null and attending
      ),
      'album', (
        select jsonb_build_object('photos', count(*), 'bytes', coalesce(sum(bytes), 0))
        from public.album_photos
      ),
      'sheet', jsonb_build_object(
        'lastSyncAt', (select value from private.settings where key = 'last_sheet_sync_at')
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Google Sheet sync and keep-alive
-- ---------------------------------------------------------------------------

-- Called by Apps Script with the publishable key plus the secret stored in
-- private.settings. `hash` lets the script skip rewriting the Sheet when nothing changed.
create function public.export_for_sheet(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
begin
  if p_secret is null
     or p_secret is distinct from (select value from private.settings where key = 'sheet_secret') then
    raise exception 'forbidden';
  end if;

  v_data := jsonb_build_object(
    'invitations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', i.code,
        'displayName', i.display_name,
        'seats', i.seats,
        'side', i.side,
        'group', i.group_name,
        'phone', i.phone,
        'email', i.email,
        'notes', i.notes,
        'sentAt', i.sent_at,
        'firstOpenedAt', i.first_opened_at,
        'lastOpenedAt', i.last_opened_at,
        'openCount', i.open_count,
        'attending', i.attending,
        'attendsCeremony', i.attends_ceremony,
        'attendsReception', i.attends_reception,
        'needsTransport', i.needs_transport,
        'needsLodging', i.needs_lodging,
        'contactPhone', i.contact_phone,
        'songRequest', i.song_request,
        'message', i.message,
        'respondedAt', i.responded_at,
        'people', (select count(*) from public.attendees a where a.invitation_id = i.id)
      ) order by i.created_at, i.code), '[]'::jsonb)
      from public.invitations i
    ),
    'attendees', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', i.code,
        'invitation', i.display_name,
        'position', a.position,
        'fullName', a.full_name,
        'kind', a.kind,
        'age', a.age,
        'menu', a.menu,
        'dietary', a.dietary
      ) order by i.created_at, i.code, a.position), '[]'::jsonb)
      from public.attendees a
      join public.invitations i on i.id = a.invitation_id
    )
  );

  update private.settings set value = now()::text where key = 'last_sheet_sync_at';

  return v_data || jsonb_build_object('hash', md5(v_data::text), 'syncedAt', now());
end;
$$;

create function public.ping()
returns int
language sql
stable
set search_path = ''
as $$
  select 1
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges (Postgres grants EXECUTE to PUBLIC by default; Supabase also
-- grants to anon/authenticated. Reset both, then grant only what each role needs.)
-- ---------------------------------------------------------------------------

revoke all on function public.get_content() from public, anon, authenticated;
revoke all on function public.get_invitation(text, boolean) from public, anon, authenticated;
revoke all on function public.submit_rsvp(text, jsonb) from public, anon, authenticated;
revoke all on function public.register_album_photo(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_dashboard() from public, anon, authenticated;
revoke all on function public.export_for_sheet(text) from public, anon, authenticated;
revoke all on function public.ping() from public, anon, authenticated;

grant execute on function public.get_content() to anon, authenticated;
grant execute on function public.get_invitation(text, boolean) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated;
grant execute on function public.register_album_photo(text, text, jsonb) to anon, authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.export_for_sheet(text) to anon;
grant execute on function public.ping() to anon, authenticated;

-- Private helpers: only the two used inside RLS/storage policies are callable by API roles.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_upload_album(text) to anon, authenticated;
