import { describe, expect, it } from 'vitest';
import { normalizePhone, renderTemplate, whatsappUrl } from './whatsapp';

describe('renderTemplate', () => {
  it('fills the placeholders', () => {
    expect(
      renderTemplate('Hola {name}: {seats} pases. {link} {name}', {
        name: 'Familia Pérez',
        seats: 4,
        link: 'https://x.com/?i=abc234',
      }),
    ).toBe('Hola Familia Pérez: 4 pases. https://x.com/?i=abc234 Familia Pérez');
  });

  it('leaves unknown placeholders alone', () => {
    expect(renderTemplate('{otro}', { name: 'A', seats: 1, link: 'l' })).toBe('{otro}');
  });
});

describe('normalizePhone', () => {
  it('adds 51 to Peruvian mobiles', () => {
    expect(normalizePhone('987 654 321')).toBe('51987654321');
    expect(normalizePhone('987-654-321')).toBe('51987654321');
  });

  it('keeps numbers that already have a country code', () => {
    expect(normalizePhone('+51 987 654 321')).toBe('51987654321');
    expect(normalizePhone('0034 612 345 678')).toBe('34612345678');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567');
  });

  it('rejects what cannot be a phone', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('whatsappUrl', () => {
  it('encodes the message', () => {
    expect(whatsappUrl('987654321', '¡Hola! & ven')).toBe(
      'https://wa.me/51987654321?text=%C2%A1Hola!%20%26%20ven',
    );
    expect(whatsappUrl(null, 'x')).toBeNull();
  });
});
