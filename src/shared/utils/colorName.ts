// A Spanish name for a color, for screen readers (the swatches only show the color).

const NAMED: ReadonlyArray<readonly [string, readonly [number, number, number]]> = [
  ['blanco', [255, 255, 255]],
  ['marfil', [247, 241, 227]],
  ['crema', [240, 228, 200]],
  ['beige', [222, 203, 175]],
  ['nude', [214, 178, 158]],
  ['dorado', [201, 162, 90]],
  ['plateado', [192, 192, 196]],
  ['gris', [128, 128, 128]],
  ['negro', [20, 20, 20]],
  ['rojo', [200, 30, 40]],
  ['vino', [115, 20, 35]],
  ['rosado', [240, 170, 185]],
  ['fucsia', [220, 40, 140]],
  ['lila', [190, 160, 215]],
  ['morado', [110, 50, 140]],
  ['celeste', [150, 200, 235]],
  ['azul', [40, 70, 160]],
  ['azul marino', [25, 35, 80]],
  ['verde', [50, 130, 70]],
  ['verde oliva', [110, 120, 60]],
  ['amarillo', [240, 210, 60]],
  ['naranja', [240, 130, 40]],
  ['terracota', [190, 95, 65]],
  ['marrón', [110, 70, 40]],
];

/** The nearest named color to a `#RRGGBB` value (weighted for how the eye sees it). */
export function colorName(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  let best = NAMED[0]!;
  let bestDistance = Infinity;
  for (const named of NAMED) {
    const [r, g, b] = named[1];
    const mean = (rgb[0] + r) / 2;
    const distance =
      (2 + mean / 256) * (rgb[0] - r) ** 2 +
      4 * (rgb[1] - g) ** 2 +
      (2 + (255 - mean) / 256) * (rgb[2] - b) ** 2;
    if (distance < bestDistance) {
      best = named;
      bestDistance = distance;
    }
  }
  return best[0];
}
