import type { CustomFont, Theme } from '@/shared/schemas/content';
import { mix, withAlpha } from './color';
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

/** Shades derived from the base tokens: envelope paper and wax seal. */
export function derivedColors({ primary, accent }: Theme['colors']): Record<string, string> {
  return {
    '--env': mix(primary, '#eef3fa', 0.5),
    '--env-side': mix(primary, '#f3f6fb', 0.44),
    '--env-bottom': mix(primary, '#f6f8fc', 0.38),
    '--env-inside': mix(primary, '#e3e9f2', 0.68),
    '--primary-a55': withAlpha(primary, 0.55),
    '--primary-a25': withAlpha(primary, 0.25),
    '--seal-hi': mix(accent, '#ffffff', 0.45),
    '--seal-lo': mix(accent, '#3b2a12', 0.62),
    '--seal-well-hi': mix(accent, '#ffffff', 0.7),
    '--seal-well-lo': mix(accent, '#3b2a12', 0.75),
    '--seal-emboss-hi': mix(accent, '#ffffff', 0.4),
    '--seal-emboss-lo': mix(accent, '#2a1d0a', 0.55),
  };
}

/** CSS custom properties for a theme: `--color-<token>`, `--font-<role>` and derived shades. */
export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.colors)) {
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
