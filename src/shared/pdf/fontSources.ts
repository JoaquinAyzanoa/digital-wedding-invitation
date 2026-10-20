// Font files for the PDF. @react-pdf/renderer reads WOFF2, so the same Google Fonts files
// the invitation uses work here (no TTFs in the repo). Variable families render at their
// default weight. Uploaded fonts (TTF/OTF) are used directly.

export interface FontFace {
  family: string;
  src: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
}

/** The `latin` @font-face blocks of a Google Fonts CSS2 response (Spanish needs nothing else). */
export function parseGoogleFontsCss(css: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const match of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (match[1] !== 'latin') continue;
    const body = match[2]!;
    const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
    const src = /url\(([^)]+)\)/.exec(body)?.[1];
    if (!family || !src) continue;
    faces.push({
      family,
      src,
      fontWeight: Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? 400),
      fontStyle: /font-style:\s*italic/.test(body) ? 'italic' : 'normal',
    });
  }
  return faces;
}

/** ASCII file name: "Invitacion-Camila-y-Joaquin-Familia-Perez.pdf". */
export function pdfFileName(bride: string, groom: string, guest: string): string {
  const slug = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `Invitacion-${[slug(bride), 'y', slug(groom), slug(guest)].filter(Boolean).join('-')}.pdf`;
}
