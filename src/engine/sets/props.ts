import * as THREE from 'three';
import type { Prop } from '../../types.ts';

/** Pastel palette shared by all sets. */
export const C = {
  wall: 0xfde8ef, wall2: 0xdff1fb, wall3: 0xfff3c9, wall4: 0xe3f5df,
  floor: 0xf6efe4, floorGrass: 0xbfe8a8, road: 0x8f96a3, sidewalk: 0xdcdde3,
  wood: 0xd9a066, woodLight: 0xf0cf9b, white: 0xffffff, cream: 0xfff6e0,
  pink: 0xff9ec4, blue: 0x8cc8ff, yellow: 0xffe27a, green: 0x8fdc8f, red: 0xff7a7a,
  purple: 0xc6a8ff, orange: 0xffb169, dark: 0x4a4f5e, grey: 0xc9ced8, brown: 0x8a5a3c,
};

/** Adds a shadow-casting box (size w,h,d; centre x, base y, z) to `parent`. */
export function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Adds a cylinder (upright by default) with its base at y. */
export function cyl(parent: THREE.Object3D, r: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function sphere(parent: THREE.Object3D, r: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Subtle baseplate grid as a pure-array texture (no canvas, so it works in Node). */
function gridTexture(): THREE.DataTexture {
  const N = 32, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = x === 0 || y === 0 ? 232 : 255;
    data.set([v, v, v, 255], (y * N + x) * 4);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Floor mesh named "floor" (marks are validated against its bounding box). Tile = 4 studs. */
export function floor(parent: THREE.Object3D, w: number, d: number, color: number): THREE.Mesh {
  const tex = gridTexture();
  tex.repeat.set(w / 4, d / 4);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.name = 'floor';
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Three-walled room: floor x[-12,12] z[-9,9], back wall at z=9, side walls at x=±12, no front/ceiling. */
export function room(g: THREE.Group, wallColor: number, floorColor: number): void {
  floor(g, 24, 18, floorColor);
  box(g, 25, 10, 0.5, wallColor, 0, 0, 9.25);
  box(g, 0.5, 10, 18.5, wallColor, -12.25, 0, 0);
  box(g, 0.5, 10, 18.5, wallColor, 12.25, 0, 0);
  box(g, 24, 0.6, 0.3, C.white, 0, 0, 8.85); // skirting
}

export function door(color = C.wood): THREE.Group {
  const g = new THREE.Group();
  box(g, 4.4, 7.6, 0.4, C.white, 0, 0, 0); // frame
  box(g, 3.6, 7, 0.3, color, 0, 0, -0.25);
  sphere(g, 0.25, C.yellow, 1.2, 3.5, -0.5);
  return g;
}
export function bed(): THREE.Group {
  const g = new THREE.Group(); // width 5 (x), length 7 (z), head at +z
  box(g, 5, 1.2, 7, C.wood, 0, 0, 0);
  box(g, 4.6, 0.9, 6.2, C.white, 0, 1.2, -0.1);
  box(g, 4.7, 0.4, 4.2, C.pink, 0, 2.0, -1.2);
  box(g, 5, 3.2, 0.5, C.wood, 0, 0, 3.25);
  box(g, 3.2, 0.7, 1.4, C.cream, 0, 2.1, 2.2);
  return g;
}
export function table(): THREE.Group {
  const g = new THREE.Group(); // 6 x 3.6, top at y=2.8
  box(g, 6, 0.4, 3.6, C.woodLight, 0, 2.4, 0);
  for (const [x, z] of [[-2.6, -1.4], [2.6, -1.4], [-2.6, 1.4], [2.6, 1.4]]) box(g, 0.5, 2.4, 0.5, C.wood, x, 0, z);
  return g;
}
export function chair(): THREE.Group {
  const g = new THREE.Group(); // seat at y=1.8, back at +z... faces -z
  box(g, 2, 0.35, 2, C.blue, 0, 1.6, 0);
  box(g, 2, 2, 0.3, C.blue, 0, 1.95, 0.85);
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(g, 0.25, 1.6, 0.25, C.wood, x, 0, z);
  return g;
}
export function cake(): THREE.Group {
  const g = new THREE.Group();
  cyl(g, 0.9, 0.6, C.cream, 0, 0, 0);
  cyl(g, 0.6, 0.5, C.pink, 0, 0.6, 0);
  cyl(g, 0.06, 0.4, C.yellow, 0, 1.1, 0);
  sphere(g, 0.1, C.red, 0, 1.55, 0);
  return g;
}
export function gift(): THREE.Group {
  const g = new THREE.Group();
  box(g, 1.2, 1, 1.2, C.purple, 0, 0, 0);
  box(g, 1.25, 1.02, 0.2, C.yellow, 0, 0, 0);
  box(g, 0.2, 1.02, 1.25, C.yellow, 0, 0, 0);
  box(g, 0.5, 0.25, 0.25, C.yellow, 0, 1, 0);
  return g;
}
export function phone(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.45, 0.06, 0.9, C.dark, 0, 0, 0);
  box(g, 0.38, 0.02, 0.78, C.blue, 0, 0.06, 0);
  return g;
}
export function backpack(): THREE.Group {
  const g = new THREE.Group();
  box(g, 1.2, 1.5, 0.7, C.orange, 0, 0, 0);
  box(g, 1, 0.6, 0.3, C.yellow, 0, 0.2, -0.45);
  box(g, 0.15, 1.2, 0.1, C.dark, -0.4, 0.1, 0.4);
  box(g, 0.15, 1.2, 0.1, C.dark, 0.4, 0.1, 0.4);
  return g;
}
export function car(color = C.red): THREE.Group {
  const g = new THREE.Group(); // length 8 along x, width 3.6
  box(g, 8, 1.6, 3.6, color, 0, 0.6, 0);
  box(g, 4.2, 1.4, 3.3, color, -0.4, 2.2, 0);
  box(g, 3.6, 0.9, 3.4, C.blue, -0.4, 2.35, 0);
  for (const x of [-2.6, 2.6]) for (const z of [-1.8, 1.8]) { const w = cyl(g, 0.65, 0.5, C.dark, x, 0, z); w.rotation.x = Math.PI / 2; w.position.y = 0.65; }
  box(g, 0.2, 0.5, 0.8, C.yellow, 4, 1.3, -1.1);
  box(g, 0.2, 0.5, 0.8, C.yellow, 4, 1.3, 1.1);
  return g;
}
export function dog(): THREE.Group {
  const g = new THREE.Group(); // faces -z
  box(g, 1, 0.9, 1.8, C.orange, 0, 0.7, 0);
  box(g, 0.8, 0.8, 0.8, C.orange, 0, 1.2, -1.1);
  box(g, 0.4, 0.3, 0.4, C.brown, 0, 1.2, -1.6);
  box(g, 0.25, 0.5, 0.25, C.brown, -0.35, 1.9, -1.0);
  box(g, 0.25, 0.5, 0.25, C.brown, 0.35, 1.9, -1.0);
  box(g, 0.2, 0.2, 0.8, C.orange, 0, 1.4, 1.1).rotation.x = 0.5;
  for (const [x, z] of [[-0.35, -0.6], [0.35, -0.6], [-0.35, 0.6], [0.35, 0.6]]) box(g, 0.25, 0.7, 0.25, C.brown, x, 0, z);
  return g;
}

const PROP_BUILDERS: Record<Prop, () => THREE.Object3D> = {
  cake, gift, phone, door: () => door(), bed, table, chair, backpack, car: () => car(), dog,
};
export function buildProp(name: Prop): THREE.Object3D {
  return PROP_BUILDERS[name]();
}

/** Places `o` in `parent` at (x, y, z) with a yaw. */
export function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x: number, y: number, z: number, yaw = 0): T {
  o.position.set(x, y, z);
  o.rotation.y = yaw;
  parent.add(o);
  return o;
}

export function tree(parent: THREE.Object3D, x: number, z: number, s = 1): void {
  cyl(parent, 0.7 * s, 4 * s, C.brown, x, 0, z);
  sphere(parent, 3 * s, C.green, x, 5.5 * s, z);
  sphere(parent, 2 * s, 0xa6e8a0, x + 1.2 * s, 7 * s, z);
}
export function house(parent: THREE.Object3D, x: number, z: number, wallColor: number, roofColor: number): void {
  const g = new THREE.Group();
  box(g, 10, 7, 8, wallColor, 0, 0, 0);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85 }));
  roof.scale.set(8.5, 3, 8.5 * 0.8); // 4-sided pyramid
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 7 + 1.5, 0);
  roof.castShadow = true;
  g.add(roof);
  put(g, door(), 0, 0, -4.2);
  box(g, 2, 2, 0.2, C.blue, -3.2, 3.5, -4.1);
  box(g, 2, 2, 0.2, C.blue, 3.2, 3.5, -4.1);
  put(parent, g, x, 0, z);
}

export type Layout = { marks: Record<string, [number, number, number]>; homes: [number, number, number][] };
