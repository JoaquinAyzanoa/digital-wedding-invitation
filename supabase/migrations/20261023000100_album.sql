-- Album in Google Drive (Phase 9).
--
-- Guests' photos go, at their original quality, to a Google Drive folder of the couple
-- (Supabase Storage's free 1 GB is too small for originals). The upload goes to the Apps
-- Script web app (apps-script/Code.js, the same project as the Sheet sync), which saves the
-- file in Drive. Before saving, the script asks here whether the code exists and the album
-- is open (album_drive_check), and afterwards records the photo (register_drive_photo):
-- both with the same secret as the Sheet sync. Supabase only keeps the count.
--
-- The web app's URL is set by the admin and given only to guests with a valid code, inside
-- their invitation (albumUploadUrl). The folder's link is registered by the script's setup.

-- Uploads no longer go to Supabase Storage.
drop policy "album: guest upload" on storage.objects;
drop function public.register_album_photo(text, text, jsonb);
drop function private.can_upload_album(text);

-- album_photos: one row per photo saved in Drive.
alter table public.album_photos alter column path drop not null;
alter table public.album_photos add column drive_file_id text unique;
alter table public.album_photos add column file_name text;

insert into private.settings (key, value)
values ('album_upload_url', null), ('album_folder_url', null)
on conflict (key) do nothing;

create function private.sheet_secret_ok(p_secret text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_secret is not null
    and p_secret is not distinct from (select value from private.settings where key = 'sheet_secret')
$$;

-- The guest's view gains albumUploadUrl: only while the album is open and connected.
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
    'albumUploadUrl', case when private.album_is_open()
      then (select value from private.settings where key = 'album_upload_url') end,
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

-- Asked by the script before saving a photo: who it is for and whether it may be saved.
-- At most 300 photos per invitation.
create function public.album_drive_check(p_secret text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_count int;
begin
  if not private.sheet_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  select * into v_inv from public.invitations where code = lower(btrim(p_code));
  if v_inv.id is null then
    raise exception 'invitation_not_found';
  end if;
  if not private.album_is_open() then
    raise exception 'album_closed';
  end if;
  select count(*) into v_count from public.album_photos where invitation_id = v_inv.id;
  if v_count >= 300 then
    raise exception 'album_full';
  end if;
  return jsonb_build_object('code', v_inv.code, 'displayName', v_inv.display_name, 'count', v_count);
end;
$$;

-- Recorded by the script once the photo is in Drive.
create function public.register_drive_photo(
  p_secret text,
  p_code text,
  p_file_id text,
  p_name text,
  p_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
begin
  if not private.sheet_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  select id into v_invitation_id from public.invitations where code = lower(btrim(p_code));
  if v_invitation_id is null then
    raise exception 'invitation_not_found';
  end if;
  if p_file_id is null or p_file_id !~ '^[A-Za-z0-9_-]{10,100}$' then
    raise exception 'invalid_payload';
  end if;
  insert into public.album_photos (invitation_id, drive_file_id, file_name, bytes)
  values (
    v_invitation_id,
    p_file_id,
    left(nullif(btrim(p_name), ''), 200),
    case when p_bytes > 0 and p_bytes <= 2147483647 then p_bytes end
  )
  on conflict (drive_file_id) do nothing;
end;
$$;

-- The script's setup registers the Drive folder, so the admin can open it from the panel.
create function public.google_register_folder(p_secret text, p_folder_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.sheet_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  if p_folder_url is null or p_folder_url !~ '^https://drive\.google\.com/[A-Za-z0-9/_?=&.-]+$' then
    raise exception 'invalid_payload';
  end if;
  update private.settings set value = p_folder_url where key = 'album_folder_url';
end;
$$;

-- The admin pastes the web app's URL (Implementar → Aplicación web).
create function public.admin_set_album_upload_url(p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_url is not null and p_url !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$' then
    raise exception 'invalid_payload';
  end if;
  update private.settings set value = p_url where key = 'album_upload_url';
end;
$$;

-- The Google settings for the admin: the Sheet's secret and sync, and the album's folder.
create or replace function public.admin_sheet_settings()
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
    'lastSyncAt', (select value from private.settings where key = 'last_sheet_sync_at')::timestamptz,
    'albumUploadUrl', (select value from private.settings where key = 'album_upload_url'),
    'albumFolderUrl', (select value from private.settings where key = 'album_folder_url')
  );
end;
$$;

revoke all on function public.album_drive_check(text, text) from public, anon, authenticated;
revoke all on function public.register_drive_photo(text, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.google_register_folder(text, text) from public, anon, authenticated;
revoke all on function public.admin_set_album_upload_url(text) from public, anon, authenticated;
grant execute on function public.album_drive_check(text, text) to anon;
grant execute on function public.register_drive_photo(text, text, text, text, bigint) to anon;
grant execute on function public.google_register_folder(text, text) to anon;
grant execute on function public.admin_set_album_upload_url(text) to authenticated;

-- New private helper: no API role may call it directly.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
