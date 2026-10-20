-- Album (Phase 9).
--
-- Each photo is uploaded twice: the photo (`<code>/<uuid>.<ext>`, ~2000 px) and a small
-- thumbnail next to it (`<code>/<uuid>.thumb.<ext>`) so the admin gallery does not download
-- every full photo (Storage image transformations are not on the free plan). The per-code
-- limit counts both files: 600 objects = 300 photos.
--
-- admin_album_stats: photo counts and the Storage space used (the free plan has 1 GB).

create or replace function private.can_upload_album(p_name text)
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
     or p_name !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}/[0-9a-f-]{36}(\.thumb)?\.(webp|jpg|jpeg|png)$' then
    return false;
  end if;

  return exists (select 1 from public.invitations where code = v_code)
    and private.album_is_open()
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'album' and o.name like v_code || '/%'
    ) < 600;
end;
$$;

create function public.admin_album_stats()
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
    'photos', (select count(*) from public.album_photos),
    'hidden', (select count(*) from public.album_photos where hidden),
    'guests', (select count(distinct invitation_id) from public.album_photos),
    'albumBytes', (
      select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
      from storage.objects o where o.bucket_id = 'album'
    ),
    'siteBytes', (
      select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
      from storage.objects o where o.bucket_id = 'site'
    )
  );
end;
$$;

revoke all on function public.admin_album_stats() from public, anon, authenticated;
grant execute on function public.admin_album_stats() to authenticated;

-- `create or replace` keeps can_upload_album's grants; restate them to be explicit.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_upload_album(text) to anon, authenticated;
