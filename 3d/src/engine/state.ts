import * as THREE from 'three';
import type { CharacterInfo } from '../characters/roster.ts';
import type { Face, Pose, Prop, Story, TimedBeat, Timeline, Vec3 } from '../types.ts';
import { poseAt } from './actions/index.ts';
import { lerpAngle, yawToward } from './actions/util.ts';
import { cameraAt, type Cam } from './camera.ts';
import { buildBlockCharacter } from './characters/block.ts';
import { applyPose, type Rig } from './rig.ts';
import type { BuiltSet } from './sets/index.ts';

export type ScenePayload = { story: Story; timeline: Timeline; seed: number; roster: Record<string, CharacterInfo> };
export type SetLayout = Record<number, BuiltSet>;
export type SceneState = { sceneIndex: number; poses: Record<string, Pose>; camera: Cam; items: Record<string, Prop | null>; heads: Record<string, Vec3>; yaws: Record<string, number>; beatStart: number; beatEnd: number };

const FPS = 30;
/** Characters never come closer than this (studs, on the floor); the one that is walking steers around the one standing. */
const PERSONAL_SPACE = 3;
/** Seconds to turn toward (and away from) the person they are talking with. */
const TURN = 0.35;
/** Mouth flips between half and fully open this often inside a word, seconds. */
const MOUTH_STEP = 0.09;

/**
 * Scenes and beats switch on the first frame at or after their start (`ceil(start*30)`), so the set
 * shown and the camera's beat always change on the same frame.
 */
const startFrame = (start: number) => Math.ceil(start * FPS);
const lastStarted = <T extends { start: number }>(xs: T[], frame: number): T =>
  xs.filter((x) => startFrame(x.start) <= frame).at(-1) ?? xs[0];

/** Where cast member `i` stands at the start of a scene; extra cast line up 1.5 studs right of the last home. */
export function homeOf(set: BuiltSet, i: number): Vec3 {
  const last = set.homes.length - 1;
  if (i <= last) return set.homes[i];
  const h = set.homes[last];
  return [h[0] + 1.5 * (i - last), h[1], h[2]];
}

let refRig: Rig | undefined;
/** Head centre of a block rig with Emily's proportions in `pose`. */
function headOf(pose: Pose): Vec3 {
  refRig ??= buildBlockCharacter({ shirt: '#ffffff', pants: '#ffffff', hair: 'bald', hat: null });
  applyPose(refRig, pose);
  refRig.root.updateMatrixWorld(true);
  return refRig.parts.Head.getWorldPosition(new THREE.Vector3()).toArray() as Vec3;
}

/** Face of the latest action of `who` started by `t` that sets one (any scene), else neutral. */
function faceOf(who: string, t: number, beats: TimedBeat[]): Face {
  let face: Face = 'neutral', start = -Infinity;
  for (const b of beats) for (const a of b.actions) {
    if (a.who === who && a.face && a.start <= t && a.start >= start) ({ face, start } = a);
  }
  return face;
}

/** Prop `who` holds at `t`: the latest action started by `t` that sets an item (any scene); `none` empties the hand. */
export function itemOf(who: string, t: number, beats: TimedBeat[]): Prop | null {
  let item: Prop | null = null, start = -Infinity;
  for (const b of beats) for (const a of b.actions) {
    if (a.who === who && a.item !== undefined && a.start <= t && a.start >= start) ({ start } = a), (item = a.item === 'none' ? null : a.item);
  }
  return item;
}

/** Only `say` beats move the speaker's mouth; narration is voice-over. */
function mouthOf(who: string, t: number, beat: TimedBeat): 0 | 1 | 2 {
  if (beat.kind !== 'say' || who !== beat.speaker) return 0;
  const w = beat.words.find((w) => w.start <= t && t < w.end);
  if (!w) return 0;
  return Math.floor((t - w.start) / MOUTH_STEP) % 2 === 0 ? 1 : 2;
}

/**
 * Keeps every pair at least PERSONAL_SPACE apart. The walker gives way (sideways, so it curves around the other one
 * instead of stopping at it); two characters that both stand or both walk share the push. Smooth: the push is zero at
 * the moment of contact and grows with the overlap. Skipped while someone hugs.
 */
