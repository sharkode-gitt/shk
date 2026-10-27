import { protagonistOf } from '../story/cast.ts';
import { parseBeatSpeaker, parseShot } from '../story/schema.ts';
import { stripTags } from '../story/text.ts';
import type { Act, Story, TimedAction, TimedBeat, TimedScene, Timeline, Timing } from '../types.ts';

export const BEAT_PAD = 0.15;
export const TAIL = 0.5;
/** Minimum seconds an action needs; acts not listed need 0. */
export const ACTION_MIN = { walk_to: 1.2, run_to: 0.8 } as const satisfies Partial<Record<Act, number>>;

const minOf = (act: Act): number => (ACTION_MIN as Partial<Record<Act, number>>)[act] ?? 0;

/**
 * Turns the story plus per-line audio timing into absolute times.
 * Each character's actions in a beat run back-to-back from the beat start (characters in parallel);
 * the last one absorbs the time left until the beat ends.
 */
export function compileTimeline(story: Story, timing: Timing): Timeline {
  const lines = new Map<string, Timing['lines'][number]>();
  for (const l of timing.lines) {
    if (lines.has(l.beatId)) throw new Error(`timing: duplicate line for beat ${l.beatId}`);
    lines.set(l.beatId, l);
  }
  const known = new Set(story.scenes.flatMap((s, si) => s.beats.map((_, bi) => `${si}.${bi}`)));
  for (const id of lines.keys()) if (!known.has(id)) throw new Error(`timing: line for beat ${id} which is not in the story`);

  const beats: TimedBeat[] = [];
  const scenes: TimedScene[] = [];
  let t = 0;
  story.scenes.forEach((scene, si) => {
    const sceneStart = t;
    scene.beats.forEach((beat, bi) => {
      const id = `${si}.${bi}`;
      const line = lines.get(id);
      if (!line) throw new Error(`timing: missing line for beat ${id}`);
      if (!(line.duration > 0) || !Number.isFinite(line.duration)) {
        throw new Error(`timing: beat ${id} has invalid duration ${line.duration}`);
      }

      const byWho = new Map<string, typeof beat.do>();
      for (const d of beat.do) byWho.set(d.who, [...(byWho.get(d.who) ?? []), d]);
      const need = Math.max(0, ...[...byWho.values()].map((ds) => ds.reduce((s, d) => s + minOf(d.act), 0)));
      const start = t;
      const end = start + Math.max(line.duration + BEAT_PAD, need);

      const timed = new Map<(typeof beat.do)[number], TimedAction>();
      for (const ds of byWho.values()) {
        let at = start;
        ds.forEach((d, i) => {
          const s = at;
          at = i === ds.length - 1 ? end : at + minOf(d.act);
          timed.set(d, { who: d.who, act: d.act, face: d.face, at: d.at, ...(d.item ? { item: d.item } : {}), start: s, end: at });
        });
      }

      beats.push({
        id, scene: si, start, end,
        speaker: parseBeatSpeaker(beat, protagonistOf(story)),
        kind: beat.say ? 'say' : 'narrate',
        text: stripTags(beat.say ? beat.say.line : beat.narrate!),
        audio: { file: line.file, start, duration: line.duration },
        words: line.words.map((w) => ({ word: w.word, start: w.start + start, end: w.end + start })),
        shot: parseShot(beat.shot),
        actions: beat.do.map((d) => timed.get(d)!),
      });
      t = end;
    });
    scenes.push({ index: si, set: scene.set, time: scene.time, music: scene.music ?? story.music, start: sceneStart, end: t });
  });

  return { duration: t + TAIL, fps: 30, scenes, beats };
}
