/** Alphabet of invitation codes: no 0/o, 1/l/i to avoid confusion when typed by hand. */
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

export function normalizeCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase();
  return code ? code : null;
}

/** A real invitation code (6 characters of the alphabet). */
export function isInvitationCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** A well-formed code (or the demo one). Says nothing about whether it exists. */
export function isWellFormedCode(code: string): boolean {
  return code === 'demo' || isInvitationCode(code);
}
