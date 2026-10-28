import * as THREE from 'three';
import { C, box, chair, cyl, door, put, room, sphere, type Layout } from './props.ts';
import { classroomWallTexture, plankTexture, sunPatch } from './textures.ts';

/** A student desk with its chair behind it, facing the board (-z side is the front). */
function deskSet(g: THREE.Group, x: number, z: number, tone: number): void {
  box(g, 3, 0.3, 2.2, tone, x, 2.4, z); // top
  box(g, 3, 0.15, 0.1, 0x8a5a2b, x, 2.4, z - 1.1); // edge
  box(g, 0.25, 2.4, 0.25, C.grey, x - 1.25, 0, z - 0.9);
  box(g, 0.25, 2.4, 0.25, C.grey, x + 1.25, 0, z - 0.9);
  box(g, 0.25, 2.4, 0.25, C.grey, x - 1.25, 0, z + 0.9);
  box(g, 0.25, 2.4, 0.25, C.grey, x + 1.25, 0, z + 0.9);
  box(g, 2.2, 0.15, 1.4, C.grey, x, 1.1, z); // book shelf under the top
  box(g, 0.9, 0.12, 0.7, 0xe2574c, x - 0.6, 2.7, z - 0.2); // a notebook
  box(g, 0.9, 0.12, 0.7, 0x4a90e2, x + 0.7, 2.7, z + 0.1);
  put(g, chair(), x, 0, z + 2.2);
}

export function classroom(g: THREE.Group): Layout {
  room(g, 0xe7f1f5, 0xffffff, plankTexture(0xd9a066), 0.6);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), new THREE.MeshStandardMaterial({ map: classroomWallTexture(), roughness: 0.92 }));
  wall.position.set(0, 7, 8.9);
  wall.rotation.y = Math.PI;
  wall.receiveShadow = true;
  g.add(wall);
  box(g, 5, 2.6, 2.4, C.wood, 0, 0, 6); // teacher desk
  box(g, 5.2, 0.2, 2.6, 0xa06f3a, 0, 2.6, 6);
  sphere(g, 0.35, 0xe2574c, 1.6, 3.15, 6); // an apple
  cyl(g, 0.6, 1.2, 0x6f7c8a, -9.5, 0, 6.8); // a bin
  for (const [x, z, tone] of [[-8.5, 3.5, C.woodLight], [-4, 3.5, C.woodLight], [4, 3.5, 0xf0cf9b], [8.5, 3.5, C.woodLight], [-8.5, 7, 0xf0cf9b], [-4, 7, C.woodLight], [4, 7, C.woodLight], [8.5, 7, 0xf0cf9b]] as const) deskSet(g, x, z, tone);
  // a globe on the teacher desk and a plant by the door
  sphere(g, 0.8, 0x4a90e2, -1.6, 3.7, 6); cyl(g, 0.15, 0.7, C.dark, -1.6, 2.7, 6);
  cyl(g, 0.7, 1, 0xb9854a, 10.5, 0, 7.5); sphere(g, 1, 0x4caf50, 10.5, 2.3, 7.5); sphere(g, 0.7, 0x66bb6a, 11, 3.1, 7.5);
  put(g, door(), 11.6, 0, -4, -Math.PI / 2);
  for (const [x, z, w, d, o] of [[4, -3, 4, 9, 0.32], [-5, 2, 3.5, 8, 0.22]] as const) { // light from the windows
    const s = sunPatch(w, d, 0xfff0c0, o);
    s.position.set(x, 0.03, z);
    s.rotation.z = -0.3;
    g.add(s);
  }
  return {
    marks: { center: [0, 0, 0], door: [9, 0, -4], desk: [-6, 0, 0.6], board: [0, 0, 7], entry: [7, 0, -2], exit: [-10.5, 0, -2] },
    homes: [[-6, 0, -2], [-2, 0, -2], [2, 0, -2], [6, 0, -2]],
  };
}
