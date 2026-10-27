import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryStory } from '../../src/build/gallery.ts';
import { compileTimeline } from '../../src/build/timeline.ts';
import { parseShot } from '../../src/story/schema.ts';
import { ACTS, FACES, SETS, SHOT_KINDS } from '../../src/vocab.ts';

const { story, timing } = galleryStory();
const beats = story.scenes.flatMap((s) => s.beats);
const same = (got: Iterable<string | null>, want: readonly (string | null)[]) => assert.deepEqual([...new Set(got)].sort(), [...want].sort());

test('covers every act, face, shot kind and set', () => {
  same(beats.flatMap((b) => b.do.map((d) => d.act)), ACTS);
  same(beats.flatMap((b) => b.do.map((d) => d.face ?? null)).filter((f) => f), FACES);
  same(beats.map((b) => parseShot(b.shot).kind), SHOT_KINDS);
  same(story.scenes.map((s) => s.set), SETS);
});

test('compiles without validateStory and lands inside the 20-60 s window', () => {
  const t = compileTimeline(story, timing);
  assert.ok(t.duration >= 20 && t.duration <= 60, `duration ${t.duration}`);
  assert.equal(t.beats.length, beats.length);
  assert.equal(t.scenes.length, 7);
});

test('every beat has a narration line that names the action and a timing line', () => {
  assert.ok(beats.every((b) => typeof b.narrate === 'string' && b.narrate.length > 0));
  assert.equal(timing.lines.length, beats.length);
  assert.ok(timing.lines.every((l) => l.duration >= 2 && l.words.length > 0));
});

test('is deterministic', () => assert.deepEqual(galleryStory(), galleryStory()));
