import type { CustomFont, FontRef, Theme } from '@/shared/schemas/content';

export type FontRole = keyof Theme['fonts'];

interface CuratedFont {
  family: string;
  /** Google Fonts CSS2 axis spec. Only weights the family actually has: one bad spec fails the whole request. */
  axes?: string;
}

// Script fonts favour high-contrast calligraphy with long entry strokes, like the reference.
// Mea Culpa is the closest free match to it (big entry loops on P, A, C, R).
export const CURATED_FONTS: Record<FontRole, CuratedFont[]> = {
  script: [
    { family: 'Mea Culpa' },
    { family: 'Pinyon Script' },
    { family: 'Imperial Script' },
    { family: 'Ballet' },
    { family: 'Great Vibes' },
    { family: 'Monsieur La Doulaise' },
    { family: 'Mrs Saint Delafield' },
    { family: 'Corinthia' },
    { family: 'Ephesis' },
    { family: 'WindSong' },
    { family: 'Italianno' },
    { family: 'Parisienne' },
    { family: 'Alex Brush' },
  ],
  serif: [
    { family: 'Cormorant Garamond', axes: 'ital,wght@0,400;0,500;0,600;1,400' },
    { family: 'EB Garamond', axes: 'ital,wght@0,400;0,500;0,600;1,400' },
    { family: 'Playfair Display', axes: 'ital,wght@0,400;0,500;0,600;1,400' },
    { family: 'Lora', axes: 'ital,wght@0,400;0,500;0,600;1,400' },
    { family: 'Libre Baskerville', axes: 'ital,wght@0,400;0,700;1,400' },
    { family: 'Cormorant', axes: 'ital,wght@0,400;0,500;0,600;1,400' },
    // Capitals only (lowercase is drawn as small capitals), like engraved invitations.
    { family: 'Cinzel', axes: 'wght@400;500;600' },
  ],
  sans: [
    { family: 'Jost', axes: 'wght@300;400;500' },
    { family: 'Montserrat', axes: 'wght@300;400;500' },
    { family: 'Raleway', axes: 'wght@300;400;500' },
    { family: 'Josefin Sans', axes: 'wght@300;400;500' },
    { family: 'Quicksand', axes: 'wght@300;400;500' },
    { family: 'Lato', axes: 'wght@300;400;700' },
  ],
};

const FALLBACKS: Record<FontRole, string> = {
  script: 'cursive',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const curatedAxes = new Map(
  Object.values(CURATED_FONTS)
    .flat()
    .map((font) => [font.family, font.axes]),
);

/** Whether a curated family has an italic face (its axes start with `ital`). */
export function hasItalic(family: string): boolean {
  return curatedAxes.get(family)?.startsWith('ital') ?? false;
}

export function customFontFamily(id: string): string {
  return `wi-custom-${id}`;
}

/** CSS `font-family` value for a role, with a generic fallback. */
export function fontStack(ref: FontRef, role: FontRole): string {
  const family = ref.source === 'google' ? ref.family : customFontFamily(ref.id);
  return `"${family}", ${FALLBACKS[role]}`;
}

/** One Google Fonts CSS2 URL for every Google font in use, or null if there are none. */
export function googleFontsUrl(refs: FontRef[]): string | null {
  const families = [
    ...new Set(refs.flatMap((ref) => (ref.source === 'google' ? [ref.family] : []))),
  ];
  if (families.length === 0) return null;

  const params = families.map((family) => {
    const axes = curatedAxes.get(family);
    const name = family.replace(/ /g, '+');
    return `family=${axes ? `${name}:${axes}` : name}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

/** `@font-face` rules for the uploaded fonts that are actually referenced. */
export function customFontFaces(refs: FontRef[], customFonts: CustomFont[]): string {
  const ids = new Set(refs.flatMap((ref) => (ref.source === 'custom' ? [ref.id] : [])));
  return customFonts
    .filter((font) => ids.has(font.id))
    .map(
      (font) =>
        `@font-face { font-family: "${customFontFamily(font.id)}"; ` +
        `src: url("${encodeURI(font.url)}"); font-display: swap; }`,
    )
    .join('\n');
}

function upsertElement<K extends 'link' | 'style'>(doc: Document, tag: K, id: string) {
  let el = doc.getElementById(id) as HTMLElementTagNameMap[K] | null;
  if (!el) {
    el = doc.createElement(tag);
    el.id = id;
    doc.head.append(el);
  }
  return el;
}

/**
 * Injects the stylesheets for the given fonts and resolves once the script font is ready
 * (or after `timeoutMs`, so a slow network never blocks the page).
 */
export function loadFonts(
  refs: FontRef[],
  customFonts: CustomFont[],
  {
    doc = document,
    timeoutMs = 1500,
    waitFor,
    id = 'wi-theme-fonts',
  }: {
    doc?: Document;
    timeoutMs?: number;
    waitFor?: string;
    /** Element id prefix; callers loading unrelated font sets must use different ids. */
    id?: string;
  } = {},
): Promise<void> {
  const url = googleFontsUrl(refs);
  if (url) {
    const link = upsertElement(doc, 'link', `${id}-google`);
    link.rel = 'stylesheet';
    if (link.href !== url) link.href = url;
  }
  upsertElement(doc, 'style', `${id}-custom`).textContent = customFontFaces(refs, customFonts);

  if (!waitFor || !('fonts' in doc)) return Promise.resolve();
  const loaded = doc.fonts.load(`1em ${waitFor}`).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}
