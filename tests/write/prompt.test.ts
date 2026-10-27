import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, RECENT_TITLES, type Hero } from '../../src/write/prompt.ts';
import { ACTS, FACES, SETS, VOICES } from '../../src/vocab.ts';
import { validStory } from './helpers.ts';

const hero: Hero = { name: 'Emily', age: 12, personality: 'kind, a little shy', look: 'long black hair, gold crown' };

test('the system prompt names every set, act, face and voice', () => {
  const { system } = buildPrompt({ hero, recentTitles: [] });
  for (const word of [...SETS, ...ACTS, ...FACES, ...VOICES]) assert.ok(system.includes(word), `missing ${word}`);
  assert.match(system, /110 to 150 words/);
  assert.match(system, /wants/);
  assert.match(system, /\[sad\]/);
});

test('the system prompt is identical across different ideas (so it can be cached)', () => {
  const a = buildPrompt({ hero, recentTitles: ['x'], idea: 'a lost phone' });
  const b = buildPrompt({ hero, recentTitles: ['y', 'z'], idea: 'a school play', rejectNote: 'too sad' });
  assert.equal(a.system, b.system);
  assert.notEqual(a.user, b.user);
});

test('the user prompt lists exactly the 30 most recent titles (31 passed, the oldest dropped)', () => {
  const titles = Array.from({ length: 31 }, (_, i) => `Title ${i + 1}`); // newest first
  const { user } = buildPrompt({ hero, recentTitles: titles });
  assert.equal(RECENT_TITLES, 30);
  assert.equal((user.match(/^- Title \d+$/gm) ?? []).length, 30);
  assert.ok(user.includes('- Title 30') && !user.includes('- Title 31'));
});

test('the idea is in the user prompt; without one the model is told to pick', () => {
  assert.match(buildPrompt({ hero, recentTitles: [], idea: "Emily's crush finds her diary" }).user, /crush finds her diary/);
  assert.match(buildPrompt({ hero, recentTitles: [] }).user, /Pick an original idea/);
});

test('a rejection note and the previous draft appear in the user prompt', () => {
  const previous = validStory('Old Draft');
  const { user } = buildPrompt({ hero, recentTitles: ['Old Draft'], rejectNote: 'too much crying', previous });
  assert.match(user, /too much crying/);
  assert.match(user, /Old Draft/);
  assert.match(user, /"scenes"/);
});
