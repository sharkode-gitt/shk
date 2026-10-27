import * as THREE from 'three';
import type { SetName, TimeOfDay, Vec3 } from '../../types.ts';
import { bedroom } from './bedroom.ts';
import { classroom } from './classroom.ts';
import { kitchen } from './kitchen.ts';
import { livingRoom } from './living_room.ts';
import { park } from './park.ts';
import type { Layout } from './props.ts';
import { schoolHallway } from './school_hallway.ts';
import { street } from './street.ts';

export { buildProp } from './props.ts';

export type BuiltSet = { group: THREE.Group; marks: Record<string, Vec3>; homes: Vec3[]; lights: THREE.Light[] };

export const SET_MARKS: Record<SetName, string[]> = {
  bedroom: ['center', 'door', 'bed', 'window'],
  living_room: ['center', 'door', 'sofa', 'tv'],
  kitchen: ['center', 'door', 'table', 'fridge'],
  classroom: ['center', 'door', 'desk', 'board'],
  school_hallway: ['center', 'door', 'lockers'],
  park: ['center', 'door', 'bench', 'tree'],
  street: ['center', 'door', 'car', 'house'],
};

const BUILDERS: Record<SetName, (g: THREE.Group) => Layout> = {
  bedroom, living_room: livingRoom, kitchen, classroom, school_hallway: schoolHallway, park, street,
};
const INDOOR = new Set<SetName>(['bedroom', 'living_room', 'kitchen', 'classroom', 'school_hallway']);

// Sun colour / position (low sun in the morning, high in the afternoon) and strengths.
const LIGHT: Record<TimeOfDay, { color: number; pos: Vec3; sun: number; hemi: number; lamp: number }> = {
  morning: { color: 0xfff2dc, pos: [-24, 14, -10], sun: 2.4, hemi: 1.0, lamp: 60 },
  afternoon: { color: 0xffffff, pos: [8, 40, -12], sun: 2.8, hemi: 1.1, lamp: 40 },
  night: { color: 0x9fb4ff, pos: [-10, 30, -10], sun: 0.6, hemi: 0.5, lamp: 220 },
};

export function buildSet(name: SetName, time: TimeOfDay): BuiltSet {
  const group = new THREE.Group();
  group.name = name;
  const { marks, homes } = BUILDERS[name](group);
  const L = LIGHT[time];
  const indoor = INDOOR.has(name);

  const hemi = new THREE.HemisphereLight(L.color, 0xe8dcc8, L.hemi);
  const sun = new THREE.DirectionalLight(L.color, L.sun);
  sun.position.set(...L.pos);
  sun.target.position.set(0, 0, indoor ? 0 : 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const r = indoor ? 18 : 35;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 120 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04; // removes acne stripes on characters in close-ups
  const lights: THREE.Light[] = [hemi, sun];
  if (indoor) {
    const lamp = new THREE.PointLight(0xffd9a0, L.lamp, 30, 2); // warm interior light
    lamp.position.set(0, 9, 2);
    lights.push(lamp);
  }
  group.add(...lights, sun.target);
  return { group, marks, homes, lights };
}
