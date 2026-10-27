import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runChecks } from '../src/render/checks.ts';
import { normalizeLoudness, renderComp } from '../src/render/render.ts';
import { buildFixtureComp, ROOT } from './fixture-lib.ts';

const jobDir = resolve(ROOT, 'jobs/fixture');
const { compDir, timeline } = await buildFixtureComp(jobDir);
if (process.argv.includes('--comp-only')) { console.log(compDir); process.exit(0); }

const log: string[] = [];
const say = (s: string) => { console.log(s); log.push(s); };

const raw = join(jobDir, 'raw.mp4');
const workers = process.env.WORKERS ? (process.env.WORKERS === 'auto' ? 'auto' : Number(process.env.WORKERS)) : undefined;
const rendered = await renderComp(compDir, raw, { workers });
say(`render: ${rendered.seconds.toFixed(1)} s for a ${timeline.duration.toFixed(1)} s video`);
log.push('--- render output ---', rendered.log);

const before = await normalizeLoudness(raw, join(jobDir, 'final.mp4'));
say(`loudness before normalizing: ${before.input_i} LUFS`);

const result = await runChecks(join(jobDir, 'final.mp4'));
say(`checks: ${result.ok ? 'ok' : 'FAILED'}`);
for (const f of result.failures) say(`  - ${f}`);
writeFileSync(join(jobDir, 'log.txt'), log.join('\n'));
if (!result.ok) process.exitCode = 1;
