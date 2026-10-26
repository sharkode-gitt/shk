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
