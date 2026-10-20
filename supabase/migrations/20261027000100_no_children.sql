-- No children at the wedding (and no menu to choose, which the content already allows:
-- an empty rsvp.menuOptions list).
--
-- rsvp.questions.children (missing = off): while off, the RSVP does not ask adult or child
-- and every attendee is stored as an adult without age, whatever the payload says.

create or replace function private.apply_rsvp(p_invitation_id uuid, p_payload jsonb, p_strict boolean default true)
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
  v_children boolean;
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
  v_children := coalesce((v_questions ->> 'children')::boolean, false);
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

    -- Without children at the wedding everyone is an adult, whatever the payload says.
    v_kind := case when v_children
      then coalesce(private.opt_text(v_item -> 'kind', 10, 'invalid_attendees'), 'adult')
      else 'adult' end;
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

-- Same signature: create or replace keeps it private (no grants to restate).
