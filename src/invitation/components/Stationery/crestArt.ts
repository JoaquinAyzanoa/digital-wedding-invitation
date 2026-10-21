// The baroque cartouche around the monogram (viewBox -108 -126 216 244, centred on the
// monogram). Only the left half is built; the component mirrors it. Everything is line art:
// scrolls along ellipses that end in volutes, slender curled leaves and a shell at the crown.

type Point = readonly [number, number];

const RAD = Math.PI / 180;
const fmt = (n: number) => n.toFixed(2);

/** A smooth path through the points (Catmull-Rom as cubic Béziers). */
function smooth(points: Point[]): string {
  let d = `M${fmt(points[0]![0])} ${fmt(points[0]![1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0]!)} ${fmt(c1[1]!)} ${fmt(c2[0]!)} ${fmt(c2[1]!)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

const onEllipse = (rx: number, ry: number, deg: number): Point => [
  rx * Math.cos(deg * RAD),
  ry * Math.sin(deg * RAD),
];

/** Unit direction along the ellipse at `deg`, walking towards growing (+1) or falling angles. */
function tangent(rx: number, ry: number, deg: number, sign: number): Point {
  const t = [-rx * Math.sin(deg * RAD) * sign, ry * Math.cos(deg * RAD) * sign] as const;
  const length = Math.hypot(t[0], t[1]);
  return [t[0] / length, t[1] / length];
}

/** A spiral leaving `start` along `dir`, turning right (+1) or left (-1), tightening. */
function volute(start: Point, dir: Point, side: 1 | -1, r0: number, turns: number) {
  const normal: Point = side > 0 ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
  const centre: Point = [start[0] + normal[0] * r0, start[1] + normal[1] * r0];
  const a0 = Math.atan2(start[1] - centre[1], start[0] - centre[0]);
  const steps = Math.round(turns * 14);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const r = r0 * Math.exp(-0.42 * t);
    const a = a0 + side * t;
    points.push([centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)]);
  }
  return { points, centre };
}

interface ScrollEnds {
  /** Per end: 1 curls away from the centre, -1 towards it, 0 no volute. */
  start?: -1 | 0 | 1;
  end?: -1 | 0 | 1;
  r0?: number;
  r1?: number;
  turns?: number;
}

/** A scroll along an ellipse from `from`° to `to`°, ending in volutes (and their eyes). */
function scroll(rx: number, ry: number, from: number, to: number, ends: ScrollEnds = {}) {
  const { start = 1, end = 1, r0 = 8, r1 = 8, turns = 1.35 } = ends;
  const sign = to > from ? 1 : -1;
  const steps = Math.max(4, Math.round(Math.abs(to - from) / 6));
  const arc: Point[] = [];
  for (let i = 0; i <= steps; i++) arc.push(onEllipse(rx, ry, from + ((to - from) * i) / steps));
  const curl = (point: Point, dir: Point, way: 1 | -1, r: number) => {
    const right = volute(point, dir, 1, r, turns);
    const left = volute(point, dir, -1, r, turns);
    const rightIsOuter = Math.hypot(...right.centre) > Math.hypot(...left.centre);
    return way > 0 === rightIsOuter ? right.points : left.points;
  };
  let points = arc;
  const eyes: Point[] = [];
  if (end) {
    const spiral = curl(arc.at(-1)!, tangent(rx, ry, to, sign), end, r1);
    points = [...points, ...spiral.slice(1)];
    eyes.push(spiral.at(-1)!);
  }
  if (start) {
    const spiral = curl(arc[0]!, tangent(rx, ry, from, -sign), start, r0);
    points = [...spiral.slice(1).reverse(), ...points];
    eyes.push(spiral.at(-1)!);
  }
  return { d: smooth(points), eyes };
}

/** A scallop shell opening up (sign -1) or down (+1) from (0, y). */
function shell(y: number, sign: 1 | -1, radius: number, ribCount: number) {
  const tips: Point[] = [];
  let ribs = '';
  for (let i = 0; i < ribCount; i++) {
    const a = (200 + (140 * i) / (ribCount - 1)) * RAD;
    const dir: Point = [Math.cos(a), sign < 0 ? Math.sin(a) : -Math.sin(a)];
    ribs += `M${fmt(dir[0] * 3)} ${fmt(y + dir[1] * 3)}L${fmt(dir[0] * radius * 0.92)} ${fmt(y + dir[1] * radius * 0.92)}`;
    tips.push([dir[0] * radius, y + dir[1] * radius]);
  }
  let edge = `M${fmt(tips[0]![0])} ${fmt(tips[0]![1])}`;
  for (let i = 1; i < tips.length; i++) {
    const mid = [(tips[i - 1]![0] + tips[i]![0]) / 2, (tips[i - 1]![1] + tips[i]![1]) / 2];
    edge += `Q${fmt(mid[0]! * 1.18)} ${fmt(y + (mid[1]! - y) * 1.18)} ${fmt(tips[i]![0])} ${fmt(tips[i]![1])}`;
  }
  const last = tips.at(-1)!;
  const base = `M${fmt(tips[0]![0])} ${fmt(tips[0]![1])}Q0 ${fmt(y - sign * radius * 0.05)} ${fmt(last[0])} ${fmt(last[1])}`;
  return { ribs, edge, base };
}

/** Transform placing a leaf on an ellipse point, rotated to `angle`. */
function leafOn(rx: number, ry: number, deg: number, angle: number, scale: number) {
  const [x, y] = onEllipse(rx, ry, deg);
  return `translate(${fmt(x)} ${fmt(y)}) rotate(${angle}) scale(${scale})`;
}

/** A slender curled leaf pointing along +x (about 20 long), and its midrib. */
export const LEAF =
  'M0 0C4 -4.5 10 -6.2 15 -4.8C17.6 -4 19.6 -2.2 20.2 0.6C18.2 -1.2 15.6 -1.4 13.6 -0.3C10 1.8 4.6 2.1 0 0Z';
export const LEAF_RIB = 'M1.6 -0.3C6 -2.2 11 -3.1 16.4 -2.5';

const scrolls = [
  { ...scroll(70, 84, 145, 215, { r0: 10, r1: 10 }), width: 3.4 },
  { ...scroll(80, 94, 222, 254, { start: -1, r0: 7, r1: 6.5, turns: 1.25 }), width: 2.6 },
  { ...scroll(62, 84, 238, 268, { start: -1, r0: 6, r1: 7.5 }), width: 2.4 },
  { ...scroll(80, 92, 138, 108, { start: -1, r0: 7, r1: 6.5, turns: 1.25 }), width: 2.6 },
  { ...scroll(64, 84, 126, 96, { start: -1, r0: 6, r1: 6.5 }), width: 2.4 },
];

/** The left half's scrolls: drawn as hollow ribbons (a gold line with paper inside). */
export const RIBBONS = scrolls.map(({ d, width }) => ({ d, width }));
/** A small bead at the eye of every volute. */
export const EYES = scrolls.flatMap(({ eyes }) => eyes);
/**
 * A laurel branch up the left side, between the oval and the big scroll: a stem with pairs of
 * leaves, smaller towards the tip, and a bud at the end. The two branches meet at a bow.
 */
export const LAUREL = (() => {
  const rx = 63;
  const ry = 77;
  const from = 104;
  const to = 236;
  const pairs = 11;
  const stem: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const [x, y] = onEllipse(rx, ry, from + ((to - from) * i) / 40);
    stem.push(`${fmt(x)} ${fmt(y)}`);
  }
  // Direction of growth along the stem (towards growing angles), in degrees.
  const growth = (deg: number) =>
    (Math.atan2(ry * Math.cos(deg * RAD), -rx * Math.sin(deg * RAD)) * 180) / Math.PI;
  const leaves: string[] = [];
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.6) / (pairs + 0.4);
    const deg = from + (to - from) * t;
    const [x, y] = onEllipse(rx, ry, deg);
    const scale = 1.05 - t * 0.45;
    for (const side of [-1, 1]) {
      leaves.push(
        `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(growth(deg) + side * 38)}) scale(${fmt(scale)})`,
      );
    }
  }
  const [tx, ty] = onEllipse(rx, ry, to + 2);
  leaves.push(`translate(${fmt(tx)} ${fmt(ty)}) rotate(${fmt(growth(to))}) scale(0.55)`);
  return { stem: `M${stem.join('L')}`, leaves, bowY: onEllipse(rx, ry, 90)[1] + 1 };
})();
/** A laurel leaf pointing along +x (about 11 long), and its vein. */
export const LAUREL_LEAF = 'M0 0C2.2 -2.9 6.6 -3.6 11 0C6.6 3.2 2.2 2.6 0 0Z';
export const LAUREL_VEIN = 'M0.8 0C4 -0.5 7.5 -0.5 10 0';
/** The bow where the branches meet: two loops, a knot and two notched tails. */
export const BOW = {
  loops: 'M0 0C-5 -6 -15 -7 -16 -2C-17 3 -7 3 0 0ZM0 0C5 -6 15 -7 16 -2C17 3 7 3 0 0Z',
  tails:
    'M-1 1C-4 6 -8 10 -12 14L-8 14.5L-9.5 17.5C-5 13 -2 8 0 2ZM1 1C4 6 8 10 12 14L8 14.5L9.5 17.5C5 13 2 8 0 2Z',
  knot: 'M-2.4 -1.2C-2.4 -3 2.4 -3 2.4 -1.2C2.4 1.6 -2.4 1.6 -2.4 -1.2Z',
};
/** Leaves fanning at the middle of the side, in pairs at the shoulder and hip, by the crown. */
export const LEAVES = [
  leafOn(77, 91, 180, 180, 1.25),
  leafOn(76, 90, 170, 150, 1),
  leafOn(76, 90, 190, 210, 1),
  leafOn(74, 88, 160, 128, 0.75),
  leafOn(74, 88, 200, 232, 0.75),
  leafOn(84, 98, 226, 240, 0.85),
  leafOn(84, 96, 134, 120, 0.85),
  'translate(-15 -90) rotate(196) scale(0.85)',
  'translate(-12 90) rotate(164) scale(0.8)',
];
export const CROWN = shell(-87, -1, 16, 9);
export const BASE_SHELL = shell(88, 1, 11, 7);
export const FINIAL = 'M0 -103C-5 -109 -5 -116 0 -122C5 -116 5 -109 0 -103Z';
export const DROP = 'M0 100C-3 104 -3 108 0 112C3 108 3 104 0 100Z';
