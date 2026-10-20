import { describe, expect, it } from 'vitest';
import { codeFromSearch, isInvitationCode, isWellFormedCode } from './code';

describe('invitation codes', () => {
  it('accepts 4 characters (new) up to 6 (older links) of the alphabet', () => {
    expect(isInvitationCode('ubhd')).toBe(true);
    expect(isInvitationCode('abc234')).toBe(true);
    expect(isInvitationCode('abc')).toBe(false);
    expect(isInvitationCode('abcd2345')).toBe(false);
    // 0, 1, i, l and o are left out: easy to confuse when typed by hand.
    expect(isInvitationCode('ab1o')).toBe(false);
    expect(isWellFormedCode('demo')).toBe(true);
  });

  it('reads the code from the short link and from the older one', () => {
    expect(codeFromSearch('?ubhd')).toBe('ubhd');
    expect(codeFromSearch('?UBHD')).toBe('ubhd');
    expect(codeFromSearch('?ubhd&notrack=1')).toBe('ubhd');
    expect(codeFromSearch('?i=abc234')).toBe('abc234');
    expect(codeFromSearch('?preview=1&i=demo')).toBe('demo');
    expect(codeFromSearch('?demo')).toBe('demo');
  });

  it('finds no code in other links', () => {
    expect(codeFromSearch('')).toBeNull();
    expect(codeFromSearch('?preview=1')).toBeNull();
    expect(codeFromSearch('?design')).toBeNull();
    expect(codeFromSearch('?fbclid=abc234')).toBeNull();
  });
});
