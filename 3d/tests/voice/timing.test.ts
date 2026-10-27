import test from 'node:test';
import assert from 'node:assert/strict';
import { wordsFromAlignment, type Alignment } from '../../src/voice/timing.ts';

/** Per-character timings at 0.1 s per character, from the text itself. */
const align = (text: string): Alignment => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => Math.round(i * 10) / 100),
  character_end_times_seconds: [...text].map((_, i) => Math.round((i + 1) * 10) / 100),
});

test('"Hi mom" gives two words with the first start and last end of their characters', () => {
  assert.deepEqual(wordsFromAlignment('Hi mom', align('Hi mom')), [
    { word: 'Hi', start: 0, end: 0.2 },
    { word: 'mom', start: 0.3, end: 0.6 },
  ]);
});

test('an emotion tag is dead time: no word contains "[" and the tag is not a word', () => {
  const words = wordsFromAlignment('[sad] Hi', align('[sad] Hi'));
  assert.deepEqual(words, [{ word: 'Hi', start: 0.6, end: 0.8 }]);
  for (const w of wordsFromAlignment('Oh [whispers] no [laughs]', align('Oh [whispers] no [laughs]'))) assert.ok(!/[\[\]]/.test(w.word), w.word);
});

test('punctuation stays attached; repeated spaces and a tag glued to a word do not create empty words', () => {
  const words = wordsFromAlignment('x', align("Wait,  it's [sad]over!"));
  assert.deepEqual(words.map((w) => w.word), ['Wait,', "it's", 'over!']);
});

test('empty alignment gives no words', () => {
  assert.deepEqual(wordsFromAlignment('', { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }), []);
});
