// Visual regression of the end-to-end fixture. Run with `npm run test:visual`; kept out of `npm test`
// because it drives Chrome (about 20 s). Missing approved PNGs are written on the first run (review them
// before committing); `UPDATE_VISUAL=1` re-approves every frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { buildFixtureComp } from '../../scripts/fixture-lib.ts';
import { HYPERFRAMES } from '../../src/render/render.ts';

const MAX_DIFF = 0.005; // fraction of pixels allowed to differ
const approvedDir = fileURLToPath(new URL('./approved/', import.meta.url));

test('fixture frames match the approved stills', { timeout: 600_000 }, async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'visual-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const { compDir, timeline } = await buildFixtureComp(join(tmp, 'job'));

  // The middle of each scene, plus one frame either side of the first cut.
  const cut = timeline.scenes[1].start;
  const times = [...timeline.scenes.map((s) => (s.start + s.end) / 2), cut - 0.05, cut + 0.05].map((x) => Math.round(x * 100) / 100);
  const out = join(tmp, 'snap');
  mkdirSync(out);
  execFileSync(process.execPath, [HYPERFRAMES, 'snapshot', compDir, '--at', times.join(','), '--no-end', '-o', out], { stdio: 'ignore' });
  const shots = readdirSync(out).filter((f) => /^frame-\d+-at-.*\.png$/.test(f)).sort();
  assert.equal(shots.length, times.length, `expected ${times.length} snapshots, got ${shots.join(', ')}`);

  mkdirSync(approvedDir, { recursive: true });
  const written: string[] = [];
  const failures: string[] = [];
  shots.forEach((file, i) => {
    const name = `e2e-${times[i].toFixed(2)}s.png`;
    const approved = join(approvedDir, name);
    if (process.env.UPDATE_VISUAL || !existsSync(approved)) {
      writeFileSync(approved, readFileSync(join(out, file)));
      written.push(name);
      return;
    }
    const a = PNG.sync.read(readFileSync(approved)), b = PNG.sync.read(readFileSync(join(out, file)));
    if (a.width !== b.width || a.height !== b.height) { failures.push(`${name}: size ${b.width}x${b.height}, approved ${a.width}x${a.height}`); return; }
    const diff = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
    const ratio = diff / (a.width * a.height);
    if (ratio > MAX_DIFF) {
      writeFileSync(join(approvedDir, name.replace('.png', '.actual.png')), readFileSync(join(out, file)));
      failures.push(`${name}: ${(ratio * 100).toFixed(2)}% of pixels differ (max ${MAX_DIFF * 100}%); see ${name.replace('.png', '.actual.png')}`);
    }
  });
  if (written.length) t.diagnostic(`approved on this run: ${written.join(', ')}`);
  assert.deepEqual(failures, []);
});
