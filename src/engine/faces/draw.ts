import type { Face } from '../../types.ts';

export type Rect = { x: number; y: number; w: number; h: number };
type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
type Curve = (t: number) => Pt;

const INK = '#141014';
const BLUSH = '#ff9aa8';
const TEAR = '#7cc8ff';
const MOUTH_IN = '#5a1e26';
const TONGUE = '#e8788a';

// Everything below is in rect-normalized units (0..1 across the head front), measured from
// Emily's original face in Hero1_diff.png. `side` is -1 for the eye on the image's left.
const EYE_X = 0.27, EYE_Y = 0.582, EYE_RX = 0.122, EYE_RY = 0.114;
const MOUTH_Y = 0.795;

/** [outer y, inner y, bow] — bow > 0 sags the middle down. */
type Brow = [number, number, number];
type Eye =
  | { kind: 'round'; scale: number; iris: number }
  | { kind: 'arc' }
  /** Upper lid cut at cy + inner/outer * ry. */
  | { kind: 'lidded'; inner: number; outer: number };
type Mouth =
  | { kind: 'o' }
  | { kind: 'line'; w: number; curve: (s: number) => number; open: number; dx?: number; teeth?: boolean };
type Spec = { brow: Brow | [Brow, Brow]; browW: number; eye: Eye; mouth: Mouth; tears?: boolean };

const SPECS: Record<Face, Spec> = {
  neutral: { brow: [0.315, 0.31, -0.012], browW: 0.019, eye: { kind: 'round', scale: 1, iris: 1 },
    mouth: { kind: 'line', w: 0.05, curve: () => 0, open: 0.08 } },
  happy: { brow: [0.29, 0.285, -0.028], browW: 0.019, eye: { kind: 'arc' },
    mouth: { kind: 'line', w: 0.075, curve: (s) => -0.028 * s * s, open: 0.12 } },
  sad: { brow: [0.354, 0.278, 0.013], browW: 0.019, eye: { kind: 'round', scale: 1, iris: 1 },
    mouth: { kind: 'line', w: 0.053, curve: (s) => 0.026 * s * s, open: 0.07 } },
  crying: { brow: [0.35, 0.262, 0.016], browW: 0.019, eye: { kind: 'round', scale: 1, iris: 1 }, tears: true,
    mouth: { kind: 'line', w: 0.06, curve: (s) => 0.03 * s * s + 0.004 * Math.sin(7 * s), open: 0.09 } },
  angry: { brow: [0.285, 0.385, 0], browW: 0.027, eye: { kind: 'lidded', inner: -0.2, outer: -0.72 },
    mouth: { kind: 'line', w: 0.065, curve: (s) => 0.014 * s * s, open: 0.07, teeth: true } },
  shocked: { brow: [0.235, 0.23, -0.03], browW: 0.019, eye: { kind: 'round', scale: 1.15, iris: 0.6 },
    mouth: { kind: 'o' } },
  smug: { brow: [[0.33, 0.335, -0.004], [0.265, 0.285, -0.03]], browW: 0.019,
    eye: { kind: 'lidded', inner: 0.0, outer: -0.12 },
    mouth: { kind: 'line', w: 0.06, curve: (s) => -0.012 * s * s - 0.017 * s, open: 0.05, dx: 0.025 } },
  scared: { brow: [0.3, 0.232, 0.02], browW: 0.017, eye: { kind: 'round', scale: 0.8, iris: 0.55 },
    mouth: { kind: 'line', w: 0.07, curve: (s) => 0.012 * Math.sin(s * Math.PI * 2), open: 0.07 } },
};

const quad = (a: Pt, c: Pt, b: Pt): Curve => (t) => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

/** Fills a stroke of varying width along a curve (tapered brows, lids, lashes). */
function ribbon(ctx: Ctx, f: Curve, width: (t: number) => number, n = 32): void {
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = f(t);
    const [x0, y0] = f(Math.max(0, t - 1e-3)), [x1, y1] = f(Math.min(1, t + 1e-3));
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len, h = width(t) / 2;
    a.push([x + nx * h, y + ny * h]);
    b.push([x - nx * h, y - ny * h]);
  }
  poly(ctx, [...a, ...b.reverse()]);
  ctx.fill();
}

