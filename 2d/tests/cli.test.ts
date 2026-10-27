import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXIT, main, type CliDeps } from '../src/cli.ts';
import { loadConfig, requireEnv } from '../src/config.ts';
import { createJob, readStatus, setStatus } from '../src/jobs/store.ts';
import { QuotaExceededError } from '../src/voice/eleven.ts';
import type { StoryClient } from '../src/write/write.ts';
import { validStory } from './write/helpers.ts';

const setup = (t: test.TestContext, over: Partial<CliDeps> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = { ...loadConfig(), paths: { jobs: join(dir, 'jobs'), cache: join(dir, 'cache'), assets: 'assets' } };
  const out: string[] = [], err: string[] = [];
  let n = 0;
  const client: StoryClient = { async generate() { return { kind: 'ok', json: validStory(`Story ${++n}`) }; } };
  const deps: CliDeps = {
    config, out: (l) => out.push(l), err: (l) => err.push(l),
    requireEnv: () => 'key', storyClient: () => client,
    make: () => ({
      voice: async (root, id) => { setStatus(root, id, 'voiced'); },
      build: async () => {},
      render: async () => ({ checks: { ok: true, failures: [] }, renderSeconds: 1 }),
    }),
    gallery: async () => true, accountVoices: async () => [], ...over,
  };
  return { deps, out, err, root: config.paths.jobs };
};

test('new --count 2 creates two drafts and prints an id and a story.md path for each', async (t) => {
  const { deps, out, root } = setup(t);
  assert.equal(await main(['new', '--count', '2'], deps), EXIT.ok);
  assert.equal(out.length, 2);
  assert.match(out[0], /^\d{4}-\d{2}-\d{2}-001\t.*story\.md$/);
  assert.deepEqual([readStatus(root, out[0].split('\t')[0]).state, readStatus(root, out[1].split('\t')[0]).state], ['drafted', 'drafted']);
});

test('new passes the idea along, and a bad --count is an error', async (t) => {
  let seen = '';
  const client: StoryClient = { async generate(_s, user) { seen = user; return { kind: 'ok', json: validStory() }; } };
  const { deps, err } = setup(t, { storyClient: () => client });
  assert.equal(await main(['new', "Emily's crush finds her diary"], deps), EXIT.ok);
  assert.match(seen, /crush finds her diary/);
  assert.equal(await main(['new', '--count', 'zero'], deps), EXIT.error);
  assert.match(err.at(-1)!, /--count/);
});

test('a story the writer could not produce is reported and the exit code is 1', async (t) => {
  const client: StoryClient = { async generate() { return { kind: 'refusal', category: 'general_harms' }; } };
  const { deps, err } = setup(t, { storyClient: () => client });
  assert.equal(await main(['new'], deps), EXIT.error);
  assert.match(err[0], /failed.*general_harms/);
});

test('approve works on a draft; on a rendered job it exits 1 with a clear message', async (t) => {
  const { deps, out, err, root } = setup(t);
  createJob(root, '2026-10-27-001');
  assert.equal(await main(['approve', '2026-10-27-001'], deps), EXIT.ok);
  assert.equal(readStatus(root, '2026-10-27-001').state, 'approved');
  assert.match(out[0], /approved/);

  createJob(root, '2026-10-27-002');
  for (const s of ['approved', 'voiced', 'built', 'rendered'] as const) setStatus(root, '2026-10-27-002', s);
  assert.equal(await main(['approve', '2026-10-27-002'], deps), EXIT.error);
  assert.match(err[0], /cannot go from rendered to approved/);
  assert.equal(await main(['approve'], deps), EXIT.error);
  assert.match(err.at(-1)!, /usage: approve <id>/);
});

test('reject needs a note, marks the old job rejected and prints the new id', async (t) => {
  const { deps, out, err, root } = setup(t);
  await main(['new'], deps);
  const oldId = out[0].split('\t')[0];
  assert.equal(await main(['reject', oldId], deps), EXIT.error);
  assert.match(err[0], /usage: reject/);
  assert.equal(await main(['reject', oldId, 'too sad'], deps), EXIT.ok);
  assert.equal(readStatus(root, oldId).state, 'rejected');
  assert.notEqual(out.at(-1)!.split('\t')[0], oldId);
});

test('list shows every job with its state and title, newest first', async (t) => {
  const { deps, out } = setup(t);
  await main(['list'], deps);
  assert.match(out[0], /no jobs yet/);
  out.length = 0;
  await main(['new', '--count', '2'], deps);
  out.length = 0;
  await main(['list'], deps);
  assert.match(out[0], /-002\tdrafted\tStory 2$/);
  assert.match(out[1], /-001\tdrafted\tStory 1$/);
});

test('make <id> runs a job to rendered; make with neither id nor --approved is a usage error', async (t) => {
  const { deps, out, root } = setup(t);
  createJob(root, '2026-10-27-001');
  setStatus(root, '2026-10-27-001', 'approved');
  assert.equal(await main(['make', '2026-10-27-001'], deps), EXIT.ok);
  assert.equal(out[0], '2026-10-27-001\trendered');
  assert.equal(await main(['make'], deps), EXIT.error);
});

