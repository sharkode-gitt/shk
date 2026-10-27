import type { PartName } from '../types.ts';

export type V3 = [number, number, number];
export type Box = { center: V3; size: V3 };
/** reference/hero-rig.json: where the 15 R15 parts and the reference accessories sit. */
export type HeroRig = {
  parts: Record<PartName, Box>;
  accessories: { name: string; type: 'Hair' | 'Hat' | 'Front'; center: V3; size: V3 }[];
};

export const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Bounding box of every `g` group, from its `v` lines. */
export function groupBoxes(obj: string): Record<string, Box> {
  const mm: Record<string, [V3, V3]> = {};
  let cur: [V3, V3] | undefined;
  for (const line of obj.split('\n')) {
    if (line.startsWith('g ')) {
      cur = mm[line.slice(2).trim()] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    } else if (cur && line.startsWith('v ')) {
      const p = line.split(/\s+/).slice(1, 4).map(Number);
      for (let i = 0; i < 3; i++) {
        cur[0][i] = Math.min(cur[0][i]!, p[i]!);
        cur[1][i] = Math.max(cur[1][i]!, p[i]!);
      }
    }
  }
  return Object.fromEntries(Object.entries(mm).map(([g, [lo, hi]]) => [g, {
    center: lo.map((l, i) => (l + hi[i]!) / 2) as V3,
    size: lo.map((l, i) => hi[i]! - l) as V3,
  }]));
}

/** One-to-one nearest matching (closest pairs first); returns the target index per source. */
export function match(from: V3[], to: V3[]): number[] {
  if (from.length > to.length) throw new Error(`${from.length} groups but only ${to.length} targets`);
  const pairs = from.flatMap((f, i) => to.map((t, j) => ({ i, j, d: dist(f, t) }))).sort((a, b) => a.d - b.d);
  const out: number[] = [];
  const used = new Set<number>();
  for (const { i, j } of pairs) {
    if (out[i] === undefined && !used.has(j)) { out[i] = j; used.add(j); }
  }
  return out;
}
