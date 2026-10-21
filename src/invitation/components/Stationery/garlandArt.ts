// An embossed garland (one 240 × 56 tile, repeated across the page): two stems crossing,
// leaves along them, sprigs reaching to the edges, small five-petal flowers and berries.
// Built once from a fixed seed, so every visit draws the same garland.

export const TILE_WIDTH = 240;
export const TILE_HEIGHT = 56;
const MID = 28;

const fmt = (n: number) => n.toFixed(2);

let seed = 7;
function random() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

type Stem = (x: number) => number;
// Two waves in opposite phase that meet the tile's edges at the same height and slope.
const wave =
  (amplitude: number, phase: number): Stem =>
  (x) =>
    MID + amplitude * Math.sin(((2 * Math.PI * x) / TILE_WIDTH) * 2 + phase);
const STEMS = [wave(8, 0), wave(7, Math.PI)] as const;

const slopeAt = (stem: Stem, x: number) =>
  (Math.atan2(stem(x + 0.5) - stem(x - 0.5), 1) * 180) / Math.PI;

const LEAF = 'M0 0C2.4 -2.5 6.2 -3.1 9.6 -0.4C6.2 2.3 2.4 2 0 0Z';

export interface GarlandArt {
  /** Stems and twigs: stroked. */
  lines: string[];
  /** Leaves (path + transform), flower petals (ellipses) and berries (circles): filled. */
  leaves: Array<{ d: string; transform: string }>;
  petals: Array<{ cx: number; cy: number; rx: number; ry: number; rotate: number }>;
  berries: Array<{ cx: number; cy: number; r: number }>;
}

function build(): GarlandArt {
  const art: GarlandArt = { lines: [], leaves: [], petals: [], berries: [] };
  const leaf = (x: number, y: number, angle: number, scale: number) =>
    art.leaves.push({
      d: LEAF,
      transform: `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(angle)}) scale(${fmt(scale)})`,
    });

  STEMS.forEach((stem, k) => {
    const points: string[] = [];
    for (let x = 0; x <= TILE_WIDTH; x += 4) points.push(`${fmt(x)} ${fmt(stem(x))}`);
    art.lines.push(`M${points.join('L')}`);
    // Leaves alternate sides, leaning forward.
    for (let x = 3 + k * 4; x < TILE_WIDTH; x += 8) {
      const side = (Math.round(x / 8) + k) % 2 ? 1 : -1;
      leaf(x, stem(x), slopeAt(stem, x) + side * (38 + random() * 18), 0.7 + random() * 0.45);
    }
  });

  // Sprigs: short branches with three pairs of leaves, towards the top or bottom edge.
  for (let x = 14, i = 0; x < TILE_WIDTH - 6; x += 30, i++) {
    const stem = STEMS[i % 2]!;
    const y0 = stem(x);
    const dir = i % 2 === 0 ? -1 : 1;
    const length = 9 + random() * 5;
    const tip = [x + 5 + random() * 4, y0 + dir * length] as const;
    art.lines.push(
      `M${fmt(x)} ${fmt(y0)}Q${fmt(x + 1)} ${fmt(y0 + dir * length * 0.6)} ${fmt(tip[0])} ${fmt(tip[1])}`,
    );
    const angle = (Math.atan2(tip[1] - y0, tip[0] - x) * 180) / Math.PI;
    leaf(tip[0], tip[1], angle, 0.75);
    for (const t of [0.45, 0.75]) {
      const px = x + (tip[0] - x) * t;
      const py = y0 + (tip[1] - y0) * t;
      leaf(px, py, angle - 50, 0.6);
      leaf(px, py, angle + 50, 0.6);
    }
  }

  const blooms = [
    [30, 13, 6],
    [92, 44, 6.5],
    [150, 12, 5.5],
    [212, 43, 6],
    [61, 42, 4],
    [122, 15, 3.6],
    [183, 15, 4],
    [8, 44, 3.4],
    [236, 13, 3.4],
  ] as const;
  for (const [cx, cy, r] of blooms) {
    for (let i = 0; i < 5; i++) {
      const a = ((i * 72 - 90) * Math.PI) / 180;
      art.petals.push({
        cx: cx + Math.cos(a) * r * 0.62,
        cy: cy + Math.sin(a) * r * 0.62,
        rx: r * 0.5,
        ry: r * 0.36,
        rotate: i * 72 - 90,
      });
    }
  }

  for (let i = 0; i < 26; i++) {
    const x = random() * TILE_WIDTH;
    const y = STEMS[i % 2]!(x) + (random() > 0.5 ? -1 : 1) * (8 + random() * 10);
    art.berries.push({
      cx: x,
      cy: Math.min(TILE_HEIGHT - 3, Math.max(3, y)),
      r: 0.8 + random() * 0.7,
    });
  }
  return art;
}

export const GARLAND = build();
