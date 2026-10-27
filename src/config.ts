import { readFileSync } from 'node:fs';
import { z } from 'zod';

const ConfigSchema = z.object({
  writer: z.object({
    model: z.string().min(1),
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']),
  }),
  voice: z.object({ model: z.literal('eleven_v3'), format: z.literal('mp3_44100_128') }),
  paths: z.object({ jobs: z.string().min(1), cache: z.string().min(1), assets: z.string().min(1) }),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Reads and validates config.json; errors name the offending field. */
export function loadConfig(path = 'config.json'): Config {
  const parsed = ConfigSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`${path} is invalid: ${issues}`);
  }
  return parsed.data;
}

export type SecretName = 'ANTHROPIC_API_KEY' | 'ELEVENLABS_API_KEY';

/** A secret from the environment; throws before any API call, naming the variable. */
export function requireEnv(name: SecretName, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not set; add it to .env (see .env.example)`);
  return value;
}
