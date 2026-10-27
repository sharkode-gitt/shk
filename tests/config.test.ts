import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, requireEnv } from '../src/config.ts';

const valid = { writer: { model: 'claude-opus-5-5', effort: 'high' }, voice: { model: 'eleven_v3', format: 'mp3_44100_128' }, paths: { jobs: 'jobs', cache: 'cache', assets: 'assets' } };
const write = (t: test.TestContext, cfg: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const p = join(dir, 'config.json');
  writeFileSync(p, JSON.stringify(cfg));
  return p;
};

test('the shipped config.json loads', () => assert.equal(loadConfig().writer.model, 'claude-opus-5-5'));

test('a valid config loads', (t) => assert.deepEqual(loadConfig(write(t, valid)), valid));

test('an invalid effort fails and names the field', (t) => {
  assert.throws(() => loadConfig(write(t, { ...valid, writer: { ...valid.writer, effort: 'ultra' } })), /writer\.effort/);
});

test('a missing path names the field', (t) => {
  assert.throws(() => loadConfig(write(t, { ...valid, paths: { jobs: 'jobs', assets: 'assets' } })), /paths\.cache/);
});

test('requireEnv returns the value, trimmed', () => assert.equal(requireEnv('ANTHROPIC_API_KEY', { ANTHROPIC_API_KEY: ' sk-x ' }), 'sk-x'));

test('requireEnv without the variable names it and points at .env', () => {
  assert.throws(() => requireEnv('ELEVENLABS_API_KEY', {}), (e: Error) => /ELEVENLABS_API_KEY/.test(e.message) && /\.env/.test(e.message));
  assert.throws(() => requireEnv('ELEVENLABS_API_KEY', { ELEVENLABS_API_KEY: '  ' }), /ELEVENLABS_API_KEY/);
});
