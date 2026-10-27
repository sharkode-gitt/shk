import * as THREE from 'three';
import type { Face, Pose, Story, TimedBeat, Timeline, Vec3 } from '../types.ts';
import { poseAt } from './actions/index.ts';
import { cameraAt, type Cam } from './camera.ts';
import { buildBlockCharacter } from './characters/block.ts';
import { applyPose, type Rig } from './rig.ts';
import type { BuiltSet } from './sets/index.ts';

export type ScenePayload = { story: Story; timeline: Timeline; seed: number };
export type SetLayout = Record<number, BuiltSet>;
export type SceneState = { sceneIndex: number; poses: Record<string, Pose>; camera: Cam };

const FPS = 30;
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

/** Only `say` beats move the speaker's mouth; narration is voice-over. */
function mouthOf(who: string, t: number, beat: TimedBeat): 0 | 1 | 2 {
  if (beat.kind !== 'say' || who !== beat.speaker) return 0;
  const w = beat.words.find((w) => w.start <= t && t < w.end);
  if (!w) return 0;
  return Math.floor((t - w.start) / MOUTH_STEP) % 2 === 0 ? 1 : 2;
}

/** Everything the renderer needs at time `t`; pure apart from the cached reference rig. */
export function sceneState(time: number, payload: ScenePayload, layout: SetLayout): SceneState {
  const { story, timeline, seed } = payload;
  const frame = Math.round(time * FPS);
  const t = frame / FPS; // snapped, so the active beat never starts after t
  const scene = lastStarted(timeline.scenes, frame);
  const set = layout[scene.index];
  const beats = timeline.beats.filter((b) => b.scene === scene.index);
  const beat = lastStarted(beats, frame);
  const ids = story.cast.map((c) => c.id);
  const homes = Object.fromEntries(ids.map((id, i) => [id, homeOf(set, i)]));

  // Position-only lookup of another character (their own `at` targets stay unresolved) so two characters
  // targeting each other cannot recurse forever.
  const others = (id: string, tt: number): Vec3 =>
    homes[id] ? poseAt(id, tt, beats, set.marks, homes[id], seed).root.pos : set.marks.center ?? [0, 0, 0];

  const poses: Record<string, Pose> = {};
  const heads: Record<string, Vec3> = {};
  const yaws: Record<string, number> = {};
  for (const id of ids) {
    const p = poseAt(id, t, beats, set.marks, homes[id], seed, others);
    poses[id] = { ...p, face: faceOf(id, t, timeline.beats), mouth: mouthOf(id, t, beat) };
    heads[id] = headOf(poses[id]);
    yaws[id] = p.root.yaw;
  }

  const dur = beat.end - beat.start;
  const tIn = t - beat.start;
  const u = Math.min(1, Math.max(0, dur > 0 ? tIn / dur : 1));
  const camera = cameraAt(beat.shot, u, dur, tIn, heads, set, seed, beat.speaker, yaws);
  return { sceneIndex: scene.index, poses, camera };
}
