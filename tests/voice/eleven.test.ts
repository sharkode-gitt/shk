import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ElevenError, QuotaExceededError, synthesize, type ElevenDeps } from '../../src/voice/eleven.ts';

const req = { text: '[sad] Hi mom', voiceId: 'voice123', model: 'eleven_v3', format: 'mp3_44100_128' };
const okBody = () => {
  const text = req.text;
  return {
    audio_base64: Buffer.from('fake-mp3-bytes').toString('base64'),
    alignment: { characters: [...text], character_start_times_seconds: [...text].map((_, i) => i * 0.1), character_end_times_seconds: [...text].map((_, i) => (i + 1) * 0.1) },
  };
};
const json = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

type Call = { url: string; init: RequestInit };
const setup = (t: test.TestContext, responses: (() => Response)[]) => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'eleven-'));
  t.after(() => rmSync(cacheDir, { recursive: true, force: true }));
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const deps: ElevenDeps = {
    fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return (responses.shift() ?? (() => json(500, '{}')))(); }) as typeof fetch,
    apiKey: 'test-key', cacheDir, sleep: async (ms) => { sleeps.push(ms); },
  };
  return { deps, calls, sleeps, cacheDir };
};

test('a successful call returns the mp3, the words (tag dropped) and the duration, and sends the right request', async (t) => {
  const { deps, calls } = setup(t, [() => json(200, okBody())]);
  const r = await synthesize(deps, req);
  assert.equal(r.cached, false);
  assert.deepEqual(r.words.map((w) => w.word), ['Hi', 'mom']);
  assert.ok(Math.abs(r.duration - 1.2) < 1e-9);
  assert.equal(readFileSync(r.mp3, 'utf8'), 'fake-mp3-bytes');
  assert.match(calls[0].url, /\/v1\/text-to-speech\/voice123\/with-timestamps\?output_format=mp3_44100_128$/);
  assert.equal((calls[0].init.headers as Record<string, string>)['xi-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { text: '[sad] Hi mom', model_id: 'eleven_v3' });
});

test('the second identical call comes from the cache and does not touch the network', async (t) => {
  const { deps, calls } = setup(t, [() => json(200, okBody()), () => json(200, okBody())]);
  const a = await synthesize(deps, req);
  const b = await synthesize(deps, req);
  assert.equal(calls.length, 1);
  assert.equal(b.cached, true);
  assert.deepEqual(b.words, a.words);
  assert.equal(b.mp3, a.mp3);
  await synthesize(deps, { ...req, voiceId: 'other' }); // a different voice is a different entry
  assert.equal(calls.length, 2);
});

test('429, 429, then 200 succeeds after waiting 1 s and 2 s', async (t) => {
  const { deps, calls, sleeps } = setup(t, [() => json(429, '{}'), () => json(429, '{}'), () => json(200, okBody())]);
  const r = await synthesize(deps, req);
  assert.equal(r.cached, false);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test('six 500s in a row give up after waits of 1, 2, 4, 8 and 16 s', async (t) => {
  const { deps, calls, sleeps } = setup(t, Array.from({ length: 6 }, () => () => json(500, 'oops')));
  await assert.rejects(synthesize(deps, req), (e: Error) => e instanceof ElevenError && /HTTP 500/.test(e.message));
  assert.equal(calls.length, 6);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16000]);
  assert.deepEqual(readdirSync(deps.cacheDir), []); // nothing cached from a failure
});

test('401 quota_exceeded throws QuotaExceededError without retrying', async (t) => {
  const { deps, calls } = setup(t, [() => json(401, { detail: { status: 'quota_exceeded', message: 'out of credits' } })]);
  await assert.rejects(synthesize(deps, req), QuotaExceededError);
  assert.equal(calls.length, 1);
});

test('another 4xx throws ElevenError carrying the response body, without retrying', async (t) => {
  const { deps, calls } = setup(t, [() => json(422, { detail: 'voice not found' })]);
  await assert.rejects(synthesize(deps, req), (e: Error) => e instanceof ElevenError && !(e instanceof QuotaExceededError) && /voice not found/.test(e.message));
  assert.equal(calls.length, 1);
});

test('an answer without timings is an error, not a silent empty caption', async (t) => {
  const { deps } = setup(t, [() => json(200, { audio_base64: 'AAAA', alignment: null })]);
  await assert.rejects(synthesize(deps, req), /without audio or word timings/);
});
