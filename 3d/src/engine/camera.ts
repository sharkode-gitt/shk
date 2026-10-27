import type { Shot, Vec3 } from '../types.ts';
import { mulberry32 } from '../build/seed.ts';
import type { BuiltSet } from './sets/index.ts';

export type Cam = { pos: Vec3; target: Vec3; fov: number };

const VFOV = 40; // vertical degrees; the video is 9:16
const TAN_H = Math.tan((VFOV / 2) * Math.PI / 180) * (9 / 16); // horizontal half-angle tangent
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
const mid = (ps: Vec3[]): Vec3 => [0, 1, 2].map((i) => ps.reduce((s, p) => s + p[i], 0) / ps.length) as Vec3;

/** Camera on the -Z side of `c`, `d` studs back, at `c.y + dy`, aiming at `c.y + ty`. */
const frame = (c: Vec3, d: number, dy: number, ty: number, fov: number, minZ = c[2]): Cam => ({
  pos: [c[0], c[1] + dy, minZ - d], target: [c[0], c[1] + ty, c[2]], fov,
});

/** Camera `d` studs in front of a head along its facing (yaw 0 faces -Z), at `c.y + dy`, aiming at `c.y + ty`. */
const facing = (c: Vec3, yaw: number, d: number, dy: number, ty: number, fov: number): Cam => ({
  pos: [c[0] - d * Math.sin(yaw), c[1] + dy, c[2] - d * Math.cos(yaw)], target: [c[0], c[1] + ty, c[2]], fov,
});

/** Horizontal distance from p to the segment a-b. */
function segDist(p: Vec3, a: Vec3, b: Vec3): number {
  const [ux, uz] = [b[0] - a[0], b[2] - a[2]];
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[2] - a[2]) * uz) / (ux * ux + uz * uz || 1)));
  return Math.hypot(p[0] - a[0] - k * ux, p[2] - a[2] - k * uz);
}

/** Three-quarter angle off the target's facing, so whoever it faces does not block the lens. */
const THREE_QUARTER = 0.6;

/** Smooth hand-held offset: three sines (periods ~2.7, 1.7, 1.1 s), seed-derived phases, |n| <= 0.03. */
function handheld(t: number, seed: number): Vec3 {
  const rnd = mulberry32(seed);
  return [0, 1, 2].map(() => {
    const [p1, p2, p3] = [rnd(), rnd(), rnd()].map((r) => r * 2 * Math.PI);
    const w = 2 * Math.PI * t;
    return 0.03 * (0.6 * Math.sin(w / 2.7 + p1) + 0.25 * Math.sin(w / 1.7 + p2) + 0.15 * Math.sin(w / 1.1 + p3));
  }) as Vec3;
}

