import * as THREE from 'three';
import { C, box, cyl, floor, put, sphere, table, tree, type Layout } from './props.ts';
import { grassTexture, pavingTexture, skyTexture } from './textures.ts';

/** A balloon on a string. */
function balloon(g: THREE.Group, x: number, z: number, h: number, color: number): void {
  cyl(g, 0.025, h, 0xffffff, x, 0, z);
  const b = sphere(g, 0.62, color, x, h + 0.55, z);
  b.scale.y = 1.25;
}

/** A small bird: a body and two wings that flap. */
function bird(g: THREE.Group, color: number): { root: THREE.Group; wings: THREE.Mesh[] } {
  const root = new THREE.Group();
  const body = sphere(root, 0.35, color, 0, 0, 0); body.scale.set(1.3, 0.8, 0.8); body.castShadow = false;
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.4), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    w.position.set(s * 0.55, 0, 0); w.geometry.translate(s * 0.4, 0, 0); w.position.x = s * 0.1;
    root.add(w); wings.push(w);
  }
  g.add(root);
  return { root, wings };
}

export function park(g: THREE.Group): Layout {
  const flock = [[0x2f6fb5, 16, 14, 24, 0.0], [0xe2574c, 12, 17, 30, 2.1], [0xf2c14e, 20, 12, 20, 4.2]].map(([c, r, y, z, ph]) => ({ ...bird(g, c as number), r: r as number, y: y as number, z: z as number, ph: ph as number }));
  const cloudsToMove: THREE.Mesh[] = [];
  const grass = floor(g, 240, 240, 0xffffff, grassTexture(), 0.95);
  (grass.material as THREE.MeshStandardMaterial).map!.repeat.set(30, 30); // one repeat = 8 studs
  // sky, hills and clouds: the park never ends in a flat horizon
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(0x3d9bff, 0xd6f0ff), side: THREE.BackSide, toneMapped: false, fog: false }));
  g.add(sky);
  for (const [x, z, r, c] of [[-40, 95, 38, 0x6bbf5a], [30, 105, 46, 0x5fb34f], [100, 90, 34, 0x74c564], [-110, 80, 30, 0x66b956]] as const) {
    const h = sphere(g, r, c, x, -r * 0.55, z);
    h.scale.y = 0.7;
    h.castShadow = false;
  }
  for (const [x, y, z, s] of [[-30, 46, 100, 1.2], [38, 54, 110, 1.5], [90, 40, 95, 1], [-80, 50, 105, 1.3]] as const) {
    for (const [dx, dy, r] of [[0, 0, 6], [6, -1, 5], [-6, -1, 4.5], [2, 2, 4.5]] as const) {
      const c = sphere(g, r * s, 0xffffff, x + dx * s, y + dy * s, z);
      c.scale.y = 0.6; c.castShadow = false; cloudsToMove.push(c);
      (c.material as THREE.MeshStandardMaterial).emissive.set(0x9db7cc);
    }
  }
  // paved path
  const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 44), new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.8 }));
  (path.material as THREE.MeshStandardMaterial).map!.repeat.set(6 / 4, 44 / 4);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.04, 5); path.receiveShadow = true;
  g.add(path);
  // trees in a wide band behind everything, plus bushes
  for (let i = 0; i < 9; i++) tree(g, -36 + i * 9 + (i % 2) * 3, 30 + (i % 3) * 5, 1.5 + (i % 3) * 0.2);
  for (const [x, z, s] of [[-20, 18, 1.2], [-8, 22, 1], [20, 20, 1.3], [26, 8, 1], [-26, 6, 1.1]]) tree(g, x, z, s);
  for (let i = 0; i < 8; i++) { const b = sphere(g, 1.3, i % 2 ? 0x4caf50 : 0x66bb6a, -16 + i * 5, 0.9 + (i % 2) * 0.2, 14); b.scale.y = 0.8; }
  // low wooden fence along the back of the lawn
  for (let i = 0; i < 24; i++) box(g, 0.35, 2, 0.2, C.woodLight, -23 + i * 2, 0, 12.5);
  box(g, 48, 0.25, 0.15, C.wood, 0, 1.2, 12.4); box(g, 48, 0.25, 0.15, C.wood, 0, 0.5, 12.4);
  // bench, flowers
  const bench = new THREE.Group();
  box(bench, 6, 0.4, 2, C.wood, 0, 1.6, 0); box(bench, 6, 1.8, 0.3, C.wood, 0, 2.0, 0.85);
  box(bench, 0.4, 1.6, 1.8, C.dark, -2.6, 0, 0); box(bench, 0.4, 1.6, 1.8, C.dark, 2.6, 0, 0);
  put(g, bench, -9, 0, 9);
  for (const [x, z, c] of [[-4, 7, C.pink], [11, 6, C.yellow], [-14, 7, C.red], [15, 9, C.pink], [3, 9, C.yellow], [-1, 8.5, C.red]] as const) { cyl(g, 0.08, 0.8, C.green, x, 0, z); sphere(g, 0.35, c, x, 0.9, z); }
  // birthday party: table with a cake, balloons, bunting and a gift pile (the story's party is in the park)
  put(g, table(), 9, 0, 8.5);
  box(g, 1.8, 0.1, 1.8, 0xffffff, 9, 2.8, 8.5);
  cyl(g, 0.8, 0.7, 0xfff6e0, 9, 2.85, 8.5); cyl(g, 0.55, 0.5, 0xff9ec4, 9, 3.5, 8.5); sphere(g, 0.12, C.red, 9, 4.1, 8.5);
  [[5.2, C.red], [6, 0x4a90e2], [12.6, C.yellow], [13.4, 0x8fdc8f], [-2.6, 0xff9ec4], [-3.4, 0xc6a8ff]].forEach(([x, c], i) => balloon(g, x as number, 9.5 + (i % 2), 3.4 + (i % 3) * 0.6, c as number));
  for (const [x, z, c] of [[7, 7.3, C.purple], [7.9, 7, C.yellow], [7.4, 7.9, C.pink]] as const) box(g, 0.9, 0.8, 0.9, c, x, 0, z);
  for (let i = 0; i < 12; i++) { // bunting between two poles
    const x = 2 + i * 1.2, y = 7 - Math.sin((i / 11) * Math.PI) * -0.9 - 1.2;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 3), new THREE.MeshStandardMaterial({ color: [C.red, C.yellow, 0x4a90e2, 0x8fdc8f][i % 4], roughness: 0.8 }));
    flag.rotation.z = Math.PI; flag.position.set(x, y, 11); g.add(flag);
  }
  cyl(g, 0.12, 8, C.wood, 1.4, 0, 11); cyl(g, 0.12, 8, C.wood, 15.8, 0, 11);
  const cloudStart = cloudsToMove.map((c) => c.position.x);
  const tick = (t: number) => {
    flock.forEach((b) => {
      const a = t * 0.35 + b.ph;
      b.root.position.set(Math.cos(a) * b.r, b.y + Math.sin(a * 2) * 0.8, b.z + Math.sin(a) * 6);
      b.root.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 14 + b.ph) * 0.7;
      b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
    });
    cloudsToMove.forEach((c, i) => { c.position.x = cloudStart[i] + ((t * 0.5) % 400); if (c.position.x > 200) c.position.x -= 400; });
  };
  return {
    marks: { center: [0, 0, 3], door: [15, 0, 4], bench: [-9, 0, 5.5], tree: [8, 0, 7.5], entry: [9, 0, 3], exit: [-11, 0, 3] },
    homes: [[-6, 0, 3], [-2, 0, 3], [2, 0, 3], [6, 0, 3]],
    tick,
  };
}
