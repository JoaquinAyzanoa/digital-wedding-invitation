// Small sRGB helpers so derived colors (envelope paper, seal shades) are computed from the
// theme in JS instead of CSS `color-mix()`, which older iOS/Android in-app browsers lack.

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** `weight` of `a` mixed with the rest of `b` (like `color-mix(a weight%, b)`). */
export function mix(a: string, b: string, weight: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex(ca.map((c, i) => c * weight + cb[i]! * (1 - weight)) as Rgb);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
