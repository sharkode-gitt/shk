import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WordTiming } from '../types.ts';
import { wordsFromAlignment, type Alignment } from './timing.ts';

export class ElevenError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'ElevenError'; }
}
/** The account has no credits left; callers stop the whole run instead of failing one job. */
export class QuotaExceededError extends ElevenError {
  constructor(message = 'ElevenLabs credits are used up (quota_exceeded)') { super(message, 401); this.name = 'QuotaExceededError'; }
}

export type ElevenDeps = { fetch: typeof fetch; apiKey: string; cacheDir: string; sleep?: (ms: number) => Promise<void> };
export type SynthRequest = { text: string; voiceId: string; model: string; format: string };
export type Synthesis = { mp3: string; words: WordTiming[]; duration: number; cached: boolean };

const API = 'https://api.elevenlabs.io/v1/text-to-speech';
const RETRY_WAITS_MS = [1000, 2000, 4000, 8000, 16000];
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const cacheKey = (r: SynthRequest) => createHash('sha256').update(`${r.text}|${r.voiceId}|${r.model}|${r.format}`).digest('hex');

/** Text to speech with per-word timings. The result is cached on disk by (text, voice, model, format), so repeats cost nothing. */
export async function synthesize(deps: ElevenDeps, req: SynthRequest): Promise<Synthesis> {
  const key = cacheKey(req);
  mkdirSync(deps.cacheDir, { recursive: true });
  const mp3 = join(deps.cacheDir, `${key}.mp3`);
  const meta = join(deps.cacheDir, `${key}.json`);
  if (existsSync(mp3) && existsSync(meta)) {
    const { words, duration } = JSON.parse(readFileSync(meta, 'utf8')) as { words: WordTiming[]; duration: number };
    return { mp3, words, duration, cached: true };
  }

  const sleep = deps.sleep ?? defaultSleep;
  const url = `${API}/${encodeURIComponent(req.voiceId)}/with-timestamps?output_format=${encodeURIComponent(req.format)}`;
  let res: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    res = await deps.fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': deps.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text: req.text, model_id: req.model }),
    });
    const transient = res.status === 429 || res.status >= 500;
    if (!transient) break;
    if (attempt >= RETRY_WAITS_MS.length) throw new ElevenError(`ElevenLabs kept failing (HTTP ${res.status}) after ${attempt} retries`, res.status);
    await sleep(RETRY_WAITS_MS[attempt]);
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && /quota_exceeded/.test(body)) throw new QuotaExceededError();
    throw new ElevenError(`ElevenLabs rejected the request (HTTP ${res.status}): ${body.slice(0, 500)}`, res.status);
  }
  const data = (await res.json()) as { audio_base64: string; alignment: Alignment | null };
  if (!data.audio_base64 || !data.alignment?.characters?.length) throw new ElevenError('ElevenLabs answered without audio or word timings');
  const words = wordsFromAlignment(req.text, data.alignment);
  const ends = data.alignment.character_end_times_seconds;
  const duration = ends[ends.length - 1];
  writeFileSync(mp3, Buffer.from(data.audio_base64, 'base64'));
  writeFileSync(meta, JSON.stringify({ words, duration }));
  return { mp3, words, duration, cached: false };
}
