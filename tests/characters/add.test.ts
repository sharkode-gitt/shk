import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addCharacter } from '../../src/characters/add.ts';
import { convertModel, textureOfGroup } from '../../src/characters/convert.ts';
import type { HeroRig } from '../../src/characters/geometry.ts';
import { loadRoster } from '../../src/characters/roster.ts';

const rig: HeroRig = JSON.parse(readFileSync('reference/hero-rig.json', 'utf8'));
const EMILY = 'assets/characters/emily';
const emilyRect = JSON.parse(readFileSync(`${EMILY}/character.json`, 'utf8')).model.face;

/** A fresh assets folder and a copy of Emily's export standing in for a new character's Studio export. */
const setup = (t: test.TestContext, srcFiles?: (src: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'addchar-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const src = join(dir, 'export'), assets = join(dir, 'assets');
  mkdirSync(src);
  mkdirSync(assets);
  for (const f of readdirSync(EMILY)) if (/\.(obj|mtl|png)$/.test(f)) copyFileSync(join(EMILY, f), join(src, f));
  srcFiles?.(src);
  writeFileSync(join(assets, 'voices.json'), JSON.stringify({ emily: 'E' }));
  const opts = { srcDir: src, assetsDir: assets, id: 'bacon', name: 'Bacon', age: 13, personality: 'cheerful and clumsy', look: 'classic noob', rig };
  return { dir, src, assets, opts };
};

test('maps 15 body parts and classifies the accessories by where they sit', (t) => {
  const { opts } = setup(t);
  const r = addCharacter(opts);
  assert.equal(r.bodyGroups, 15);
  const byKind = Object.fromEntries(r.accessories.map((a) => [a.accessory, a.attach]));
  assert.deepEqual(byKind, { hair: 'Head', hat: 'Head', bag: 'UpperTorso' });
});

test('finds the face box and the skin colour on the texture, close to the hand-measured ones for Emily', (t) => {
  const { opts } = setup(t);
  const { info } = addCharacter(opts);
  const { rect, skin } = info.model.face;
  for (const k of ['x', 'y'] as const) assert.ok(Math.abs(rect[k] - emilyRect.rect[k]) <= 15, `${k}: ${rect[k]} vs ${emilyRect.rect[k]}`);
  assert.ok(rect.w >= 190 && rect.w <= emilyRect.rect.w + 15, `w ${rect.w}`);
  assert.ok(rect.h >= 200 && rect.h <= emilyRect.rect.h + 15, `h ${rect.h}`);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  rgb(skin).forEach((c, i) => assert.ok(Math.abs(c - rgb(emilyRect.skin)[i]!) <= 12, `skin ${skin} vs ${emilyRect.skin}`));
  assert.equal(info.model.atlas, 'Hero1_diff.png');
  assert.equal(info.model.face.style, 'classic');
});

test('writes a roster entry that loads, copies the model files, and reserves a voice slot', (t) => {
  const { opts, assets } = setup(t);
  const r = addCharacter(opts);
  const roster = loadRoster(assets);
  assert.deepEqual(Object.keys(roster), ['bacon']);
  assert.equal(roster.bacon.name, 'Bacon');
  assert.equal(roster.bacon.color, '#ffd166');
  const files = readdirSync(r.dir);
  for (const f of ['emily.obj', 'emily.mtl', 'Hero1_diff.png', 'parts.json', 'character.json']) assert.ok(files.includes(f), f);
  assert.deepEqual(JSON.parse(readFileSync(join(assets, 'voices.json'), 'utf8')), { emily: 'E', bacon: '' });
  assert.ok(r.warnings.some((w) => /voice/.test(w)));
});

test('an existing voice is kept and produces no warning', (t) => {
  const { opts, assets } = setup(t);
  writeFileSync(join(assets, 'voices.json'), JSON.stringify({ bacon: 'VOICE1' }));
  assert.deepEqual(addCharacter(opts).warnings, []);
  assert.equal(JSON.parse(readFileSync(join(assets, 'voices.json'), 'utf8')).bacon, 'VOICE1');
});

test('adding the same id twice needs --force', (t) => {
  const { opts } = setup(t);
  addCharacter(opts);
  assert.throws(() => addCharacter(opts), /already exists.*--force/);
  assert.doesNotThrow(() => addCharacter({ ...opts, force: true }));
});

test('a folder without exactly one .obj and one .mtl is rejected', (t) => {
  const { opts, src } = setup(t, (s) => rmSync(join(s, 'emily.mtl')));
  assert.throws(() => addCharacter(opts), /exactly one \.obj and one \.mtl \(found 1 and 0\)/);
  void src;
});

test('a model with the wrong number of body parts is explained, with an R6 hint at six', () => {
  const group = (n: number) => `g Part${n}\nv 0 ${n} 0\nv 1 ${n} 1\n`;
  const six = [1, 2, 3, 4, 5, 6].map(group).join('');
  assert.throws(() => convertModel(six, rig), /expected 15 body-part groups, found 6.*R6.*R15/s);
  assert.throws(() => convertModel(group(1) + group(2), rig), (e: Error) => /found 2/.test(e.message) && !/R6/.test(e.message));
});

test('textureOfGroup follows usemtl to map_Kd', () => {
  const obj = 'g A\nusemtl m1\nf 1 2 3\ng B\nusemtl m2\n';
  const mtl = 'newmtl m1\nmap_Kd one.png\nnewmtl m2\nmap_Kd two.png\n';
  assert.equal(textureOfGroup(obj, mtl, 'B'), 'two.png');
  assert.equal(textureOfGroup(obj, mtl, 'C'), undefined);
});
