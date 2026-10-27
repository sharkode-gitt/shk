import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateChecks, measureLoudness, parseBlackdetect, parseLoudness, parseProbe, runChecks } from '../../src/render/checks.ts';
import { normalizeLoudness } from '../../src/render/render.ts';

// Real ffprobe / blackdetect / loudnorm output of generated clips (see fixtures/README.md).
const fx = (name: string, kind: 'probe.json' | 'blackdetect.txt' | 'loudness.txt') =>
  readFileSync(new URL(`./fixtures/${name}.${kind}`, import.meta.url), 'utf8');
const check = (name: string) =>
  evaluateChecks({ probe: parseProbe(fx(name, 'probe.json')), black: parseBlackdetect(fx(name, 'blackdetect.txt')), loudness: parseLoudness(fx(name, 'loudness.txt')) });

test('parseProbe: size, duration and audio presence', () => {
  const p = parseProbe(fx('good', 'probe.json'));
  assert.deepEqual([p.width, p.height, p.hasAudio], [1080, 1920, true]);
  assert.ok(Math.abs(p.duration - 30) < 0.1);
  assert.equal(parseProbe(fx('noaudio', 'probe.json')).hasAudio, false);
});

test('parseBlackdetect: none in a clean clip, one 0.8 s span in the black one', () => {
  assert.deepEqual(parseBlackdetect(fx('good', 'blackdetect.txt')), []);
  assert.deepEqual(parseBlackdetect(fx('black', 'blackdetect.txt')), [{ start: 12, end: 12.8, duration: 0.8 }]);
});

test('parseLoudness: reads the loudnorm JSON; null when there is none', () => {
  const s = parseLoudness(fx('quiet', 'loudness.txt'))!;
  assert.equal(s.input_i, -20.05);
  assert.equal(s.input_tp, -14.8);
  assert.equal(parseLoudness(fx('noaudio', 'loudness.txt')), null);
  assert.equal(parseLoudness(''), null);
});

test('a good file passes', () => assert.deepEqual(check('good'), { ok: true, failures: [] }));

test('1920x1080 fails on resolution', () => {
  const r = check('landscape');
  assert.equal(r.ok, false);
  assert.deepEqual(r.failures.length, 1);
  assert.match(r.failures[0], /resolution/);
});

test('15 s fails on duration', () => {
  const r = check('short');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /duration/);
});

test('no audio track fails on audio (and does not also complain about loudness)', () => {
  const r = check('noaudio');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /audio/);
});

test('a 0.8 s black stretch fails on black frames', () => {
  const r = check('black');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /black/);
});

test('-20 LUFS fails on loudness', () => {
  const r = check('quiet');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /loudness/);
});

test('rule edges: 20 s and 60 s pass, black of exactly 0.5 s passes, -13.1 LUFS passes, -15.1 fails', () => {
  const base = { probe: { width: 1080, height: 1920, duration: 20, hasAudio: true }, black: [], loudness: { input_i: -14, input_tp: -2, input_lra: 5, input_thresh: -24, target_offset: 0 } };
  assert.ok(evaluateChecks(base).ok);
  assert.ok(evaluateChecks({ ...base, probe: { ...base.probe, duration: 60 } }).ok);
  assert.ok(evaluateChecks({ ...base, black: [{ start: 1, end: 1.5, duration: 0.5 }] }).ok);
  assert.ok(evaluateChecks({ ...base, loudness: { ...base.loudness, input_i: -13.1 } }).ok);
  assert.ok(!evaluateChecks({ ...base, loudness: { ...base.loudness, input_i: -15.1 } }).ok);
  assert.ok(!evaluateChecks({ ...base, probe: { ...base.probe, duration: 60.1 } }).ok);
});

test('normalizeLoudness brings a quiet clip to -14 LUFS, keeps the video stream, and runChecks sees the audio', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loud-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const src = join(dir, 'quiet.mp4'), out = join(dir, 'norm.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=21',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=21:sample_rate=48000', '-af', 'volume=-18dB', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src]);
  const before = await normalizeLoudness(src, out);
  assert.ok(before.input_i < -20, `source should be quiet, got ${before.input_i}`);
  const after = (await measureLoudness(out))!;
  assert.ok(Math.abs(after.input_i - -14) <= 1, `after: ${after.input_i} LUFS`);
  const codec = (f: string) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
  assert.equal(codec(out), codec(src));
  const r = await runChecks(out);
  assert.deepEqual(r, { ok: true, failures: [] }, r.failures.join('; '));
});

test('runChecks reports an unreadable file instead of throwing', async () => {
  const r = await runChecks('/nonexistent/video.mp4');
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /file/);
});
