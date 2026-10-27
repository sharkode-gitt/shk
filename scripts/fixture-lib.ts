import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeComposition } from '../src/build/compose.ts';
import { seedFromId } from '../src/build/seed.ts';
import { compileTimeline } from '../src/build/timeline.ts';
import type { Mood, Story, Timeline, Timing } from '../src/types.ts';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const load = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export const fixture = () => {
  const story = load<Story>('fixtures/e2e/story.json');
  const timing = load<Timing>('fixtures/e2e/timing.json');
  return { story, timing, timeline: compileTimeline(story, timing) as Timeline };
};

/** Writes the end-to-end fixture's composition into `<jobDir>/comp` with silent voices (a 220 Hz tone at -30 dBFS, so the mix has something to measure). */
export async function buildFixtureComp(jobDir: string): Promise<{ compDir: string; timeline: Timeline }> {
  const { story, timing, timeline } = fixture();
  const sfxMap = load<Record<string, string>>('fixtures/sfx-map.json');
  const audioDir = join(resolve(jobDir), 'audio-in');
  rmSync(resolve(jobDir), { recursive: true, force: true });
  mkdirSync(audioDir, { recursive: true });
  for (const line of timing.lines) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=44100:duration=${line.duration}`,
      '-af', 'volume=-30dB', '-ac', '1', join(audioDir, basename(line.file))]);
  }
  const compDir = await writeComposition({ jobDir: resolve(jobDir), story, timeline, seed: seedFromId('fixture'), audioDir, music: {} as Record<Mood, string[]>, sfxMap });
  return { compDir, timeline };
}
