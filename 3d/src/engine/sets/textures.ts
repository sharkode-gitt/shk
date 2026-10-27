import * as THREE from 'three';

type RGB = [number, number, number];
export const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const clamp = (v: number) => Math.max(0, Math.min(255, v));

/** Deterministic noise in [0,1) for a pixel, so textures are identical on every run. */
const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A small pixel painter that works in Node and in the browser (no canvas). */
export class Paint {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number, base: RGB = [255, 255, 255]) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.data.set([base[0], base[1], base[2], 255], i * 4);
  }
  px(x: number, y: number, c: RGB, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (Math.floor(y) * this.w + Math.floor(x)) * 4, d = this.data;
    d[i] = clamp(d[i] * (1 - a) + c[0] * a); d[i + 1] = clamp(d[i + 1] * (1 - a) + c[1] * a); d[i + 2] = clamp(d[i + 2] * (1 - a) + c[2] * a);
  }
  /** y = 0 is the TOP of the picture. */
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1): this {
    for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.px(i, j, c, a);
    return this;
  }
  circle(cx: number, cy: number, r: number, c: RGB, a = 1): this {
    for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) this.px(i, j, c, a);
    return this;
  }
  /** Vertical gradient over a rectangle: from colour `a` (top) to `b` (bottom), blended with weight `k`. */
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB, k = 1): this {
    for (let j = 0; j < h; j++) { const t = j / Math.max(1, h - 1); this.rect(x, y + j, w, 1, [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t], k); }
    return this;
  }
  noise(amount: number, seed = 1): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const n = (hash(x, y, seed) - 0.5) * amount; const i = (y * this.w + x) * 4; for (let k = 0; k < 3; k++) this.data[i + k] = clamp(this.data[i + k] + n); }
    return this;
  }
  texture(repeatX = 1, repeatY = 1): THREE.DataTexture {
    // DataTexture rows start at the bottom: flip so that y = 0 is the top, like a picture.
    const flipped = new Uint8Array(this.data.length);
    for (let y = 0; y < this.h; y++) flipped.set(this.data.subarray(y * this.w * 4, (y + 1) * this.w * 4), (this.h - 1 - y) * this.w * 4);
    const t = new THREE.DataTexture(flipped, this.w, this.h, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }
}

/** Glossy checker tiles with grout: 2 x 2 tiles in `size` px; one texture repeat = 2 tiles. */
export function tileTexture(c1: number, c2: number, grout = 0x9d9a90, size = 128): THREE.DataTexture {
  const p = new Paint(size, size), half = size / 2, a = rgb(c1), b = rgb(c2), g = rgb(grout);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const base = (tx + ty) % 2 ? a : b, k = 0.96 + hash(tx, ty, 7) * 0.08;
    p.rect(tx * half, ty * half, half, half, mul(base, k));
  }
  p.rect(0, 0, size, 3, g).rect(0, half - 1, size, 3, g).rect(0, 0, 3, size, g).rect(half - 1, 0, 3, size, g);
  return p.noise(7, 3).texture();
}

/**
 * The back wall of a school hallway, 24 studs wide x 14 high at 48 px per stud: a row of lockers (vents, handles, numbers),
 * a cream wall above with a bulletin board, posters, a clock and the red banner.
 */
