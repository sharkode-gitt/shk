import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Config } from './config.ts';
import { jobPath, listJobs, readStatus, setStatus, type JobState } from './jobs/store.ts';
import { writeComposition } from './build/compose.ts';
import { seedFromId } from './build/seed.ts';
import { compileTimeline } from './build/timeline.ts';
import { runChecks } from './render/checks.ts';
import { normalizeLoudness, renderComp } from './render/render.ts';
import { QuotaExceededError } from './voice/eleven.ts';
import { MUSIC } from './vocab.ts';
import type { Mood, Story, Timing } from './types.ts';

export type VoiceFn = (root: string, id: string) => Promise<void>;
export type BuildFn = (root: string, id: string) => Promise<void>;
export type RenderFn = (root: string, id: string) => Promise<{ checks: { ok: boolean; failures: string[] }; renderSeconds: number }>;
export type MakeDeps = { voice: VoiceFn; build: BuildFn; render: RenderFn };

const log = (root: string, id: string, line: string) => appendFileSync(jobPath(root, id, 'log.txt'), `${new Date().toISOString()} ${line}\n`);

/**
 * Takes one job as far as it can go, resuming from its first unfinished stage:
 * approved -> voiced -> built -> rendered (or needs-review when the output checks fail).
 * Running it again on a finished or half-finished job never repeats a finished stage, so no credits are spent twice.
 * Running out of voice credits is rethrown and leaves the job where it was; any other error marks it `failed`.
 */
export async function makeJob(deps: MakeDeps, root: string, id: string): Promise<JobState> {
  let state = readStatus(root, id).state;
  if (state === 'drafted') throw new Error(`job ${id} is still a draft; approve it first (story approve ${id})`);
  try {
    if (state === 'approved') {
      log(root, id, 'voice: start');
      await deps.voice(root, id);
      state = 'voiced';
      log(root, id, 'voice: done');
    }
    if (state === 'voiced') {
      log(root, id, 'build: start');
      await deps.build(root, id);
      setStatus(root, id, 'built');
      state = 'built';
      log(root, id, 'build: done');
    }
    if (state === 'built') {
      log(root, id, 'render: start');
      const r = await deps.render(root, id);
      log(root, id, `render: done in ${r.renderSeconds.toFixed(1)} s; checks ${r.checks.ok ? 'ok' : `FAILED: ${r.checks.failures.join('; ')}`}`);
      state = setStatus(root, id, r.checks.ok ? 'rendered' : 'needs-review', r.checks.ok ? undefined : r.checks.failures.join('; ')).state;
    }
    return state;
  } catch (e) {
    if (e instanceof QuotaExceededError) { log(root, id, `stopped: ${e.message}`); throw e; }
    const message = (e as Error).message;
    log(root, id, `failed: ${message}`);
    return setStatus(root, id, 'failed', message).state;
  }
}

/** Makes every unfinished approved job, oldest first. Stops at the first out-of-credits error and leaves the rest untouched. */
export async function makeApproved(deps: MakeDeps, root: string): Promise<{ results: { id: string; state: JobState }[]; quotaExceeded: boolean }> {
  const todo = listJobs(root).filter((j) => j.state === 'approved' || j.state === 'voiced' || j.state === 'built').reverse();
  const results: { id: string; state: JobState }[] = [];
  for (const job of todo) {
    try {
      results.push({ id: job.id, state: await makeJob(deps, root, job.id) });
    } catch (e) {
      if (e instanceof QuotaExceededError) return { results, quotaExceeded: true };
      throw e;
    }
  }
  return { results, quotaExceeded: false };
}

// --- the real stages, built on the engine ---

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

/** Music files per mood from `<assets>/music/<mood>/`; a mood with no folder has none (the video then has no music there). */
export function musicLibrary(assetsDir: string): Record<Mood, string[]> {
  const lib = {} as Record<Mood, string[]>;
  for (const mood of MUSIC) {
    const dir = resolve(assetsDir, 'music', mood);
    lib[mood] = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)).sort().map((f) => join(dir, f)) : [];
  }
  return lib;
}

/** Sound effects map from `<assets>/sfx/map.json` (names relative to that folder, one or several takes per key); no file means no effects. */
export function sfxMap(assetsDir: string): Record<string, string | string[]> {
  const file = resolve(assetsDir, 'sfx', 'map.json');
  if (!existsSync(file)) return {};
  const at = (name: string) => resolve(assetsDir, 'sfx', name);
  return Object.fromEntries(Object.entries(readJson<Record<string, string | string[]>>(file)).map(([k, v]) => [k, Array.isArray(v) ? v.map(at) : at(v)]));
}

export const realBuild = (config: Config): BuildFn => async (root, id) => {
  const jobDir = resolve(jobPath(root, id));
  const story = readJson<Story>(join(jobDir, 'story.json'));
  const timing = readJson<Timing>(join(jobDir, 'timing.json'));
  await writeComposition({
    jobDir, story, timeline: compileTimeline(story, timing), seed: seedFromId(id),
    audioDir: jobDir, music: musicLibrary(config.paths.assets), sfxMap: sfxMap(config.paths.assets),
  });
};

export const realRender = (): RenderFn => async (root, id) => {
  const dir = resolve(jobPath(root, id));
  const raw = join(dir, 'raw.mp4');
  const workers = process.env.WORKERS ? (process.env.WORKERS === 'auto' ? 'auto' : Number(process.env.WORKERS)) : undefined;
  const rendered = await renderComp(join(dir, 'comp'), raw, { workers });
  await normalizeLoudness(raw, join(dir, 'final.mp4'));
  return { checks: await runChecks(join(dir, 'final.mp4')), renderSeconds: rendered.seconds };
};
