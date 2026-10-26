import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBlockCharacter } from '../../src/engine/characters/block.ts';
import type { Look } from '../../src/types.ts';

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
