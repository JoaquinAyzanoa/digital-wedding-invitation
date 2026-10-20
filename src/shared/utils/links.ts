/** Public site URL for links shared with guests (VITE_SITE_URL, or this origin locally). */
export function siteUrl(): string {
  return (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
}

/** The guest's personal link. */
export function invitationLink(code: string): string {
  return `${siteUrl()}/?${code}`;
}

/** Opening an invitation from the admin: same deployment, and the visit is not counted. */
export function adminPreviewLink(code: string): string {
  return `${window.location.origin}/?${code}&notrack=1`;
}
