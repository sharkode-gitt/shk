import * as THREE from 'three';
import { C, box, chair, door, put, room, table, type Layout } from './props.ts';

export function kitchen(g: THREE.Group): Layout {
  room(g, C.wall4, C.floor);
  box(g, 12, 3, 2.4, C.white, -4, 0, 7.6); // counters
  box(g, 12.2, 0.3, 2.6, C.woodLight, -4, 3, 7.6);
  box(g, 3, 0.4, 1.6, C.grey, -6, 3.3, 7.6); // sink
  box(g, 2.6, 1.8, 0.2, C.dark, -1, 3.3, 8.9);
  box(g, 11, 2.4, 1.4, C.pink, -4, 5.4, 8.1); // upper cabinets
  const fr = new THREE.Group();
  box(fr, 3.2, 7.4, 3, C.blue, 0, 0, 0);
  box(fr, 3.2, 0.1, 0.05, C.dark, 0, 4.4, -1.5);
  box(fr, 0.2, 2, 0.2, C.white, 1.2, 4.8, -1.6);
  box(fr, 0.2, 1.4, 0.2, C.white, 1.2, 2.2, -1.6);
  put(g, fr, 8, 0, 7.4);
  put(g, table(), -4, 0, 0.5);
  put(g, chair(), -6.2, 0, 0.5, -Math.PI / 2);
  put(g, chair(), -1.8, 0, 0.5, Math.PI / 2);
  put(g, door(), -11.6, 0, -4, Math.PI / 2);
  return {
    marks: { center: [0, 0, 0], door: [-9, 0, -4], table: [-4, 0, -2.5], fridge: [8, 0, 4.5] },
    homes: [[0, 0, -3], [2.7, 0, -3], [5.4, 0, -3]],
  };
}
