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
  /** Bilinear upscale by an integer factor: the hard pixel steps of shapes drawn at low resolution become soft, anti-aliased edges. */
  smooth(f: number): Paint {
    const o = new Paint(this.w * f, this.h * f);
    for (let y = 0; y < o.h; y++) {
      const sy = Math.min(this.h - 1.001, Math.max(0, (y + 0.5) / f - 0.5)), y0 = Math.floor(sy), fy = sy - y0;
      for (let x = 0; x < o.w; x++) {
        const sx = Math.min(this.w - 1.001, Math.max(0, (x + 0.5) / f - 0.5)), x0 = Math.floor(sx), fx = sx - x0;
        const i00 = (y0 * this.w + x0) * 4, i10 = i00 + 4, i01 = i00 + this.w * 4, i11 = i01 + 4, j = (y * o.w + x) * 4;
        for (let k = 0; k < 3; k++) o.data[j + k] = this.data[i00 + k] * (1 - fx) * (1 - fy) + this.data[i10 + k] * fx * (1 - fy) + this.data[i01 + k] * (1 - fx) * fy + this.data[i11 + k] * fx * fy;
      }
    }
    return o;
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
  return p.smooth(2).noise(4, 9).texture();
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

/** Wooden floor boards: 8 boards of 16 px, each a slightly different tone, with dark seams and a few knots. */
export function plankTexture(base = 0xd9a066, size = 128): THREE.DataTexture {
  const p = new Paint(size, size), c = rgb(base), rows = 8, h = size / rows;
  for (let r = 0; r < rows; r++) {
    const k = 0.88 + hash(r, 1, 4) * 0.22, off = Math.floor(hash(r, 2, 4) * size);
    p.rect(0, r * h, size, h, mul(c, k));
    for (let x = 0; x < size; x += 3) p.rect(x, r * h + 2 + hash(x, r, 5) * (h - 4), 2 + hash(x, r, 6) * 5, 1, mul(c, k * 0.86), 0.5); // grain
    p.rect(off, r * h, 2, h, mul(c, 0.55)); // end seam
    p.rect(0, r * h + h - 2, size, 2, mul(c, 0.55)); // long seam
  }
  return p.noise(6, 8).texture();
}

/** Mown grass: wide light and dark stripes plus speckles. One repeat = 8 studs. */
export function grassTexture(light = 0x7fcf62, dark = 0x6cc254, size = 128): THREE.DataTexture {
  const p = new Paint(size, size, rgb(light));
  for (let i = 0; i < 4; i++) p.rect(0, i * (size / 4), size, size / 8, rgb(dark));
  for (let i = 0; i < 260; i++) p.rect(hash(i, 1, 11) * size, hash(i, 2, 11) * size, 2, 3, mul(rgb(dark), 0.82 + hash(i, 3, 11) * 0.2), 0.7);
  for (let i = 0; i < 30; i++) p.circle(hash(i, 4, 11) * size, hash(i, 5, 11) * size, 1.4, [255, 255, 255], 0.55); // tiny flowers
  return p.noise(5, 12).texture();
}

/** Paving stones for a park path: light slabs with grout, 4 x 4 per repeat. */
export function pavingTexture(size = 128): THREE.DataTexture {
  const p = new Paint(size, size, rgb(0xcfc9bb)), t = size / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) p.rect(x * t, y * t, t, t, mul(rgb(0xd8d2c4), 0.92 + hash(x, y, 13) * 0.14));
  for (let i = 0; i < 4; i++) p.rect(0, i * t, size, 2, rgb(0x9a9486)).rect(i * t, 0, 2, size, rgb(0x9a9486));
  return p.noise(6, 14).texture();
}

/** Vertical sky gradient for a dome (`bottom` at the horizon). */
export function skyTexture(top: number, bottom: number): THREE.DataTexture {
  const p = new Paint(4, 128);
  p.vgrad(0, 0, 4, 128, rgb(top), rgb(bottom));
  return p.texture();
}

/**
 * The back wall of a classroom, 24 x 14 studs at 48 px per stud: green chalkboard with a doodle, shelves of books, a world-map
 * poster, an alphabet strip, a clock and two windows with a sky and tree outside.
 */
