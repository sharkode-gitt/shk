import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { StorySchemaForModel } from '../story/model-schema.ts';
import { anthropicStoryClient, type StoryClient } from './write.ts';
import { requireEnv } from '../config.ts';

export type RunResult = { stdout: string; stderr: string; code: number };
export type RunFn = (cmd: string, args: string[], input: string) => Promise<RunResult>;

const run: RunFn = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => reject((e as NodeJS.ErrnoException).code === 'ENOENT'
      ? new Error(`"${cmd}" was not found: install Claude Code and log in with \`claude\` first (or set CLAUDE_BIN to its path)`)
      : e));
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    child.stdin.end(input); // the prompt goes through stdin, so its length never hits the command-line limit
  });

/**
 * Writes stories with the Claude Code CLI (`claude -p`), which runs on the logged-in Claude plan instead of
 * a pay-per-token API key. Same contract as the API client: structured JSON out, validation and retries happen above.
 */
export function claudeCodeStoryClient(config: Config, deps: { run?: RunFn; bin?: string } = {}): StoryClient {
  const runFn = deps.run ?? run;
  const bin = deps.bin ?? process.env.CLAUDE_BIN ?? 'claude';
  // The CLI rejects the `$schema` URI zod adds (it only knows the schema by structure), so it is dropped.
  const { $schema: _uri, ...jsonSchema } = z.toJSONSchema(StorySchemaForModel);
  const schema = JSON.stringify(jsonSchema);
  return {
    async generate(system, user) {
      const args = ['-p', '--output-format', 'json', '--json-schema', schema, '--system-prompt', system,
        '--model', config.writer.model, '--tools', '', '--no-session-persistence'];
      const r = await runFn(bin, args, user);
      let out: { is_error?: boolean; subtype?: string; stop_reason?: string; result?: string; structured_output?: unknown; stop_details?: { category?: string | null } };
      try { out = JSON.parse(r.stdout); } catch { throw new Error(`claude -p printed something that is not JSON (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`); }
      if (out.stop_reason === 'refusal') return { kind: 'refusal', category: out.stop_details?.category ?? null };
      if (r.code !== 0 || out.is_error) throw new Error(`claude -p failed (exit ${r.code}, ${out.subtype ?? 'error'}): ${(out.result ?? r.stderr).slice(0, 400)}`);
      if (out.structured_output !== undefined && out.structured_output !== null) return { kind: 'ok', json: out.structured_output };
      try { return { kind: 'ok', json: JSON.parse(out.result ?? '') }; } catch { return { kind: 'ok', json: null }; }
    },
  };
}

/** The writer chosen in config.json: the Claude plan through the CLI, or the API with ANTHROPIC_API_KEY (checked here, before any work). */
export function createStoryClient(config: Config, env: NodeJS.ProcessEnv = process.env): StoryClient {
  return config.writer.provider === 'api' ? anthropicStoryClient(config, requireEnv('ANTHROPIC_API_KEY', env)) : claudeCodeStoryClient(config);
}
