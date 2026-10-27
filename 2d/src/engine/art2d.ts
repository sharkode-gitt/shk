import type { CharacterInfo } from '../characters/roster.ts';
import type { Face } from '../types.ts';

export type Art = CharacterInfo['art'];
type Ctx = CanvasRenderingContext2D;

/** Canvas pixels per stud for every part. */
export const PX = 140;
/** Head canvas: 3.66 x 4.57 studs, the head itself 2.3 x 2.1 centred at (256, 250). */
export const HEAD = { w: 512, h: 640, cx: 256, cy: 250, hw: 160, hh: 148 };
export const TORSO = { w: 288, h: 384 };

const canvas = (w: number, h: number): [HTMLCanvasElement, Ctx] => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
};

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.min(255, Math.max(0, v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
};

function blob(g: Ctx, path: (g: Ctx) => void, fill: string, outline: string, lw = 9) {
  g.beginPath(); path(g);
  g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.lineJoin = 'round'; g.strokeStyle = outline; g.stroke();
}
const rrect = (x: number, y: number, w: number, h: number, r: number) => (g: Ctx) => g.roundRect(x, y, w, h, r);
const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0) => (g: Ctx) => g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);

function eye(g: Ctx, x: number, y: number, w: number, h: number, look: number, pupil: number, art: Art) {
  blob(g, ellipse(x, y, w, h), '#ffffff', art.outline, 6);
  blob(g, ellipse(x + look * w * 0.35, y + h * 0.05, w * pupil, h * pupil * 1.05), art.outline, art.outline, 1);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x + look * w * 0.35 - w * 0.18, y - h * 0.25, w * 0.13, 0, 7); g.fill();
}

