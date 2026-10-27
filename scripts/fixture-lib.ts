import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeComposition } from '../src/build/compose.ts';
import { seedFromId } from '../src/build/seed.ts';
import { compileTimeline } from '../src/build/timeline.ts';
import { runChecks, type CheckResult } from '../src/render/checks.ts';
import { normalizeLoudness, renderComp } from '../src/render/render.ts';
import type { Mood, Story, Timeline, Timing } from '../src/types.ts';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const load = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export type JobInput = { story: Story; timing: Timing };

/** The end-to-end fixture: 3 scenes, 14 beats, about 26 s. */
export const fixture = (): JobInput => ({ story: load<Story>('fixtures/e2e/story.json'), timing: load<Timing>('fixtures/e2e/timing.json') });

/** Writes `<jobDir>/comp` for a story with silent voices (a 220 Hz tone at -30 dBFS, so the mix has something to measure). */
export async function buildComp(jobDir: string, { story, timing }: JobInput, seedId: string): Promise<{ compDir: string; timeline: Timeline }> {
  const timeline = compileTimeline(story, timing);
  const dir = resolve(jobDir);
  const audioDir = join(dir, 'audio-in');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(audioDir, { recursive: true });
  for (const line of timing.lines) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=44100:duration=${line.duration}`,
      '-af', 'volume=-30dB', '-ac', '1', join(audioDir, basename(line.file))]);
  }
  const sfxMap = load<Record<string, string>>('fixtures/sfx-map.json');
  const compDir = await writeComposition({ jobDir: dir, story, timeline, seed: seedFromId(seedId), audioDir, music: {} as Record<Mood, string[]>, sfxMap });
  return { compDir, timeline };
}

export const buildFixtureComp = (jobDir: string) => buildComp(jobDir, fixture(), 'fixture');

/** composition -> render -> loudness -> checks, writing `<jobDir>/final.mp4` and `<jobDir>/log.txt`. `--comp-only` stops after the composition. */
export async function renderJob(name: string, input: JobInput): Promise<{ result: CheckResult | null }> {
  const jobDir = resolve(ROOT, 'jobs', name);
  const { compDir, timeline } = await buildComp(jobDir, input, name); // the job name seeds the camera shake and idle phases
  if (process.argv.includes('--comp-only')) { console.log(compDir); return { result: null }; }

  const log: string[] = [];
  const say = (s: string) => { console.log(s); log.push(s); };
  const workers = process.env.WORKERS ? (process.env.WORKERS === 'auto' ? 'auto' : Number(process.env.WORKERS)) : undefined;

  const raw = join(jobDir, 'raw.mp4');
  const rendered = await renderComp(compDir, raw, { workers });
  say(`render: ${rendered.seconds.toFixed(1)} s for a ${timeline.duration.toFixed(1)} s video`);
  log.push('--- render output ---', rendered.log);

  const before = await normalizeLoudness(raw, join(jobDir, 'final.mp4'));
  say(`loudness before normalizing: ${before.input_i} LUFS`);

  const result = await runChecks(join(jobDir, 'final.mp4'));
  say(`checks: ${result.ok ? 'ok' : 'FAILED'}`);
  for (const f of result.failures) say(`  - ${f}`);
  writeFileSync(join(jobDir, 'log.txt'), log.join('\n'));
  say(`video: jobs/${name}/final.mp4`);
  return { result };
}
