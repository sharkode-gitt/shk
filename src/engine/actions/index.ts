import { seedFromId } from '../../build/seed.ts';
import type { Act, JointName, TimedAction, TimedBeat, Vec3 } from '../../types.ts';
import { cry } from './cry.ts';
import { facepalm } from './facepalm.ts';
import { fall, lying } from './fall.ts';
import { hug } from './hug.ts';
import { idle } from './idle.ts';
import { jump } from './jump.ts';
import { laugh } from './laugh.ts';
import { point } from './point.ts';
import { shocked } from './shocked.ts';
import { seated, sit } from './sit.ts';
import { standUp } from './stand_up.ts';
import { talk } from './talk.ts';
import { wave } from './wave.ts';
import { run, walk } from './walk.ts';
import { clamp01, type ActionCtx, type ActionFn, type ActionPose, type Posture } from './util.ts';

export type { ActionCtx, ActionFn, ActionPose, Posture } from './util.ts';

export const ACTIONS: Record<Act, ActionFn> = {
  idle, walk_to: walk, run_to: run, sit, stand_up: standUp, talk, point, wave,
  hug, jump, fall, cry, laugh, facepalm, shocked,
};

/** Cross-fade time between consecutive actions, seconds. */
export const BLEND = 0.2;
/** walk_to/run_to toward a character stops this far from them. */
const STOP_SHORT = 1.5;

/** Actions layered (upper body only) over a held seated/lying pose instead of standing. */
const LAYERED = new Set<Act>(['idle', 'talk', 'point', 'wave', 'hug', 'cry', 'laugh', 'facepalm', 'shocked']);
const UPPER: JointName[] = ['Waist', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftElbow', 'RightElbow', 'LeftWrist', 'RightWrist'];
/** Posture each action leaves the character in; unlisted actions keep the current one. */
const LEAVES: Partial<Record<Act, Posture>> = { sit: 'sit', fall: 'lie', stand_up: 'stand', walk_to: 'stand', run_to: 'stand', jump: 'stand' };

/** Base seated/lying pose (root, legs) with the action's upper-body joints on top. Lying keeps its yaw. */
const held = (fn: ActionFn, posture: Posture): ActionFn => (u, t, ctx) => {
  const base = posture === 'sit' ? seated(ctx, 1) : lying(ctx, 1);
  const top = fn(u, t, ctx);
  for (const j of UPPER) if (top.joints[j]) base.joints[j] = top.joints[j];
  if (posture === 'sit') base.root.yaw = top.root.yaw;
  return base;
};
const fnFor = (act: Act, posture: Posture) => (posture !== 'stand' && LAYERED.has(act) ? held(ACTIONS[act], posture) : ACTIONS[act]);

type Seg = { fn: ActionFn; start: number; end: number; ctx: ActionCtx };

const evalSeg = (s: Seg, t: number) =>
  s.fn(Number.isFinite(s.end) && s.end > s.start ? clamp01((t - s.start) / (s.end - s.start)) : 1, t, s.ctx);

const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
const lerpYaw = (a: number, b: number, w: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * w;
};

function mix(a: ActionPose, b: ActionPose, w: number): ActionPose {
  const joints: ActionPose['joints'] = {};
  for (const j of new Set([...Object.keys(a.joints), ...Object.keys(b.joints)]) as Set<JointName>) {
    const ja = a.joints[j] ?? [0, 0, 0], jb = b.joints[j] ?? [0, 0, 0];
    joints[j] = [lerp(ja[0], jb[0], w), lerp(ja[1], jb[1], w), lerp(ja[2], jb[2], w)];
  }
  const pos = a.root.pos.map((v, i) => lerp(v, b.root.pos[i], w)) as Vec3;
  return { root: { pos, yaw: lerpYaw(a.root.yaw, b.root.yaw, w) }, joints };
}

function ctxFor(
  a: TimedAction, who: string, from: Vec3, fromYaw: number, seed: number,
  marks: Record<string, Vec3>, others?: (who: string, t: number) => Vec3,
): ActionCtx {
  const mark = a.at === undefined ? undefined : marks[a.at];
  const cast = mark || a.at === undefined || a.at === who ? undefined : others?.(a.at, a.start);
  const lookAt = mark ?? cast;
  let to: Vec3 | undefined;
  if (a.act === 'walk_to' || a.act === 'run_to') {
    to = mark ?? from;
    if (cast) {
      const dx = cast[0] - from[0], dz = cast[2] - from[2], d = Math.hypot(dx, dz);
      const k = d > STOP_SHORT ? (d - STOP_SHORT) / d : 0;
      to = [from[0] + dx * k, from[1], from[2] + dz * k];
    }
  }
  return { from, fromYaw, to, lookAt, seed };
}

/**
 * Pose of `who` at absolute time `t`, given only the beats of the current scene and the character's `home`
 * for that scene. Each action starts where the previous one of the same character ended; before the first
 * action the character idles at `home` facing -Z (yaw 0). Outside any action it idles where it last stopped.
 * Consecutive segments cross-fade over BLEND seconds. After sit/fall the character holds that posture
 * (idle and gestures layer on the upper body) until stand_up, walk_to, run_to or jump.
 * `others(id, t)` resolves another cast member's position when `at` names a character instead of a mark.
 */
export function poseAt(
  who: string, t: number, beats: TimedBeat[], marks: Record<string, Vec3>, home: Vec3, seed: number,
  others?: (who: string, t: number) => Vec3,
): ActionPose {
  const s = (seed ^ seedFromId(who)) >>> 0;
  const acts = beats.flatMap((b) => b.actions).filter((a) => a.who === who).sort((x, y) => x.start - y.start);
  let pos: Vec3 = home, yaw = 0, posture: Posture = 'stand';
  const idleFrom = (start: number): Seg => ({ fn: fnFor('idle', posture), start, end: Infinity, ctx: { from: pos, fromYaw: yaw, seed: s, posture } });
  const segs: Seg[] = [idleFrom(-Infinity)];
  const push = (seg: Seg) => {
    // A segment replaces any starting at the same instant or later (no zero-length idle between actions,
    // and an action overlapping the previous one cuts it off).
    while (segs.length > 1 && segs.at(-1)!.start >= seg.start) segs.pop();
    segs.push(seg);
  };
  for (const a of acts) {
    if (a.start > t) break;
    const ctx = { ...ctxFor(a, who, pos, yaw, s, marks, others), posture };
    const seg: Seg = { fn: fnFor(a.act, posture), start: a.start, end: a.end, ctx };
    push(seg);
    const end = seg.fn(1, a.end, seg.ctx).root;
    // Ground position, yaw and posture carry over; the held pose is rebuilt from the posture.
    // walk_to/run_to/jump from sit/lie stand up implicitly inside the BLEND cross-fade.
    pos = [end.pos[0], home[1], end.pos[2]];
    yaw = end.yaw;
    posture = LEAVES[a.act] ?? posture;
    if (a.end <= t) push(idleFrom(a.end));
  }
  const cur = segs.at(-1)!, prev = segs.at(-2);
  const pose = evalSeg(cur, t);
  const w = (t - cur.start) / BLEND;
  return prev && w < 1 ? mix(evalSeg(prev, t), pose, w) : pose;
}
