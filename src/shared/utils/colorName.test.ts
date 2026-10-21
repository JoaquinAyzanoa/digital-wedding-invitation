import { describe, expect, it } from 'vitest';
import { colorName } from './colorName';

describe('colorName', () => {
  it('names the usual colors to avoid', () => {
    expect(colorName('#FFFFFF')).toBe('blanco');
    expect(colorName('#F8F3E8')).toBe('marfil');
    expect(colorName('#7A1020')).toBe('vino');
    expect(colorName('#C8102E')).toBe('rojo');
    expect(colorName('#000000')).toBe('negro');
    expect(colorName('#E9DCCB')).toBe('crema');
  });
});
