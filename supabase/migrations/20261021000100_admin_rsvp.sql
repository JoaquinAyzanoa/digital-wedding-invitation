-- RSVP on a guest's behalf from the admin (e.g. they confirmed by phone), and reset.
--
-- The validation and writing of an answer moves to private.apply_rsvp, shared by
-- submit_rsvp (guests: by code, only while the RSVP is open) and admin_save_rsvp (admins:
-- by id, also after the deadline). Same rules either way.

create function private.apply_rsvp(p_invitation_id uuid, p_payload jsonb)
returns void
language plpgsql
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

end;
$$;

create or replace function public.submit_rsvp(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.invitations
  where code = lower(btrim(p_code))
  for update;

  if v_id is null then
    raise exception 'invitation_not_found';
  end if;

  if not private.rsvp_is_open() then
    raise exception 'rsvp_closed';
  end if;

  perform private.apply_rsvp(v_id, p_payload);
  return private.invitation_view(v_id);
end;
$$;

create function public.admin_save_rsvp(p_invitation_id uuid, p_payload jsonb)
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

  perform private.apply_rsvp(p_invitation_id, p_payload);
  return private.invitation_view(p_invitation_id);
end;
$$;

-- Back to "pending": removes the answer and the attendees.
create function public.admin_reset_rsvp(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.attendees where invitation_id = p_invitation_id;
  update public.invitations
  set attending = null,
      attends_ceremony = null,
      attends_reception = null,
      needs_transport = null,
      needs_lodging = null,
      contact_phone = null,
      song_request = null,
      message = null,
      responded_at = null
  where id = p_invitation_id;

  if not found then
    raise exception 'invitation_not_found';
  end if;
end;
$$;

revoke all on function public.admin_save_rsvp(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_reset_rsvp(uuid) from public, anon, authenticated;
grant execute on function public.admin_save_rsvp(uuid, jsonb) to authenticated;
grant execute on function public.admin_reset_rsvp(uuid) to authenticated;

-- `create or replace` keeps submit_rsvp's grants; the new private helper gets none.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_upload_album(text) to anon, authenticated;
