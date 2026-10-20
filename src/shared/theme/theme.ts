import type { CustomFont, Theme } from '@/shared/schemas/content';
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
    script: { source: 'google', family: 'Pinyon Script' },
    serif: { source: 'google', family: 'Cormorant Garamond' },
    sans: { source: 'google', family: 'Jost' },
  },
};

/** CSS custom properties for a theme: `--color-<token>` and `--font-<role>`. */
export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.colors)) {
    vars[`--color-${token}`] = value;
  }
  for (const [role, ref] of Object.entries(theme.fonts)) {
    vars[`--font-${role}`] = fontStack(ref, role as keyof Theme['fonts']);
  }
  return vars;
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