export function cameraAt(
  shot: Shot, u: number, _beatDur: number, tInBeat: number,
  heads: Record<string, Vec3>, set: BuiltSet, seed: number, speaker: string,
  yaws: Record<string, number> = {},
): Cam {
  const all = Object.values(heads);
  const fallback: Vec3 = all[0] ?? [0, 4.5, 0];
  const bounds = set?.bounds;
  const inside = (p: Vec3) => !bounds || (p[0] >= bounds.minX && p[0] <= bounds.maxX && p[2] <= bounds.maxZ);
  const head = (id: string | undefined): Vec3 => (id ? heads[id] : undefined) ?? fallback;
  /** Face-on shot of `id` from 0.6 rad left or right of its facing, whichever keeps other heads further off the line. */
  const faceOn = (id: string | undefined, d: number, dy: number, ty: number, fov: number): Cam => {
    const c = head(id), yaw = (id ? yaws[id] : undefined) ?? 0;
    const others = Object.entries(heads).filter(([k]) => k !== id).map(([, p]) => p);
    const clear = (cam: Cam) => Math.min(Infinity, ...others.map((p) => segDist(p, cam.pos, c)));
    const [a, b] = [yaw + THREE_QUARTER, yaw - THREE_QUARTER].map((y) => facing(c, y, d, dy, ty, fov));
    // In a room, a side whose camera would stand behind a wall loses to one that stays inside.
    const inA = inside(a.pos), inB = inside(b.pos);
    if (inA !== inB) return inA ? a : b;
    return clear(b) > clear(a) ? b : a;
  };
  /** Head to thighs, face-on to the speaker (follows its facing); the head sits mid-frame, below the captions. */
  const medium = (id: string | undefined): Cam => faceOn(id, 9, -0.3, 0, VFOV);
  /** Distance so every point stays within +-halfSpan (plus 2.2 stud margin) horizontally, min `base`. */
  const fit = (halfSpan: number, base: number) => Math.max(base, (halfSpan + 2.2) / TAN_H);

  let cam: Cam;
  switch (shot.kind) {
    case 'wide': {
      const c = mid(all.length ? all : [fallback]);
      const span = Math.max(...all.map((p) => Math.abs(p[0] - c[0])), 0);
      cam = frame(c, fit(span, all.length <= 2 ? 10.5 : 14), 1.5, -1.5, VFOV, Math.min(...all.map((p) => p[2]), c[2]));
      break;
    }
    case 'medium': case 'shake': {
      cam = medium(speaker);
      if (shot.kind === 'shake' && tInBeat < 0.4) {
        const k = 0.15 * (1 - tInBeat / 0.4);
        cam.pos = [cam.pos[0] + k * Math.sin(tInBeat * 90), cam.pos[1] + k * Math.cos(tInBeat * 70), cam.pos[2]];
      }
      break;
    }
    // Face-on shots follow the target's facing; distances keep the head (about 1.65 wide seen at three-quarters) at 65-70% of the width,
    // and the aim point sits above it so the head lands in the lower half, clear of the captions.
    case 'closeup': cam = faceOn(shot.targets[0], 8.5, 0, 0.5, 30); break;
    case 'push_in': cam = faceOn(shot.targets[0], 10 - 3 * easeInOut(u), -0.2, 0.2, 35); break;
    case 'two_shot': {
      const [a, b] = [head(shot.targets[0]), head(shot.targets[1])];
      const c = mid([a, b]);
      cam = frame(c, fit(Math.abs(a[0] - b[0]) / 2, 9.5), -0.3, -0.2, VFOV, Math.min(a[2], b[2]));
      break;
    }
    case 'over_shoulder': {
      const x = head(shot.targets[0]);
      const other = Object.entries(heads)
        .filter(([id]) => id !== shot.targets[0])
        .map(([, p]) => p)
        .sort((p, q) => Math.hypot(p[0] - x[0], p[2] - x[2]) - Math.hypot(q[0] - x[0], q[2] - x[2]))[0];
      const dx = other ? x[0] - other[0] : 0;
      const dz = other ? x[2] - other[2] : 0;
      const l = Math.hypot(dx, dz);
      if (!other || l < 0.5) { cam = medium(shot.targets[0]); break; }
      const [nx, nz] = [dx / l, dz / l];
      // 5.5 studs behind the other's head and 1.7 to the side (about 17 degrees off the line): in 9:16 that head
      // is a sliver at the frame's edge instead of filling the lens, and the target stays in view.
      cam = {
        pos: [other[0] - nx * 5.5 - nz * 1.7, other[1] + 0.6, other[2] - nz * 5.5 + nx * 1.7],
        target: [x[0], x[1] - 0.2, x[2]], fov: 40,
      };
      break;
    }
    case 'orbit': {
      const c = mid(all.length ? all : [fallback]);
      const r = fit(Math.max(...all.map((p) => Math.hypot(p[0] - c[0], p[2] - c[2])), 0), 14);
      const a = (-20 + 40 * u) * Math.PI / 180; // sweeps 40 deg centred on the -Z side
      cam = { pos: [c[0] + r * Math.sin(a), c[1] + 1.5, c[2] - r * Math.cos(a)], target: [c[0], c[1] - 1.5, c[2]], fov: VFOV };
      break;
    }
  }
  // Shots that would otherwise stand still drift 6% closer over the beat, so no frame is ever frozen.
  if (shot.kind === 'wide' || shot.kind === 'medium' || shot.kind === 'two_shot' || shot.kind === 'over_shoulder' || shot.kind === 'closeup') {
    const k = 1 - 0.07 * easeInOut(Math.min(1, Math.max(0, u)));
    cam.pos = [0, 1, 2].map((i) => cam.target[i] + (cam.pos[i] - cam.target[i]) * k) as Vec3;
  }
  if (bounds) { // last resort: never stand behind a wall of the room
    cam.pos = [Math.min(bounds.maxX, Math.max(bounds.minX, cam.pos[0])), cam.pos[1], Math.min(bounds.maxZ, cam.pos[2])];
  }
  const n = handheld(tInBeat, seed);
  return { ...cam, pos: [cam.pos[0] + n[0], cam.pos[1] + n[1], cam.pos[2] + n[2]] };
}
