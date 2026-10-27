import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicAutomation, musicClips, sfxEvents } from './audio.ts';
import { bundleEngine } from './bundle.ts';
import { captionChunks, captionColor } from './captions.ts';
import { charactersDir, loadRoster, type Roster } from '../characters/roster.ts';
import { rosterIdOf } from '../story/cast.ts';
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
  sfxMap: Record<string, string | string[]>;
  /** Where `characters/<id>/` live; defaults to the project's assets folder. */
  assetsDir?: string;
};

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HIGHLIGHT = '#ffe14d';
const W = 1080, H = 1920;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

const THUMB = '<svg viewBox="0 0 24 24" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"><path d="M2 10h4v11H2zM8 10l4-8c1.7 0 2.8 1.3 2.5 3L14 9h6a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 18.4 21H8z"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"><path d="M12 2a6 6 0 0 0-6 6v4l-2 4v1h16v-1l-2-4V8a6 6 0 0 0-6-6zM9.5 19a2.5 2.5 0 0 0 5 0z"/></svg>';

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
  const assetsDir = opts.assetsDir ?? join(ROOT, 'assets');
  const allRoster = loadRoster(assetsDir);
  // Only the characters this story uses go into the composition (id -> info).
  const roster: Roster = {};
  for (const member of story.cast) {
    const id = rosterIdOf(member);
    if (!id) continue;
    if (!allRoster[id]) throw new Error(`cast member "${member.id}" refers to character "${id}", which is not in ${charactersDir(assetsDir)}`);
    roster[id] = allRoster[id];
  }
  const compDir = join(jobDir, 'comp');
  await mkdir(compDir, { recursive: true });
  const taken = new Map<string, string>();

  const speakerName = (id: string) => {
    const member = story.cast.find((m) => m.id === id);
    return member?.name ?? roster[rosterIdOf(member ?? {}) ?? id]?.name ?? id;
  };

  // --- captions ---
  const chunks = captionChunks(timeline.beats);
  const capHtml: string[] = [];
  const tweens: string[] = [];
  chunks.forEach((c, i) => {
    const id = `cap-${i}`;
    const dur = Math.max(c.end - c.start, 0.05);
    const name = c.kind === 'say'
      ? `<div class="who" style="color:${captionColor(c.speaker, story, c.kind, roster)}">${esc(speakerName(c.speaker))}</div>`
      : '';
    const words = c.words.map((w, j) => `<span id="${id}-w${j}" class="w">${esc(w.word)}</span>`).join(' ');
    capHtml.push(`<div id="${id}" class="cap clip" data-start="${num(c.start)}" data-duration="${num(dur)}" data-track-index="2"><div id="${id}-in" class="cap-in">${name}<div class="line">${words}</div></div></div>`);
    // In: rise and settle with a small overshoot. Out: lift and fade, finished before the next chunk comes in.
    const inDur = Math.min(0.24, dur * 0.35), outDur = Math.min(0.14, dur * 0.25);
    tweens.push(`tl.fromTo("#${id}-in",{opacity:0,y:34,scale:0.88},{opacity:1,y:0,scale:1,duration:${num(inDur)},ease:"back.out(1.8)"},${num(c.start)});`);
    tweens.push(`tl.to("#${id}-in",{opacity:0,y:-16,scale:0.96,duration:${num(outDur)},ease:"power2.in"},${num(Math.max(c.start + inDur, c.end - outDur))});`);
    c.words.forEach((w, j) => {
      const ws = Math.max(w.start, c.start), we = Math.min(Math.max(w.end, ws + 0.12), c.end);
      tweens.push(`tl.fromTo("#${id}-w${j}",{color:"#ffffff",scale:1},{color:"${HIGHLIGHT}",scale:1.08,duration:0.12,ease:"back.out(2.2)"},${num(ws)});`);
      tweens.push(`tl.to("#${id}-w${j}",{color:"#ffffff",scale:1,duration:0.14,ease:"power2.out"},${num(Math.max(we - 0.04, ws + 0.12))});`);
    });
  });

  // --- end card: from the last beat to the end, below the captions and above the unsafe bottom band ---
  const endHtml: string[] = [];
  const cta = story.cta;
  const endStart = timeline.beats.at(-1)?.start ?? 0;
  if (cta) {
    const endDur = Math.max(timeline.duration - endStart, 0.5);
    const pop = (sel: string, at: number) => tweens.push(`tl.fromTo("${sel}",{opacity:0,scale:0.4,y:40},{opacity:1,scale:1,y:0,duration:0.4,ease:"back.out(2.2)"},${num(endStart + at)});`);
    if (cta.kind === 'subscribe') {
      const label = cta.next ? `PART ${cta.next}` : 'NEXT PART';
      endHtml.push(`<div id="end-badge" class="end-badge">${esc(label)}</div>
<div class="end-row"><div id="end-like" class="end-btn like">${THUMB}<span>LIKE</span></div><div id="end-sub" class="end-btn sub">${BELL}<span>SUBSCRIBE</span></div></div>`);
      pop('#end-badge', 0.1); pop('#end-like', 0.35); pop('#end-sub', 0.6);
      tweens.push(`tl.to("#end-sub",{scale:1.08,duration:0.35,yoyo:true,repeat:3,ease:"sine.inOut"},${num(endStart + 1.1)});`);
    } else {
      endHtml.push(`<div id="end-q" class="end-q">${esc(cta.question ?? 'Comment A or B')}</div>
<div class="end-row"><div id="end-a" class="end-card a"><b>A</b><span>${esc(cta.a ?? '')}</span></div><div id="end-b" class="end-card b"><b>B</b><span>${esc(cta.b ?? '')}</span></div></div>
<div id="end-hint" class="end-hint">COMMENT A OR B</div>`);
      pop('#end-q', 0.1); pop('#end-a', 0.4); pop('#end-b', 0.7); pop('#end-hint', 1.0);
    }
    void endDur;
  }

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
  for (const id of Object.keys(roster)) await cp(join(charactersDir(assetsDir), id), join(compDir, 'characters', id), { recursive: true });

  const duration = num(timeline.duration);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(story.title)}</title>
