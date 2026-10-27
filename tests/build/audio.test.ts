import test from 'node:test';
import assert from 'node:assert/strict';
import { musicClips, musicAutomation, sfxEvents } from '../../src/build/audio.ts';
import type { Mood, TimedAction, TimedBeat, TimedScene, Timeline } from '../../src/types.ts';

const scene = (index: number, music: Mood, start: number, end: number): TimedScene =>
  ({ index, set: 'bedroom', time: 'morning', music, start, end });
const beat = (id: string, scn: number, audioStart: number, duration: number, actions: TimedAction[] = []): TimedBeat =>
  ({ id, scene: scn, start: audioStart, end: audioStart + duration + 0.15, speaker: 'emily', kind: 'say', text: 'x',
    audio: { file: `${id}.wav`, start: audioStart, duration }, words: [], shot: { kind: 'wide', targets: [] }, actions });
const tl = (scenes: TimedScene[], beats: TimedBeat[]): Timeline =>
  ({ duration: scenes[scenes.length - 1].end, fps: 30, scenes, beats });

const lib = { happy: ['h1.mp3', 'h2.mp3', 'h3.mp3'], tense: ['t1.mp3'] } as unknown as Record<Mood, string[]>;

test('consecutive scenes with the same music become one clip; a mood change makes two', () => {
  const same = musicClips(tl([scene(0, 'happy', 0, 5), scene(1, 'happy', 5, 9)], []), lib, 1);
  assert.deepEqual(same.map((c) => [c.mood, c.start, c.end]), [['happy', 0, 9]]);
  const diff = musicClips(tl([scene(0, 'happy', 0, 5), scene(1, 'tense', 5, 9)], []), lib, 1);
  assert.deepEqual(diff.map((c) => [c.mood, c.start, c.end]), [['happy', 0, 5], ['tense', 5, 9]]);
});

test('the same seed picks the same file; the pick comes from the library', () => {
  const t = tl([scene(0, 'happy', 0, 5)], []);
  assert.equal(musicClips(t, lib, 7)[0].file, musicClips(t, lib, 7)[0].file);
  const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => musicClips(t, lib, s)[0].file));
  assert.ok(picks.size > 1);
  for (const f of picks) assert.ok(lib.happy.includes(f));
});

test('an empty library for a mood yields no clip and no error', () => {
  const t = tl([scene(0, 'happy', 0, 5), scene(1, 'tense', 5, 9)], []);
  const clips = musicClips(t, { happy: [], tense: ['t1.mp3'] } as unknown as Record<Mood, string[]>, 1);
  assert.deepEqual(clips.map((c) => c.mood), ['tense']);
  assert.deepEqual(musicClips(t, {} as Record<Mood, string[]>, 1), []);
});

const clip = { file: 'h1.mp3', start: 10, end: 30, mood: 'happy' as Mood };
const pts = (b: TimedBeat[]) => musicAutomation(clip, b).lanes[0].points;
const at = (p: { t: number; v: number }[], t: number) => {
  let v = p[0].v;
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) { const a = p[i - 1]; return a.v + ((p[i].v - a.v) * (t - a.t)) / (p[i].t - a.t || 1); }
    v = p[i].v;
  }
  return v;
};

test('automation starts at t=0 with 0.35, ducks to 0.12 during speech, and recovers after a gap > 0.5 s', () => {
  const p = pts([beat('0.0', 0, 12, 2), beat('0.1', 0, 16, 2)]);
  assert.deepEqual(p[0], { t: 0, v: 0.35 });
  assert.equal(musicAutomation(clip, []).version, 1);
  assert.ok(Math.abs(at(p, 3) - 0.12) < 1e-9); // mid first line (abs 13)
  assert.ok(Math.abs(at(p, 4.5) - 0.35) < 1e-9); // gap between lines (abs 14.5)
  assert.ok(Math.abs(at(p, 7) - 0.12) < 1e-9); // mid second line (abs 17)
  assert.ok(Math.abs(at(p, 12) - 0.35) < 1e-9);
});

test('duck window is audio start - 0.1 .. end + 0.1 with 0.15 s ramps', () => {
  const p = pts([beat('0.0', 0, 12, 2)]);
  assert.ok(Math.abs(at(p, 1.9) - 0.35) < 1e-9); // window opens at t=1.9
  assert.ok(Math.abs(at(p, 1.975) - 0.235) < 1e-9); // halfway down the ramp
  assert.ok(Math.abs(at(p, 2.05) - 0.12) < 1e-9);
  assert.ok(Math.abs(at(p, 4.1) - 0.12) < 1e-9); // still ducked at end of line + 0.1
  assert.ok(Math.abs(at(p, 4.25) - 0.35) < 1e-9);
});

test('overlapping windows merge and times strictly increase', () => {
  const p = pts([beat('0.0', 0, 12, 2), beat('0.1', 0, 13.5, 2), beat('0.2', 0, 15.7, 1)]);
  for (let i = 1; i < p.length; i++) assert.ok(p[i].t > p[i - 1].t);
  assert.ok(Math.abs(at(p, 3.9) - 0.12) < 1e-9); // abs 13.9: inside the merged window
});

test('at most 512 points, even with many short lines', () => {
  const beats = Array.from({ length: 400 }, (_, i) => beat(`0.${i}`, 0, 11 + i * 0.05, 0.02));
  const p = musicAutomation({ ...clip, end: 10 + 400 * 0.05 }, beats).lanes[0].points;
  assert.ok(p.length <= 512);
  assert.deepEqual(p[0], { t: 0, v: 0.35 });
});

const act = (a: TimedAction['act'], start: number): TimedAction => ({ who: 'emily', act: a, start, end: start + 1 });

test('sfx: act events fire at the action start; ids are unique; cut once per scene change', () => {
  const t = tl(
    [scene(0, 'happy', 0, 4), scene(1, 'happy', 4, 8), scene(2, 'tense', 8, 12)],
    [beat('0.0', 0, 0.5, 1, [act('jump', 0.5), act('jump', 2)]), beat('1.0', 1, 4.5, 1, [act('fall', 5), act('idle', 5.5)])],
  );
  const ev = sfxEvents(t, { 'act:jump': 'boing.wav', 'act:fall': 'thud.wav', cut: 'whoosh.wav' });
  assert.deepEqual(ev.map((e) => [e.file, e.at]), [
    ['boing.wav', 0.5], ['boing.wav', 2], ['whoosh.wav', 4], ['thud.wav', 5], ['whoosh.wav', 8]]);
  assert.equal(new Set(ev.map((e) => e.id)).size, ev.length);
  assert.equal(ev.filter((e) => e.file === 'whoosh.wav').length, 2); // 3 scenes -> 2 cuts
});

test('sfx: acts without a map entry are skipped; no cut sound without a cut entry', () => {
  const t = tl([scene(0, 'happy', 0, 4), scene(1, 'happy', 4, 8)], [beat('0.0', 0, 0.5, 1, [act('idle', 0.5)])]);
  assert.deepEqual(sfxEvents(t, {}), []);
});

test('sfx: a key with several takes uses them in turn', () => {
  const t = tl([scene(0, 'happy', 0, 4), scene(1, 'happy', 4, 8), scene(2, 'happy', 8, 12), scene(3, 'happy', 12, 16)], []);
  const ev = sfxEvents(t, { cut: ['a.wav', 'b.wav'] });
  assert.deepEqual(ev.map((e) => e.file), ['a.wav', 'b.wav', 'a.wav']);
});
