import * as THREE from 'three';
import { C, box, door, put, room, type Layout } from './props.ts';

export function schoolHallway(g: THREE.Group): Layout {
  room(g, C.wall3, C.sidewalk);
  const cols = [C.blue, C.pink, C.green, C.yellow, C.purple, C.orange];
  for (let i = 0; i < 12; i++) { // lockers along the back wall
    const x = -11 + i * 2;
    box(g, 1.9, 6.4, 1.4, cols[i % cols.length], x, 0, 8.1);
    box(g, 1.3, 0.1, 0.05, C.dark, x, 5, 7.38);
    box(g, 0.2, 0.9, 0.1, C.white, x + 0.55, 3.2, 7.37);
  }
  box(g, 8, 1, 0.1, C.red, 0, 7.4, 8.85); // banner on the back wall, above the lockers
  put(g, door(C.blue), 11.6, 0, -2, -Math.PI / 2);
  box(g, 4, 5, 0.2, C.white, -9, 3, 8.75); // notice board
  return {
    marks: { center: [0, 0, 0], door: [9, 0, -2], lockers: [0, 0, 6.2] },
    homes: [[-6, 0, -1], [-2, 0, -1], [2, 0, -1], [6, 0, -1]],
  };
}
