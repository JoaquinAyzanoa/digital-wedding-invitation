// Font files for the PDF. react-pdf cannot embed most Google Fonts WOFF2 files (its subsetter
// crashes on them), so the curated fonts come as static TTFs from Fontsource's CDN (same
// typefaces, open CORS). Uploaded fonts (TTF/OTF) are used directly.

export interface FontFace {
  src: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
}

/** Regular (and italic, when the family has one) latin TTFs of a Google font. */
export function fontsourceFaces(family: string, hasItalic: boolean): FontFace[] {
  const id = family.toLowerCase().replace(/ /g, '-');
  const url = (style: string) =>
    `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-400-${style}.ttf`;
  const faces: FontFace[] = [{ src: url('normal'), fontWeight: 400, fontStyle: 'normal' }];
  if (hasItalic) faces.push({ src: url('italic'), fontWeight: 400, fontStyle: 'italic' });
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
