import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJob, jobPath, readStatus, setStatus } from '../src/jobs/store.ts';
import { makeApproved, makeJob, musicLibrary, sfxMap, type MakeDeps } from '../src/make.ts';
import { QuotaExceededError } from '../src/voice/eleven.ts';

const setup = (t: test.TestContext, state: 'approved' | 'voiced' | 'built' = 'approved', id = '2026-10-27-001') => {
  const dir = mkdtempSync(join(tmpdir(), 'make-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'jobs');
  add(root, id, state);
  return { root, dir };
};
const add = (root: string, id: string, state: 'approved' | 'voiced' | 'built') => {
  createJob(root, id);
  for (const s of ['approved', 'voiced', 'built'] as const) { setStatus(root, id, s); if (s === state) break; }
};
/** Fake stages that count their calls. `voice` mimics voiceJob by moving the job to voiced. */
const fakes = (over: Partial<MakeDeps> = {}) => {
  const calls = { voice: [] as string[], build: [] as string[], render: [] as string[] };
  const deps: MakeDeps = {
    voice: async (root, id) => { calls.voice.push(id); setStatus(root, id, 'voiced'); },
    build: async (root, id) => { calls.build.push(id); mkdirSync(jobPath(root, id, 'comp'), { recursive: true }); },
    render: async (_r, id) => { calls.render.push(id); return { checks: { ok: true, failures: [] }, renderSeconds: 12.5 }; },
    ...over,
  };
  return { deps, calls };
};

test('approved goes all the way to rendered, calling each stage once and logging the render time', async (t) => {
  const { root } = setup(t);
  const { deps, calls } = fakes();
  assert.equal(await makeJob(deps, root, '2026-10-27-001'), 'rendered');
  assert.deepEqual([calls.voice.length, calls.build.length, calls.render.length], [1, 1, 1]);
  assert.deepEqual(readStatus(root, '2026-10-27-001').history.map((h) => h.state), ['drafted', 'approved', 'voiced', 'built', 'rendered']);
  assert.match(readFileSync(jobPath(root, '2026-10-27-001', 'log.txt'), 'utf8'), /render: done in 12\.5 s; checks ok/);
});

test('make twice does nothing the second time', async (t) => {
  const { root } = setup(t);
  const { deps, calls } = fakes();
  await makeJob(deps, root, '2026-10-27-001');
  assert.equal(await makeJob(deps, root, '2026-10-27-001'), 'rendered');
  assert.deepEqual([calls.voice.length, calls.build.length, calls.render.length], [1, 1, 1]);
});

test('a job already built only renders (no voice, no build); one already voiced builds and renders', async (t) => {
  const a = setup(t, 'built');
  const fa = fakes();
  await makeJob(fa.deps, a.root, '2026-10-27-001');
  assert.deepEqual([fa.calls.voice.length, fa.calls.build.length, fa.calls.render.length], [0, 0, 1]);
  const b = setup(t, 'voiced');
  const fb = fakes();
  await makeJob(fb.deps, b.root, '2026-10-27-001');
  assert.deepEqual([fb.calls.voice.length, fb.calls.build.length, fb.calls.render.length], [0, 1, 1]);
});

test('failing output checks leave the job needs-review with the failures recorded', async (t) => {
  const { root } = setup(t);
  const { deps } = fakes({ render: async () => ({ checks: { ok: false, failures: ['duration is 19.0 s, expected 20-60 s'] }, renderSeconds: 5 }) });
  assert.equal(await makeJob(deps, root, '2026-10-27-001'), 'needs-review');
  assert.match(readStatus(root, '2026-10-27-001').error!, /duration is 19\.0 s/);
});

test('an exception in the build marks the job failed and keeps comp/ and the log', async (t) => {
  const { root } = setup(t);
  const { deps } = fakes({ build: async (r, id) => { mkdirSync(jobPath(r, id, 'comp'), { recursive: true }); throw new Error('esbuild exploded'); } });
  assert.equal(await makeJob(deps, root, '2026-10-27-001'), 'failed');
  assert.match(readStatus(root, '2026-10-27-001').error!, /esbuild exploded/);
  assert.ok(existsSync(jobPath(root, '2026-10-27-001', 'comp')));
  assert.match(readFileSync(jobPath(root, '2026-10-27-001', 'log.txt'), 'utf8'), /failed: esbuild exploded/);
});

test('a draft cannot be made', async (t) => {
  const { root } = setup(t);
  createJob(root, '2026-10-27-002');
  await assert.rejects(makeJob(fakes().deps, root, '2026-10-27-002'), /still a draft/);
});

test('out of credits is rethrown and the job stays approved, not failed', async (t) => {
  const { root } = setup(t);
  const { deps } = fakes({ voice: async () => { throw new QuotaExceededError(); } });
  await assert.rejects(makeJob(deps, root, '2026-10-27-001'), QuotaExceededError);
  assert.equal(readStatus(root, '2026-10-27-001').state, 'approved');
});

test('three approved jobs with credits ending on the second: the first is rendered, the other two stay approved', async (t) => {
  const { root } = setup(t, 'approved', '2026-10-27-001');
  add(root, '2026-10-27-002', 'approved');
  add(root, '2026-10-27-003', 'approved');
  let n = 0;
  const { deps } = fakes({ voice: async (r, id) => { if (++n === 2) throw new QuotaExceededError(); setStatus(r, id, 'voiced'); } });
  const out = await makeApproved(deps, root);
  assert.equal(out.quotaExceeded, true);
  assert.deepEqual(out.results, [{ id: '2026-10-27-001', state: 'rendered' }]);
  assert.deepEqual(['001', '002', '003'].map((s) => readStatus(root, `2026-10-27-${s}`).state), ['rendered', 'approved', 'approved']);
});

test('makeApproved goes oldest first, picks up half-finished jobs, and skips drafts, rendered and failed ones', async (t) => {
  const { root } = setup(t, 'built', '2026-10-27-002');
  add(root, '2026-10-27-001', 'approved');
  createJob(root, '2026-10-27-003'); // draft
  const { deps, calls } = fakes();
  const out = await makeApproved(deps, root);
  assert.deepEqual(out.results.map((r) => r.id), ['2026-10-27-001', '2026-10-27-002']);
  assert.deepEqual(calls.render, ['2026-10-27-001', '2026-10-27-002']);
  assert.equal(out.quotaExceeded, false);
  assert.equal((await makeApproved(deps, root)).results.length, 0);
});

test('musicLibrary lists tracks per mood and tolerates missing folders; sfxMap resolves names and tolerates no file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(musicLibrary(dir).happy, []);
  assert.deepEqual(sfxMap(dir), {});
  mkdirSync(join(dir, 'music', 'happy'), { recursive: true });
  writeFileSync(join(dir, 'music', 'happy', 'b.mp3'), '');
  writeFileSync(join(dir, 'music', 'happy', 'a.mp3'), '');
  writeFileSync(join(dir, 'music', 'happy', 'notes.txt'), '');
  assert.deepEqual(musicLibrary(dir).happy.map((f) => f.split(/[\\/]/).pop()), ['a.mp3', 'b.mp3']);
  mkdirSync(join(dir, 'sfx'), { recursive: true });
  writeFileSync(join(dir, 'sfx', 'map.json'), JSON.stringify({ cut: 'whoosh.mp3' }));
  assert.match(String(sfxMap(dir).cut), /sfx[\\/]whoosh\.mp3$/);
});
