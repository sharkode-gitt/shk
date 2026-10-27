import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRoster } from '../../src/characters/roster.ts';
import { loadConfig } from '../../src/config.ts';
import { jobPath, listJobs, readStatus, setStatus } from '../../src/jobs/store.ts';
import { rejectStory, writeStory, type StoryClient } from '../../src/write/write.ts';
import { validStory } from './helpers.ts';

const setup = (t: test.TestContext) => {
  const root = mkdtempSync(join(tmpdir(), 'write-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, config: loadConfig(), roster: loadRoster('assets') };
};
/** A fake client that answers from a queue and records every prompt it sees. */
const fake = (answers: Awaited<ReturnType<StoryClient['generate']>>[]) => {
  const calls: { system: string; user: string }[] = [];
  const client: StoryClient = { async generate(system, user) { calls.push({ system, user }); return answers.shift() ?? { kind: 'ok', json: {} }; } };
  return { client, calls };
};

test('an invalid first answer is retried with the validation errors, and the second one is kept', async (t) => {
  const { root, config, roster } = setup(t);
  const { client, calls } = fake([{ kind: 'ok', json: { title: 'x' } }, { kind: 'ok', json: validStory('Good One') }]);
  const id = await writeStory({ client, root, config, roster }, { idea: 'a birthday' });
  assert.equal(calls.length, 2);
  assert.match(calls[1].user, /previous output failed validation/);
  assert.match(calls[1].user, /cast/);
  assert.equal(calls[0].system, calls[1].system);
  const s = readStatus(root, id);
  assert.deepEqual([s.state, s.title], ['drafted', 'Good One']);
  assert.ok(existsSync(jobPath(root, id, 'story.json')) && existsSync(jobPath(root, id, 'story.md')));
  assert.equal(readFileSync(jobPath(root, id, 'idea.txt'), 'utf8'), 'a birthday');
});

test('three invalid answers leave the job failed with the errors', async (t) => {
  const { root, config, roster } = setup(t);
  const { client, calls } = fake([{ kind: 'ok', json: {} }, { kind: 'ok', json: {} }, { kind: 'ok', json: {} }, { kind: 'ok', json: validStory() }]);
  const id = await writeStory({ client, root, config, roster }, {});
  assert.equal(calls.length, 3);
  const s = readStatus(root, id);
  assert.equal(s.state, 'failed');
  assert.match(s.error!, /3 attempts/);
});

test('a story outside the word window is treated as invalid', async (t) => {
  const { root, config, roster } = setup(t);
  const { client, calls } = fake([{ kind: 'ok', json: validStory('Too Long', 190) }, { kind: 'ok', json: validStory('Right', 130) }]);
  const id = await writeStory({ client, root, config, roster }, {});
  assert.match(calls[1].user, /spoken words; it must have 110 to 150/);
  assert.equal(readStatus(root, id).title, 'Right');
});

test('a refusal ends the job at once as failed, citing the category', async (t) => {
  const { root, config, roster } = setup(t);
  const { client, calls } = fake([{ kind: 'refusal', category: 'general_harms' }, { kind: 'ok', json: validStory() }]);
  const id = await writeStory({ client, root, config, roster }, {});
  assert.equal(calls.length, 1);
  const s = readStatus(root, id);
  assert.equal(s.state, 'failed');
  assert.match(s.error!, /general_harms/);
});

test('a thrown client error marks the job failed and rethrows', async (t) => {
  const { root, config, roster } = setup(t);
  const client: StoryClient = { async generate() { throw new Error('network down'); } };
  await assert.rejects(writeStory({ client, root, config, roster }, {}), /network down/);
  const [job] = listJobs(root);
  assert.equal(job.state, 'failed');
  assert.match(job.error!, /network down/);
});

test('later prompts include the titles of earlier jobs, rejected ones too', async (t) => {
  const { root, config, roster } = setup(t);
  const first = fake([{ kind: 'ok', json: validStory('First Story') }]);
  const id1 = await writeStory({ client: first.client, root, config, roster }, {});
  setStatus(root, id1, 'rejected', 'meh');
  const second = fake([{ kind: 'ok', json: validStory('Second Story') }]);
  await writeStory({ client: second.client, root, config, roster }, {});
  assert.match(second.calls[0].user, /- First Story/);
});

test('rejectStory marks the old job rejected and writes a new one that sees the note, the idea and the old draft', async (t) => {
  const { root, config, roster } = setup(t);
  const a = fake([{ kind: 'ok', json: validStory('Draft One') }]);
  const oldId = await writeStory({ client: a.client, root, config, roster }, { idea: 'the school play' });
  const b = fake([{ kind: 'ok', json: validStory('Draft Two') }]);
  const newId = await rejectStory({ client: b.client, root, config, roster }, oldId, 'too sad');
  assert.notEqual(newId, oldId);
  assert.deepEqual([readStatus(root, oldId).state, readStatus(root, newId).state], ['rejected', 'drafted']);
  assert.match(b.calls[0].user, /too sad/);
  assert.match(b.calls[0].user, /the school play/);
  assert.match(b.calls[0].user, /Draft One/);
});

test('rejecting a job that is already rendered throws and creates nothing', async (t) => {
  const { root, config, roster } = setup(t);
  const a = fake([{ kind: 'ok', json: validStory() }]);
  const id = await writeStory({ client: a.client, root, config, roster }, {});
  for (const s of ['approved', 'voiced', 'built', 'rendered'] as const) setStatus(root, id, s);
  const b = fake([]);
  await assert.rejects(rejectStory({ client: b.client, root, config, roster }, id, 'x'), /cannot go from rendered to rejected/);
  assert.equal(b.calls.length, 0);
  assert.equal(listJobs(root).length, 1);
});
