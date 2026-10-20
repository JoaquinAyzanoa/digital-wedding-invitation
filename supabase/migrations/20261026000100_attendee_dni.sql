-- DNI of each confirmed person (Peruvian ID: 8 digits).
--
-- Asked in the RSVP while public_data.rsvp.questions.dni is on (missing = on): required
-- for every attendee, adults and children. The admin may save an answer without it (e.g.
-- confirmed by phone).
--
-- Privacy: with short, guessable codes a full name next to a full DNI must not be shown to
-- whoever opens an invitation. Guests only get the last 3 digits back (dniHint); the full
-- DNI is for the admin (table, Sheet, CSV). When a guest changes the answer and leaves a
-- DNI empty, the one already given for the same name is kept.

alter table public.attendees add column dni text check (dni ~ '^[0-9]{8}$');

drop function private.apply_rsvp(uuid, jsonb);

-- p_strict: the guest's rules (DNI required). The admin passes false.
create function private.apply_rsvp(p_invitation_id uuid, p_payload jsonb, p_strict boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_rsvp jsonb;
  v_questions jsonb;
  v_menu_options jsonb;
  v_ask_dni boolean;
  v_previous_dni jsonb;
  v_attending boolean;
  v_attendees jsonb;
  v_item jsonb;
  v_position int := 0;
  v_name text;
  v_kind text;
  v_age int;
  v_menu text;
  v_dni text;
  v_dnis text[] := '{}';
  v_ceremony boolean;
  v_reception boolean;
  v_contact_phone text;
begin
  -- The caller looked the invitation up and locked it.
  select * into v_inv from public.invitations where id = p_invitation_id;

  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  v_attending := private.opt_bool(p_payload -> 'attending');
  if v_attending is null then
    raise exception 'invalid_payload';
  end if;

  select c.public_data -> 'rsvp' into v_rsvp from public.site_content c where c.id = 1;
  v_questions := coalesce(v_rsvp -> 'questions', '{}'::jsonb);
  v_ask_dni := coalesce((v_questions ->> 'dni')::boolean, true);
  v_menu_options := case
    when jsonb_typeof(v_rsvp -> 'menuOptions') = 'array' then v_rsvp -> 'menuOptions'
    else '[]'::jsonb
  end;

  v_contact_phone := private.opt_text(p_payload -> 'contactPhone', 30);
  if v_contact_phone is not null and v_contact_phone !~ '^[0-9+() -]{6,30}$' then
    raise exception 'invalid_payload';
  end if;

  -- DNIs already given, by name: kept when the guest leaves the field empty.
  select coalesce(jsonb_object_agg(lower(btrim(full_name)), dni), '{}'::jsonb)
  into v_previous_dni
  from public.attendees
  where invitation_id = v_inv.id and dni is not null;

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

    return;
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

    if v_ask_dni then
      v_dni := private.opt_text(v_item -> 'dni', 8, 'invalid_attendees');
      v_dni := coalesce(v_dni, v_previous_dni ->> lower(v_name));
      if v_dni is not null and v_dni !~ '^[0-9]{8}$' then
        raise exception 'invalid_attendees';
      end if;
      if v_dni is null and p_strict then
        raise exception 'invalid_attendees';
      end if;
      if v_dni = any (v_dnis) then
        raise exception 'invalid_attendees';
      end if;
      v_dnis := v_dnis || v_dni;
    else
      v_dni := null;
    end if;

    insert into public.attendees (invitation_id, position, full_name, kind, age, menu, dietary, dni)
    values (
      v_inv.id,
      v_position,
      v_name,
      v_kind,
      v_age,
      v_menu,
      private.opt_text(v_item -> 'dietary', 300, 'invalid_attendees'),
      v_dni
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
end;
$$;

-- The admin may leave a DNI empty.
create or replace function public.admin_save_rsvp(p_invitation_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;

  perform 1 from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;

  perform private.apply_rsvp(p_invitation_id, p_payload, false);
  return private.invitation_view(p_invitation_id);
end;
$$;

-- Guests see only the last 3 digits of each DNI (dniHint).
create or replace function private.invitation_view(p_id uuid)
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
          'dietary', a.dietary,
          'dniHint', right(a.dni, 3)
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

-- The Sheet gets the full DNI (it is the couple's own list).
create or replace function public.export_for_sheet(p_secret text, p_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
  v_hash text;
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
        'dni', a.dni,
        'kind', a.kind,
        'age', a.age,
        'menu', a.menu,
        'dietary', a.dietary
      ) order by i.created_at, i.code, a.position), '[]'::jsonb)
      from public.attendees a
      join public.invitations i on i.id = a.invitation_id
    )
  );
  v_hash := md5(v_data::text);

  update private.settings set value = now()::text where key = 'last_sheet_sync_at';

  if p_hash is not distinct from v_hash then
    return jsonb_build_object('unchanged', true, 'hash', v_hash, 'syncedAt', now());
  end if;
  return v_data || jsonb_build_object('unchanged', false, 'hash', v_hash, 'syncedAt', now());
end;
$$;

-- New private helper version: no API role may call it directly.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
