// The baroque cartouche around the monogram (viewBox -104 -122 208 236, centred on the
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

/** A scroll along an ellipse from `from`° to `to`°, ending in volutes. */
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
  if (end) points = [...points, ...curl(arc.at(-1)!, tangent(rx, ry, to, sign), end, r1).slice(1)];
  if (start) {
    const spiral = curl(arc[0]!, tangent(rx, ry, from, -sign), start, r0);
    points = [...spiral.slice(1).reverse(), ...points];
  }
  return smooth(points);
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

/** The left half's scrolls (heavier lines) and their inner echoes (hairlines). */
export const SCROLLS = [
  scroll(70, 84, 145, 215, { r0: 9, r1: 9 }),
  scroll(78, 92, 224, 252, { start: -1, r0: 7, r1: 6, turns: 1.2 }),
  scroll(62, 84, 238, 268, { start: -1, r0: 6, r1: 7.5 }),
  scroll(78, 90, 136, 110, { start: -1, r0: 7, r1: 6, turns: 1.2 }),
  scroll(64, 84, 126, 96, { start: -1, r0: 6, r1: 6.5 }),
];
export const ECHOES = [
  scroll(64, 78, 152, 208, { start: 0, end: 0 }),
  scroll(73, 87, 150, 210, { start: 0, end: 0 }),
];
export const LEAVES = [
  leafOn(73, 87, 176, 160, 0.95),
  leafOn(73, 87, 184, 200, 0.95),
  leafOn(72, 86, 166, 128, 0.7),
  leafOn(72, 86, 194, 232, 0.7),
  leafOn(80, 94, 220, 235, 0.8),
  leafOn(80, 92, 140, 125, 0.8),
  'translate(-13 -88) rotate(200) scale(0.75)',
  'translate(-10 88) rotate(160) scale(0.7)',
];
export const CROWN = shell(-86, -1, 15, 7);
export const BASE_SHELL = shell(88, 1, 10, 5);
export const FINIAL = 'M0 -101C-4 -106 -4 -112 0 -117C4 -112 4 -106 0 -101Z';
