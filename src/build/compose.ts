import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicAutomation, musicClips, sfxEvents } from './audio.ts';
import { bundleEngine } from './bundle.ts';
import { captionChunks, captionColor } from './captions.ts';
import type { Mood, Story, Timeline } from '../types.ts';

export type CompositionOptions = {
  jobDir: string;
  story: Story;
  timeline: Timeline;
  seed: number;
  /** Voice files named by `beat.audio.file` are looked up here (as given, then by basename). */
  audioDir: string;
  /** Mood -> music files, absolute or relative to `audioDir`. */
  music: Record<Mood, string[]>;
  /** `act:<name>` / `cut` -> sound file, absolute or relative to `audioDir`. */
  sfxMap: Record<string, string>;
};

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HIGHLIGHT = '#ffe14d';
const W = 1080, H = 1920;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Copies a sound file into comp/audio/<group>/ and returns its comp-relative path. */
async function stage(compDir: string, audioDir: string, group: string, file: string, taken: Map<string, string>): Promise<string> {
  const candidates = isAbsolute(file) ? [file] : [resolve(audioDir, file), resolve(audioDir, basename(file)), resolve(ROOT, file)];
  const src = candidates.find((c) => existsSync(c));
  if (!src) throw new Error(`audio file not found: ${file} (looked in ${candidates.join(', ')})`);
  let rel = `audio/${group}/${basename(src)}`;
  const owner = taken.get(rel);
  if (owner && owner !== src) rel = `audio/${group}/${taken.size}-${basename(src)}`; // same name, different file
  taken.set(rel, src);
  await mkdir(dirname(join(compDir, rel)), { recursive: true });
  await copyFile(src, join(compDir, rel));
  return rel;
}

/** Writes jobDir/comp/ (index.html plus everything it loads) and returns its path. */
export async function writeComposition(opts: CompositionOptions): Promise<string> {
  const { jobDir, story, timeline, seed, audioDir, music, sfxMap } = opts;
  const compDir = join(jobDir, 'comp');
  await mkdir(compDir, { recursive: true });
  const taken = new Map<string, string>();

  // --- captions ---
  const chunks = captionChunks(timeline.beats);
  const capHtml: string[] = [];
  const tweens: string[] = [];
  chunks.forEach((c, i) => {
    const id = `cap-${i}`;
    const dur = Math.max(c.end - c.start, 0.05);
    const name = c.kind === 'say'
      ? `<div class="who" style="color:${captionColor(c.speaker, story, c.kind)}">${esc(story.cast.find((m) => m.id === c.speaker)?.name ?? c.speaker)}</div>`
      : '';
    const words = c.words.map((w, j) => `<span id="${id}-w${j}" class="w">${esc(w.word)}</span>`).join(' ');
    capHtml.push(`<div id="${id}" class="cap clip" data-start="${num(c.start)}" data-duration="${num(dur)}" data-track-index="2">${name}<div class="line">${words}</div></div>`);
    tweens.push(`tl.fromTo("#${id}",{opacity:0},{opacity:1,duration:0.08,ease:"power1.out"},${num(c.start)});`);
    tweens.push(`tl.to("#${id}",{opacity:0,duration:0.08,ease:"power1.in"},${num(Math.max(c.start, c.end - 0.08))});`);
    c.words.forEach((w, j) => {
      const ws = Math.max(w.start, c.start), we = Math.min(Math.max(w.end, ws + 0.1), c.end);
      tweens.push(`tl.fromTo("#${id}-w${j}",{color:"#ffffff",scale:1},{color:"${HIGHLIGHT}",scale:1.12,duration:0.06,ease:"power2.out"},${num(ws)});`);
      tweens.push(`tl.to("#${id}-w${j}",{color:"#ffffff",scale:1,duration:0.06,ease:"power2.in"},${num(Math.max(we - 0.06, ws + 0.06))});`);
    });
  });

  // --- audio ---
  const audioHtml: string[] = [];
  for (const b of timeline.beats) {
    const rel = await stage(compDir, audioDir, 'voice', b.audio.file, taken);
    audioHtml.push(`<audio id="vo-${b.id.replace(/\./g, '-')}" class="clip" src="${esc(rel)}" data-start="${num(b.audio.start)}" data-duration="${num(b.audio.duration)}" data-track-index="10" data-volume="1" data-audio-group="voiceover"></audio>`);
  }
  const clips = musicClips(timeline, music, seed);
  for (let n = 0; n < clips.length; n++) {
    const c = clips[n];
    const rel = await stage(compDir, audioDir, 'music', c.file, taken);
    const beats = timeline.beats.filter((b) => b.audio.start + b.audio.duration > c.start && b.audio.start < c.end);
    const automation = musicAutomation(c, beats);
    audioHtml.push(`<audio id="music-${n}" class="clip" src="${esc(rel)}" data-start="${num(c.start)}" data-duration="${num(c.end - c.start)}" data-track-index="11" data-volume="1" data-automation='${json(automation)}'></audio>`);
  }
  const sfx = sfxEvents(timeline, sfxMap);
  for (let n = 0; n < sfx.length; n++) {
    const rel = await stage(compDir, audioDir, 'sfx', sfx[n].file, taken);
    audioHtml.push(`<audio id="sfx-${n}" class="clip" src="${esc(rel)}" data-start="${num(sfx[n].at)}" data-duration="${num(Math.min(2, timeline.duration - sfx[n].at))}" data-track-index="12" data-volume="0.6"></audio>`);
  }

  // --- files ---
  await bundleEngine(join(compDir, 'engine.js'));
  await copyFile(join(ROOT, 'node_modules/gsap/dist/gsap.min.js'), join(compDir, 'gsap.min.js'));
  await cp(join(ROOT, 'assets/fonts'), join(compDir, 'fonts'), { recursive: true });
  await cp(join(ROOT, 'assets/emily'), join(compDir, 'emily'), { recursive: true });

  const duration = num(timeline.duration);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(story.title)}</title>
<style>
@font-face { font-family: "Lilita One"; src: url("fonts/LilitaOne-Regular.ttf") format("truetype"); }
html, body { margin: 0; background: #000; }
#story { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
#stage { position: absolute; inset: 0; }
#stage canvas { width: 100%; height: 100%; display: block; }
#captions { position: absolute; inset: 0; pointer-events: none; }
.cap { position: absolute; top: 30%; left: 6%; right: 12%; transform: translateY(-50%); text-align: center; font-family: "Lilita One", sans-serif; color: #fff; }
.cap .who { font-size: 40px; line-height: 1.1; margin-bottom: 8px; -webkit-text-stroke: 6px #000; paint-order: stroke fill; text-shadow: 0 4px 10px rgba(0,0,0,.55); }
.cap .line { font-size: 92px; line-height: 1.1; -webkit-text-stroke: 10px #000; paint-order: stroke fill; text-shadow: 0 6px 14px rgba(0,0,0,.6); }
.cap .w { display: inline-block; color: #fff; }
</style>
</head>
<body>
<div id="story" data-composition-id="story" data-start="0" data-width="${W}" data-height="${H}" data-duration="${duration}">
<div id="stage"></div>
<div id="captions" data-track-kind="captions">
${capHtml.join('\n')}
</div>
${audioHtml.join('\n')}
</div>
<script type="application/json" id="scene">${json({ story, timeline, seed })}</script>
<script src="gsap.min.js"></script>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${tweens.join('\n')}
window.__timelines["story"] = tl;
</script>
<script type="module" src="engine.js"></script>
</body>
</html>
`;
  await writeFile(join(compDir, 'index.html'), html);
  return compDir;
}
