import type { CustomFont, Theme } from '@/shared/schemas/content';
import { deepen, mix, withAlpha } from './color';
import { contrastRatio } from './contrast';
import { fontStack, loadFonts } from './fonts';

export const DEFAULT_THEME: Theme = {
  colors: {
    bg: '#FBFAF7',
    surface: '#FFF8EE',
    ink: '#2E2A3A',
    muted: '#6B6878',
    primary: '#4F6496',
    accent: '#C9A46C',
    line: '#E6E1D8',
  },
  fonts: {
    script: { source: 'google', family: 'Mea Culpa' },
    serif: { source: 'google', family: 'Cormorant Garamond' },
    sans: { source: 'google', family: 'Jost' },
  },
};

const WHITE_INK = 'rgb(255 255 255 / 0.92)';

/** Paper in a chosen colour: the face as picked, lighter folds and a deeper inside. */
function paperShades(color: string) {
  return {
    face: color,
    side: mix(color, '#ffffff', 0.86),
    bottom: mix(color, '#ffffff', 0.72),
    inside: deepen(color),
  };
}

/**
 * Shades derived from the base tokens: envelope paper, wax seal and the gold around them.
 * The envelope and the seal take their own colour when one is chosen, and only they do.
 */
export function derivedColors({
  primary,
  accent,
  envelope,
  seal,
}: Theme['colors']): Record<string, string> {
  const goldLo = mix(accent, '#3b2a12', 0.62);
  const wax = (seal || accent).toLowerCase();
  const own = envelope ? paperShades(envelope) : null;
  // The engraved hint on a chosen paper: white or dark gold, whichever reads better on it.
  const ownInk =
    envelope && contrastRatio('#ffffff', envelope) < contrastRatio(goldLo, envelope)
      ? goldLo
      : WHITE_INK;
  const primarySoft = mix(primary, '#f3f6fb', 0.44);
  const primaryPale = mix(primary, '#f6f8fc', 0.38);
  const primaryDeep = mix(primary, '#e3e9f2', 0.68);
  return {
    // Petals and confetti.
    '--primary-soft': primarySoft,
    '--primary-pale': primaryPale,
    '--primary-deep': primaryDeep,
    '--primary-a55': withAlpha(primary, 0.55),
    '--primary-a25': withAlpha(primary, 0.25),
    // The envelope's paper: from the primary...
    '--env': own?.face ?? mix(primary, '#eef3fa', 0.5),
    '--env-side': own?.side ?? primarySoft,
    '--env-bottom': own?.bottom ?? primaryPale,
    '--env-inside': own?.inside ?? primaryDeep,
    '--env-ink': own ? ownInk : WHITE_INK,
    // ...and over the cover video, warm paper from the gold.
    '--paper': own?.face ?? mix(accent, '#f5ece0', 0.3),
    '--paper-side': own?.side ?? mix(accent, '#f8f1e6', 0.26),
    '--paper-bottom': own?.bottom ?? mix(accent, '#fbf6ee', 0.22),
    '--paper-inside': own?.inside ?? mix(accent, '#eadfcd', 0.42),
    '--paper-ink': own ? ownInk : goldLo,
    // Gold details on the cover: the "&", the seats, the card's ink.
    '--gold-hi': mix(accent, '#ffffff', 0.45),
    '--gold-lo': goldLo,
    '--seal': wax,
    '--seal-hi': mix(wax, '#ffffff', 0.45),
    '--seal-lo': mix(wax, '#3b2a12', 0.62),
    '--seal-well-hi': mix(wax, '#ffffff', 0.7),
    '--seal-well-lo': mix(wax, '#3b2a12', 0.75),
    '--seal-emboss-hi': mix(wax, '#ffffff', 0.4),
    '--seal-emboss-lo': mix(wax, '#2a1d0a', 0.55),
  };
}

/** CSS custom properties for a theme: `--color-<token>`, `--font-<role>` and derived shades. */
export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.colors)) {
    // Optional: the envelope and the seal reach the page only through their derived shades.
    if (token === 'envelope' || token === 'seal') continue;
    vars[`--color-${token}`] = value;
  }
  for (const [role, ref] of Object.entries(theme.fonts)) {
    vars[`--font-${role}`] = fontStack(ref, role as keyof Theme['fonts']);
  }
  return { ...vars, ...derivedColors(theme.colors) };
}

/** Applies the theme to `:root`, loads its fonts and resolves when the script font is usable. */
export function applyTheme(
  theme: Theme,
  customFonts: CustomFont[],
  root: HTMLElement = document.documentElement,
): Promise<void> {
  for (const [name, value] of Object.entries(themeVariables(theme))) {
    root.style.setProperty(name, value);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);

  const refs = Object.values(theme.fonts);
  return loadFonts(refs, customFonts, { waitFor: fontStack(theme.fonts.script, 'script') });
}
