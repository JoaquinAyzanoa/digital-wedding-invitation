/** Alphabet of invitation codes: no 0/o, 1/l/i to avoid confusion when typed by hand. */
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

export function normalizeCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase();
  return code ? code : null;
}

/** A well-formed code (or the demo one). Says nothing about whether it exists. */
export function isWellFormedCode(code: string): boolean {
  return code === 'demo' || CODE_PATTERN.test(code);
}
