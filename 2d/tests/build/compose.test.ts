import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeComposition } from '../../src/build/compose.ts';
import { HYPERFRAMES } from '../../src/render/render.ts';
import { captionChunks } from '../../src/build/captions.ts';
import { compileTimeline } from '../../src/build/timeline.ts';
import type { Mood, Story, Timeline, Timing } from '../../src/types.ts';

const load = (p: string) => JSON.parse(readFileSync(new URL(`../../fixtures/${p}`, import.meta.url), 'utf8'));
const story: Story = load('story.json');
const timing: Timing = load('timing.json');
const timeline: Timeline = compileTimeline(story, timing);

/** A 0.1 s silent mono 8 kHz WAV: enough for the composition writer, which never decodes audio. */
const wav = () => {
  const n = 800, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
};

let tmp: string, compDir: string, html: string;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'compose-'));
  const audioDir = join(tmp, 'in');
  mkdirSync(join(audioDir, 'audio'), { recursive: true });
  for (const l of timing.lines) writeFileSync(join(audioDir, l.file), wav());
  for (const f of ['happy.wav', 'tense.wav', 'boing.wav', 'whoosh.wav']) writeFileSync(join(audioDir, f), wav());
  const music = { happy: ['happy.wav'], tense: ['tense.wav'] } as unknown as Record<Mood, string[]>;
  compDir = await writeComposition({
    jobDir: join(tmp, 'job'), story, timeline, seed: 42, audioDir, music,
    sfxMap: { cut: 'whoosh.wav', 'act:jump': 'boing.wav', 'act:fall': 'boing.wav' },
  });
  html = readFileSync(join(compDir, 'index.html'), 'utf8');
});
after(() => rmSync(tmp, { recursive: true, force: true }));

test('root declares composition id, size and data-duration = timeline.duration', () => {
  const root = /<div id="story"[^>]*>/.exec(html)![0];
  assert.match(root, /data-composition-id="story"/);
  assert.match(root, /data-width="1080"/);
  assert.match(root, /data-height="1920"/);
  assert.equal(Number(/data-duration="([\d.]+)"/.exec(root)![1]), Math.round(timeline.duration * 1000) / 1000);
});

test('every <audio> has a unique id and a src that exists in comp/', () => {
  const tags = html.match(/<audio [^>]*>/g)!;
  assert.ok(tags.length >= timeline.beats.length);
  const ids = tags.map((t) => /id="([^"]+)"/.exec(t)![1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of tags) assert.ok(existsSync(join(compDir, /src="([^"]+)"/.exec(t)![1])), t);
  assert.equal(ids.filter((i) => i.startsWith('vo-')).length, timeline.beats.length);
  assert.ok(ids.includes('vo-0-0'));
  assert.ok(tags.filter((t) => / id="vo-/.test(t)).every((t) => /data-audio-group="voiceover"/.test(t)));
  assert.ok(tags.filter((t) => / id="sfx-/.test(t)).every((t) => /data-volume="0.6"/.test(t)));
  assert.ok(tags.some((t) => / id="music-0"/.test(t) && /data-automation='/.test(t)));
});

test('one .cap per caption chunk, one <span> per word', () => {
  const chunks = captionChunks(timeline.beats);
  assert.equal((html.match(/class="cap clip"/g) ?? []).length, chunks.length);
  assert.equal((html.match(/class="w"/g) ?? []).length, chunks.reduce((n, c) => n + c.words.length, 0));
});

test('no "[" in the visible text', () => {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const text = body.replace(/<[^>]+>/g, ' ');
  assert.ok(!text.includes('['), text.slice(text.indexOf('[') - 20, text.indexOf('[') + 20));
});

test('no http URL anywhere in the HTML; the files it needs are local', () => {
  assert.ok(!/https?:\/\//i.test(html));
  for (const f of ['engine.js', 'gsap.min.js', 'fonts/Rubik-Variable.ttf', 'characters/emily/character.json']) {
    assert.ok(existsSync(join(compDir, f)), f);
  }
});

test('hyperframes lint reports 0 errors', () => {
  let out = '';
  try {
    out = execFileSync(process.execPath, [HYPERFRAMES, 'lint', compDir, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e as { stdout?: string }).stdout ?? '';
    assert.fail(`lint failed: ${out || String(e)}`);
  }
  const report = JSON.parse(out.slice(out.indexOf('{')));
  assert.equal(report.ok, true, out);
  assert.ok(report.filesScanned > 0, 'lint scanned nothing');
  assert.equal(report.errorCount, 0, out);
});
