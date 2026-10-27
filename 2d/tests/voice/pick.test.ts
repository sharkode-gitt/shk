import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listVoices, pickVoices, saveVoices, type AccountVoice } from '../../src/voice/pick.ts';
import { VOICES } from '../../src/vocab.ts';

const v = (id: string, gender: string, age: string, name = id): AccountVoice => ({ id, name, gender, age, category: 'premade', description: '' });
const roster = [
  v('f_mid', 'female', 'middle_aged'), v('m_mid', 'male', 'middle_aged'), v('f_young', 'female', 'young'),
  v('m_young', 'male', 'young'), v('m_young2', 'male', 'young'), v('f_old', 'female', 'old'), v('f_mid2', 'female', 'middle_aged'),
];
const empty = Object.fromEntries(['emily', ...VOICES].map((k) => [k, '']));

test('listVoices reads labels from the API shape and normalises them', async () => {
  const body = { voices: [{ voice_id: 'abc', name: 'Rachel', category: 'premade', labels: { gender: 'Female', age: 'Middle-Aged' } }, { voice_id: 'def', name: 'No labels' }] };
  const got = await listVoices({ apiKey: 'k', fetch: (async () => new Response(JSON.stringify(body))) as typeof fetch });
  assert.deepEqual(got.map((x) => [x.id, x.gender, x.age]), [['abc', 'female', 'middle_aged'], ['def', '', '']]);
  await assert.rejects(listVoices({ apiKey: 'k', fetch: (async () => new Response('nope', { status: 401 })) as typeof fetch }), /HTTP 401/);
});

test('picks a fitting voice for each role and never reuses one', () => {
  const { picks, missing } = pickVoices(roster, empty);
  assert.deepEqual(missing, []);
  assert.equal(picks.mom.id, 'f_mid');
  assert.equal(picks.dad.id, 'm_mid');
  assert.equal(picks.teen_girl.id, 'f_young');
  assert.equal(picks.little_brother.id, 'm_young');
  assert.equal(picks.boy.id, 'm_young2');
  assert.equal(picks.teacher.id, 'f_mid2');
  assert.equal(picks.old_lady.id, 'f_old');
  assert.equal(new Set(Object.values(picks).map((p) => p.id)).size, 7);
});

test('roles that are already filled are kept, and their voices are not handed out again', () => {
  const { picks } = pickVoices(roster, { ...empty, emily: 'exsUS4vynmxd379XN4yO', mom: 'f_mid' });
  assert.ok(!('mom' in picks) && !('emily' in picks));
  assert.equal(picks.teacher.id, 'f_mid2'); // f_mid is taken by mom
});

test('with too few voices it relaxes the match, and reports roles it cannot fill', () => {
  const { picks, missing } = pickVoices([v('only_f', 'female', 'young')], empty);
  assert.equal(picks.mom.id, 'only_f'); // best effort: any female
  assert.ok(missing.includes('dad') && missing.includes('boy'));
});

test('saveVoices fills only the empty slots of voices.json', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'voices-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'voices.json'), JSON.stringify({ ...empty, emily: 'EMILY_ID', mom: 'KEEP_ME' }));
  saveVoices(dir, { mom: roster[0], dad: roster[1] });
  const saved = JSON.parse(readFileSync(join(dir, 'voices.json'), 'utf8'));
  assert.deepEqual([saved.emily, saved.mom, saved.dad], ['EMILY_ID', 'KEEP_ME', 'm_mid']);
});
