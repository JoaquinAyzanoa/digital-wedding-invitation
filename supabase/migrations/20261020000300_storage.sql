-- Storage buckets and policies.
--
-- site  (public):  couple photos, music, decorations, custom fonts. Only the admin writes.
-- album (private): guest uploads to `<code>/<uuid>.<ext>` while the album is open.
--                  Only the admin reads (signed URLs) or deletes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site', 'site', true, 20971520, null),
  ('album', 'album', false, 8388608, array['image/*'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- site: admin only (public reads go through the public URL and need no policy)

create policy "site: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'site' and (select private.is_admin()));

create policy "site: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site' and (select private.is_admin()));

create policy "site: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'site' and (select private.is_admin()))
  with check (bucket_id = 'site' and (select private.is_admin()));

create policy "site: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site' and (select private.is_admin()));

-- album: guests upload, admin reads and moderates

create policy "album: guest upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'album' and private.can_upload_album(name));

create policy "album: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'album' and (select private.is_admin()));

create policy "album: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'album' and (select private.is_admin()));
