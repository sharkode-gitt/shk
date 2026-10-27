import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/config.ts';
import { claudeCodeStoryClient, createStoryClient, type RunFn } from '../../src/write/claude-code.ts';

const config = loadConfig();
const answer = (obj: unknown, code = 0) => async () => ({ stdout: JSON.stringify(obj), stderr: '', code });

test('sends the prompt on stdin and the system prompt, schema and model as flags, with tools off', async () => {
  let seen: { cmd: string; args: string[]; input: string } | undefined;
  const run: RunFn = async (cmd, args, input) => { seen = { cmd, args, input }; return { stdout: JSON.stringify({ is_error: false, structured_output: { title: 'x' } }), stderr: '', code: 0 }; };
  const r = await claudeCodeStoryClient(config, { run, bin: 'claude' }).generate('SYSTEM TEXT', 'USER TEXT');
  assert.deepEqual(r, { kind: 'ok', json: { title: 'x' } });
  assert.equal(seen!.input, 'USER TEXT');
  const a = seen!.args;
  assert.equal(a[a.indexOf('--system-prompt') + 1], 'SYSTEM TEXT');
  assert.equal(a[a.indexOf('--model') + 1], config.writer.model);
  assert.equal(a[a.indexOf('--tools') + 1], '');
  assert.ok(a.includes('-p') && a.includes('--no-session-persistence'));
  const schema = JSON.parse(a[a.indexOf('--json-schema') + 1]);
  assert.equal(schema.type, 'object');
  assert.ok(!('$schema' in schema), 'the CLI rejects the $schema URI');
});

test('falls back to parsing the result text when there is no structured_output', async () => {
  const r = await claudeCodeStoryClient(config, { run: answer({ is_error: false, result: '{"title":"y"}' }) }).generate('s', 'u');
  assert.deepEqual(r, { kind: 'ok', json: { title: 'y' } });
});

test('a refusal is reported as a refusal, with its category', async () => {
  const r = await claudeCodeStoryClient(config, { run: answer({ is_error: false, stop_reason: 'refusal', stop_details: { category: 'general_harms' } }) }).generate('s', 'u');
  assert.deepEqual(r, { kind: 'refusal', category: 'general_harms' });
});

test('an error result (for example the plan limit) throws with its message', async () => {
  const run = answer({ is_error: true, subtype: 'error_during_execution', result: 'usage limit reached' }, 1);
  await assert.rejects(claudeCodeStoryClient(config, { run }).generate('s', 'u'), /usage limit reached/);
});

test('output that is not JSON throws with what was printed', async () => {
  const run: RunFn = async () => ({ stdout: 'Please log in', stderr: '', code: 1 });
  await assert.rejects(claudeCodeStoryClient(config, { run }).generate('s', 'u'), /not JSON.*Please log in/);
});

test('a missing CLI explains how to fix it', async () => {
  await assert.rejects(claudeCodeStoryClient(config, { bin: 'definitely-not-installed-xyz' }).generate('s', 'u'), /install Claude Code/);
});

test('createStoryClient: the api provider needs ANTHROPIC_API_KEY, naming it; the plan provider needs none', () => {
  const api = { ...config, writer: { ...config.writer, provider: 'api' as const } };
  assert.throws(() => createStoryClient(api, {}), /ANTHROPIC_API_KEY/);
  assert.doesNotThrow(() => createStoryClient(api, { ANTHROPIC_API_KEY: 'sk-test' }));
  assert.doesNotThrow(() => createStoryClient(config, {}));
});
