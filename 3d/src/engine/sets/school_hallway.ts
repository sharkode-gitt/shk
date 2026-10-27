import * as THREE from 'three';
import { C, box, cyl, door, put, room, type Layout } from './props.ts';
import { hallwayWallTexture, sunPatch, tileTexture } from './textures.ts';

export function schoolHallway(g: THREE.Group): Layout {
  room(g, C.wall3, 0xffffff, tileTexture(0xe9e4d6, 0xc9d3dc), 0.45);
  // The back wall (lockers, banner, notice board, clock, posters) is one painted texture, 24 x 14 studs.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), new THREE.MeshStandardMaterial({ map: hallwayWallTexture(), roughness: 0.9 }));
  wall.position.set(0, 7, 8.9);
  wall.rotation.y = Math.PI;
  wall.receiveShadow = true;
  g.add(wall);
  put(g, door(C.blue), 11.6, 0, -2, -Math.PI / 2);
  // A bench and a bin in front of the lockers give the room depth behind the characters.
  const bench = new THREE.Group();
  box(bench, 5, 0.4, 1.6, C.wood, 0, 1.7, 0);
  box(bench, 0.4, 1.7, 1.4, C.dark, -2.2, 0, 0);
  box(bench, 0.4, 1.7, 1.4, C.dark, 2.2, 0, 0);
  put(g, bench, 7, 0, 6.6);
  put(g, cyl(new THREE.Group(), 0.8, 1.8, 0x6f7c8a, 0, 0, 0).parent!, -7.4, 0, 7);
  // Sunlight from the windows on the right, falling across the floor.
  for (const [x, z, w, d, y] of [[5, -2, 5, 9, 0.35], [-3.5, 3, 4, 7, 0.22], [10, 3, 3, 6, 0.25]] as const) {
    const s = sunPatch(w, d, 0xfff0c0, y);
    s.position.set(x, 0.03, z);
    s.rotation.z = 0.35;
    g.add(s);
  }
  return {
    marks: { center: [0, 0, 0], door: [9, 0, -2], lockers: [0, 0, 6.2] },
    homes: [[-6, 0, -1], [-2, 0, -1], [2, 0, -1], [6, 0, -1]],
  };
}
