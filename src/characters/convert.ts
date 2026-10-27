import type { PartName } from '../types.ts';
import { groupBoxes, match, type Box, type HeroRig, type V3 } from './geometry.ts';

export type Attach = 'Head' | 'UpperTorso';
export type AccessoryMap = { accessory: string; attach: Attach };
export type GroupMap = { part: PartName } | AccessoryMap;
export type PartsMap = { offset: V3; groups: Record<string, GroupMap> };
export type Rect = { x: number; y: number; w: number; h: number };

const isAccessory = (name: string) => /^handle/i.test(name);

/**
 * Where an accessory sits on the body: if it reaches above the middle of the head it is worn on the head (`hair` if it
 * hangs below the middle of the head, otherwise a `hat`); if it stays below that it hangs from the torso (`bag`).
 * Long hair can have its centre below the head, so the top of the box decides, not the centre.
 */
export function classifyAccessory(box: Box, head: Box): AccessoryMap {
  const top = box.center[1] + box.size[1] / 2;
  if (top > head.center[1]) {
    const bottom = box.center[1] - box.size[1] / 2;
    return { accessory: bottom < head.center[1] ? 'hair' : 'hat', attach: 'Head' };
  }
  return { accessory: 'bag', attach: 'UpperTorso' };
}

/**
 * Maps the groups of a Roblox Studio R15 export to the engine's 15 body parts and the accessories (groups named
 * `Handle…`). Everything else is a body part and there must be exactly 15 of them.
 */
export function convertModel(objText: string, rig: HeroRig): { parts: PartsMap; headGroup: string } {
  const boxes = groupBoxes(objText);
  const names = Object.keys(boxes);
  const body = names.filter((n) => !isAccessory(n));
  const handles = names.filter(isAccessory);
  const partNames = Object.keys(rig.parts) as PartName[];

  if (body.length !== partNames.length) {
    const hint = body.length === 6
      ? ' That looks like an R6 avatar (6 parts); export an R15 one (Avatar tab -> Avatar Settings -> R15).'
      : '';
    throw new Error(`expected ${partNames.length} body-part groups, found ${body.length} (${body.join(', ')}).${hint}`);
  }

  const partCenters = partNames.map((p) => rig.parts[p].center);
  let offset: V3 = [0, 0, 0];
  let hit: number[] = [];
  for (let iter = 0; iter < 3; iter++) {
    hit = match(body.map((g) => boxes[g]!.center.map((c, i) => c + offset[i]!) as V3), partCenters);
    offset = [0, 1, 2].map((i) => body.reduce((s, g, k) => s + partCenters[hit[k]!]![i]! - boxes[g]!.center[i]!, 0) / body.length) as V3;
  }

  const groups: Record<string, GroupMap> = {};
  body.forEach((g, k) => { groups[g] = { part: partNames[hit[k]!]! }; });
  const headGroup = body[hit.findIndex((j) => partNames[j] === 'Head')]!;
  const head = boxes[headGroup]!;
  const shifted = (b: Box): Box => ({ center: b.center.map((c, i) => c + offset[i]!) as V3, size: b.size });
  for (const g of handles) groups[g] = classifyAccessory(shifted(boxes[g]!), shifted(head));
  return { parts: { offset: offset.map((v) => Math.round(v * 1000) / 1000) as V3, groups }, headGroup };
}

/** Name of the texture file used by a group (OBJ `usemtl` -> MTL `map_Kd`). */
export function textureOfGroup(objText: string, mtlText: string, group: string): string | undefined {
  let current = '';
  let material: string | undefined;
  for (const line of objText.split('\n')) {
    if (line.startsWith('g ')) current = line.slice(2).trim();
    else if (current === group && line.startsWith('usemtl ')) material = line.slice(7).trim();
  }
  if (!material) return undefined;
  let inBlock = false;
  for (const line of mtlText.split('\n')) {
    const t = line.trim();
    if (t.startsWith('newmtl ')) inBlock = t.slice(7).trim() === material;
    else if (inBlock && /^map_kd\s/i.test(t)) return t.split(/\s+/).slice(1).join(' ');
  }
  return undefined;
}

/**
 * The front of the head in atlas pixels: the bounding box of the UVs of every head face that points toward -Z
 * (the way characters face). The face is drawn inside this box. `v` runs bottom-up in OBJ, so y is flipped.
 */
export function headFrontRect(objText: string, headGroup: string, atlasW: number, atlasH: number): Rect {
  const vt: [number, number][] = [], vn: V3[] = [];
  const faces: string[][] = [];
  let current = '';
  for (const line of objText.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'vt') vt.push([Number(p[1]), Number(p[2])]);
    else if (p[0] === 'vn') vn.push([Number(p[1]), Number(p[2]), Number(p[3])]);
    else if (p[0] === 'g') current = line.slice(2).trim();
    else if (p[0] === 'f' && current === headGroup) faces.push(p.slice(1));
  }
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const f of faces) {
    const idx = f.map((t) => t.split('/').map(Number));
    if (idx.some((i) => i[1] === undefined || i[2] === undefined)) continue;
    const nz = idx.reduce((s, i) => s + vn[i[2]! - 1]![2], 0) / idx.length;
    if (nz >= -0.5) continue;
    for (const i of idx) {
      const [u, v] = vt[i[1]! - 1]!;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
  }
  if (!Number.isFinite(u0)) throw new Error(`the head group "${headGroup}" has no front-facing faces with UVs and normals`);
  return {
    x: Math.round(u0 * atlasW), y: Math.round((1 - v1) * atlasH),
    w: Math.round((u1 - u0) * atlasW), h: Math.round((v1 - v0) * atlasH),
  };
}
