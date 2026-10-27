import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { CharacterSchema, charactersDir, type CharacterInfo } from './roster.ts';
import { convertModel, headFaceMapping, headFrontRect, kdOfGroup, linearToHex, textureOfGroup, type Rect } from './convert.ts';
import type { HeroRig } from './geometry.ts';

export type AddOpts = {
  /** A folder with the Studio export: one .obj, one .mtl and the textures. */
  srcDir: string;
  assetsDir: string;
  id: string;
  name: string;
  age: number;
  personality: string;
  look: string;
  color?: string;
  /**
   * Face drawing: `classic` for ordinary Roblox faces and `emily` for the big anime eyes (both draw on the head's atlas);
   * `none` leaves a face that comes with the model. Default: `classic` when the head shares the body's atlas, else `none`.
   */
  faceStyle?: 'classic' | 'emily' | 'none';
  force?: boolean;
  rig: HeroRig;
};
export type AddResult = { info: CharacterInfo; dir: string; bodyGroups: number; accessories: { group: string; accessory: string; attach: string }[]; warnings: string[] };

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** Median colour of small patches just inside the corners of the face box: skin, away from eyes and mouth. */
export function skinAround(png: PNG, r: Rect): string {
  const samples: [number, number, number][] = [];
  const inset = Math.max(2, Math.round(Math.min(r.w, r.h) * 0.04)), size = Math.max(2, Math.round(Math.min(r.w, r.h) * 0.06));
  for (const [cx, cy] of [[r.x + inset, r.y + inset], [r.x + r.w - inset - size, r.y + inset], [r.x + inset, r.y + r.h - inset - size], [r.x + r.w - inset - size, r.y + r.h - inset - size]] as const) {
    for (let y = cy; y < cy + size; y++) for (let x = cx; x < cx + size; x++) {
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const i = (png.width * y + x) << 2;
      if (png.data[i + 3]! < 200) continue;
      samples.push([png.data[i]!, png.data[i + 1]!, png.data[i + 2]!]);
    }
  }
  if (!samples.length) return '#f0cdc4';
  const med = (k: 0 | 1 | 2) => samples.map((s) => s[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]!;
  return `#${hex(med(0))}${hex(med(1))}${hex(med(2))}`;
}

/**
 * Registers a Studio export as a roster character: copies its files to `<assets>/characters/<id>/`, works out which
 * OBJ group is which body part or accessory, where the face is on the texture and what skin colour it has, and writes
 * `parts.json` and `character.json`.
 */
export function addCharacter(o: AddOpts): AddResult {
  const warnings: string[] = [];
  const files = readdirSync(o.srcDir);
  const objs = files.filter((f) => /\.obj$/i.test(f)), mtls = files.filter((f) => /\.mtl$/i.test(f));
  if (objs.length !== 1 || mtls.length !== 1) throw new Error(`${o.srcDir} must hold exactly one .obj and one .mtl (found ${objs.length} and ${mtls.length})`);
  const objText = readFileSync(join(o.srcDir, objs[0]!), 'utf8');
  const mtlText = readFileSync(join(o.srcDir, mtls[0]!), 'utf8');

  const dir = join(charactersDir(o.assetsDir), o.id);
  if (existsSync(join(dir, 'character.json')) && !o.force) throw new Error(`character "${o.id}" already exists (use --force to replace it)`);

  const { parts, headGroup } = convertModel(objText, o.rig);
  const atlas = textureOfGroup(objText, mtlText, headGroup);
  if (!atlas) throw new Error(`could not find the body texture: the head group "${headGroup}" has no material with a map_Kd in ${mtls[0]}`);
  if (!files.includes(atlas)) throw new Error(`the body texture "${atlas}" named in the .mtl is not in ${o.srcDir}`);
  const png = PNG.sync.read(readFileSync(join(o.srcDir, atlas)));
  const mapped = headFaceMapping(objText, headGroup, png.width, png.height);
  if (!mapped) warnings.push('could not map the front of the head to the texture; using an approximate face box');
  const rect = mapped?.rect ?? headFrontRect(objText, headGroup, png.width, png.height);
  if (rect.w < 40 || rect.h < 40) warnings.push(`the face box found on the texture is small (${rect.w}x${rect.h} px); check the character in a render`);

  // A head with a texture of its own (a face that comes with the model) is kept as it is; a head on the body's atlas gets a drawn face.
  const bodyTextures = new Set(Object.entries(parts.groups).flatMap(([g, v]) => ('part' in v ? [textureOfGroup(objText, mtlText, g)] : [])));
  const sharesAtlas = bodyTextures.size === 1;
  if (!sharesAtlas && !o.faceStyle) warnings.push(`the head has its own texture (${atlas}); its face is kept as it is, without expressions`);
  const kd = kdOfGroup(objText, mtlText, headGroup);
  const info = CharacterSchema.parse({
    id: o.id, name: o.name, age: o.age, personality: o.personality, look: o.look, color: o.color,
    model: { obj: objs[0], mtl: mtls[0], atlas, face: { style: o.faceStyle ?? (sharesAtlas ? 'classic' : 'none'), rect, skin: kd ? linearToHex(kd) : skinAround(png, rect), flipX: mapped?.flipX ?? false }, unflipped: [] },
  });

  mkdirSync(dir, { recursive: true });
  for (const f of files) if (/\.(obj|mtl|png|jpg|jpeg)$/i.test(f)) copyFileSync(join(o.srcDir, f), join(dir, f));
  writeFileSync(join(dir, 'parts.json'), JSON.stringify(parts, null, 2) + '\n');
  writeFileSync(join(dir, 'character.json'), JSON.stringify(info, null, 2) + '\n');

  const voicesFile = join(o.assetsDir, 'voices.json');
  const voices = existsSync(voicesFile) ? (JSON.parse(readFileSync(voicesFile, 'utf8')) as Record<string, string>) : {};
  if (!(o.id in voices)) {
    voices[o.id] = '';
    writeFileSync(voicesFile, JSON.stringify(voices, null, 2) + '\n');
  }
  if (!voices[o.id]) warnings.push(`no ElevenLabs voice yet: put a voice id in ${voicesFile} under "${o.id}"`);

  const accessories = Object.entries(parts.groups).flatMap(([group, g]) => ('accessory' in g ? [{ group, accessory: g.accessory, attach: g.attach }] : []));
  return { info, dir, bodyGroups: Object.values(parts.groups).filter((g) => 'part' in g).length, accessories, warnings };
}
