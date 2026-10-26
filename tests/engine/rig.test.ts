import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyPose, buildRigFromParts, JOINTS, PARTS } from '../../src/engine/rig.ts';
import type { PartName, Pose } from '../../src/types.ts';

const neutral: Pose = { root: { pos: [0, 0, 0], yaw: 0 }, joints: {}, face: 'neutral', mouth: 0 };
const GROUND = Math.min(...Object.values(PARTS).map((p) => p.center[1] - p.size[1] / 2));

// Each part is a box placed at its world center, as the block character does.
function boxParts() {
  const parts = {} as Record<PartName, THREE.Object3D>;
  for (const [name, p] of Object.entries(PARTS) as [PartName, (typeof PARTS)[PartName]][]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...p.size));
    m.position.set(...p.center);
    parts[name] = m;
  }
  return parts;
}
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

test('ground is the lowest foot bottom (about 2.0)', () => assert.ok(Math.abs(GROUND - 2.002) < 1e-6));

test('neutral pose keeps part world centers (feet on y=0)', () => {
  const rig = buildRigFromParts(boxParts());
  applyPose(rig, neutral);
  for (const [name, p] of Object.entries(PARTS) as [PartName, (typeof PARTS)[PartName]][]) {
    const w = world(rig.parts[name]);
    assert.ok(w.distanceTo(new THREE.Vector3(p.center[0], p.center[1] - GROUND, p.center[2])) < 0.01, name);
  }
});

test('RightShoulder raised moves RightHand up', () => {
  const rig = buildRigFromParts(boxParts());
  applyPose(rig, neutral);
  const y0 = world(rig.parts.RightHand).y;
  applyPose(rig, { ...neutral, joints: { RightShoulder: [0, 0, -Math.PI / 2] } });
  assert.ok(world(rig.parts.RightHand).y - y0 > 0.5);
});

test('root pos and yaw move the whole rig', () => {
  const rig = buildRigFromParts(boxParts());
  applyPose(rig, { ...neutral, root: { pos: [3, 0, 2], yaw: Math.PI } });
  const h = world(rig.parts.Head);
  assert.ok(Math.abs(h.x - 3) < 0.01 && Math.abs(h.z - 2.043) < 0.01);
});

test('joints omitted from the pose reset to zero rotation', () => {
  const rig = buildRigFromParts(boxParts());
  applyPose(rig, { ...neutral, joints: { Neck: [1, 0, 0] } });
  applyPose(rig, neutral);
  assert.equal(rig.joints.Neck.rotation.x, 0);
});

test('accessories attach to their part keeping world position', () => {
  const acc = new THREE.Object3D();
  acc.position.set(0, 7, 0);
  const rig = buildRigFromParts(boxParts(), [{ object: acc, attach: 'Head' }]);
  applyPose(rig, neutral);
  assert.equal(acc.parent, rig.parts.Head);
  assert.ok(Math.abs(world(acc).y - (7 - GROUND)) < 1e-6);
});

test('JOINTS has 15 entries', () => assert.equal(Object.keys(JOINTS).length, 15));
