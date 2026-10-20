import { Font, pdf, type DocumentProps } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { createElement, type ReactElement } from 'react';
import type { CustomFont, FontRef, PublicContent } from '@/shared/schemas/content';
import { customFontFamily, hasItalic, type FontRole } from '@/shared/theme/fonts';
import { fontsourceFaces, pdfFileName } from './fontSources';
import { InvitationPdf, type PdfFonts } from './InvitationPdf';

// Loaded on demand only (dynamic import): @react-pdf is large and only needed when a PDF
// is requested.

// Words are never split with hyphens (Spanish names would break oddly).
Font.registerHyphenationCallback((word) => [word]);

const BUILT_IN: Record<FontRole, string> = {
  script: 'Times-Italic',
  serif: 'Times-Roman',
  sans: 'Helvetica',
};
const registered = new Set<string>();

/**
 * react-pdf throws (and the whole PDF fails) when text asks for italic and the family has
 * none, as with most uploaded fonts. Families without italic reuse the upright faces.
 */
export function withItalic<T extends { fontStyle: 'normal' | 'italic' }>(faces: T[]): T[] {
  return faces.some((f) => f.fontStyle === 'italic')
    ? faces
    : [...faces, ...faces.map((f) => ({ ...f, fontStyle: 'italic' as const }))];
}

/** Registers the theme's fonts (files are fetched by react-pdf while rendering). */
function registerFonts(theme: PublicContent['theme'], customFonts: CustomFont[]): PdfFonts {
  const result = { ...BUILT_IN };
  for (const [role, ref] of Object.entries(theme.fonts) as Array<[FontRole, FontRef]>) {
    if (ref.source === 'google') {
      if (!registered.has(ref.family)) {
        Font.register({
          family: ref.family,
          fonts: withItalic(fontsourceFaces(ref.family, hasItalic(ref.family))),
        });
        registered.add(ref.family);
      }
      result[role] = ref.family;
    } else {
      const font = customFonts.find((f) => f.id === ref.id);
      if (!font) continue;
      const family = customFontFamily(font.id);
      if (!registered.has(family)) {
        Font.register({
          family,
          fonts: withItalic([{ src: font.url, fontWeight: 400, fontStyle: 'normal' }]),
        });
        registered.add(family);
      }
      result[role] = family;
    }
  }
  return result;
}

/** Any image the browser can show, as a PNG data URL (scaled down to `maxSide`). */
async function toPng(url: string | undefined, maxSide = 800): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return undefined; // A missing flower must not stop the PDF.
  }
}

export function qrDataUrl(link: string, dark: string): Promise<string> {
  return QRCode.toDataURL(link, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark, light: '#FFFFFF' },
  });
}

export interface GeneratePdfInput {
  content: PublicContent;
  guest: { displayName: string; seats: number } | null;
  link: string;
}

export async function generateInvitationPdf({ content, guest, link }: GeneratePdfInput) {
  const [qr, top, bottom] = await Promise.all([
    qrDataUrl(link, content.theme.colors.ink),
    toPng(content.decorations.cornerTL),
    toPng(content.decorations.cornerBR),
  ]);
  const render = (fonts: PdfFonts) =>
    pdf(
      // pdf() is typed for a <Document> element; InvitationPdf renders one.
      createElement(InvitationPdf, {
        content,
        guest,
        link,
        qr,
        fonts,
        decorations: { top, bottom },
      }) as unknown as ReactElement<DocumentProps>,
    ).toBlob();

  let blob: Blob;
  try {
    blob = await render(registerFonts(content.theme, content.customFonts));
  } catch {
    // A font that cannot be downloaded or embedded (offline, a broken upload) must not cost
    // the guest their PDF: the same page with the PDF's built-in fonts.
    blob = await render(BUILT_IN);
  }
  const fileName = pdfFileName(
    content.couple.bride,
    content.couple.groom,
    guest?.displayName ?? '',
  );
  return { blob, fileName };
}
