import * as THREE from 'three';
import { C, box, chair, door, put, room, type Layout } from './props.ts';

export function classroom(g: THREE.Group): Layout {
  room(g, C.wall2, C.woodLight);
  box(g, 12, 5, 0.3, 0x4f8f6e, 0, 3, 8.8); // chalkboard
  box(g, 12.6, 0.3, 0.4, C.wood, 0, 2.7, 8.75);
  box(g, 5, 2.6, 2.4, C.wood, 0, 0, 5.5); // teacher desk (top at 2.6)
  for (const x of [-8, -4, 4, 8]) { // student desks, chairs behind them
    box(g, 3, 0.3, 2.2, C.woodLight, x, 2.4, 2.5);
    box(g, 0.3, 2.4, 0.3, C.grey, x - 1.2, 0, 2.5);
    box(g, 0.3, 2.4, 0.3, C.grey, x + 1.2, 0, 2.5);
    put(g, chair(), x, 0, 4.5);
  }
  put(g, door(), 11.6, 0, -4, -Math.PI / 2);
  return {
    marks: { center: [0, 0, 0], door: [9, 0, -4], desk: [-6, 0, 0.6], board: [0, 0, 7] },
    homes: [[-6, 0, -2], [-2, 0, -2], [2, 0, -2], [6, 0, -2]],
  };
}