function poly(ctx: Ctx, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

const taper = (max: number, min = 0.002) => (t: number) => min + max * Math.sin(Math.PI * t) ** 0.7;

function drawBrow(ctx: Ctx, side: number, [outer, inner, bow]: Brow, w: number): void {
  const xo = 0.5 + side * 0.384, xi = 0.5 + side * 0.085;
  ctx.fillStyle = INK;
  ribbon(ctx, quad([xo, outer], [(xo + xi) / 2, (outer + inner) / 2 + 2 * bow], [xi, inner]),
    (t) => 0.002 + w * Math.sin(Math.PI * (0.15 + 0.75 * t)) ** 0.8);
}

/** Two lash flicks hanging off the outer end `p` of the upper lid. */
function lashes(ctx: Ctx, side: number, [px, py]: Pt, rx: number, ry: number): void {
  ctx.fillStyle = INK;
  poly(ctx, [[px - side * 0.45 * rx, py - 0.14 * ry], [px - side * 0.05 * rx, py + 0.2 * ry], [px + side * 0.32 * rx, py - 0.16 * ry]]);
  ctx.fill();
  poly(ctx, [[px - side * 0.3 * rx, py + 0.18 * ry], [px - side * 0.2 * rx, py + 0.7 * ry], [px + side * 0.45 * rx, py + 0.8 * ry]]);
  ctx.fill();
}

function drawEye(ctx: Ctx, side: number, eye: Eye, tears: boolean): void {
  const cx = 0.5 + side * (0.5 - EYE_X), cy = EYE_Y;
  if (eye.kind === 'arc') {
    // Closed smiling eye: a thick upward bow.
    const rx = EYE_RX, ry = EYE_RY, outer: Pt = [cx + side * 1.05 * rx, cy + 0.15 * ry];
    ctx.fillStyle = INK;
    ribbon(ctx, quad(outer, [cx, cy - 1.0 * ry], [cx - side * 0.95 * rx, cy + 0.15 * ry]), taper(0.036, 0.007));
    // One lash flicking up and out from the outer half of the bow.
    poly(ctx, [[cx + side * 0.6 * rx, cy - 0.24 * ry], [cx + side * 0.9 * rx, cy - 0.0 * ry], [cx + side * 1.32 * rx, cy - 0.42 * ry]]);
    ctx.fill();
    return;
  }
  const scale = eye.kind === 'round' ? eye.scale : 1, iris = eye.kind === 'round' ? eye.iris : 1;
  const rx = EYE_RX * scale, ry = EYE_RY * scale;
  // Lid line, from the outer end to the inner end.
  const lid: [Pt, Pt, Pt] = eye.kind === 'round'
    ? [[cx + side * 1.25 * rx, cy - 0.72 * ry], [cx + side * 0.1 * rx, cy - 1.22 * ry], [cx - side * 1.05 * rx, cy - 0.6 * ry]]
    : [[cx + side * 1.2 * rx, cy + eye.outer * ry], [cx, cy + ((eye.outer + eye.inner) / 2 - 0.08) * ry], [cx - side * 1.05 * rx, cy + eye.inner * ry]];

  ctx.save();
  if (eye.kind === 'lidded') {
    poly(ctx, [lid[0], lid[1], lid[2], [lid[2][0], cy + 2 * ry], [lid[0][0], cy + 2 * ry]]);
    ctx.clip();
  }
  // Highlight 1: the white of the eye. Full-size irises leave only a crescent on the outer-lower
  // side (as in the original); smaller irises (shocked, scared) sit inside a white ring.
  const full = iris === 1;
  ctx.fillStyle = '#fff';
  if (full) ellipse(ctx, cx + side * 0.2 * rx, cy - 0.02 * ry, 0.92 * rx, 0.92 * ry);
  else ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.007;
  ctx.stroke();
  const irx = full ? 0.94 * rx : rx * 0.85 * iris, iry = full ? ry : ry * 0.95 * iris;
  const ix = cx - side * (full ? 0.06 : 0.1) * rx, iy = cy;
  ctx.fillStyle = INK;
  ellipse(ctx, ix, iy, irx, iry);
  ctx.fill();
  // Highlight 2: a small sparkle on the upper-inner side of the iris.
  ctx.fillStyle = '#fff';
  ellipse(ctx, ix - side * 0.4 * irx, iy - 0.42 * iry, 0.14 * irx, 0.14 * iry);
  ctx.fill();
  if (tears) {
    ellipse(ctx, cx, cy, rx, ry);
    ctx.clip();
    ctx.fillStyle = TEAR;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(cx - rx, cy + 0.5 * ry, 2 * rx, ry);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.fillStyle = INK;
  ribbon(ctx, quad(...lid), (t) => 0.007 + 0.026 * (1 - t) ** 0.5 + 0.01 * Math.sin(Math.PI * t));
  if (eye.kind === 'round') {
    ribbon(ctx, quad([cx + side * 0.85 * rx, cy - 1.0 * ry], [cx, cy - 1.42 * ry], [cx - side * 0.75 * rx, cy - 0.98 * ry]), taper(0.007));
  }
  lashes(ctx, side, lid[0], rx, ry);
}

function drawBlush(ctx: Ctx): void {
  ctx.strokeStyle = BLUSH;
  ctx.lineWidth = 0.007;
  ctx.lineCap = 'round';
  for (const x0 of [0.148, 0.183, 0.218, 0.74, 0.775, 0.81]) {
    ctx.beginPath();
    ctx.moveTo(x0, 0.77);
    ctx.lineTo(x0 + 0.03, 0.695);
    ctx.stroke();
  }
}

function drawTears(ctx: Ctx, side: number): void {
  const x = 0.5 + side * (0.5 - EYE_X) + side * 0.4 * EYE_RX, top = EYE_Y + 0.85 * EYE_RY;
  ctx.fillStyle = TEAR;
  ctx.globalAlpha = 0.9;
  ribbon(ctx, (t) => [x + side * 0.012 * Math.sin(t * 5), top + t * (0.97 - top)], (t) => 0.022 + 0.014 * t);
  // A falling drop on the inner side of the cheek.
  const dx = 0.5 + side * 0.13, dy = 0.75;
  poly(ctx, [[dx, dy - 0.05], [dx + 0.018, dy], [dx - 0.018, dy]]);
  ctx.fill();
  ellipse(ctx, dx, dy + 0.004, 0.018, 0.018);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawMouth(ctx: Ctx, mouth: Mouth, open: number): void {
  ctx.lineWidth = 0.008;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  if (mouth.kind === 'o') {
    const rx = 0.026 + 0.03 * open, ry = 0.03 + 0.08 * open, cy = MOUTH_Y + ry * 0.4;
    ctx.fillStyle = MOUTH_IN;
    ellipse(ctx, 0.5, cy, rx, ry);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const mx = 0.5 + (mouth.dx ?? 0);
  const top = (s: number): Pt => [mx + s * mouth.w, MOUTH_Y + mouth.curve(s)];
  if (open === 0) {
    ctx.fillStyle = INK;
    ribbon(ctx, (t) => top(2 * t - 1), taper(0.014, 0.003));
    return;
  }
  const n = 24, h = mouth.open * open;
  const upper: Pt[] = [], lower: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (2 * i) / n - 1, [x, y] = top(s);
    upper.push([x, y]);
    lower.push([x, y + h * (1 - s * s) ** (mouth.teeth ? 0.25 : 0.6)]);
  }
  const shape = [...upper, ...lower.reverse()];
  ctx.save();
  poly(ctx, shape);
  ctx.fillStyle = MOUTH_IN;
  ctx.fill();
  ctx.clip();
  if (mouth.teeth) {
    ctx.fillStyle = '#fff';
    poly(ctx, [...upper, ...upper.map(([x, y]): Pt => [x, y + Math.min(0.022, h * 0.45)]).reverse()]);
    ctx.fill();
  } else {
    ctx.fillStyle = TONGUE;
    ellipse(ctx, mx, MOUTH_Y + mouth.curve(0) + h, mouth.w * 0.55, h * 0.45);
    ctx.fill();
  }
  ctx.restore();
  poly(ctx, shape);
  ctx.stroke();
}

/** Paints `rect` with `skin` and draws `face` in Emily's style; `mouth` 1/2 open it 35%/70%. */
export function drawFace(ctx: Ctx, face: Face, mouth: 0 | 1 | 2, rect: Rect, skin: string): void {
  const spec = SPECS[face];
  ctx.save();
  ctx.fillStyle = skin;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w, rect.h);
  drawBlush(ctx);
  const brows: [Brow, Brow] = Array.isArray(spec.brow[0]) ? (spec.brow as [Brow, Brow]) : [spec.brow as Brow, spec.brow as Brow];
  drawBrow(ctx, -1, brows[0], spec.browW);
  drawBrow(ctx, 1, brows[1], spec.browW);
  drawEye(ctx, -1, spec.eye, !!spec.tears);
  drawEye(ctx, 1, spec.eye, !!spec.tears);
  if (spec.tears) {
    drawTears(ctx, -1);
    drawTears(ctx, 1);
  }
  drawMouth(ctx, spec.mouth, [0, 0.35, 0.7][mouth]);
  ctx.restore();
}
