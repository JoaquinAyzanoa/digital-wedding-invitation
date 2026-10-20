-- Google Sheet sync (Phase 8).
--
-- export_for_sheet gets an optional p_hash: the Apps Script runs every 5 minutes and
-- sends the hash of the last data it wrote; when nothing changed the answer is a few bytes
-- instead of every invitation (the free plan's egress is limited). Every call still
-- records the sync time, so the admin can see the script is alive.
--
-- The admin reads the secret (to paste it into the script) and can rotate it.

drop function public.export_for_sheet(text);

create function public.export_for_sheet(p_secret text, p_hash text default null)
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

-- The values the admin pastes into the Apps Script, and the last sync.
create function public.admin_sheet_settings()
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
  return jsonb_build_object(
    'secret', (select value from private.settings where key = 'sheet_secret'),
    'lastSyncAt', (select value from private.settings where key = 'last_sheet_sync_at')::timestamptz
  );
end;
$$;

-- A new secret (e.g. if the old one leaked): the script stops syncing until it gets it.
create function public.admin_rotate_sheet_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;
  update private.settings set value = v_secret where key = 'sheet_secret';
  return v_secret;
end;
$$;

revoke all on function public.export_for_sheet(text, text) from public, anon, authenticated;
revoke all on function public.admin_sheet_settings() from public, anon, authenticated;
revoke all on function public.admin_rotate_sheet_secret() from public, anon, authenticated;
grant execute on function public.export_for_sheet(text, text) to anon;
grant execute on function public.admin_sheet_settings() to authenticated;
grant execute on function public.admin_rotate_sheet_secret() to authenticated;