function separate(ids: string[], poses: Record<string, Pose>, moving: (id: string) => boolean, enabled: boolean): void {
  if (!enabled) return;
  const mv = Object.fromEntries(ids.map((id) => [id, moving(id)]));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const A = poses[ids[i]].root.pos, B = poses[ids[j]].root.pos;
      const dx = A[0] - B[0], dz = A[2] - B[2], d = Math.hypot(dx, dz);
      if (d >= PERSONAL_SPACE) continue;
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      const push = PERSONAL_SPACE - d;
      const wa = mv[ids[i]] === mv[ids[j]] ? 0.5 : mv[ids[i]] ? 1 : 0;
      // Mostly sideways (perpendicular to the line between them), a little straight apart.
      const sx = -nz, sz = nx;
      const mix = (w: number, sign: number): [number, number] => [w * push * (0.35 * nx + 0.65 * sx) * sign, w * push * (0.35 * nz + 0.65 * sz) * sign];
      const [ax, az] = mix(wa, 1), [bx, bz] = mix(1 - wa, -1);
      A[0] += ax; A[2] += az; B[0] += bx; B[2] += bz;
    }
  }
}

/**
 * While a character speaks, they and the one they are speaking to (the nearest other character) turn to face each
 * other, easing in and out over TURN seconds so the turn is never a snap. Characters that are walking keep their yaw.
 */
function faceEachOther(ids: string[], poses: Record<string, Pose>, beats: TimedBeat[], t: number, moving: (id: string) => boolean, others: (id: string, t: number) => Vec3): void {
  const talks = beats.filter((b) => b.kind === 'say' && ids.includes(b.speaker)).map((b) => {
    const from = others(b.speaker, b.start);
    const near = ids.filter((x) => x !== b.speaker).sort((x, y) => Math.hypot(...[0, 2].map((k) => others(x, b.start)[k] - from[k])) - Math.hypot(...[0, 2].map((k) => others(y, b.start)[k] - from[k])))[0];
    return { ...b, near };
  });
  const base = Object.fromEntries(ids.map((id) => [id, poses[id].root.yaw]));
  const pos = Object.fromEntries(ids.map((id) => [id, [...poses[id].root.pos] as Vec3]));
  for (const id of ids) {
    if (moving(id)) continue;
    const mine = talks.filter((b) => b.speaker === id || b.near === id).sort((a, b) => a.start - b.start);
    // Merge back-to-back lines into one stretch, so there is no turn away between them.
    const runs: { start: number; end: number; with: { start: number; end: number; partner: string }[] }[] = [];
    for (const b of mine) {
      const partner = b.speaker === id ? b.near : b.speaker;
      const last = runs.at(-1);
      if (last && b.start - last.end < 0.1) { last.end = Math.max(last.end, b.end); last.with.push({ start: b.start, end: b.end, partner }); }
      else runs.push({ start: b.start, end: b.end, with: [{ start: b.start, end: b.end, partner }] });
    }
    const run = runs.find((r) => t >= r.start - 1e-6 && t <= r.end + 1e-6);
    if (!run) continue;
    const x = Math.min(1, Math.max(0, Math.min(t - run.start, run.end - t) / TURN));
    const w = 0.85 * x * x * (3 - 2 * x); // 85%: face to face but still a little toward the camera, so faces stay visible
    const partner = (run.with.find((p) => t >= p.start && t <= p.end) ?? run.with.at(-1)!).partner;
    poses[id].root.yaw = lerpAngle(base[id], yawToward(pos[id], pos[partner], base[id]), w);
  }
}

/**
 * Everything the renderer needs at time `t`; pure apart from the cached reference rig. The camera's side of a face-on shot
 * is locked to where everybody stood when the beat started, so it never flips while a character moves.
 */
export function sceneState(time: number, payload: ScenePayload, layout: SetLayout): SceneState {
  const first = compute(time, payload, layout);
  // Who stands where and which way they face once the beat has settled (turns last 0.35 s): the shot is framed from that.
  const settled = compute(Math.max(first.beatStart, Math.min(first.beatEnd - 1 / FPS, first.beatStart + 0.5)), payload, layout);
  return compute(time, payload, layout, { heads: settled.heads, yaws: settled.yaws });
}

