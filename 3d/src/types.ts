import type { z } from 'zod';
import type { StorySchema } from './story/schema.ts';
import type { SETS, TIMES, ACTS, FACES, PROPS, MUSIC, SHOT_KINDS } from './vocab.ts';

export type Story = z.infer<typeof StorySchema>;
// The hero cast entry has no look, so it is optional on the cast type.
export type Look = NonNullable<Story['cast'][number]['look']>;
export type Shot = { kind: ShotKind; targets: string[] };

export type SetName = (typeof SETS)[number];
export type TimeOfDay = (typeof TIMES)[number];
export type Act = (typeof ACTS)[number];
export type Face = (typeof FACES)[number];
export type Prop = (typeof PROPS)[number];
export type Mood = (typeof MUSIC)[number];
export type ShotKind = (typeof SHOT_KINDS)[number];

// Keys of reference/hero-rig.json -> joints / parts.
export type JointName =
  | 'Root' | 'Waist' | 'Neck'
  | 'LeftShoulder' | 'RightShoulder' | 'LeftElbow' | 'RightElbow' | 'LeftWrist' | 'RightWrist'
  | 'LeftHip' | 'RightHip' | 'LeftKnee' | 'RightKnee' | 'LeftAnkle' | 'RightAnkle';
export type PartName =
  | 'Head' | 'UpperTorso' | 'LowerTorso'
  | 'LeftUpperArm' | 'RightUpperArm' | 'LeftLowerArm' | 'RightLowerArm' | 'LeftHand' | 'RightHand'
  | 'LeftUpperLeg' | 'RightUpperLeg' | 'LeftLowerLeg' | 'RightLowerLeg' | 'LeftFoot' | 'RightFoot';

export type Vec3 = [number, number, number];
/** Joint rotations are euler XYZ radians; yaw rotates around +Y. */
export type Pose = {
  root: { pos: Vec3; yaw: number };
  joints: Partial<Record<JointName, Vec3>>;
  face: Face;
  mouth: 0 | 1 | 2;
};

// --- Timeline (seconds) ---
export type WordTiming = { word: string; start: number; end: number };
/** `words` are relative to the start of the audio file. */
export type LineTiming = { beatId: string; file: string; duration: number; words: WordTiming[] };
/** `beatId` is `${scene}.${beat}`, both 0-based. */
export type Timing = { lines: LineTiming[] };
export type TimedAction = { who: string; act: Act; face?: Face; at?: string; item?: Prop | 'none'; start: number; end: number };
export type TimedBeat = {
  id: string; scene: number; start: number; end: number; speaker: string; kind: 'narrate' | 'say';
  text: string; audio: { file: string; start: number; duration: number };
  words: WordTiming[]; // absolute
  shot: Shot; actions: TimedAction[];
};
export type TimedScene = { index: number; set: SetName; time: TimeOfDay; music: Mood; start: number; end: number; /** Cast ids on screen (absent = everyone). */ cast?: string[]; /** Start marks by cast id. */ starts?: Record<string, string> };
export type Timeline = { duration: number; fps: 30; scenes: TimedScene[]; beats: TimedBeat[] };