/** The face features of one expression. `mouth` is 0 closed, 1 half open, 2 open; `look` -2..2 shifts the pupils sideways. */
function drawFace(g: Ctx, art: Art, face: Face, mouth: 0 | 1 | 2, look: number) {
  const { cx, cy } = HEAD, ink = art.outline;
  const masked = art.accessories.includes('skullmask');
  const ex = 52, ey = cy - 6;
  const brow = (x: number, tilt: number, dy = -46) => {
    g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = art.hair.style === 'none' || art.hair.color === '#111111' ? ink : shade(art.hair.color, 0.6);
    g.strokeStyle = ink; g.beginPath(); g.moveTo(x - 24, ey + dy + tilt); g.lineTo(x + 24, ey + dy - tilt); g.stroke();
  };
  const open = mouth === 0 ? 0 : mouth === 1 ? 14 : 28;
  g.lineCap = 'round';
  if (masked) return; // the skull mask brings its own face
  const size = face === 'shocked' || face === 'scared' ? [30, 36, 0.38] : face === 'angry' ? [26, 26, 0.5] : [27, 33, 0.55];
  const L = look * 0.5;
  if (face === 'happy') {
    for (const s of [-1, 1]) { g.lineWidth = 10; g.strokeStyle = ink; g.beginPath(); g.arc(cx + s * ex, ey + 6, 24, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  } else if (face === 'smug') {
    for (const s of [-1, 1]) { eye(g, cx + s * ex, ey, size[0], size[1], L, size[2], art); g.fillStyle = art.skin; g.fillRect(cx + s * ex - 36, ey - 38, 72, 36); g.lineWidth = 8; g.strokeStyle = ink; g.beginPath(); g.moveTo(cx + s * ex - 30, ey - 2); g.lineTo(cx + s * ex + 30, ey - 2); g.stroke(); }
  } else if (face === 'crying') {
    for (const s of [-1, 1]) { eye(g, cx + s * ex, ey, size[0], size[1], L, 0.7, art); g.fillStyle = '#7cc4ff'; g.beginPath(); g.ellipse(cx + s * (ex + 16), ey + 62, 10, 22, 0, 0, 7); g.fill(); }
  } else {
    for (const s of [-1, 1]) eye(g, cx + s * ex, ey, size[0], size[1], L, size[2], art);
  }
  if (face === 'sad' || face === 'crying') { brow(cx - ex, 12); brow(cx + ex, -12); }
  if (face === 'angry') { brow(cx - ex, -12, -38); brow(cx + ex, 12, -38); }
  if (face === 'scared') { brow(cx - ex, 8, -52); brow(cx + ex, -8, -52); }
  if (face === 'shocked') { brow(cx - ex, 0, -58); brow(cx + ex, 0, -58); }
  g.fillStyle = 'rgba(255,90,110,.35)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 88, ey + 42, 18, 10, 0, 0, 7); g.fill(); }
  const my = cy + 62;
  g.lineWidth = 8; g.strokeStyle = ink;
  const shape = face === 'shocked' ? 'o' : face === 'scared' ? 'wobble' : face === 'happy' ? 'smile' : face === 'sad' || face === 'crying' ? 'frown' : face === 'angry' ? 'grit' : face === 'smug' ? 'smirk' : 'flat';
  if (open >= 14 && shape !== 'o') { // talking: an open mouth with a tongue
    blob(g, ellipse(cx, my + 6, 24 + (shape === 'smile' ? 6 : 0), 6 + open * 0.7), '#5b1d2a', ink, 7);
    g.fillStyle = '#ff7f8e'; g.beginPath(); g.ellipse(cx, my + 6 + open * 0.5, 12, 6, 0, 0, 7); g.fill();
  } else if (shape === 'o') blob(g, ellipse(cx, my + 8, 17 + open * 0.3, 22 + open * 0.6), '#5b1d2a', ink, 7);
  else {
    g.beginPath();
    if (shape === 'smile') { g.moveTo(cx - 28, my); g.quadraticCurveTo(cx, my + 34, cx + 28, my); }
    else if (shape === 'frown') { g.moveTo(cx - 24, my + 14); g.quadraticCurveTo(cx, my - 14, cx + 24, my + 14); }
    else if (shape === 'smirk') { g.moveTo(cx - 22, my + 6); g.quadraticCurveTo(cx + 6, my + 16, cx + 28, my - 8); }
    else if (shape === 'wobble') { g.moveTo(cx - 26, my + 8); for (let i = 0; i < 4; i++) g.quadraticCurveTo(cx - 26 + i * 13 + 6, my + (i % 2 ? 18 : -2), cx - 26 + (i + 1) * 13, my + 8); }
    else if (shape === 'grit') { g.moveTo(cx - 26, my + 4); g.lineTo(cx + 26, my + 4); }
    else { g.moveTo(cx - 22, my + 6); g.lineTo(cx + 22, my + 6); }
    g.stroke();
  }
}

/** Hair that sits behind the head (long, bob) and the fringe in front of it. */
function hair(g: Ctx, art: Art, front: boolean) {
  const { cx, cy, hw, hh } = HEAD, h = art.hair, ink = art.outline;
  if (h.style === 'none') return;
  const col = h.color;
  if (!front) {
    if (h.style === 'long') blob(g, rrect(cx - hw - 20, cy - hh + 10, 2 * hw + 40, 300, 70), col, ink);
    if (h.style === 'bob') blob(g, rrect(cx - hw - 18, cy - hh + 10, 2 * hw + 36, 230, 60), col, ink);
    return;
  }
  if (h.style === 'spiky') {
    g.beginPath(); g.moveTo(cx - hw, cy - hh + 40);
    for (let i = 0; i <= 6; i++) { g.lineTo(cx - hw + (i * 2 * hw) / 6 - hw / 6, cy - hh - 46 - (i % 2 ? 0 : 34)); g.lineTo(cx - hw + ((i + 1) * 2 * hw) / 6 - hw / 6 - 8, cy - hh + 6); }
    g.lineTo(cx + hw, cy - hh + 40); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 9; g.strokeStyle = ink; g.lineJoin = 'round'; g.stroke();
    return;
  }
  const messy = h.style === 'messy';
  blob(g, (c) => {
    c.moveTo(cx - hw - 6, cy - 30);
    c.quadraticCurveTo(cx - hw - 12, cy - hh - 40, cx, cy - hh - 26);
    c.quadraticCurveTo(cx + hw + 12, cy - hh - 40, cx + hw + 6, cy - 30);
    if (messy) { c.lineTo(cx + hw - 6, cy - 50); c.lineTo(cx + 70, cy - 8); c.lineTo(cx + 40, cy - 62); c.lineTo(cx, cy - 6); c.lineTo(cx - 40, cy - 66); c.lineTo(cx - 80, cy - 10); c.lineTo(cx - hw + 6, cy - 56); }
    else { c.quadraticCurveTo(cx + 40, cy - 78, cx - hw * 0.1, cy - 70); c.quadraticCurveTo(cx - hw + 20, cy - 70, cx - hw - 6, cy - 30); }
    c.closePath();
  }, col, ink);
}

function hats(g: Ctx, art: Art) {
  const { cx, cy, hw, hh } = HEAD, ink = art.outline, top = cy - hh;
  for (const a of art.accessories) {
    if (a === 'crown') {
      g.save(); g.translate(cx + 44, top - 6); g.rotate(0.28);
      blob(g, (c) => { c.moveTo(-60, 4); c.lineTo(-60, -52); c.lineTo(-30, -22); c.lineTo(0, -66); c.lineTo(30, -22); c.lineTo(60, -52); c.lineTo(60, 4); c.closePath(); }, '#ffcf3a', ink, 8);
      g.fillStyle = '#ff5a6e'; g.beginPath(); g.arc(0, -14, 8, 0, 7); g.fill(); g.restore();
    }
    if (a === 'fedora') {
      blob(g, ellipse(cx, top + 18, hw + 54, 26), '#1b1b20', ink, 8);
      blob(g, rrect(cx - 92, top - 92, 184, 108, 34), '#1b1b20', ink, 8);
      g.fillStyle = '#3a3a44'; g.fillRect(cx - 88, top - 10, 176, 18);
    }
    if (a === 'tophat') {
      blob(g, ellipse(cx, top + 14, hw + 30, 20), '#d63a3a', ink, 8);
      blob(g, rrect(cx - 80, top - 138, 160, 150, 14), '#d63a3a', ink, 8);
      g.fillStyle = '#1b1b20'; g.fillRect(cx - 76, top - 20, 152, 22);
    }
    if (a === 'bunnymask') {
      for (const s of [-1, 1]) blob(g, ellipse(cx + s * 70, top - 62, 32, 84, s * 0.16), '#ffffff', ink, 8);
      for (const s of [-1, 1]) blob(g, ellipse(cx + s * 70, top - 62, 14, 58, s * 0.16), '#ff9eb5', ink, 1);
    }
    if (a === 'catears') for (const s of [-1, 1]) blob(g, (c) => { c.moveTo(cx + s * 40, top + 6); c.lineTo(cx + s * 100, top - 78); c.lineTo(cx + s * 132, top + 22); c.closePath(); }, '#ff9ec4', ink, 8);
    if (a === 'bow') blob(g, (c) => { c.moveTo(cx - 100, top + 20); c.lineTo(cx - 150, top - 8); c.lineTo(cx - 150, top + 52); c.closePath(); c.moveTo(cx - 100, top + 20); c.lineTo(cx - 50, top - 8); c.lineTo(cx - 50, top + 52); c.closePath(); }, '#ff5a9a', ink, 7);
  }
}

function faceMasks(g: Ctx, art: Art, mouth: 0 | 1 | 2) {
  const { cx, cy } = HEAD, ink = art.outline;
  if (art.accessories.includes('skullmask')) { // a golden skull over the whole face; the jaw drops when talking
    const jaw = mouth * 11;
    blob(g, (c) => { c.moveTo(cx - 100, cy + 4); c.quadraticCurveTo(cx - 108, cy - 92, cx, cy - 96); c.quadraticCurveTo(cx + 108, cy - 92, cx + 100, cy + 4); c.lineTo(cx + 74, cy + 52); c.lineTo(cx - 74, cy + 52); c.closePath(); }, '#e8b93a', ink, 8);
    for (const s of [-1, 1]) { blob(g, ellipse(cx + s * 44, cy - 26, 28, 32, s * 0.15), '#0b0b0e', ink, 5); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * 44 + 5, cy - 32, 6, 0, 7); g.fill(); }
    g.fillStyle = ink; g.beginPath(); g.moveTo(cx, cy + 2); g.lineTo(cx - 13, cy + 36); g.lineTo(cx + 13, cy + 36); g.closePath(); g.fill();
    blob(g, rrect(cx - 74, cy + 52, 148, 44 + jaw, 14), '#e8b93a', ink, 8);
    g.fillStyle = '#fff6d6'; for (let i = 0; i < 6; i++) g.fillRect(cx - 68 + i * 23, cy + 56, 18, 20 + jaw * 0.4);
    g.strokeStyle = ink; g.lineWidth = 4; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(cx - 74 + i * 24.6, cy + 56); g.lineTo(cx - 74 + i * 24.6, cy + 76 + jaw * 0.4); g.stroke(); }
  }
  if (art.accessories.includes('bunnymask')) { // white mask with a red stripe; blue eyes
    blob(g, rrect(cx - HEAD.hw + 6, cy - 78, 2 * HEAD.hw - 12, 150, 56), '#ffffff', ink, 8);
    g.fillStyle = '#e24b4b'; g.fillRect(cx - 14, cy - 76, 28, 148);
  }
  if (art.accessories.includes('glasses')) {
    for (const s of [-1, 1]) { g.lineWidth = 8; g.strokeStyle = ink; g.beginPath(); g.arc(cx + s * 52, cy - 6, 38, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 14, cy - 6); g.lineTo(cx + 14, cy - 6); g.stroke();
  }
}

/** One head sprite: hair behind, head, face, mask, fringe, hat. */
export function drawHead(art: Art, face: Face, mouth: 0 | 1 | 2, look: number): HTMLCanvasElement {
  const [c, g] = canvas(HEAD.w, HEAD.h);
  const { cx, cy, hw, hh } = HEAD;
  hair(g, art, false);
  blob(g, ellipse(cx, cy, hw, hh), art.skin, art.outline, 10);
  g.lineWidth = 10; g.strokeStyle = art.outline; g.beginPath(); g.ellipse(cx, cy, hw, hh, 0, 0, 7); g.stroke();
  drawFace(g, art, face, mouth, look);
  faceMasks(g, art, mouth);
  hair(g, art, true);
  hats(g, art);
  return c;
}

export function drawTorso(art: Art): HTMLCanvasElement {
  const [c, g] = canvas(TORSO.w, TORSO.h);
  const ink = art.outline, w = TORSO.w, h = TORSO.h;
  blob(g, rrect(24, 18, w - 48, h - 36, 50), art.shirt, ink, 10);
  g.save(); g.beginPath(); g.roundRect(24, 18, w - 48, h - 36, 50); g.clip();
  g.fillStyle = shade(art.shirt, 0.82); g.fillRect(0, h * 0.62, w, h);
  if (art.accessories.includes('jacket')) { g.fillStyle = '#17171c'; g.fillRect(24, 0, 56, h); g.fillRect(w - 80, 0, 56, h); }
  g.restore();
  if (art.accessories.includes('furcollar')) for (let i = 0; i < 9; i++) blob(g, ellipse(54 + i * 22, 34, 22, 26), '#2a2420', ink, 5);
  if (art.accessories.includes('bag')) {
    g.lineWidth = 12; g.strokeStyle = '#1b1b20'; g.beginPath(); g.moveTo(40, 24); g.lineTo(w - 60, h - 120); g.stroke();
    blob(g, rrect(w - 120, h - 170, 90, 76, 14), '#1b1b20', ink, 6);
  }
  g.lineWidth = 10; g.strokeStyle = ink; g.beginPath(); g.roundRect(24, 18, w - 48, h - 36, 50); g.stroke();
  return c;
}

/** A rod (sleeve or trouser leg) drawn pointing down; texture is 56 x 160 for a 0.4 x 1.15 stud limb. */
export function drawLimb(color: string, outline: string): HTMLCanvasElement {
  const [c, g] = canvas(56, 160);
  blob(g, rrect(8, 6, 40, 148, 20), color, outline, 8);
  return c;
}
export function drawHand(skin: string, outline: string): HTMLCanvasElement {
  const [c, g] = canvas(80, 80);
  blob(g, ellipse(40, 40, 26, 26), skin, outline, 8);
  return c;
}
export function drawShoe(color: string, outline: string): HTMLCanvasElement {
  const [c, g] = canvas(112, 64);
  blob(g, (p) => p.roundRect(10, 8, 92, 46, [26, 26, 12, 12]), color, outline, 8);
  return c;
}
