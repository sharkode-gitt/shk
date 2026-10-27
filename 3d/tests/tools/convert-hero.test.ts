import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapParts, type HeroRig } from '../../tools/convert-hero.ts';

const rig: HeroRig = JSON.parse(readFileSync('reference/hero-rig.json', 'utf8'));

test('mini.obj: offset is recovered and groups get the right parts', () => {
  const map = mapParts(readFileSync('tests/fixtures/mini.obj', 'utf8'), rig);
  [0, 5, 0].forEach((v, i) => assert.ok(Math.abs(map.offset[i]! - v) <= 0.01, `offset[${i}]=${map.offset[i]}`));
  assert.deepEqual(map.groups, {
    Hero1: { part: 'Head' },
    Hero2: { part: 'LeftFoot' },
    Hero3: { part: 'RightFoot' },
  });
});

test('real export: 15 Hero groups map to 15 distinct parts', () => {
  const map = mapParts(readFileSync('assets/characters/emily/emily.obj', 'utf8'), rig);
  const parts = Object.entries(map.groups).flatMap(([g, v]) => (g.startsWith('Hero') && 'part' in v ? [v.part] : []));
  assert.equal(parts.length, 15);
  assert.deepEqual([...new Set(parts)].sort(), Object.keys(rig.parts).sort());
});

test('real export: Handle groups become hair, crown and bag once each', () => {
  const map = mapParts(readFileSync('assets/characters/emily/emily.obj', 'utf8'), rig);
  const acc = Object.entries(map.groups).flatMap(([g, v]) => (g.startsWith('Handle') && 'accessory' in v ? [{ g, ...v }] : []));
  assert.deepEqual(acc.map((a) => a.accessory).sort(), ['bag', 'crown', 'hair']);
  const attach = Object.fromEntries(acc.map((a) => [a.accessory, a.attach]));
  assert.deepEqual(attach, { hair: 'Head', crown: 'Head', bag: 'UpperTorso' });
});

test('real export: the crown is the Handle with the highest y', () => {
  const obj = readFileSync('assets/characters/emily/emily.obj', 'utf8');
  const map = mapParts(obj, rig);
  const maxY: Record<string, number> = {};
  let g = '';
  for (const line of obj.split('\n')) {
    if (line.startsWith('g ')) g = line.slice(2).trim();
    else if (line.startsWith('v ') && g.startsWith('Handle')) maxY[g] = Math.max(maxY[g] ?? -Infinity, Number(line.split(/\s+/)[2]));
  }
  const top = Object.entries(maxY).sort((a, b) => b[1] - a[1])[0]![0];
  assert.deepEqual(map.groups[top], { accessory: 'crown', attach: 'Head' });
});

test('real export matches the rig 1:1 (offset zero, no scale or mirror)', () => {
  const map = mapParts(readFileSync('assets/characters/emily/emily.obj', 'utf8'), rig);
  map.offset.forEach((v) => assert.ok(Math.abs(v) <= 0.01, `offset ${map.offset}`));
});
