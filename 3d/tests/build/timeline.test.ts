import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileTimeline, BEAT_PAD, TAIL, ACTION_MIN } from '../../src/build/timeline.ts';
import type { Story, Timing } from '../../src/types.ts';

const load = (p: string) => JSON.parse(readFileSync(new URL(`../../fixtures/${p}`, import.meta.url), 'utf8'));
const story = (): Story => load('story.json');
const timing = (): Timing => load('timing.json');
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test('constants', () => {
  assert.equal(BEAT_PAD, 0.15);
  assert.equal(TAIL, 0.5);
  assert.deepEqual(ACTION_MIN, { walk_to: 1.2, run_to: 0.8 });
});

test('6 contiguous beats starting at 0, first ends at 2.4 + pad', () => {
  const t = compileTimeline(story(), timing());
  assert.equal(t.fps, 30);
  assert.equal(t.beats.length, 6);
  assert.equal(t.beats[0].start, 0);
  near(t.beats[0].end, 2.4 + BEAT_PAD);
  t.beats.slice(1).forEach((b, i) => assert.equal(b.start, t.beats[i].end));
  assert.deepEqual(t.beats.map((b) => b.id), ['0.0', '0.1', '0.2', '1.0', '1.1', '1.2']);
});

test('beat metadata: speaker, kind, stripped text, shot, audio', () => {
  const [b0, b1] = compileTimeline(story(), timing()).beats;
  assert.equal(b0.kind, 'narrate');
  assert.equal(b0.speaker, 'emily');
  assert.equal(b0.text, 'On my 10th birthday, my sister ruined everything.');
  assert.deepEqual(b0.shot, { kind: 'wide', targets: [] });
  assert.deepEqual(b0.audio, { file: 'audio/0.0.wav', start: 0, duration: 2.4 });
  assert.equal(b1.kind, 'say');
  assert.equal(b1.speaker, 'mia');
  assert.deepEqual(b1.shot, { kind: 'closeup', targets: ['mia'] });
  assert.equal(b1.audio.start, b1.start);
});

test('absolute words = relative + audio.start', () => {
  const tm = timing();
  const t = compileTimeline(story(), tm);
  const b = t.beats[2];
  const rel = tm.lines[2].words;
  assert.ok(b.start > 0 && rel.length > 1);
  assert.equal(b.words.length, rel.length);
  b.words.forEach((w, i) => {
    assert.equal(w.word, rel[i].word);
    near(w.start, rel[i].start + b.audio.start);
    near(w.end, rel[i].end + b.audio.start);
  });
});

test('a lone action spans the whole beat and copies face/at', () => {
  const b = compileTimeline(story(), timing()).beats[1];
  assert.deepEqual(b.actions, [{ who: 'mia', act: 'point', at: 'emily', face: 'smug', start: b.start, end: b.end }]);
});

test('short beat with walk_to ends at start + 1.2', () => {
  const tm = timing();
  tm.lines[3].duration = 0.6; // 1.0 = mom walk_to + emily sit
  const b = compileTimeline(story(), tm).beats[3];
  near(b.end, b.start + 1.2);
});

test('walk_to then sit by the same character run in sequence; others in parallel', () => {
  const s = story();
  s.scenes[1].beats[0].do = [
    { who: 'mom', act: 'walk_to', at: 'table' },
    { who: 'emily', act: 'idle' },
    { who: 'mom', act: 'sit', at: 'chair' },
  ];
  const b = compileTimeline(s, timing()).beats[3];
  const [walk, idle, sit] = b.actions;
  assert.equal(walk.start, b.start);
  near(walk.end, b.start + ACTION_MIN.walk_to);
  assert.equal(sit.start, walk.end);
  assert.equal(sit.end, b.end);
  assert.equal(idle.start, b.start);
  assert.equal(idle.end, b.end);
});

test('scene bounds and total duration', () => {
  const t = compileTimeline(story(), timing());
  assert.equal(t.scenes[0].start, 0);
  assert.equal(t.scenes[0].end, t.beats[2].end);
  assert.equal(t.scenes[1].start, t.beats[3].start);
  assert.equal(t.scenes[1].end, t.beats[5].end);
  assert.deepEqual(
    [t.scenes[1].index, t.scenes[1].set, t.scenes[1].time, t.scenes[1].music],
    [1, 'living_room', 'afternoon', 'tense'], // scene has no music -> story music
  );
  assert.equal(t.scenes[0].music, 'happy');
  near(t.duration, t.beats[5].end + TAIL);
});

test('missing timing line throws, citing the beatId', () => {
  const tm = timing();
  tm.lines.splice(4, 1);
  assert.throws(() => compileTimeline(story(), tm), /1\.1/);
});

test('duration <= 0 (or non-finite) throws, citing the beatId', () => {
  for (const d of [0, -1, NaN]) {
    const tm = timing();
    tm.lines[2].duration = d;
    assert.throws(() => compileTimeline(story(), tm), /0\.2/);
  }
});

test('timing line for a beat not in the story throws, citing the beatId', () => {
  const tm = timing();
  tm.lines.push({ ...tm.lines[0], beatId: '9.9' });
  assert.throws(() => compileTimeline(story(), tm), /9\.9/);
});

test('duplicate timing beatId throws', () => {
  const tm = timing();
  tm.lines.push({ ...tm.lines[0] });
  assert.throws(() => compileTimeline(story(), tm), /0\.0/);
});
