import { ACTS, FACES, SETS } from '../vocab.ts';
import type { Act, Face, SetName, Story, Timing } from '../types.ts';

/** One scene of the gallery: a set and how many of the 16 beats it holds. */
const SCENES: { set: SetName; beats: number }[] = [
  { set: SETS[0], beats: 3 }, { set: SETS[1], beats: 2 }, { set: SETS[2], beats: 2 }, { set: SETS[3], beats: 2 },
  { set: SETS[4], beats: 2 }, { set: SETS[5], beats: 2 }, { set: SETS[6], beats: 3 },
];

/** Every act once, in an order that works (sit before stand_up, fall followed by a second stand_up). */
const ACT_ORDER: Act[] = [...ACTS.slice(0, 11), 'stand_up', ...ACTS.slice(11)];
const SHOTS = ['wide', 'medium', 'closeup:emily', 'over_shoulder:emily', 'two_shot:emily,mia', 'push_in:emily', 'orbit', 'shake'];
const SAY: Record<Act, string> = {
  idle: 'Idle: standing and breathing.', walk_to: 'Walk to the door.', run_to: 'Run to the middle.', sit: 'Sit down.',
  stand_up: 'Stand up again.', talk: 'Talk with the hands.', point: 'Point at Mia.', wave: 'Wave hello.', hug: 'Hug Mia.',
  jump: 'Jump for joy.', fall: 'Fall flat.', cry: 'Cry.', laugh: 'Laugh out loud.', facepalm: 'Facepalm.', shocked: 'Shocked!',
};
const AT: Partial<Record<Act, string>> = { walk_to: 'door', run_to: 'center', point: 'mia', hug: 'mia' };
const FACE_FOR: Partial<Record<Act, Face>> = { cry: 'crying', laugh: 'happy', shocked: 'shocked', facepalm: 'sad', point: 'angry', fall: 'scared' };

/**
 * QA video: Emily performs all 15 acts and shows all 8 faces, the camera runs through all 8 shot kinds and the
 * story passes through all 7 sets. It breaks the 3-set rule on purpose, so feed it to `compileTimeline`
 * directly (not `validateStory`). Narration describes what is on screen; timings are fixed.
 */
export function galleryStory(): { story: Story; timing: Timing } {
  const scenes: Story['scenes'] = [];
  const lines: Timing['lines'] = [];
  let i = 0;
  SCENES.forEach(({ set, beats }, si) => {
    const out: Story['scenes'][number]['beats'] = [];
    for (let bi = 0; bi < beats; bi++, i++) {
      const act = ACT_ORDER[i];
      const text = SAY[act];
      const face = FACE_FOR[act] ?? FACES[i % FACES.length];
      const at = AT[act];
      out.push({ narrate: text, shot: SHOTS[i % SHOTS.length], do: [{ who: 'emily', act, face, ...(at ? { at } : {}) }] });
      const words = text.split(/\s+/);
      lines.push({
        beatId: `${si}.${bi}`, file: `audio/${si}.${bi}.wav`, duration: Math.max(2, Math.round((words.length * 0.3 + 0.4) * 100) / 100),
        words: words.map((word, k) => ({ word, start: Math.round(k * 0.3 * 100) / 100, end: Math.round((k * 0.3 + 0.26) * 100) / 100 })),
      });
    }
    scenes.push({ set, time: si % 3 === 2 ? 'night' : si % 2 ? 'afternoon' : 'morning', music: 'happy', beats: out });
  });
  const story = {
    title: 'Emily Stories: QA gallery', music: 'happy',
    cast: [{ id: 'emily', ref: 'emily' }, { id: 'mia', name: 'Mia', voice: 'teen_girl', look: { skin: '#f2c79b', shirt: '#7b5cff', pants: '#2b2b2b', hair: 'long', hat: 'crown' } }],
    scenes, wants: [],
  } as unknown as Story;
  return { story, timing: { lines } };
}
