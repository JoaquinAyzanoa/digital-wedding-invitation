-- Album without Supabase (Phase 9, simplified).
--
-- The couple decided: no limit per guest and no record of who sent each photo, plus a
-- public page (/photos/, a QR on the tables) where anyone can upload. So the Apps Script
-- web app no longer asks Supabase anything: it just saves each photo in the Drive folder.
-- The web app's URL and the folder's link now live in the public content
-- (public_data.album.uploadUrl / folderUrl), edited in the admin like any other text.
--
-- This removes what the previous album migration added for the script's checks.

drop function public.album_drive_check(text, text);
drop function public.register_drive_photo(text, text, text, text, bigint);
drop function public.google_register_folder(text, text);
drop function public.admin_set_album_upload_url(text);
drop function private.sheet_secret_ok(text);

delete from private.settings where key in ('album_upload_url', 'album_folder_url');

-- The guest's view goes back to what it was (the upload URL is in the content now).
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
    'lastSyncAt', (select value from private.settings where key = 'last_sheet_sync_at')::timestamptz
  );
end;
$$;
