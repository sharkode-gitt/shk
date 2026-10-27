// One-off: map the OBJ groups of Emily's Studio export to R15 parts / accessories.
// Usage: npx tsx tools/convert-hero.ts   (writes assets/characters/emily/parts.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { PartName } from '../src/types.ts';

import { dist, groupBoxes, match, type Box, type HeroRig, type V3 } from '../src/characters/geometry.ts';

export type { HeroRig };
export type Accessory = 'hair' | 'crown' | 'bag';
export type GroupMap = { part: PartName } | { accessory: Accessory; attach: 'Head' | 'UpperTorso' };
export type PartsMap = { offset: V3; groups: Record<string, GroupMap> };

const ACCESSORY: Record<HeroRig['accessories'][number]['type'], { accessory: Accessory; attach: 'Head' | 'UpperTorso' }> = {
  Hair: { accessory: 'hair', attach: 'Head' },
  Hat: { accessory: 'crown', attach: 'Head' },
  Front: { accessory: 'bag', attach: 'UpperTorso' },
};

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
  const map = mapParts(readFileSync('assets/characters/emily/emily.obj', 'utf8'), rig);
  writeFileSync('assets/characters/emily/parts.json', JSON.stringify(map, null, 2) + '\n');
  console.log(`wrote assets/characters/emily/parts.json (offset ${map.offset}, ${Object.keys(map.groups).length} groups)`);
}
