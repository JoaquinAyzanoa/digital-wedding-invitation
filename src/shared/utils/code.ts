/** Alphabet of invitation codes: no 0/o, 1/l/i to avoid confusion when typed by hand. */
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

// New invitations get 4 characters; 5–6 are older codes that keep working.
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{4,6}$`);

export function normalizeCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase();
  return code ? code : null;
}

/** A real invitation code (4 to 6 characters of the alphabet). */
export function isInvitationCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** A well-formed code (or the demo one). Says nothing about whether it exists. */
export function isWellFormedCode(code: string): boolean {
  return code === 'demo' || isInvitationCode(code);
}

/**
 * The code in an invitation link: `/?ubhd` (the short form) or `/?i=ubhd` (older links,
 * the demo and the admin's preview). Null when there is none.
 */
export function codeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const explicit = normalizeCode(params.get('i'));
  if (explicit) return explicit;
  for (const [key, value] of params) {
    const code = normalizeCode(key);
    if (value === '' && code && isWellFormedCode(code)) return code;
  }
  return null;
}
