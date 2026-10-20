import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/admin/supabase';

/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000;

export interface AlbumGuest {
  code: string;
  name: string;
  photos: number;
  bytes: number;
  lastAt: string;
}

export interface AlbumSummary {
  photos: number;
  bytes: number;
  guests: AlbumGuest[];
}

interface Row {
  bytes: number | null;
  created_at: string;
  invitation: { code: string; display_name: string };
}

/**
 * What arrived to the Drive album, by guest (the photos themselves are in Drive: Supabase
 * only keeps one row per photo the script saved).
 */
export function useAlbumSummary() {
  return useQuery({
    queryKey: ['album', 'summary'],
    queryFn: async (): Promise<AlbumSummary> => {
      const rows: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('album_photos')
          .select('bytes, created_at, invitation:invitations(code, display_name)')
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data as unknown as Row[]));
        if (data.length < PAGE) break;
      }
      const guests = new Map<string, AlbumGuest>();
      for (const row of rows) {
        const guest = guests.get(row.invitation.code) ?? {
          code: row.invitation.code,
          name: row.invitation.display_name,
          photos: 0,
          bytes: 0,
          lastAt: row.created_at,
        };
        guest.photos++;
        guest.bytes += row.bytes ?? 0;
        guests.set(guest.code, guest);
      }
      return {
        photos: rows.length,
        bytes: rows.reduce((sum, r) => sum + (r.bytes ?? 0), 0),
        guests: [...guests.values()].sort((a, b) => b.photos - a.photos),
      };
    },
  });
}
