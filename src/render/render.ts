import { mkdir, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { measureLoudness, parseLoudness, run, TARGET, type LoudnessStats } from './checks.ts';

/** The hyperframes CLI, run with this node: `npx` is a .cmd on Windows, which execFile cannot start. */
export const HYPERFRAMES = join(dirname(createRequire(import.meta.url).resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');

/** `npx hyperframes render` of a composition folder to an MP4 (1080x1920 comes from the composition itself). */
export async function renderComp(compDir: string, outFile: string, opts: { workers?: number | 'auto' } = {}): Promise<{ seconds: number; log: string }> {
  await mkdir(dirname(outFile), { recursive: true });
  const tmp = `${outFile}.partial.mp4`;
  const started = Date.now();
  const r = await run(process.execPath, [HYPERFRAMES, 'render', compDir, '--quality', 'delivery', '--fps', '30', '--output', tmp,
    ...(opts.workers ? ['--workers', String(opts.workers)] : [])]);
  const log = `${r.stdout}\n${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (r.code !== 0) {
    await rm(tmp, { force: true });
    throw new Error(`hyperframes render failed (exit ${r.code}):\n${log.split('\n').slice(-25).join('\n')}`);
  }
  await rename(tmp, outFile);
  return { seconds: (Date.now() - started) / 1000, log };
}

const LN = `I=${TARGET.lufs}:TP=-1:LRA=11`;

/** Two-pass ffmpeg loudnorm to -14 LUFS / -1 dBTP; the video stream is copied untouched. */
export async function normalizeLoudness(inFile: string, outFile: string): Promise<LoudnessStats> {
  const before = await measureLoudness(inFile);
  if (!before) throw new Error(`could not measure loudness of ${inFile} (no audio track?)`);
  const measured = `measured_I=${before.input_i}:measured_TP=${before.input_tp}:measured_LRA=${before.input_lra}:measured_thresh=${before.input_thresh}:offset=${before.target_offset}`;
  await mkdir(dirname(outFile), { recursive: true });
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', inFile, '-map', '0:v:0', '-map', '0:a:0',
    '-c:v', 'copy', '-af', `loudnorm=${LN}:${measured}:linear=true:print_format=json`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', outFile]);
  if (r.code !== 0 || !parseLoudness(r.stderr)) throw new Error(`loudnorm failed (exit ${r.code}):\n${r.stderr.split('\n').slice(-12).join('\n')}`);
  return before;
}
