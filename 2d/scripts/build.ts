// uso: npx tsx scripts/build.ts <story> <ep> [--still=<frame>] [--no-render]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { Bible, EpisodeScript, FPS, Timeline } from '../src/types';
import { speak } from './tts';
import { ensureSfx } from './sfx';

const [story, epArg, ...flags] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const bible: Bible = JSON.parse(fs.readFileSync(`${root}/stories/${story}/bible.json`, 'utf8'));
const script: EpisodeScript = JSON.parse(fs.readFileSync(`${root}/stories/${story}/ep${epArg}.json`, 'utf8'));
const strip = (t: string) => t.replace(/[\[\]]/g, '');
const PAD = 0.3;
// ambiente procedural (drone + ruido grave), gratis
if (script.ambient) {
  const amb = `${root}/public/audio/ambient-${script.ambient}.mp3`;
  fs.mkdirSync(path.dirname(amb), { recursive: true });
  if (!fs.existsSync(amb))
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=f=52:d=120', '-f', 'lavfi', '-i', 'sine=f=55.5:d=120', '-f', 'lavfi', '-i', 'anoisesrc=d=120:c=brown:a=0.5', '-filter_complex', '[0][1]amix=inputs=2[d];[2]lowpass=f=500[n];[d][n]amix=inputs=2,tremolo=f=0.12:d=0.5,volume=2.2', '-t', '120', amb], { stdio: 'ignore' });
}
ensureSfx(root);
let cursor = 0;
let spent = 0;
for (const [si, sc] of script.scenes.entries()) {
  sc.from = cursor;
  let local = 0;
  for (const b of sc.beats) {
    const isNarr = b.who === 'narr';
    const def = bible.characters[b.who];
    const sp = await speak({
      text: strip(b.t),
      voiceId: isNarr ? bible.narratorId : def?.voiceId,
      edgeVoice: isNarr ? bible.narrator : def?.voice ?? bible.narrator,
      root, fps: FPS, stability: isNarr ? 0.55 : 0.4,
    });
    let secs: number;
    if (sp) { b.audio = sp.file; b.ws = sp.ws; b.env = sp.env; secs = sp.secs; spent += strip(b.t).length; }
    else secs = Math.max(1.2, strip(b.t).split(' ').length * 0.38);
    b.from = local;
    b.frames = Math.round((secs + PAD) * FPS);
    local += b.frames;
  }
  sc.frames = local;
  cursor += local;
}
console.log(`voz: ${spent ? 'ok' : 'sem audio (estimado)'} · ${spent} caracteres`);
const ctaFrames = Math.round(4.5 * FPS);
const timeline: Timeline = { ...script, fps: FPS, ctaFrames, totalFrames: cursor + ctaFrames };
fs.mkdirSync(`${root}/out`, { recursive: true });
fs.writeFileSync(`${root}/out/${story}-ep${epArg}.timeline.json`, JSON.stringify(timeline, null, 1));
console.log(`timeline: ${(timeline.totalFrames / FPS).toFixed(1)}s, ${timeline.scenes.length} cenas`);
if (flags.includes('--no-render')) process.exit(0);

const findChrome = () => {
  if (process.env.BROWSER_EXE) return process.env.BROWSER_EXE;
  const base = '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined; // Remotion baixa o seu proprio Chromium
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-'))) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) if (fs.existsSync(`${base}/${d}/${sub}`)) return `${base}/${d}/${sub}`;
  }
  return undefined;
};
const browserExecutable = findChrome();
const serveUrl = await bundle({ entryPoint: `${root}/src/index.ts`, publicDir: `${root}/public` });
const inputProps = { timeline, bible };
const comp = await selectComposition({ serveUrl, id: 'Episode', inputProps, browserExecutable });
const stills = flags.find((f) => f.startsWith('--stills='));
const still = flags.find((f) => f.startsWith('--still='));
if (stills) {
  for (const frame of stills.split('=')[1].split(',').map(Number)) {
    const output = `${root}/out/${story}-ep${epArg}-f${frame}.png`;
    await renderStill({ composition: comp, serveUrl, output, frame, inputProps, browserExecutable });
    console.log('still:', output);
  }
} else if (still) {
  const frame = Number(still.split('=')[1]);
  const output = `${root}/out/${story}-ep${epArg}-f${frame}.png`;
  await renderStill({ composition: comp, serveUrl, output, frame, inputProps, browserExecutable });
  console.log('still:', output);
} else {
  const rg = flags.find((f) => f.startsWith('--range='));
  const range: [number, number] | undefined = rg ? (rg.split('=')[1].split('-').map(Number) as [number, number]) : undefined;
  let last = -1;
  const outputLocation = `${root}/out/${story}-ep${epArg}.mp4`;
  await renderMedia({ composition: comp, serveUrl, codec: 'h264', outputLocation: range ? outputLocation.replace('.mp4', '-preview.mp4') : outputLocation, frameRange: range, inputProps, browserExecutable, onProgress: ({ progress }) => { const p = Math.floor(progress * 10) * 10; if (p > last) { last = p; process.stdout.write(`render ${p}%\n`); } } });
  console.log('ok:', range ? outputLocation.replace('.mp4', '-preview.mp4') : outputLocation);
}
