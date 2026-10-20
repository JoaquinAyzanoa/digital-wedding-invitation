import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mix } from './color';
import { customFontFaces, fontStack, googleFontsUrl } from './fonts';
import { DEFAULT_THEME, derivedColors, themeVariables } from './theme';

describe('googleFontsUrl', () => {
  it('builds one CSS2 URL with the curated axes', () => {
    expect(googleFontsUrl(Object.values(DEFAULT_THEME.fonts))).toBe(
      'https://fonts.googleapis.com/css2?family=Pinyon+Script' +
        '&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400' +
        '&family=Jost:wght@300;400;500&display=swap',
    );
  });

  it('skips custom fonts and duplicates', () => {
    expect(
      googleFontsUrl([
        { source: 'custom', id: 'mine' },
        { source: 'google', family: 'Great Vibes' },
        { source: 'google', family: 'Great Vibes' },
      ]),
    ).toBe('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
  });

  it('returns null when no Google font is used', () => {
    expect(googleFontsUrl([{ source: 'custom', id: 'mine' }])).toBeNull();
  });
});

describe('custom fonts', () => {
  const customFonts = [
    { id: 'mine', family: 'Mi Caligrafía', url: 'https://x.supabase.co/site/fonts/mine.ttf' },
    { id: 'unused', family: 'Otra', url: 'https://x.supabase.co/site/fonts/otra.ttf' },
  ];

  it('uses a namespaced family in the stack', () => {
    expect(fontStack({ source: 'custom', id: 'mine' }, 'script')).toBe('"wi-custom-mine", cursive');
  });

  it('only declares @font-face for referenced fonts', () => {
    const css = customFontFaces([{ source: 'custom', id: 'mine' }], customFonts);
    expect(css).toContain('wi-custom-mine');
    expect(css).toContain('mine.ttf');
    expect(css).not.toContain('otra.ttf');
  });
});

describe('themeVariables', () => {
  it('maps colors and fonts to CSS custom properties', () => {
    const vars = themeVariables(DEFAULT_THEME);
    expect(vars['--color-primary']).toBe('#4F6496');
    expect(vars['--font-script']).toBe('"Pinyon Script", cursive');
    expect(vars['--font-sans']).toMatch(/^"Jost", system-ui/);
  });
});

describe('derived colors', () => {
  it('mixes in sRGB like color-mix', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#4f6496', '#4f6496', 0.3)).toBe('#4f6496');
  });

  it('keeps the global.css defaults in sync with the default theme', () => {
    const css = readFileSync(new URL('../global.css', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(derivedColors(DEFAULT_THEME.colors))) {
      expect(css, name).toContain(`${name}: ${value};`);
    }
  });
});
