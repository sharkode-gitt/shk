import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, splitWords } from '../../src/story/text.ts';

test('stripTags', () => assert.equal(stripTags('[sad] On my  [whispers]10th birthday'), 'On my 10th birthday'));
test('splitWords keeps punctuation attached', () =>
  assert.deepEqual(splitWords("Mom said it's MY party!"), ['Mom', 'said', "it's", 'MY', 'party!']));
