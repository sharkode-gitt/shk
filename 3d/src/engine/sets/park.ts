import * as THREE from 'three';
import { C, box, cyl, floor, put, sphere, tree, type Layout } from './props.ts';

export function park(g: THREE.Group): Layout {
  floor(g, 240, 240, C.floorGrass);
  box(g, 6, 0.08, 40, C.sidewalk, 0, 0, 5); // path
  const bench = new THREE.Group();
  box(bench, 6, 0.4, 2, C.wood, 0, 1.6, 0);
  box(bench, 6, 1.8, 0.3, C.wood, 0, 2.0, 0.85);
  box(bench, 0.4, 1.6, 1.8, C.dark, -2.6, 0, 0);
  box(bench, 0.4, 1.6, 1.8, C.dark, 2.6, 0, 0);
  put(g, bench, -9, 0, 8);
  tree(g, 8, 11, 1.4);
  for (const [x, z, s] of [[-20, 18, 1.2], [-8, 22, 1], [20, 20, 1.3], [26, 8, 1], [-26, 6, 1.1], [0, 26, 1.4], [14, 26, 1]]) tree(g, x, z, s);
  for (const [x, z] of [[-4, 4], [11, 2], [-14, 5], [15, 14]]) { // flowers
    cyl(g, 0.08, 0.8, C.green, x, 0, z);
    sphere(g, 0.35, C.pink, x, 0.9, z);
  }
  // park gate on the right
  box(g, 0.6, 5, 0.6, C.red, 17, 0, 1);
  box(g, 0.6, 5, 0.6, C.red, 17, 0, 7);
  box(g, 0.6, 0.7, 7, C.red, 17, 5, 4);
  return {
    marks: { center: [0, 0, 3], door: [15, 0, 4], bench: [-9, 0, 5.5], tree: [8, 0, 7.5], entry: [9, 0, 3], exit: [-11, 0, 3] },
    homes: [[-6, 0, 3], [-2, 0, 3], [2, 0, 3], [6, 0, 3]],
  };
}
