import { pdf, type DocumentProps } from '@react-pdf/renderer';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { createElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { demoContent } from '@/demo/content';
import { fontsourceFaces, pdfFileName } from './fontSources';
import { qrDataUrl, withItalic } from './generate';
import { InvitationPdf } from './InvitationPdf';

describe('PDF fonts', () => {
  it('uses Fontsource TTFs, with the italic only when the family has one', () => {
    expect(fontsourceFaces('Mea Culpa', false)).toEqual([
      {
        src: 'https://cdn.jsdelivr.net/fontsource/fonts/mea-culpa@latest/latin-400-normal.ttf',
        fontWeight: 400,
        fontStyle: 'normal',
      },
    ]);
    expect(fontsourceFaces('Cormorant Garamond', true).map((f) => f.src)).toEqual([
      'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-400-normal.ttf',
      'https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@latest/latin-400-italic.ttf',
    ]);
  });
});

describe('pdfFileName', () => {
  it('is plain ASCII', () => {
    expect(pdfFileName('Camila', 'Joaquín', 'Familia Pérez')).toBe(
      'Invitacion-Camila-y-Joaquin-Familia-Perez.pdf',
    );
    expect(pdfFileName('Ana', 'Luis', '')).toBe('Invitacion-Ana-y-Luis.pdf');
  });
});

describe('QR', () => {
  it('encodes the personal link exactly', async () => {
    const link = 'https://camilayjoaquin.com/?i=k7m2qp';
    const dataUrl = await qrDataUrl(link, '#2E2A3A');
    const png = PNG.sync.read(Buffer.from(dataUrl.split(',')[1]!, 'base64'));
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(link);
  });
});

describe('InvitationPdf', () => {
  it('renders one 540 × 960 pt page', async () => {
    const qr = await qrDataUrl('https://x.com/?i=demo', '#000000');
    const element = createElement(InvitationPdf, {
      content: demoContent,
      guest: { displayName: 'Familia Pérez', seats: 4 },
      link: 'https://x.com/?i=demo',
      qr,
      fonts: { script: 'Times-Italic', serif: 'Times-Roman', sans: 'Helvetica' },
      decorations: {},
    });
    const document = element as unknown as ReactElement<DocumentProps>;
    const buffer = Buffer.from(await (await pdf(document).toBlob()).arrayBuffer());
    const text = buffer.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(text).toMatch(/\/MediaBox \[0 0 540 960\]/);
  }, 20_000);
});

describe('withItalic', () => {
  it('reuses the upright faces when a family has no italic (react-pdf would throw)', () => {
    const upright = { src: 'a.ttf', fontWeight: 400, fontStyle: 'normal' as const };
    expect(withItalic([upright])).toEqual([upright, { ...upright, fontStyle: 'italic' }]);
    const italic = { ...upright, fontStyle: 'italic' as const };
    expect(withItalic([upright, italic])).toEqual([upright, italic]);
  });
});