function compute(time: number, payload: ScenePayload, layout: SetLayout, lock?: { heads: Record<string, Vec3>; yaws: Record<string, number> }): SceneState {
  const { story, timeline, seed } = payload;
  const frame = Math.round(time * FPS);
  const t = frame / FPS; // snapped, so the active beat never starts after t
  const scene = lastStarted(timeline.scenes, frame);
  const set = layout[scene.index];
  const beats = timeline.beats.filter((b) => b.scene === scene.index);
  const beat = lastStarted(beats, frame);
  const ids = scene.cast ?? story.cast.map((c) => c.id);
  // One or two characters stand close together in the middle (the first on the left of the screen, x > 0).
  const mid = set.homes.length >= 3 ? [(set.homes[1][0] + set.homes[2][0]) / 2, set.homes[1][1], set.homes[1][2]] as Vec3 : set.homes[0];
  const homes = Object.fromEntries(ids.map((id, i) => [id, scene.starts?.[id] && set.marks[scene.starts[id]] ? set.marks[scene.starts[id]] : ids.length === 2 ? [mid[0] + (i === 0 ? 2.2 : -2.2), mid[1], mid[2]] as Vec3 : ids.length === 1 ? mid : homeOf(set, i)]));

  // Position-only lookup of another character (their own `at` targets stay unresolved) so two characters
  // targeting each other cannot recurse forever.
  const others = (id: string, tt: number): Vec3 =>
    homes[id] ? poseAt(id, tt, beats, set.marks, homes[id], seed).root.pos : set.marks.center ?? [0, 0, 0];

  const poses: Record<string, Pose> = {};
  const items: Record<string, Prop | null> = {};
  const heads: Record<string, Vec3> = {};
  const yaws: Record<string, number> = {};
  for (const id of ids) {
    const p = poseAt(id, t, beats, set.marks, homes[id], seed, others);
    poses[id] = { ...p, face: faceOf(id, t, timeline.beats), mouth: mouthOf(id, t, beat) };
    items[id] = itemOf(id, t, timeline.beats);
  }

  const moving = (id: string) => {
    const a = poseAt(id, t - 1 / FPS, beats, set.marks, homes[id], seed, others).root.pos, b = poseAt(id, t + 1 / FPS, beats, set.marks, homes[id], seed, others).root.pos;
    return Math.hypot(b[0] - a[0], b[2] - a[2]) > 1e-4;
  };
  // A character holding something keeps that arm down while standing (a gesture would swing the prop into their face).
  for (const id of ids) {
    if (items[id] && !moving(id)) poses[id].joints = { ...poses[id].joints, RightShoulder: [0.08, 0, 0.1], RightElbow: [0.22, 0, 0] };
  }
  // The one being talked to nods now and then while the other speaks (standing still, not gesturing).
  if (beat.kind === 'say') {
    for (const id of ids) {
      if (id === beat.speaker || moving(id)) continue;
      const nod = Math.max(0, Math.sin((2 * Math.PI * (t - beat.start)) / 1.9 + (seed % 7))) ** 3;
      const neck = poses[id].joints.Neck ?? [0, 0, 0];
      poses[id].joints = { ...poses[id].joints, Neck: [neck[0] + 0.11 * nod, neck[1], neck[2]] };
    }
  }
  const hugging = beat.actions.some((a) => a.act === 'hug');
  separate(ids, poses, moving, !hugging);
  if (!hugging) faceEachOther(ids, poses, beats, t, moving, others);
  for (const id of ids) { heads[id] = headOf(poses[id]); yaws[id] = poses[id].root.yaw; }

  const dur = beat.end - beat.start;
  const tIn = t - beat.start;
  const u = Math.min(1, Math.max(0, dur > 0 ? tIn / dur : 1));
  const camera = cameraAt(beat.shot, u, dur, tIn, heads, set, seed, beat.speaker, yaws, lock);
  // A shouted line hits with a quick punch-in: the lens starts 12% tighter and relaxes over a third of a second.
  if (beat.kind === 'say' && beat.words.some((w) => /!/.test(w.word)) && tIn < 0.35) { const k = tIn / 0.35; camera.fov *= 0.88 + 0.12 * (1 - (1 - k) ** 3); }
  return { sceneIndex: scene.index, poses, camera, items, heads, yaws, beatStart: startFrame(beat.start) / FPS, beatEnd: beat.end };
}
