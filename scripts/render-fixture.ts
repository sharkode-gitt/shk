import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeComposition } from '../src/build/compose.ts';
import { seedFromId } from '../src/build/seed.ts';
import { compileTimeline } from '../src/build/timeline.ts';
import { runChecks } from '../src/render/checks.ts';
import { normalizeLoudness, renderComp } from '../src/render/render.ts';
import type { Mood, Story, Timing } from '../src/types.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const load = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const story = load<Story>('fixtures/story.json');
const timing = load<Timing>('fixtures/timing.json');
const sfxMap = load<Record<string, string>>('fixtures/sfx-map.json');

const jobDir = resolve(ROOT, 'jobs/fixture');
const audioDir = join(jobDir, 'audio-in');
rmSync(jobDir, { recursive: true, force: true });
mkdirSync(audioDir, { recursive: true });

// Silent voices (no TTS credits spent) with a 220 Hz tone at -30 dBFS so the mix has something to measure.
for (const line of timing.lines) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=44100:duration=${line.duration}`,
    '-af', 'volume=-30dB', '-ac', '1', join(audioDir, basename(line.file))]);
}

const timeline = compileTimeline(story, timing);
const compDir = await writeComposition({ jobDir, story, timeline, seed: seedFromId('fixture'), audioDir, music: {} as Record<Mood, string[]>, sfxMap });

const log: string[] = [];
const say = (s: string) => { console.log(s); log.push(s); };

const raw = join(jobDir, 'raw.mp4');
const rendered = await renderComp(compDir, raw);
say(`render: ${rendered.seconds.toFixed(1)} s for a ${timeline.duration.toFixed(1)} s video`);
log.push('--- render output ---', rendered.log);

const before = await normalizeLoudness(raw, join(jobDir, 'final.mp4'));
say(`loudness before normalizing: ${before.input_i} LUFS`);

const result = await runChecks(join(jobDir, 'final.mp4'));
say(`checks: ${result.ok ? 'ok' : 'FAILED'}`);
for (const f of result.failures) say(`  - ${f}`);
writeFileSync(join(jobDir, 'log.txt'), log.join('\n'));
if (!result.ok) process.exitCode = 1;
