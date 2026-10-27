import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSeconds, spokenWords, storyMarkdown } from '../../src/write/markdown.ts';
import { StorySchemaForModel } from '../../src/story/model-schema.ts';
import { validateStory } from '../../src/story/schema.ts';
import { z } from 'zod';
import { validStory } from './helpers.ts';

test('no emotion tag survives in the markdown', () => {
  const s = validStory();
  s.scenes[0].beats[0].narrate = '[sad] On my birthday, [whispers] everything broke ' + s.scenes[0].beats[0].narrate;
  const md = storyMarkdown(s, 40);
  assert.ok(!md.includes('['), md);
  assert.match(md, /\*\*Emily \(narration\):\*\* On my birthday, everything broke/);
  assert.match(md, /\*\*Mia:\*\*/);
});

test('the Wants section shows only when there is something in it', () => {
  const s = validStory();
  assert.ok(!storyMarkdown(s).includes('Wants'));
  s.wants = ['swimming pool'];
  const md = storyMarkdown(s);
  assert.match(md, /## ⚠ Wants/);
  assert.match(md, /- swimming pool/);
});

test('the estimated length comes from the word count at 2.7 words per second', () => {
  const s = validStory('T', 135);
  assert.equal(spokenWords(s), 135);
  assert.ok(Math.abs(estimateSeconds(s) - 50) < 1e-9);
  assert.match(storyMarkdown(s), /Estimated length: 50 s \(135 words\)/);
});

test('lists the scenes and numbers the lines', () => {
  const md = storyMarkdown(validStory());
  assert.match(md, /1\. bedroom, morning/);
  assert.match(md, /3\. park/);
  assert.match(md, /^1\. \*\*/m);
});

test('the schema given to the model has only constructs structured outputs can express, and accepts a valid story', () => {
  const json = JSON.stringify(z.toJSONSchema(StorySchemaForModel));
  for (const banned of ['"pattern"', '"minLength"', '"maxLength"', '"minItems"', '"maxItems"', '"minimum"', '"maximum"']) {
    assert.ok(!json.includes(banned), `schema contains ${banned}`);
  }
  const story = validStory();
  assert.ok(StorySchemaForModel.safeParse(story).success);
  assert.ok(validateStory(story).ok);
});
