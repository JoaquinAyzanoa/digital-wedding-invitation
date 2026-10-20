import { Font, pdf, type DocumentProps } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { createElement, type ReactElement } from 'react';
import type { CustomFont, FontRef, PublicContent } from '@/shared/schemas/content';
import { customFontFamily, googleFontsUrl, type FontRole } from '@/shared/theme/fonts';
import { parseGoogleFontsCss, pdfFileName } from './fontSources';
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

/** Registers the theme's fonts; falls back to the PDF's built-in fonts if they cannot load. */
async function registerFonts(
  theme: PublicContent['theme'],
  customFonts: CustomFont[],
): Promise<PdfFonts> {
  const result = { ...BUILT_IN };
  const roles = Object.entries(theme.fonts) as Array<[FontRole, FontRef]>;

  const googleRefs = roles.map(([, ref]) => ref).filter((ref) => ref.source === 'google');
  const url = googleFontsUrl(googleRefs);
  let googleFamilies = new Set<string>();
  if (url) {
    try {
      const faces = parseGoogleFontsCss(await (await fetch(url)).text());
      for (const family of new Set(faces.map((f) => f.family))) {
        if (!registered.has(family)) {
          Font.register({ family, fonts: faces.filter((f) => f.family === family) });
          registered.add(family);
        }
      }
      googleFamilies = new Set(faces.map((f) => f.family));
    } catch {
      // Offline or blocked: keep the built-in fonts.
    }
  }

  for (const [role, ref] of roles) {
    if (ref.source === 'google' && googleFamilies.has(ref.family)) {
      result[role] = ref.family;
    } else if (ref.source === 'custom') {
      const font = customFonts.find((f) => f.id === ref.id);
      if (font) {
        const family = customFontFamily(font.id);
        if (!registered.has(family)) {
          Font.register({ family, src: font.url });
          registered.add(family);
        }
        result[role] = family;
      }
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
  const [fonts, qr, top, bottom] = await Promise.all([
    registerFonts(content.theme, content.customFonts),
    qrDataUrl(link, content.theme.colors.ink),
    toPng(content.decorations.cornerTL),
    toPng(content.decorations.cornerBR),
  ]);
  // pdf() is typed for a <Document> element; InvitationPdf renders one.
  const document = createElement(InvitationPdf, {
    content,
    guest,
    link,
    qr,
    fonts,
    decorations: { top, bottom },
  }) as unknown as ReactElement<DocumentProps>;
  const blob = await pdf(document).toBlob();
  const fileName = pdfFileName(
    content.couple.bride,
    content.couple.groom,
    guest?.displayName ?? '',
  );
  return { blob, fileName };
}
