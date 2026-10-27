import type { WordTiming } from '../types.ts';

export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

/**
 * Groups ElevenLabs' per-character timings into words. Anything inside `[...]` (Eleven v3 emotion tags) is
 * dead time, not a word, so captions never see it. Times are seconds from the start of the audio.
 */
export function wordsFromAlignment(_text: string, alignment: Alignment): WordTiming[] {
  const { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const words: WordTiming[] = [];
  let cur: WordTiming | null = null;
  let depth = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '[') { depth++; cur = flush(cur, words); continue; }
    if (c === ']') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    if (/\s/.test(c)) { cur = flush(cur, words); continue; }
    if (!cur) cur = { word: c, start: starts[i], end: ends[i] };
    else { cur.word += c; cur.end = ends[i]; }
  }
  flush(cur, words);
  return words;
}

function flush(cur: WordTiming | null, words: WordTiming[]): null {
  if (cur) words.push(cur);
  return null;
}