export function hallwayWallTexture(): THREE.DataTexture {
  const PX = 48, W = 24 * PX, H = 14 * PX, p = new Paint(W, H, rgb(0xf5e6b8));
  const top = (y: number) => H - y * PX; // studs above the floor -> pixel row
  p.vgrad(0, 0, W, H, [250, 238, 200], [232, 214, 166], 1);
  // lockers: 12 x 2 studs, 6.4 high
  const LH = 6.4 * PX, ly = top(6.4), pal = [0x2f9ec7, 0xe8604c, 0x3fae7a, 0xf0b73b, 0x7e63c8, 0xf08a4b];
  for (let i = 0; i < 12; i++) {
    const x0 = i * 2 * PX, c = rgb(pal[i % pal.length]);
    p.rect(x0, ly, 2 * PX, LH, c);
    p.rect(x0 + 4, ly + 4, 2 * PX - 8, LH - 8, mul(c, 1.08));
    p.vgrad(x0 + 4, ly + 4, 2 * PX - 8, 40, [255, 255, 255], c, 0.25); // soft top light
    p.vgrad(x0 + 4, ly + LH - 80, 2 * PX - 8, 76, c, [0, 0, 0], 0.28); // darker toward the floor
    for (let v = 0; v < 5; v++) p.rect(x0 + 18, ly + 26 + v * 9, 2 * PX - 36, 3, mul(c, 0.45)); // vents
    p.rect(x0 + 2 * PX - 26, ly + LH * 0.5, 9, 60, [236, 236, 240]).rect(x0 + 2 * PX - 25, ly + LH * 0.5 + 2, 3, 56, [255, 255, 255], 0.6); // handle
    p.rect(x0 + 18, ly + 100, 34, 16, [250, 250, 250]).rect(x0 + 21, ly + 104, 28, 3, [120, 120, 130]).rect(x0 + 21, ly + 109, 18, 3, [120, 120, 130]); // number plate
    p.rect(x0, ly, 4, LH, [20, 20, 30], 0.55).rect(x0 + 2 * PX - 4, ly, 4, LH, [20, 20, 30], 0.55); // dividers
    p.rect(x0, ly + LH - 22, 2 * PX, 22, [30, 30, 38], 0.7); // kick plate
  }
  p.rect(0, ly - 6, W, 6, [60, 50, 40], 0.5); // shadow line under the wall paint
  // red banner above the lockers
  p.rect(4 * PX, top(9.4), 16 * PX, 0.9 * PX, rgb(0xe2574c)).rect(4 * PX, top(9.4) + 0.9 * PX - 4, 16 * PX, 4, [0, 0, 0], 0.25);
  for (let i = 0; i < 9; i++) p.circle(4.8 * PX + i * 1.7 * PX, top(9.4) + 0.45 * PX, 7, [255, 255, 255], 0.9); // banner dots
  // bulletin board with notes
  const bx = 1.2 * PX, bw = 7 * PX, by = top(12.6), bh = 3.4 * PX;
  p.rect(bx - 6, by - 6, bw + 12, bh + 12, rgb(0xa86b3c)).rect(bx, by, bw, bh, rgb(0xc99b63)).noise(0, 1);
  const notes = [0xffffff, 0xffd166, 0xff8fab, 0x8fd3ff, 0xffffff, 0xb5e48c, 0xffd166, 0xff8fab, 0xffffff, 0x8fd3ff];
  notes.forEach((c, i) => { const nx = bx + 24 + (i % 5) * 1.3 * PX, ny = by + 24 + Math.floor(i / 5) * 1.5 * PX; p.rect(nx, ny, 1.0 * PX, 1.2 * PX, rgb(c)).rect(nx + 6, ny + 8, 1.0 * PX - 12, 3, [90, 90, 100], 0.6).rect(nx + 6, ny + 16, 0.7 * PX, 3, [90, 90, 100], 0.6).circle(nx + 0.5 * PX, ny + 3, 3.5, [220, 60, 60]); });
  // clock
  const cx = 12 * PX, cy = top(11.9), cr = 1.1 * PX;
  p.circle(cx, cy, cr + 5, [60, 50, 45]).circle(cx, cy, cr, [252, 252, 250]);
  for (let h = 0; h < 12; h++) { const a = (h / 12) * Math.PI * 2; p.circle(cx + Math.sin(a) * cr * 0.82, cy - Math.cos(a) * cr * 0.82, 2.5, [50, 50, 60]); }
  p.rect(cx - 2, cy - cr * 0.55, 4, cr * 0.55, [40, 40, 50]).rect(cx, cy - 2, cr * 0.7, 4, [40, 40, 50]).circle(cx, cy, 5, [200, 50, 50]);
  // posters
  const poster = (x: number, w: number, h: number, c1: number, c2: number) => { const y = top(12.9); p.rect(x - 5, y - 5, w + 10, h + 10, [255, 255, 255]).vgrad(x, y, w, h, rgb(c1), rgb(c2)); p.circle(x + w / 2, y + h * 0.4, w * 0.22, [255, 255, 255], 0.85).rect(x + 14, y + h - 40, w - 28, 8, [255, 255, 255], 0.9).rect(x + 14, y + h - 24, w * 0.6, 6, [255, 255, 255], 0.7); };
  poster(15.2 * PX, 2.6 * PX, 3.2 * PX, 0x5b8def, 0x7e63c8);
  poster(18.4 * PX, 2.6 * PX, 3.2 * PX, 0xf08a4b, 0xe2574c);
  // soft vignette toward the top and the floor so the wall is not flat
  return p.noise(5, 9).texture();
}

/** A soft rectangle of sunlight for floors and walls: additive, transparent, no depth write. */
export function sunPatch(w: number, h: number, color = 0xfff0c0, opacity = 0.35): THREE.Mesh {
  const N = 64, p = new Paint(N, N, [0, 0, 0]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.min(x, N - 1 - x) / (N * 0.25), dy = Math.min(y, N - 1 - y) / (N * 0.25), a = Math.min(1, dx) * Math.min(1, dy);
    p.px(x, y, [255, 255, 255], a * a);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, map: p.texture(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}
