import { mulberry32 } from './seed.ts';
import type { Mood, TimedBeat, Timeline } from '../types.ts';

export type MusicClip = { file: string; start: number; end: number; mood: Mood };
export type VolumePoint = { t: number; v: number };
export type MusicAutomation = { version: 1; lanes: [{ target: 'volume'; points: VolumePoint[] }] };
export type SfxEvent = { file: string; at: number; id: string };

const BASE = 0.35;
const DUCK = 0.12;
const LEAD = 0.1;
const RAMP = 0.15;
const MAX_POINTS = 512;

/** One clip per run of consecutive scenes with the same mood; moods without tracks get no clip. */
export function musicClips(timeline: Timeline, library: Record<Mood, string[]>, seed: number): MusicClip[] {
  const runs: { mood: Mood; start: number; end: number }[] = [];
  for (const s of timeline.scenes) {
    const last = runs[runs.length - 1];
    if (last && last.mood === s.music) last.end = s.end;
    else runs.push({ mood: s.music, start: s.start, end: s.end });
  }
  const rand = mulberry32(seed);
  const clips: MusicClip[] = [];
  for (const run of runs) {
    const r = rand(); // one draw per run, so later picks do not depend on empty moods
    const files = library[run.mood] ?? [];
    if (files.length) clips.push({ file: files[Math.floor(r * files.length)], ...run });
  }
  return clips;
}

type Win = { a: number; b: number };

const buildPoints = (wins: Win[], length: number): VolumePoint[] => {
  const pts: VolumePoint[] = wins[0] && wins[0].a <= 0 ? [{ t: 0, v: DUCK }] : [{ t: 0, v: BASE }];
  const push = (t: number, v: number) => {
    const last = pts[pts.length - 1];
    if (t < last.t) return;
    if (t === last.t) last.v = v;
    else pts.push({ t, v });
  };
  for (const { a, b } of wins) {
    if (a > 0) push(a, BASE);
    push(Math.max(a, 0) + RAMP, DUCK);
    push(b, DUCK);
    push(b + RAMP, BASE);
  }
  return pts.filter((p) => p.t <= length);
};

/** Music volume lane for a clip: BASE, ducking to DUCK under every line of dialogue or narration. */
export function musicAutomation(clip: MusicClip, beats: TimedBeat[]): MusicAutomation {
  const length = clip.end - clip.start;
  const raw: Win[] = beats
    .map((b) => {
      const a = b.audio.start - LEAD - clip.start;
      return { a, b: Math.max(b.audio.start + b.audio.duration + LEAD - clip.start, a + RAMP) };
    })
    .filter((w) => w.b > 0 && w.a < length)
    .sort((x, y) => x.a - y.a);

  let slack = RAMP;
  for (;;) {
    const wins: Win[] = [];
    for (const w of raw) {
      const last = wins[wins.length - 1];
      if (last && w.a < last.b + slack) last.b = Math.max(last.b, w.b);
      else wins.push({ ...w });
    }
    const points = buildPoints(wins, length);
    if (points.length <= MAX_POINTS || wins.length <= 1) return { version: 1, lanes: [{ target: 'volume', points }] };
    slack *= 2; // too many points: let nearby lines share one duck
  }
}

/**
 * `act:<name>` sounds fire at the action start, `cut` at the start of every scene but the first. A key may list several
 * takes; they are used in turn, so a repeated sound does not repeat the same file every time.
 */
export function sfxEvents(timeline: Timeline, map: Record<string, string | string[]>): SfxEvent[] {
  const out: SfxEvent[] = [];
  const used: Record<string, number> = {};
  const take = (key: string): string | undefined => {
    const v = map[key];
    const list = Array.isArray(v) ? v : v ? [v] : [];
    if (!list.length) return undefined;
    const n = used[key] ?? 0;
    used[key] = n + 1;
    return list[n % list.length];
  };
  for (const beat of timeline.beats) {
    beat.actions.forEach((a, i) => {
      const file = take(`act:${a.act}`);
      if (file) out.push({ file, at: a.start, id: `act:${beat.id}:${i}` });
    });
  }
  for (const s of timeline.scenes.slice(1)) {
    const file = take('cut');
    if (file) out.push({ file, at: s.start, id: `cut:${s.index}` });
  }
  return out.sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
}
