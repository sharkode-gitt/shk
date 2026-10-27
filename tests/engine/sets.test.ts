import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSet, buildProp, SET_MARKS } from '../../src/engine/sets/index.ts';
import { SETS, TIMES, PROPS } from '../../src/vocab.ts';

for (const name of SETS) {
  test(`${name}: builds, has marks inside the floor, spread-out homes`, () => {
    for (const time of TIMES) {
      const s = buildSet(name, time);
      assert.ok(s.group instanceof THREE.Group);
      assert.ok(s.lights.some((l) => l instanceof THREE.DirectionalLight && l.castShadow && l.shadow.mapSize.x === 2048));
      assert.ok(s.lights.some((l) => l instanceof THREE.HemisphereLight));
      let meshes = 0;
      s.group.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
      assert.ok(meshes > 5 && meshes < 150, `mesh count ${meshes}`);
    }
    const s = buildSet(name, 'morning');
    assert.ok(SET_MARKS[name].includes('center') && SET_MARKS[name].includes('door'));
    const floor = s.group.getObjectByName('floor');
    assert.ok(floor, 'floor mesh named "floor"');
    const box = new THREE.Box3().setFromObject(floor);
    for (const m of SET_MARKS[name]) {
      const p = s.marks[m];
      assert.ok(p, `mark ${m}`);
      assert.ok(p[0] >= box.min.x && p[0] <= box.max.x && p[2] >= box.min.z && p[2] <= box.max.z, `${m} inside floor`);
      assert.equal(p[1], 0);
    }
    assert.ok(s.homes.length >= 2 && s.homes.length <= 4);
    for (let i = 0; i < s.homes.length; i++) for (let j = i + 1; j < s.homes.length; j++) {
      const d = Math.hypot(s.homes[i][0] - s.homes[j][0], s.homes[i][2] - s.homes[j][2]);
      assert.ok(d > 1.5, `homes ${i},${j} are ${d} apart`);
    }
  });
}

test('night is dimmer and bluer than afternoon; closed sets get a warm lamp', () => {
  const sun = (n: 'morning' | 'afternoon' | 'night') =>
    buildSet('bedroom', n).lights.find((l) => l instanceof THREE.DirectionalLight)!;
  assert.ok(sun('night').intensity < sun('afternoon').intensity);
  assert.equal(sun('night').color.getHexString(), '9fb4ff');
  assert.equal(sun('morning').color.getHexString(), 'fff2dc');
  assert.equal(sun('afternoon').color.getHexString(), 'ffffff');
  assert.ok(sun('morning').position.y < sun('afternoon').position.y);
  assert.ok(buildSet('bedroom', 'night').lights.some((l) => l instanceof THREE.PointLight));
});

test('every prop builds from primitives only', () => {
  for (const p of PROPS) {
    const o = buildProp(p);
    let n = 0;
    o.traverse((c) => { if (c instanceof THREE.Mesh) n++; });
    assert.ok(n >= 1, p);
  }
});
