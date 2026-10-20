import {
  responseStatus,
  SIDES,
  type InvitationWithAttendees,
  type ResponseStatus,
  type Side,
} from '@/shared/schemas/invitationAdmin';

export const SORTS = {
  name: 'Nombre',
  created: 'Más recientes',
  responded: 'Respuesta más reciente',
  seats: 'Más pases',
} as const;

export type SortKey = keyof typeof SORTS;
type YesNoAll = 'all' | 'yes' | 'no';

export interface InvitationFilters {
  q: string;
  status: 'all' | ResponseStatus;
  side: 'all' | Side;
  /** 'all', a group name, or NO_GROUP. */
  group: string;
  sent: YesNoAll;
  opened: YesNoAll;
  sort: SortKey;
}

export const NO_GROUP = '__none';

export const DEFAULT_FILTERS: InvitationFilters = {
  q: '',
  status: 'all',
  side: 'all',
  group: 'all',
  sent: 'all',
  opened: 'all',
  sort: 'name',
};

const STATUSES = ['all', 'pending', 'attending', 'declined'] as const;
const YES_NO = ['all', 'yes', 'no'] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Filters live in the URL so they survive reloads and the back button. */
export function filtersFromParams(params: URLSearchParams): InvitationFilters {
  return {
    q: params.get('q') ?? '',
    status: pick(params.get('status'), STATUSES, 'all'),
    side: pick(params.get('side'), ['all', ...SIDES] as const, 'all'),
    group: params.get('group') ?? 'all',
    sent: pick(params.get('sent'), YES_NO, 'all'),
    opened: pick(params.get('opened'), YES_NO, 'all'),
    sort: pick(params.get('sort'), Object.keys(SORTS) as SortKey[], 'name'),
  };
}

export function filtersToParams(filters: InvitationFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== DEFAULT_FILTERS[key as keyof InvitationFilters]) params.set(key, value);
  }
  return params;
}

export function isFiltered(filters: InvitationFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof InvitationFilters)[]).some(
    (key) => key !== 'sort' && filters[key] !== DEFAULT_FILTERS[key],
  );
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function matchesYesNo(value: unknown, filter: YesNoAll): boolean {
  return filter === 'all' || (filter === 'yes') === Boolean(value);
}

export function applyFilters(
  invitations: InvitationWithAttendees[],
  filters: InvitationFilters,
): InvitationWithAttendees[] {
  const terms = fold(filters.q).split(/\s+/).filter(Boolean);

  const result = invitations.filter((i) => {
    if (filters.status !== 'all' && responseStatus(i) !== filters.status) return false;
    if (filters.side !== 'all' && i.side !== filters.side) return false;
    if (
      filters.group === NO_GROUP
        ? i.group_name
        : filters.group !== 'all' && i.group_name !== filters.group
    ) {
      return false;
    }
    if (!matchesYesNo(i.sent_at, filters.sent)) return false;
    if (!matchesYesNo(i.first_opened_at, filters.opened)) return false;
    if (terms.length) {
      // Every word must appear somewhere: name, code, group, contact, notes or attendees.
      const haystack = fold(
        [
          i.display_name,
          i.code,
          i.group_name,
          i.phone,
          i.email,
          i.notes,
          ...i.attendees.map((a) => a.full_name),
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (!terms.every((term) => haystack.includes(term))) return false;
    }
    return true;
  });

  const byName = (a: InvitationWithAttendees, b: InvitationWithAttendees) =>
    a.display_name.localeCompare(b.display_name, 'es');
  const sorters: Record<
    SortKey,
    (a: InvitationWithAttendees, b: InvitationWithAttendees) => number
  > = {
    name: byName,
    created: (a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b),
    responded: (a, b) => (b.responded_at ?? '').localeCompare(a.responded_at ?? '') || byName(a, b),
    seats: (a, b) => b.seats - a.seats || byName(a, b),
  };
  return result.sort(sorters[filters.sort]);
}

export function groupsOf(invitations: InvitationWithAttendees[]): string[] {
  return [
    ...new Set(invitations.map((i) => i.group_name).filter((g): g is string => Boolean(g))),
  ].sort((a, b) => a.localeCompare(b, 'es'));
}
