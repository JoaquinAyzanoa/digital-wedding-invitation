import { pdf, type DocumentProps } from '@react-pdf/renderer';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { createElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { demoContent } from '@/demo/content';
import { parseGoogleFontsCss, pdfFileName } from './fontSources';
import { qrDataUrl } from './generate';
import { InvitationPdf } from './InvitationPdf';

const CSS = `/* cyrillic */
@font-face {
  font-family: 'Cormorant Garamond';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/cg/cyr.woff2) format('woff2');
}
/* latin */
@font-face {
  font-family: 'Cormorant Garamond';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/cg/italic.woff2) format('woff2');
}
/* latin */
@font-face {
  font-family: 'Pinyon Script';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/ps/regular.woff2) format('woff2');
}`;

describe('PDF fonts', () => {
  it('keeps only the latin faces', () => {
    expect(parseGoogleFontsCss(CSS)).toEqual([
      {
        family: 'Cormorant Garamond',
        src: 'https://fonts.gstatic.com/s/cg/italic.woff2',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        family: 'Pinyon Script',
        src: 'https://fonts.gstatic.com/s/ps/regular.woff2',
        fontWeight: 400,
        fontStyle: 'normal',
      },
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
