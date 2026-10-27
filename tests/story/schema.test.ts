import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStory, parseShot, parseBeatSpeaker } from '../../src/story/schema.ts';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/story.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
const errorsOf = (s: unknown) => {
  const r = validateStory(s);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.errors;
};
const extra = (id: string) => ({ id, name: id, voice: 'boy', look: { shirt: '#fff', pants: '#000', hair: 'short', hat: null } });

test('fixture is valid', () => assert.equal(validateStory(fixture).ok, true));

test('beat with both narrate and say is rejected', () => {
  const s = clone();
  s.scenes[1].beats[0].narrate = 'both';
  const errors = errorsOf(s);
  assert.ok(errors.some((e) => e.includes('scenes[1].beats[0]') && e.includes('exactly one of narrate or say')), errors.join('\n'));
});

test('beat with neither narrate nor say is rejected', () => {
  const s = clone();
  delete s.scenes[0].beats[0].narrate;
  assert.ok(errorsOf(s).some((e) => e.includes('scenes[0].beats[0]') && e.includes('exactly one of narrate or say')));
});

test('cast without emily (ref:"hero") is rejected', () => {
  const s = clone();
  s.cast = s.cast.slice(1);
  s.scenes = [{ set: 'park', time: 'night', beats: [{ narrate: 'x', shot: 'wide', do: [] }] }];
  assert.ok(errorsOf(s).some((e) => e.includes('emily')));
});

test('5 cast members rejected; 1 rejected; 2 and 4 accepted', () => {
  const withCast = (n: number) => {
    const s = clone();
    const others = ['mia', 'mom', 'dad', 'bob'].slice(0, n - 1).map(extra);
    s.cast = [s.cast[0], ...others];
    s.scenes = [{ set: 'park', time: 'night', beats: [{ narrate: 'x', shot: 'wide', do: [] }] }];
    return s;
  };
  assert.equal(validateStory(withCast(1)).ok, false);
  assert.equal(validateStory(withCast(2)).ok, true);
  assert.equal(validateStory(withCast(4)).ok, true);
  const five = withCast(4);
  five.cast.push(extra('zed'));
  assert.equal(validateStory(five).ok, false);
});

test('cast member errors cite the field path', () => {
  const voice = clone();
  voice.cast[1].voice = 'alien';
  assert.ok(errorsOf(voice).some((e) => e.includes('cast[1].voice')));

  const hair = clone();
  hair.cast[1].look.hair = 'mohawk';
  assert.ok(errorsOf(hair).some((e) => e.includes('cast[1].look.hair')));

  const noLook = clone();
  delete noLook.cast[1].look;
  assert.ok(errorsOf(noLook).some((e) => e.includes('cast[1].look')));
});

test('hero entry rules', () => {
  const withLook = clone();
  withLook.cast[0].look = clone().cast[1].look;
  assert.ok(errorsOf(withLook).some((e) => e.includes('cast[0].look')));

  const wrongId = clone();
  wrongId.cast[0].id = 'mia2';
  assert.ok(errorsOf(wrongId).some((e) => e.includes('cast[0].id')));

  const reserved = clone();
  reserved.cast[1].id = 'emily';
  assert.ok(errorsOf(reserved).some((e) => e.includes('cast[1].id')));
});

test('duplicate cast ids rejected', () => {
  const s = clone();
  s.cast.push(extra('mia'));
  assert.ok(errorsOf(s).some((e) => e.includes('mia')));
});

test('4 distinct sets rejected', () => {
  const s = clone();
  const sets = ['bedroom', 'kitchen', 'park', 'street'];
  s.scenes = sets.map((set) => ({ set, time: 'night', beats: [{ narrate: 'x', shot: 'wide', do: [] }] }));
  assert.ok(errorsOf(s).some((e) => e.includes('sets')));
  s.scenes[3].set = 'bedroom';
  assert.equal(validateStory(s).ok, true);
});

test('unknown set "pool" rejected', () => {
  const s = clone();
  s.scenes[0].set = 'pool';
  assert.ok(errorsOf(s).some((e) => e.includes('scenes[0].set')));
});

test('do[].at and shot targets must be cast ids', () => {
  const s = clone();
  s.scenes[0].beats[1].shot = 'closeup:bob';
  const errors = errorsOf(s);
  assert.ok(errors.some((e) => e.includes('scenes[0].beats[1].shot') && e.includes('bob')), errors.join('\n'));

  const t = clone();
  t.scenes[0].beats[1].do[0].who = 'bob';
  assert.ok(errorsOf(t).some((e) => e.includes('scenes[0].beats[1].do[0].who') && e.includes('bob')));

  const u = clone();
  u.scenes[0].beats[1].do[0].at = 'Not A Mark';
  assert.ok(errorsOf(u).some((e) => e.includes('scenes[0].beats[1].do[0].at')));
});

test('shot arity and kind are checked', () => {
  for (const bad of ['closeup', 'wide:emily', 'two_shot:emily', 'two_shot:emily,emily', 'dolly']) {
    const s = clone();
    s.scenes[0].beats[0].shot = bad;
    assert.ok(errorsOf(s).some((e) => e.includes('scenes[0].beats[0].shot')), bad);
  }
});

test('say.who must be a cast id', () => {
  const s = clone();
  s.scenes[0].beats[1].say.who = 'bob';
  assert.ok(errorsOf(s).some((e) => e.includes('scenes[0].beats[1].say.who') && e.includes('bob')));
});

test('narrate is attributed to emily', () => {
  const r = validateStory(fixture);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(parseBeatSpeaker(r.story.scenes[0].beats[0]), 'emily');
  assert.equal(parseBeatSpeaker(r.story.scenes[0].beats[1]), 'mia');
});

test('parseShot', () => {
  assert.deepEqual(parseShot('two_shot:emily,mia'), { kind: 'two_shot', targets: ['emily', 'mia'] });
  assert.deepEqual(parseShot('closeup:mia'), { kind: 'closeup', targets: ['mia'] });
  assert.deepEqual(parseShot('orbit'), { kind: 'orbit', targets: [] });
});

test('non-object input yields errors, not a throw', () => {
  assert.equal(validateStory(null).ok, false);
});
