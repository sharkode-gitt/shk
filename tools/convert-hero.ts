// One-off: map the OBJ groups of Emily's Studio export to R15 parts / accessories.
// Usage: npx tsx tools/convert-hero.ts   (writes assets/emily/parts.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { PartName } from '../src/types.ts';

type V3 = [number, number, number];
type Box = { center: V3; size: V3 };
export type HeroRig = {
  parts: Record<PartName, Box>;
  accessories: { name: string; type: 'Hair' | 'Hat' | 'Front'; center: V3; size: V3 }[];
};
export type Accessory = 'hair' | 'crown' | 'bag';
export type GroupMap = { part: PartName } | { accessory: Accessory; attach: 'Head' | 'UpperTorso' };
export type PartsMap = { offset: V3; groups: Record<string, GroupMap> };

const ACCESSORY: Record<HeroRig['accessories'][number]['type'], { accessory: Accessory; attach: 'Head' | 'UpperTorso' }> = {
  Hair: { accessory: 'hair', attach: 'Head' },
  Hat: { accessory: 'crown', attach: 'Head' },
  Front: { accessory: 'bag', attach: 'UpperTorso' },
};

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Bounding box of every `g` group, from its `v` lines. */
function groupBoxes(obj: string): Record<string, Box> {
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
function match(from: V3[], to: V3[]): number[] {
  if (from.length > to.length) throw new Error(`${from.length} groups but only ${to.length} targets`);
  const pairs = from.flatMap((f, i) => to.map((t, j) => ({ i, j, d: dist(f, t) }))).sort((a, b) => a.d - b.d);
  const out: number[] = [];
  const used = new Set<number>();
  for (const { i, j } of pairs) {
    if (out[i] === undefined && !used.has(j)) { out[i] = j; used.add(j); }
  }
  return out;
}

export function mapParts(objText: string, rig: HeroRig): PartsMap {
  const boxes = groupBoxes(objText);
  const names = Object.keys(boxes);
  const hero = names.filter((n) => /^Hero\d+$/.test(n));
  const handles = names.filter((n) => /^Handle\d+$/.test(n));
  const partNames = Object.keys(rig.parts) as PartName[];
  const partCenters = partNames.map((p) => rig.parts[p].center);

  // Match, estimate offset = mean(rig center - group center), repeat with it applied.
  let offset: V3 = [0, 0, 0];
  let hit: number[] = [];
  for (let iter = 0; iter < 3; iter++) {
    hit = match(hero.map((g) => boxes[g]!.center.map((c, i) => c + offset[i]!) as V3), partCenters);
    offset = [0, 1, 2].map((i) => hero.reduce((s, g, k) => s + partCenters[hit[k]!]![i]! - boxes[g]!.center[i]!, 0) / hero.length) as V3;
  }

  const groups: Record<string, GroupMap> = {};
  hero.forEach((g, k) => { groups[g] = { part: partNames[hit[k]!]! }; });
  // Accessories are matched by bbox size (per axis; the export has no scale or mirror, see tests).
  const acc = match(handles.map((g) => boxes[g]!.size), rig.accessories.map((a) => a.size));
  handles.forEach((g, k) => { groups[g] = ACCESSORY[rig.accessories[acc[k]!]!.type]; });
  return { offset: offset.map((v) => Math.round(v * 1000) / 1000) as V3, groups };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rig: HeroRig = JSON.parse(readFileSync('reference/hero-rig.json', 'utf8'));
  const map = mapParts(readFileSync('assets/emily/emily.obj', 'utf8'), rig);
  writeFileSync('assets/emily/parts.json', JSON.stringify(map, null, 2) + '\n');
  console.log(`wrote assets/emily/parts.json (offset ${map.offset}, ${Object.keys(map.groups).length} groups)`);
}
