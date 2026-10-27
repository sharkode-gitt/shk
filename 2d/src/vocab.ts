// Single source of truth for the story vocabulary (spec §4). Schema, prompt and engine all import from here.
export const SETS = ['bedroom', 'living_room', 'kitchen', 'classroom', 'school_hallway', 'park', 'street'] as const;
export const TIMES = ['morning', 'afternoon', 'night'] as const;
export const ACTS = [
  'idle', 'walk_to', 'run_to', 'sit', 'stand_up', 'talk', 'point', 'wave',
  'hug', 'jump', 'fall', 'cry', 'laugh', 'facepalm', 'shocked',
] as const;
export const FACES = ['happy', 'sad', 'angry', 'shocked', 'smug', 'crying', 'scared', 'neutral'] as const;
export const HAIRS = ['short', 'long', 'pigtails', 'bun', 'spiky', 'bald'] as const;
export const HATS = [null, 'cap', 'crown', 'beanie', 'bow', 'glasses'] as const;
export const PROPS = ['cake', 'gift', 'phone', 'door', 'bed', 'table', 'chair', 'backpack', 'car', 'dog'] as const;
export const MUSIC = ['sad', 'tense', 'happy', 'funny', 'twist'] as const;
export const VOICES = ['mom', 'dad', 'teen_girl', 'little_brother', 'boy', 'teacher', 'old_lady'] as const;
export const SHOT_KINDS = ['wide', 'medium', 'closeup', 'over_shoulder', 'two_shot', 'push_in', 'orbit', 'shake'] as const;
