import { execFile } from 'node:child_process';

export type Probe = { width: number; height: number; duration: number; hasAudio: boolean };
export type BlackSpan = { start: number; end: number; duration: number };
/** Fields of ffmpeg's `loudnorm=print_format=json` report that the pipeline uses (LUFS / dBTP / LU). */
export type LoudnessStats = { input_i: number; input_tp: number; input_lra: number; input_thresh: number; target_offset: number };
export type CheckInput = { probe: Probe; black: BlackSpan[]; loudness: LoudnessStats | null };
export type CheckResult = { ok: boolean; failures: string[] };

export const TARGET = { width: 1080, height: 1920, minSeconds: 20, maxSeconds: 60, lufs: -14, lufsTolerance: 1, maxBlackSeconds: 0.5 };

/** Parses `ffprobe -show_streams -show_format -of json`. */
export function parseProbe(json: string | object): Probe {
  const d = (typeof json === 'string' ? JSON.parse(json) : json) as {
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
    format?: { duration?: string };
  };
  const video = d.streams?.find((s) => s.codec_type === 'video');
  const duration = Number(d.format?.duration ?? video?.duration ?? 0);
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    duration: Number.isFinite(duration) ? duration : 0,
    hasAudio: !!d.streams?.some((s) => s.codec_type === 'audio'),
  };
}

/** Parses the `[blackdetect @ …] black_start:… black_end:… black_duration:…` lines of ffmpeg's stderr. */
export function parseBlackdetect(stderr: string): BlackSpan[] {
  const out: BlackSpan[] = [];
  for (const m of stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)) {
    out.push({ start: Number(m[1]), end: Number(m[2]), duration: Number(m[3]) });
  }
  return out;
}

/** Reads the JSON block that `loudnorm=print_format=json` prints at the end of ffmpeg's stderr; null when there is none. */
export function parseLoudness(text: string): LoudnessStats | null {
  const end = text.lastIndexOf('}');
  const start = end < 0 ? -1 : text.lastIndexOf('{', end);
  if (start < 0) return null;
  let raw: Record<string, string>;
  try { raw = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const pick = (k: string) => Number(raw[k]);
  const stats = { input_i: pick('input_i'), input_tp: pick('input_tp'), input_lra: pick('input_lra'), input_thresh: pick('input_thresh'), target_offset: pick('target_offset') };
  return Object.values(stats).every(Number.isFinite) ? stats : null;
}

/** The pure rules. Each failure names its rule: resolution, duration, audio, loudness or black. */
export function evaluateChecks({ probe, black, loudness }: CheckInput): CheckResult {
  const failures: string[] = [];
  if (probe.width !== TARGET.width || probe.height !== TARGET.height) {
    failures.push(`resolution is ${probe.width}x${probe.height}, expected ${TARGET.width}x${TARGET.height}`);
  }
  if (!(probe.duration >= TARGET.minSeconds && probe.duration <= TARGET.maxSeconds)) {
    failures.push(`duration is ${probe.duration.toFixed(1)} s, expected ${TARGET.minSeconds}-${TARGET.maxSeconds} s`);
  }
  if (!probe.hasAudio) failures.push('audio: no audio track');
  else if (!loudness) failures.push('loudness: could not be measured');
  else if (Math.abs(loudness.input_i - TARGET.lufs) > TARGET.lufsTolerance) {
    failures.push(`loudness is ${loudness.input_i} LUFS, expected ${TARGET.lufs} +-${TARGET.lufsTolerance}`);
  }
  for (const b of black) {
    if (b.duration > TARGET.maxBlackSeconds) failures.push(`black frames for ${b.duration} s at ${b.start} s`);
  }
  return { ok: failures.length === 0, failures };
}

export type RunResult = { stdout: string; stderr: string; code: number };

/** Runs a command and never throws on a non-zero exit; ffmpeg reports on stderr. */
export const run = (cmd: string, args: string[]): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') reject(new Error(`${cmd} not found on PATH`));
      else resolve({ stdout, stderr, code: err ? ((err as { code?: number }).code ?? 1) : 0 });
    });
  });

/** Integrated loudness of a file's audio, measured with ffmpeg's loudnorm analysis pass. */
export async function measureLoudness(file: string): Promise<LoudnessStats | null> {
  const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
  return parseLoudness(r.stderr);
}

/** Probes, scans for black frames and measures loudness, then applies the rules. */
export async function runChecks(file: string): Promise<CheckResult> {
  const probeRun = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  if (probeRun.code !== 0) return { ok: false, failures: [`file: ffprobe could not read it (${probeRun.stderr.trim() || probeRun.code})`] };
  const probe = parseProbe(probeRun.stdout);
  const blackRun = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', `blackdetect=d=${TARGET.maxBlackSeconds}:pix_th=0.10`, '-an', '-f', 'null', '-']);
  const loudness = probe.hasAudio ? await measureLoudness(file) : null;
  return evaluateChecks({ probe, black: parseBlackdetect(blackRun.stderr), loudness });
}
