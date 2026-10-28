import test from 'node:test';
import assert from 'node:assert/strict';
import { captionChunks, captionColor } from '../../src/build/captions.ts';
import type { Story, TimedBeat, WordTiming } from '../../src/types.ts';

const mk = (words: string[], t0 = 1, speaker = 'mom', kind: 'narrate' | 'say' = 'say'): TimedBeat => {
  const w: WordTiming[] = words.map((word, i) => ({ word, start: t0 + i * 0.5, end: t0 + i * 0.5 + 0.4 }));
  return { id: '0.0', scene: 0, start: t0, end: t0 + words.length * 0.5, speaker, kind, text: words.join(' '),
    audio: { file: 'a.mp3', start: t0, duration: 1 }, words: w, shot: { kind: 'wide', targets: [] }, actions: [] } as TimedBeat;
};
const texts = (b: TimedBeat) => captionChunks([b]).map((c) => c.words.map((w) => w.word));

test('groups up to 4 words / 21 characters and keeps punctuation attached', () =>
  assert.deepEqual(texts(mk(['Mom', 'said', "it's", 'MY', 'party', 'now!'])), [['Mom', 'said', "it's", 'MY'], ['party', 'now!']]));

test('breaks after a comma', () =>
  assert.deepEqual(texts(mk(['Well,', 'I', 'think', 'so'])), [['Well,'], ['I', 'think', 'so']]));

test('emotion tags never reach a caption word', () => {
  const chunks = captionChunks([mk(['[sad]', 'I', 'miss[sad]', 'you', '[whispers]', 'so'])]);
  const words = chunks.flatMap((c) => c.words.map((w) => w.word));
  assert.deepEqual(words, ['I', 'miss', 'you', 'so']);
  assert.ok(words.every((w) => !w.includes('[') && !w.includes(']')));
});

test('chunks of a beat do not overlap; last ends 0.2s after last word', () => {
  const b = mk(['a', 'b', 'c', 'd', 'e']);
  const c = captionChunks([b]);
  assert.equal(c.length, 2);
  assert.equal(c[0].start, 1);
  assert.equal(c[0].end, c[1].start);
  assert.ok(Math.abs(c[1].end - (b.words[4].end + 0.2)) < 1e-9);
  assert.equal(c[0].speaker, 'mom');
  assert.equal(c[0].kind, 'say');
});

const story = { cast: [{ id: 'emily', ref: 'hero' }, { id: 'mom', look: { shirt: '#000000' } }, { id: 'dad', look: { shirt: '#336699' } }] } as unknown as Story;

test('captionColor: narration white, Emily pink, others lightened 35%, unknown white', () => {
  assert.equal(captionColor('emily', story), '#ff8fb1');
  assert.equal(captionColor('mom', story), '#595959');
  assert.equal(captionColor('nobody', story), '#ffffff');
});
test('captionColor: dad shirt #336699 mixed 35% toward white', () => {
  const m = (c: number) => Math.round(c + (255 - c) * 0.35).toString(16).padStart(2, '0');
  assert.equal(captionColor('dad', story), `#${m(0x33)}${m(0x66)}${m(0x99)}`);
});
test('captionColor: narration is white even though the narrator speaker id is emily', () =>
  assert.equal(captionColor('emily', story, 'narrate'), '#ffffff'));