test('make --approved with the credits out exits with code 2 and says what was left', async (t) => {
  const { deps, err, root } = setup(t, {
    make: () => ({ voice: async () => { throw new QuotaExceededError(); }, build: async () => {}, render: async () => { throw new Error('unreachable'); } }),
  });
  createJob(root, '2026-10-27-001');
  setStatus(root, '2026-10-27-001', 'approved');
  assert.equal(await main(['make', '--approved'], deps), EXIT.quota);
  assert.match(err[0], /credits are used up/);
  assert.equal(readStatus(root, '2026-10-27-001').state, 'approved');
});

test('make checks ELEVENLABS_API_KEY first, naming it, before touching any job', async (t) => {
  let stagesBuilt = false;
  const { deps, err, root } = setup(t, {
    requireEnv: (name) => requireEnv(name, {}),
    make: () => { stagesBuilt = true; return { voice: async () => {}, build: async () => {}, render: async () => ({ checks: { ok: true, failures: [] }, renderSeconds: 0 }) }; },
  });
  createJob(root, '2026-10-27-001');
  setStatus(root, '2026-10-27-001', 'approved');
  assert.equal(await main(['make', '--approved'], deps), EXIT.error);
  assert.match(err[0], /ELEVENLABS_API_KEY.*\.env/);
  assert.equal(stagesBuilt, false);
  assert.equal(readStatus(root, '2026-10-27-001').state, 'approved');
});

test('gallery, unknown commands and no arguments', async (t) => {
  const { deps, out, err } = setup(t);
  assert.equal(await main(['gallery'], deps), EXIT.ok);
  assert.equal(await main(['gallery'], { ...deps, gallery: async () => false }), EXIT.error);
  assert.equal(await main(['frobnicate'], deps), EXIT.error);
  assert.match(err.at(-1)!, /unknown command "frobnicate"/);
  assert.equal(await main([], deps), EXIT.error);
  assert.match(out.at(-1)!, /story <command>/);
  assert.equal(await main(['--help'], deps), EXIT.ok);
});

test('voices lists the account voices; --fill writes suggestions into empty slots and says what is still missing', async (t) => {
  const { deps, out, err } = setup(t, {
    accountVoices: async () => [
      { id: 'f1', name: 'Mara', gender: 'female', age: 'middle_aged', category: 'premade', description: '' },
      { id: 'm1', name: 'Tom', gender: 'male', age: 'middle_aged', category: 'premade', description: '' },
    ],
  });
  const assets = join(deps.config.paths.jobs, '..', 'assets');
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, 'voices.json'), JSON.stringify({ emily: 'E', mom: '', dad: '', teen_girl: '', little_brother: '', boy: '', teacher: '', old_lady: '' }));
  const d = { ...deps, config: { ...deps.config, paths: { ...deps.config.paths, assets } } };
  assert.equal(await main(['voices'], d), EXIT.ok);
  assert.match(out[0], /^f1\tMara\tfemale\tmiddle_aged\tpremade$/);
  assert.equal(JSON.parse(readFileSync(join(assets, 'voices.json'), 'utf8')).mom, '');
  assert.equal(await main(['voices', '--fill'], d), EXIT.ok);
  const saved = JSON.parse(readFileSync(join(assets, 'voices.json'), 'utf8'));
  assert.deepEqual([saved.emily, saved.mom, saved.dad], ['E', 'f1', 'm1']);
  assert.match(err.at(-1)!, /no suitable voice found for:.*teen_girl/);
});

test('voices without the key fails naming it', async (t) => {
  const { deps, err } = setup(t, { requireEnv: (n) => requireEnv(n, {}) });
  assert.equal(await main(['voices'], deps), EXIT.error);
  assert.match(err[0], /ELEVENLABS_API_KEY/);
});

test('character list shows each character with its voice status, and an unknown subcommand fails with a usage message', async (t) => {
  const base = setup(t);
  const assets = join(base.deps.config.paths.jobs, '..', 'assets');
  mkdirSync(join(assets, 'characters', 'bacon'), { recursive: true });
  writeFileSync(join(assets, 'voices.json'), JSON.stringify({}));
  const art = { skin: '#ffffff', shirt: '#2f6fb5', pants: '#111111' };
  writeFileSync(join(assets, 'characters', 'bacon', 'character.json'), JSON.stringify({ id: 'bacon', name: 'Bacon', age: 13, personality: 'cheerful and clumsy', look: 'a look', art }));
  const deps = { ...base.deps, config: { ...base.deps.config, paths: { ...base.deps.config.paths, assets } } };
  assert.equal(await main(['character', 'list'], deps), EXIT.ok);
  assert.match(base.out[0], /^bacon	Bacon	13	NO VOICE	cheerful and clumsy$/);
  writeFileSync(join(assets, 'voices.json'), JSON.stringify({ bacon: 'V' }));
  base.out.length = 0;
  await main(['character', 'list'], deps);
  assert.match(base.out[0], /voice ok/);
  assert.equal(await main(['character', 'add', 'x'], deps), EXIT.error);
  assert.match(base.err.at(-1)!, /usage: character list/);
});
