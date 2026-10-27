import type { Story, TimedBeat, WordTiming } from '../types.ts';

export type CaptionChunk = { start: number; end: number; speaker: string; kind: 'narrate' | 'say'; words: WordTiming[] };

const MAX_WORDS = 3;
const TAIL = 0.2;

/** Karaoke chunks: <= 3 words, broken after . , ! ? ; emotion tags like [sad] are removed. */
export function captionChunks(beats: TimedBeat[]): CaptionChunk[] {
  const out: CaptionChunk[] = [];
  for (const beat of beats) {
    const words = beat.words
      .map((w) => ({ ...w, word: w.word.replace(/\[[^\]]*\]?|\]/g, '') }))
      .filter((w) => w.word.trim() !== '');
    const groups: WordTiming[][] = [];
    let cur: WordTiming[] = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length === MAX_WORDS || /[.,!?]["')]*$/.test(w.word)) { groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    groups.forEach((g, i) => {
      const next = groups[i + 1];
      out.push({
        start: g[0].start,
        end: next ? next[0].start : g[g.length - 1].end + TAIL,
        speaker: beat.speaker, kind: beat.kind, words: g,
      });
    });
  }
  return out;
}

const WHITE = '#ffffff';
const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Narration white, Emily pink, others their shirt lightened 35% toward white; unknown -> white. */
export function captionColor(speaker: string, story: Story, kind: 'narrate' | 'say' = 'say'): string {
  if (kind === 'narrate') return WHITE;
  if (speaker === 'emily') return '#ff8fb1';
  const shirt = story.cast.find((c) => c.id === speaker)?.look?.shirt;
  const m = shirt && /^#([0-9a-f]{6})$/i.exec(shirt);
  if (!m) return WHITE;
  const n = parseInt(m[1], 16);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => hex(c + (255 - c) * 0.35)).join('');
}
