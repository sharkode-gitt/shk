import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.ts';
import { createJob, jobPath, readStatus, setStatus } from '../../src/jobs/store.ts';
import { compileTimeline } from '../../src/build/timeline.ts';
import { QuotaExceededError } from '../../src/voice/eleven.ts';
import { loadVoices, voiceJob, type VoiceDeps } from '../../src/voice/voice.ts';
import { VOICES } from '../../src/vocab.ts';
import type { Story, Timing } from '../../src/types.ts';
import { validStory } from '../write/helpers.ts';
import { writeFileSync } from 'node:fs';

const voices = Object.fromEntries(['emily', ...VOICES].map((k) => [k, `id_${k}`]));
const make = (t: test.TestContext, story: Story = validStory()) => {
  const dir = mkdtempSync(join(tmpdir(), 'voice-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'jobs');
  const id = '2026-10-27-001';
  createJob(root, id);
  writeFileSync(jobPath(root, id, 'story.json'), JSON.stringify(story));
  setStatus(root, id, 'approved');
  const requests: { voice: string; text: string }[] = [];
  let failAt = Infinity;
  const deps: VoiceDeps = {
    config: loadConfig(), voices, apiKey: 'k', cacheDir: join(dir, 'cache'), sleep: async () => {},
    fetch: (async (url: string, init: RequestInit) => {
      if (requests.length + 1 >= failAt) return new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), { status: 401 });
      const text = JSON.parse(init.body as string).text as string;
      requests.push({ voice: /text-to-speech\/([^/]+)\//.exec(url)![1], text });
      const chars = [...text];
      return new Response(JSON.stringify({
        audio_base64: Buffer.from(text).toString('base64'),
        alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) },
      }), { status: 200 });
    }) as typeof fetch,
  };
  return { root, id, deps, requests, failOn: (n: number) => { failAt = n; } };
};

test('assets/voices.json lists a slot for Emily and every voice archetype', () => {
  const v = loadVoices('assets');
  for (const k of ['emily', ...VOICES]) assert.ok(k in v, `missing ${k}`);
});

test('voices every beat, writes timing.json that the engine compiles, and marks the job voiced', async (t) => {
  const { root, id, deps, requests } = make(t);
  const story = JSON.parse(readFileSync(jobPath(root, id, 'story.json'), 'utf8')) as Story;
  await voiceJob(deps, root, id);
  const beats = story.scenes.flatMap((s) => s.beats);
  assert.equal(requests.length, beats.length);
  assert.equal(readStatus(root, id).state, 'voiced');
  for (const [si, s] of story.scenes.entries()) for (const bi of s.beats.keys()) assert.ok(existsSync(jobPath(root, id, 'audio', `${si}.${bi}.mp3`)));
  const timing = JSON.parse(readFileSync(jobPath(root, id, 'timing.json'), 'utf8')) as Timing;
  const timeline = compileTimeline(story, timing);
  assert.equal(timeline.beats.length, beats.length);
  assert.ok(timeline.beats.every((b) => b.words.every((w) => !w.word.includes('['))));
});

test('narration uses Emily\'s voice; a dialogue line uses the voice archetype of its speaker', async (t) => {
  const { root, id, deps, requests } = make(t);
  await voiceJob(deps, root, id);
  assert.equal(requests[0].voice, 'id_emily'); // narrate
  assert.equal(requests[1].voice, 'id_teen_girl'); // Mia
  assert.ok(requests.some((r) => r.voice === 'id_mom'));
});

test('running it twice makes no new request (the job is already voiced), and neither does a fresh run on cached text', async (t) => {
  const { root, id, deps, requests } = make(t);
  await voiceJob(deps, root, id);
  const n = requests.length;
  await voiceJob(deps, root, id);
  assert.equal(requests.length, n);
});

test('credits running out on the third beat leaves the job approved; the first lines stay cached for the retry', async (t) => {
  const { root, id, deps, requests, failOn } = make(t);
  failOn(3);
  await assert.rejects(voiceJob(deps, root, id), QuotaExceededError);
  assert.equal(readStatus(root, id).state, 'approved');
  assert.equal(requests.length, 2);
  failOn(Infinity);
  await voiceJob(deps, root, id); // resumes: the first two beats come from the cache
  assert.equal(readStatus(root, id).state, 'voiced');
  const story = JSON.parse(readFileSync(jobPath(root, id, 'story.json'), 'utf8')) as Story;
  assert.equal(requests.length, story.scenes.flatMap((s) => s.beats).length);
});

test('a missing voice id fails before any request, naming the voice and the file', async (t) => {
  const { root, id, deps, requests } = make(t);
  await assert.rejects(voiceJob({ ...deps, voices: { ...voices, mom: '' } }, root, id), /"mom".*assets\/voices\.json/);
  assert.equal(readStatus(root, id).state, 'approved');
  assert.ok(requests.length < 20);
});

test('a job that is not approved cannot be voiced', async (t) => {
  const { root, deps } = make(t);
  createJob(root, '2026-10-27-002'); // drafted
  await assert.rejects(voiceJob(deps, root, '2026-10-27-002'), /only an approved job/);
});