<style>
@font-face { font-family: "Rubik"; src: url("fonts/Rubik-Variable.ttf") format("truetype"); font-weight: 300 900; }
html, body { margin: 0; background: #000; }
#story { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
#stage { position: absolute; inset: 0; }
#stage canvas { width: 100%; height: 100%; display: block; filter: contrast(1.07) saturate(1.12); }
#vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(10,8,20,.34) 100%); }
#captions { position: absolute; inset: 0; pointer-events: none; }
/* The band is centred on 30% of the height without a CSS transform, so GSAP owns every transform of the inner block. */
.cap { position: absolute; top: 21%; height: 18%; left: 6%; right: 12%; display: flex; align-items: center; justify-content: center; text-align: center; }
.cap-in { display: flex; flex-direction: column; align-items: center; font-family: "Rubik", sans-serif; color: #fff; will-change: transform, opacity; }
.cap .who { font-size: 40px; font-weight: 800; letter-spacing: 0.02em; line-height: 1.1; margin-bottom: 10px; -webkit-text-stroke: 7px #000; paint-order: stroke fill; text-shadow: 0 4px 10px rgba(0,0,0,.55); }
.cap .line { white-space: nowrap; font-size: 80px; font-weight: 900; line-height: 1.08; -webkit-text-stroke: 12px #000; paint-order: stroke fill; text-shadow: 0 7px 16px rgba(0,0,0,.6); }
#end { position: absolute; left: 5%; right: 5%; top: 56%; display: flex; flex-direction: column; align-items: center; gap: 28px; font-family: "Rubik", sans-serif; color: #fff; pointer-events: none; }
#end > :not(.end-row), .end-row > * { will-change: transform, opacity; opacity: 0; }
.end-badge { font-size: 110px; font-weight: 900; background: #ffd166; color: #1a1a1a; padding: 6px 44px; border-radius: 28px; border: 8px solid #000; box-shadow: 0 10px 0 #000; }
.end-row { display: flex; gap: 28px; width: 100%; justify-content: center; }
.end-btn { display: flex; align-items: center; gap: 18px; font-size: 56px; font-weight: 900; padding: 20px 36px; border-radius: 26px; border: 7px solid #000; box-shadow: 0 8px 0 #000; }
.end-btn svg { width: 64px; height: 64px; }
.end-btn.like { background: #3b82f6; } .end-btn.sub { background: #ef2d3c; }
.end-q { font-size: 64px; font-weight: 900; text-align: center; line-height: 1.1; -webkit-text-stroke: 10px #000; paint-order: stroke fill; text-shadow: 0 6px 14px rgba(0,0,0,.6); }
.end-card { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 16px; border-radius: 28px; border: 8px solid #000; box-shadow: 0 10px 0 #000; text-align: center; }
.end-card b { font-size: 120px; line-height: 1; }
.end-card span { font-size: 40px; font-weight: 800; line-height: 1.1; }
.end-card.a { background: #22c55e; } .end-card.b { background: #ef2d3c; }
.end-hint { font-size: 48px; font-weight: 900; -webkit-text-stroke: 8px #000; paint-order: stroke fill; }
.cap .w { display: inline-block; color: #fff; margin: 0 0.14em; }
</style>
</head>
<body>
<div id="story" data-composition-id="story" data-start="0" data-width="${W}" data-height="${H}" data-duration="${duration}">
<div id="stage"></div>
<div id="vignette"></div>
<div id="captions" data-track-kind="captions">
${capHtml.join('\n')}
</div>
<div id="end">${endHtml.join('\n')}</div>
${audioHtml.join('\n')}
</div>
<script type="application/json" id="scene">${json({ story, timeline, seed, roster })}</script>
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
