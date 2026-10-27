import test from 'node:test';
import assert from 'node:assert/strict';
import { seedFromId, mulberry32 } from '../../src/build/seed.ts';

test('seedFromId is stable for the same id', () =>
  assert.equal(seedFromId('shot-01'), seedFromId('shot-01')));

test('seedFromId differs for different ids', () =>
  assert.notEqual(seedFromId('shot-01'), seedFromId('shot-02')));

test('seedFromId is unsigned 32-bit', () => {
  for (const id of ['', 'a', 'shot-01', 'Emily ✨']) {
    const s = seedFromId(id);
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff, `${id}: ${s}`);
  }
});

test('seedFromId matches FNV-1a 32-bit reference values', () => {
  assert.equal(seedFromId(''), 0x811c9dc5);
  assert.equal(seedFromId('a'), 0xe40c292c);
});

test('mulberry32(42) yields the same 5 values in two instances', () => {
  const take = (rng: () => number) => Array.from({ length: 5 }, () => rng());
  assert.deepEqual(take(mulberry32(42)), take(mulberry32(42)));
});

test('mulberry32 values are in [0,1)', () => {
  const rng = mulberry32(seedFromId('camera-noise'));
  for (let i = 0; i < 10_000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});
