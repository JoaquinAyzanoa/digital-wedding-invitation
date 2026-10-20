import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/admin/supabase';
import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView, RsvpInput } from '@/shared/schemas/invitation';
import {
  invitationRowFromInput,
  type InvitationInput,
  type InvitationWithAttendees,
} from '@/shared/schemas/invitationAdmin';
import type { RsvpRules } from '@/shared/schemas/rsvp';
import type { Json } from '@/shared/types/database.types';

export const keys = {
  invitations: ['invitations'] as const,
  dashboard: ['dashboard'] as const,
  rsvpRules: ['rsvpRules'] as const,
};

/** Turns a Supabase/PostgREST error into a message for the admin. */
export function adminErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === '23505') return 'Ese código ya está en uso.';
  if (e?.message === 'forbidden') return 'Tu sesión no tiene permisos. Vuelve a iniciar sesión.';
  if (e?.message === 'invalid_attendees' || e?.message === 'invalid_payload') {
    return 'Algunos datos de la respuesta no son válidos.';
  }
  if (/fetch|network/i.test(e?.message ?? '')) return 'Sin conexión. Inténtalo de nuevo.';
  return e?.message || 'Algo salió mal.';
}

function check<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

export function useInvitations() {
  return useQuery({
    queryKey: keys.invitations,
    queryFn: async () =>
      check(
        await supabase
          .from('invitations')
          .select('*, attendees(*)')
          .order('created_at', { ascending: true })
          .order('display_name'),
      ) as InvitationWithAttendees[],
  });
}

export interface AdminDashboard {
  invitations: {
    total: number;
    sent: number;
    opened: number;
    responded: number;
    pending: number;
    accepted: number;
    declined: number;
    seats: number;
  };
  people: { confirmed: number; adults: number; children: number };
  bySide: Array<{ side: string; invitations: number; seats: number; confirmed: number }>;
  byGroup: Array<{ group: string | null; invitations: number; seats: number; confirmed: number }>;
  menu: Array<{ menu: string | null; count: number }>;
  dietary: Array<{ fullName: string; invitation: string; dietary: string }>;
  logistics: {
    transport: { invitations: number; people: number };
    lodging: { invitations: number; people: number };
  };
  messages: Array<{ invitation: string; attending: boolean; message: string; respondedAt: string }>;
  songs: Array<{ invitation: string; song: string }>;
  album: { photos: number; bytes: number };
  sheet: { lastSyncAt: string | null };
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: async () => check(await supabase.rpc('admin_dashboard')) as unknown as AdminDashboard,
  });
}

export interface AdminRsvpRules extends RsvpRules {
  ceremonyTitle: string;
  receptionTitle: string;
}

/**
 * The RSVP settings from the content, read leniently: the admin must keep working even
 * before the content is filled in (or if it is incomplete).
 */
export function useRsvpRules() {
  return useQuery({
    queryKey: keys.rsvpRules,
    queryFn: async (): Promise<AdminRsvpRules> => {
      const row = check(
        await supabase.from('site_content').select('public_data').eq('id', 1).maybeSingle(),
      );
      const content = (row?.public_data ?? {}) as Partial<PublicContent>;
      const rsvp = content.rsvp;
      return {
        seats: 20,
        menuOptions: Array.isArray(rsvp?.menuOptions) ? rsvp.menuOptions : [],
        questions: {
          transport: Boolean(rsvp?.questions?.transport),
          lodging: Boolean(rsvp?.questions?.lodging),
          song: Boolean(rsvp?.questions?.song),
          parts: Boolean(rsvp?.questions?.parts),
        },
        ceremonyTitle: content.events?.find((e) => e.kind === 'ceremony')?.title ?? 'Ceremonia',
        receptionTitle: content.events?.find((e) => e.kind === 'reception')?.title ?? 'Recepción',
      };
    },
  });
}

/** Every change to invitations also changes the dashboard numbers. */
function useInvalidate() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.invitations }),
      client.invalidateQueries({ queryKey: keys.dashboard }),
    ]);
}

export function useSaveInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: InvitationInput }) => {
      const row = invitationRowFromInput(input);
      const saved = check(
        id
          ? await supabase.from('invitations').update(row).eq('id', id).select().single()
          : await supabase.from('invitations').insert(row).select().single(),
      );
      if (!saved) throw new Error('No se pudo guardar la invitación.');
      return saved;
    },
    onSuccess: invalidate,
  });
}

/** Inserts in chunks; returns how many went in before any error. */
export function useImportInvitations() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (inputs: InvitationInput[]) => {
      const CHUNK = 50;
      let inserted = 0;
      for (let i = 0; i < inputs.length; i += CHUNK) {
        const rows = inputs.slice(i, i + CHUNK).map(invitationRowFromInput);
        const { error } = await supabase.from('invitations').insert(rows);
        if (error) throw Object.assign(error, { inserted });
        inserted += rows.length;
      }
      return inserted;
    },
    onSettled: invalidate,
  });
}

/** sent_at: when the invitation went out by WhatsApp (null = not sent yet). */
export function useMarkSent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, sent }: { id: string; sent: boolean }) =>
      check(
        await supabase
          .from('invitations')
          .update({ sent_at: sent ? new Date().toISOString() : null })
          .eq('id', id),
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteInvitations() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      check(await supabase.from('invitations').delete().in('id', ids)),
    onSuccess: invalidate,
  });
}

export function useSaveRsvp() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, rsvp }: { id: string; rsvp: RsvpInput }) =>
      check(
        await supabase.rpc('admin_save_rsvp', {
          p_invitation_id: id,
          p_payload: rsvp as unknown as Json,
        }),
      ) as unknown as InvitationView,
    onSuccess: invalidate,
  });
}

export function useResetRsvp() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      check(await supabase.rpc('admin_reset_rsvp', { p_invitation_id: id })),
    onSuccess: invalidate,
  });
}
