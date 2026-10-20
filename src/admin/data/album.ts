import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { thumbPath } from '@/admin/album/names';
import { supabase } from '@/admin/supabase';

const BUCKET = 'album';
/** Signed URLs last an hour; they are renewed a while before that. */
const URL_SECONDS = 3600;
/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000;

export const albumKeys = {
  photos: ['album', 'photos'] as const,
  stats: ['album', 'stats'] as const,
  thumbs: (paths: string[]) => ['album', 'thumbs', paths] as const,
};

export interface AlbumPhoto {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  hidden: boolean;
  created_at: string;
  invitation: { code: string; display_name: string };
}

export interface AlbumStats {
  photos: number;
  hidden: number;
  guests: number;
  albumBytes: number;
  siteBytes: number;
}

function check<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

/** Every photo, newest first (in pages: there can be a couple of thousand). */
export function useAlbumPhotos() {
  return useQuery({
    queryKey: albumKeys.photos,
    queryFn: async () => {
      const photos: AlbumPhoto[] = [];
      for (let from = 0; ; from += PAGE) {
        const page = check(
          await supabase
            .from('album_photos')
            .select(
              'id, path, width, height, bytes, hidden, created_at, invitation:invitations(code, display_name)',
            )
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, from + PAGE - 1),
        ) as unknown as AlbumPhoto[];
        photos.push(...page);
        if (page.length < PAGE) return photos;
      }
    },
  });
}

export function useAlbumStats() {
  return useQuery({
    queryKey: albumKeys.stats,
    queryFn: async () => check(await supabase.rpc('admin_album_stats')) as unknown as AlbumStats,
  });
}

/** Signed URLs for paths in the private bucket (missing ones come back as null). */
export async function signedUrls(paths: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (!paths.length) return result;
  const data = check(await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_SECONDS));
  for (const entry of data ?? []) {
    if (entry.path) result.set(entry.path, entry.error ? null : entry.signedUrl);
  }
  return result;
}

/** Thumbnails for the photos on screen; the full photo when a thumbnail is missing. */
export function useThumbnails(photos: AlbumPhoto[]) {
  const paths = photos.map((p) => p.path);
  return useQuery({
    queryKey: albumKeys.thumbs(paths),
    enabled: paths.length > 0,
    staleTime: (URL_SECONDS - 600) * 1000,
    refetchInterval: (URL_SECONDS - 600) * 1000,
    queryFn: async () => {
      const thumbs = await signedUrls(paths.map(thumbPath));
      const missing = paths.filter((p) => !thumbs.get(thumbPath(p)));
      const full = await signedUrls(missing);
      return new Map(paths.map((p) => [p, thumbs.get(thumbPath(p)) ?? full.get(p) ?? null]));
    },
  });
}

/** A one-off link to the full photo; `download` makes the browser save it with that name. */
export async function photoUrl(path: string, download?: string): Promise<string> {
  const data = check(
    await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, URL_SECONDS, download ? { download } : undefined),
  );
  return data!.signedUrl;
}

function useInvalidateAlbum() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: albumKeys.photos }),
      queryClient.invalidateQueries({ queryKey: albumKeys.stats }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

/** Hidden photos stay in the album but are left out of the downloads. */
export function useSetPhotoHidden() {
  const invalidate = useInvalidateAlbum();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) =>
      check(await supabase.from('album_photos').update({ hidden }).eq('id', id)),
    onSuccess: invalidate,
  });
}

/** Deletes the files (photo and thumbnail) and then the rows. */
export function useDeletePhotos() {
  const invalidate = useInvalidateAlbum();
  return useMutation({
    mutationFn: async (photos: Pick<AlbumPhoto, 'id' | 'path'>[]) => {
      const files = photos.flatMap((p) => [p.path, thumbPath(p.path)]);
      check(await supabase.storage.from(BUCKET).remove(files));
      check(
        await supabase
          .from('album_photos')
          .delete()
          .in(
            'id',
            photos.map((p) => p.id),
          ),
      );
    },
    onSuccess: invalidate,
  });
}

/**
 * Every file in the album folders of these invitation codes, for deleting the invitations
 * (their rows go with them; the files would stay, using space and invisible to everyone).
 */
export async function albumFilesOf(codes: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const code of codes) {
    for (let offset = 0; ; offset += PAGE) {
      const page =
        check(await supabase.storage.from(BUCKET).list(code, { limit: PAGE, offset })) ?? [];
      files.push(...page.map((f) => `${code}/${f.name}`));
      if (page.length < PAGE) break;
    }
  }
  return files;
}

export async function removeAlbumFiles(files: string[]) {
  // The Storage API takes a limited batch per call.
  for (let i = 0; i < files.length; i += 500) {
    check(await supabase.storage.from(BUCKET).remove(files.slice(i, i + 500)));
  }
}
