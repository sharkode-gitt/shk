import { readFileSync } from 'node:fs';
import { spokenWords } from '../../src/write/markdown.ts';
import type { Story } from '../../src/types.ts';

/** A valid story inside the 110-150 word window: the e2e fixture with its first narration padded. */
export function validStory(title = 'My Sister Stole My Birthday', words = 125): Story {
  const s = JSON.parse(readFileSync(new URL('../../fixtures/e2e/story.json', import.meta.url), 'utf8')) as Story;
  s.title = title;
  const beat = s.scenes[0].beats[0];
  while (spokenWords(s) < words) beat.narrate += ' really';
  return s;
}
