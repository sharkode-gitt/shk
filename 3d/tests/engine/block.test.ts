import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBlockCharacter } from '../../src/engine/characters/block.ts';
import { JOINTS, PARTS } from '../../src/engine/rig.ts';
import type { Look } from '../../src/types.ts';

const GROUND_Y = Math.min(...Object.values(PARTS).map((p) => p.center[1] - p.size[1] / 2));

const look: Look = { shirt: '#ff0000', pants: '#0000ff', hair: 'short', hat: null };
const colorOf = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString();

test('block character has 15 parts and 15 joints', () => {
  const rig = buildBlockCharacter(look);
  assert.equal(Object.keys(rig.parts).length, 15);
  assert.equal(Object.keys(rig.joints).length, 15);
});

test('colors: shirt on torso/upper arms, pants on legs, default skin elsewhere', () => {
  const { parts } = buildBlockCharacter(look);
  assert.equal(colorOf(parts.UpperTorso), 'ff0000');
  assert.equal(colorOf(parts.RightUpperArm), 'ff0000');
  assert.equal(colorOf(parts.LeftLowerLeg), '0000ff');
  assert.equal(colorOf(parts.Head), 'f0cdc4');
  assert.equal(colorOf(parts.LeftHand), 'f0cdc4');
});

test('crown adds one child to Head; bald hair adds none', () => {
  const bare = buildBlockCharacter({ ...look, hair: 'bald' });
  assert.equal(bare.parts.Head.children.length, 0);
  const crowned = buildBlockCharacter({ ...look, hair: 'bald', hat: 'crown' });
  assert.equal(crowned.parts.Head.children.length, 1);
});

test('every hair and hat builds', () => {
  for (const hair of ['short', 'long', 'pigtails', 'bun', 'spiky'] as const)
    assert.equal(buildBlockCharacter({ ...look, hair }).parts.Head.children.length, 1, hair);
  for (const hat of ['cap', 'crown', 'beanie', 'bow', 'glasses'] as const)
    assert.equal(buildBlockCharacter({ ...look, hair: 'bald', hat }).parts.Head.children.length, 1, hat);
});

test('faceMap goes on the -Z face of the head only', () => {
  const map = new THREE.Texture();
  const head = buildBlockCharacter(look, { faceMap: map }).parts.Head as THREE.Mesh;
  const mats = head.material as THREE.MeshStandardMaterial[];
  assert.equal(mats.length, 6);
  mats.forEach((m, i) => assert.equal(m.map, i === 5 ? map : null, `face ${i}`));
  assert.equal(mats[5].color.getHexString(), 'ffffff');
  assert.equal(mats[0].color.getHexString(), 'f0cdc4');
});

test('without faceMap the head has a single skin material', () => {
  const head = buildBlockCharacter(look).parts.Head as THREE.Mesh;
  assert.ok(!Array.isArray(head.material));
});

const world = (o: THREE.Object3D, local: THREE.Vector3) => o.localToWorld(local.clone());
/** Ends of a limb box along its own Y axis, in rig world space (ground offset undone). */
function ends(rig: ReturnType<typeof buildBlockCharacter>, part: keyof typeof rig.parts): THREE.Vector3[] {
  rig.root.updateMatrixWorld(true);
  const m = rig.parts[part] as THREE.Mesh;
  const h = (m.geometry as THREE.BoxGeometry).parameters.height / 2;
  return [world(m, new THREE.Vector3(0, h, 0)), world(m, new THREE.Vector3(0, -h, 0))];
}

test('limb boxes run joint to joint: upper arms span shoulder -> elbow', () => {
  const rig = buildBlockCharacter(look);
  const pivot = (j: keyof typeof JOINTS) => world(rig.root, new THREE.Vector3(...JOINTS[j].pivot).setY(JOINTS[j].pivot[1] - GROUND_Y));
  for (const side of ['Left', 'Right'] as const) {
    const [a, b] = ends(rig, `${side}UpperArm`);
    const [s, e] = [pivot(`${side}Shoulder`), pivot(`${side}Elbow`)];
    const ok = (a.distanceTo(s) < 0.05 && b.distanceTo(e) < 0.05) || (a.distanceTo(e) < 0.05 && b.distanceTo(s) < 0.05);
    assert.ok(ok, `${side}: ${a.toArray()} ${b.toArray()} vs ${s.toArray()} ${e.toArray()}`);
  }
});

test('neutral hands hang below and just outside the shoulders, feet touch the ground', () => {
  const rig = buildBlockCharacter(look);
  rig.root.updateMatrixWorld(true);
  for (const side of ['Left', 'Right'] as const) {
    const hand = rig.parts[`${side}Hand`].getWorldPosition(new THREE.Vector3());
    const sh = JOINTS[`${side}Shoulder`].pivot;
    assert.ok(hand.y < sh[1] - GROUND_Y - 1.2, `${side} hand below shoulder`);
    // Emily's A-pose pivots put the wrist 0.78 outboard of the shoulder; the hand follows the forearm.
    assert.ok(Math.abs(hand.x - sh[0]) < 1.0, `${side} hand x ${hand.x} vs shoulder ${sh[0]}`);
    const foot = new THREE.Box3().setFromObject(rig.parts[`${side}Foot`]);
    assert.ok(Math.abs(foot.min.y) < 0.01, `${side} foot on the ground (${foot.min.y})`);
  }
});
