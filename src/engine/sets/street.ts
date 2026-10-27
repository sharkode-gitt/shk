import * as THREE from 'three';
import { C, box, car, cyl, floor, house, put, sphere, tree, type Layout } from './props.ts';

export function street(g: THREE.Group): Layout {
  floor(g, 60, 60, C.floorGrass);
  box(g, 60, 0.05, 15, C.road, 0, 0, -3.5); // road z -11..4
  for (let x = -27; x < 28; x += 6) box(g, 3, 0.07, 0.4, C.white, x, 0, -3.5);
  box(g, 60, 0.04, 8, C.sidewalk, 0, 0, 8); // sidewalk z 4..12
  house(g, 8, 17, C.wall, C.red);
  house(g, -8, 17, C.wall2, C.blue);
  house(g, 22, 17, C.wall3, C.purple);
  put(g, car(), -12, 0.0, -1);
  put(g, car(C.yellow), 14, 0, -6, Math.PI);
  tree(g, -20, 14, 1);
  tree(g, 28, 12, 1);
  cyl(g, 0.2, 7, C.dark, -3, 0, 5); // lamp post
  sphere(g, 0.7, C.yellow, -3, 7.3, 5);
  return {
    marks: { center: [0, 0, 7], door: [-8, 0, 12], car: [-12, 0, 2.6], house: [8, 0, 12] },
    homes: [[-6, 0, 7], [-2, 0, 7], [2, 0, 7], [6, 0, 7]],
  };
}