export function classroomWallTexture(): THREE.DataTexture {
  const PX = 48, W = 24 * PX, H = 14 * PX, p = new Paint(W, H);
  const top = (y: number) => H - y * PX;
  p.vgrad(0, 0, W, H, rgb(0xeaf3f7), rgb(0xcfe2ea));
  p.rect(0, top(2.2), W, 2.2 * PX, rgb(0xb9d3dd)).rect(0, top(2.2), W, 5, rgb(0xffffff)); // wainscot and rail
  // chalkboard
  const bx = 6 * PX, bw = 12 * PX, by = top(8.6), bh = 5 * PX;
  p.rect(bx - 12, by - 12, bw + 24, bh + 24, rgb(0x8a5a2b)).rect(bx, by, bw, bh, rgb(0x2f5d50)).vgrad(bx, by, bw, bh, [255, 255, 255], [0, 0, 0], 0.06);
  for (let i = 0; i < 3; i++) p.rect(bx + 40, by + 50 + i * 40, bw * (0.7 - i * 0.18), 5, [235, 240, 235], 0.8); // chalk lines
  p.circle(bx + bw - 120, by + 110, 38, [255, 226, 120], 0.9).rect(bx + bw - 124, by + 160, 8, 56, [235, 240, 235], 0.8); // doodle: sun and stem
  for (let i = 0; i < 5; i++) p.rect(bx + 40 + i * 64, by + bh - 70, 40, 5, [235, 240, 235], 0.8).rect(bx + 40 + i * 64 + 18, by + bh - 100, 5, 35, [235, 240, 235], 0.8);
  p.rect(bx, by + bh, bw, 14, rgb(0xa06f3a)); // chalk tray
  for (let i = 0; i < 4; i++) p.rect(bx + 120 + i * 60, by + bh - 8, 40, 8, [250, 250, 245]); // chalk
  // windows with sky and a tree
  for (const wx of [1.2, 19.4]) {
    const x = wx * PX, w = 3.4 * PX, y = top(10.6), h = 5.4 * PX;
    p.rect(x - 8, y - 8, w + 16, h + 16, [255, 255, 255]).vgrad(x, y, w, h, rgb(0x8fd3ff), rgb(0xdff3ff)).circle(x + w * 0.5, y + h * 0.62, 70, rgb(0x66bb6a)).rect(x + w * 0.5 - 8, y + h * 0.62, 16, 110, rgb(0x8a5a2b));
    p.rect(x + w / 2 - 3, y, 6, h, [255, 255, 255]).rect(x, y + h / 2 - 3, w, 6, [255, 255, 255]);
  }
  // shelves under the windows? bookshelf at the left of the board
  const sx = 4.3 * PX, sy = top(6.4);
  p.rect(sx, sy, 1.4 * PX, 4.4 * PX, rgb(0x9a6b3a));
  for (let s = 0; s < 3; s++) { const yy = sy + 14 + s * 1.4 * PX; p.rect(sx + 4, yy + 1.2 * PX - 6, 1.4 * PX - 8, 6, rgb(0x6d4a24)); for (let b = 0; b < 5; b++) p.rect(sx + 8 + b * 11, yy + 8, 9, 1.2 * PX - 14, rgb([0xe2574c, 0x4a90e2, 0xf2c14e, 0x7e63c8, 0x3fae7a][b])); }
  // world map poster
  const mx = 18.6 * PX, my = top(7.3);
  p.rect(mx - 6, my - 6, 2.4 * PX + 12, 1.7 * PX + 12, [255, 255, 255]).rect(mx, my, 2.4 * PX, 1.7 * PX, rgb(0x6ec1e4));
  for (const [cx, cy, r] of [[0.6, 0.6, 22], [1.2, 0.5, 18], [1.7, 1.0, 26], [0.9, 1.2, 14]] as const) p.circle(mx + cx * PX, my + cy * PX, r, rgb(0x66bb6a));
  // clock
  const cx = 12 * PX, cy = top(10.4);
  p.circle(cx, cy, 1.0 * PX + 5, [60, 50, 45]).circle(cx, cy, 1.0 * PX, [252, 252, 250]).rect(cx - 2, cy - 36, 4, 36, [40, 40, 50]).rect(cx, cy - 2, 28, 4, [40, 40, 50]).circle(cx, cy, 5, [200, 50, 50]);
  // alphabet strip
  for (let i = 0; i < 24; i++) { const x = 0.4 * PX + i * 0.96 * PX; p.rect(x, top(12.3), 0.78 * PX, 0.8 * PX, rgb([0xf28ab2, 0xf2c14e, 0x6ec1e4, 0x8fdc8f][i % 4])).rect(x + 14, top(12.3) + 12, 6, 24, [255, 255, 255], 0.9).rect(x + 14, top(12.3) + 12, 18, 6, [255, 255, 255], 0.9); }
  return p.smooth(2).noise(3, 21).texture();
}
