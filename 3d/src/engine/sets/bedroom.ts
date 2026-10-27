import * as THREE from 'three';
import { C, bed, box, door, put, room, type Layout } from './props.ts';

export function bedroom(g: THREE.Group): Layout {
  room(g, C.wall, C.floor);
  put(g, bed(), -7, 0, 5.3);
  box(g, 1.8, 2, 1.8, C.wood, -3.2, 0, 8); // nightstand
  box(g, 3, 0.1, 5, C.purple, 3, 0, 1); // rug
  box(g, 4, 4, 0.2, C.blue, 4, 4, 8.7); // window
  box(g, 3.4, 3.4, 0.1, 0xd6f0ff, 4, 4.3, 8.6);
  box(g, 0.2, 3.4, 0.15, C.white, 4, 4.3, 8.5);
  put(g, door(), 11.6, 0, -3, -Math.PI / 2);
  return {
    marks: { center: [0, 0, 0], door: [9, 0, -3], bed: [-7, 0, 0], window: [4, 0, 6] },
    homes: [[-4, 0, -2], [0, 0, -2], [4, 0, -2]],
  };
}
