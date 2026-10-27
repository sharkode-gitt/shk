import test from 'node:test';
import assert from 'node:assert/strict';
import type { CharacterInfo } from '../../src/characters/roster.ts';
import { buildPrompt, RECENT_TITLES } from '../../src/write/prompt.ts';
import { ACTS, FACES, SETS, VOICES } from '../../src/vocab.ts';
import { validStory } from './helpers.ts';

const character = (id: string, name: string, personality: string): CharacterInfo => ({
  id, name, age: 12, personality, look: 'a look', color: '#ffd166',
  model: { obj: 'a.obj', mtl: 'a.mtl', atlas: 'a.png', face: { style: 'classic', rect: { x: 0, y: 0, w: 1, h: 1 }, skin: '#fff', flipX: false }, unflipped: [] },
});
const emily = character('emily', 'Emily', 'kind, a little shy');
const bacon = character('bacon', 'Bacon', 'cheerful and clumsy');
const roster = [emily, bacon];

test('the system prompt names every set, act, face and voice', () => {
  const { system } = buildPrompt({ roster, recentTitles: [] });
  for (const word of [...SETS, ...ACTS, ...FACES, ...VOICES]) assert.ok(system.includes(word), `missing ${word}`);
  assert.match(system, /110 to 150 words/);
  assert.match(system, /wants/);
  assert.match(system, /\[sad\]/);
});

test('the system prompt is identical across different ideas (so it can be cached)', () => {
  const a = buildPrompt({ roster, recentTitles: ['x'], idea: 'a lost phone' });
  const b = buildPrompt({ roster, recentTitles: ['y', 'z'], idea: 'a school play', rejectNote: 'too sad' });
  assert.equal(a.system, b.system);
  assert.notEqual(a.user, b.user);
});

test('the user prompt lists exactly the 30 most recent titles (31 passed, the oldest dropped)', () => {
  const titles = Array.from({ length: 31 }, (_, i) => `Title ${i + 1}`); // newest first
  const { user } = buildPrompt({ roster, recentTitles: titles });
  assert.equal(RECENT_TITLES, 30);
  assert.equal((user.match(/^- Title \d+$/gm) ?? []).length, 30);
  assert.ok(user.includes('- Title 30') && !user.includes('- Title 31'));
});

test('the idea is in the user prompt; without one the model is told to pick', () => {
  assert.match(buildPrompt({ roster, recentTitles: [], idea: "Emily's crush finds her diary" }).user, /crush finds her diary/);
  assert.match(buildPrompt({ roster, recentTitles: [] }).user, /Pick an original idea/);
});

test('a rejection note and the previous draft appear in the user prompt', () => {
  const previous = validStory('Old Draft');
  const { user } = buildPrompt({ roster, recentTitles: ['Old Draft'], rejectNote: 'too much crying', previous });
  assert.match(user, /too much crying/);
  assert.match(user, /Old Draft/);
  assert.match(user, /"scenes"/);
});

test('the system prompt describes every roster character and says how to cast them', () => {
  const { system } = buildPrompt({ roster, recentTitles: [] });
  assert.match(system, /id "emily": Emily, 12\. Personality: kind, a little shy/);
  assert.match(system, /id "bacon": Bacon, 12\. Personality: cheerful and clumsy/);
  assert.match(system, /\{ "id": "<id>", "ref": "<id>" \}/);
  assert.match(system, /"protagonist"/);
});

test('the roster order does not change the system prompt (cache stays warm)', () => {
  assert.equal(buildPrompt({ roster: [emily, bacon], recentTitles: [] }).system, buildPrompt({ roster: [bacon, emily], recentTitles: [] }).system);
});

test('a pinned character goes into the user prompt, not the system prompt', () => {
  const a = buildPrompt({ roster, recentTitles: [], character: 'bacon' });
  assert.match(a.user, /protagonist must be "bacon" \(Bacon\)/);
  assert.equal(a.system, buildPrompt({ roster, recentTitles: [] }).system);
});
