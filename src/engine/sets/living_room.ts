import * as THREE from 'three';
import { C, box, door, put, room, type Layout } from './props.ts';

export function livingRoom(g: THREE.Group): Layout {
  room(g, C.wall3, C.floor);
  const sofa = new THREE.Group();
  box(sofa, 7, 1.6, 3, C.pink, 0, 0, 0);
  box(sofa, 7, 2.6, 0.9, C.pink, 0, 0, 1.05);
  box(sofa, 0.9, 2.2, 3, C.pink, -3.5, 0, 0);
  box(sofa, 0.9, 2.2, 3, C.pink, 3.5, 0, 0);
  put(g, sofa, -4, 0, 7);
  box(g, 6, 2.4, 1.6, C.wood, 5, 0, 8); // tv stand
  box(g, 5, 3, 0.3, C.dark, 5, 2.4, 8.2);
  box(g, 4.6, 2.6, 0.1, C.blue, 5, 2.6, 8.0);
  box(g, 4.5, 1.2, 2.5, C.woodLight, -4, 0, 3); // coffee table
  box(g, 6, 0.1, 4, C.green, -4, 0, 2.5); // rug
  put(g, door(), -11.6, 0, -4, Math.PI / 2);
  return {
    marks: { center: [0, 0, 0], door: [-9, 0, -4], sofa: [-4, 0, 4.7], tv: [5, 0, 5] },
    homes: [[-6, 0, -2], [-2, 0, -2], [2, 0, -2], [6, 0, -2]],
  };
}
