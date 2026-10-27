import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config.ts';
import { jobPath, readStatus, setStatus } from '../jobs/store.ts';
import type { Story, Timing } from '../types.ts';
import { synthesize, type ElevenDeps } from './eleven.ts';

export type VoiceDeps = ElevenDeps & { config: Config; voices: Record<string, string> };

export const loadVoices = (assetsDir: string): Record<string, string> =>
  JSON.parse(readFileSync(join(assetsDir, 'voices.json'), 'utf8')) as Record<string, string>;

const HERO_VOICE = 'emily';

function voiceIdFor(story: Story, who: string, voices: Record<string, string>): { key: string; id: string } {
  const member = story.cast.find((c) => c.id === who);
  if (!member) throw new Error(`beat speaker "${who}" is not in the cast`);
  const key = member.ref === 'hero' ? HERO_VOICE : member.voice!;
  const id = voices[key];
  if (!id) throw new Error(`no ElevenLabs voice id for "${key}": fill it in assets/voices.json`);
  return { key, id };
}

/** Voices every beat of an `approved` job: one mp3 per beat in `audio/`, word timings in `timing.json`, state `voiced`. */
export async function voiceJob(deps: VoiceDeps, root: string, id: string): Promise<void> {
  const status = readStatus(root, id);
  if (status.state !== 'approved') {
    if (status.state === 'voiced' || status.state === 'built' || status.state === 'rendered') return; // already done
    throw new Error(`job ${id} is ${status.state}; only an approved job can be voiced`);
  }
  const story = JSON.parse(readFileSync(jobPath(root, id, 'story.json'), 'utf8')) as Story;
  const audioDir = jobPath(root, id, 'audio');
  mkdirSync(audioDir, { recursive: true });

  const lines: Timing['lines'] = [];
  for (const [si, scene] of story.scenes.entries()) {
    for (const [bi, beat] of scene.beats.entries()) {
      const { id: voiceId } = voiceIdFor(story, beat.say?.who ?? 'emily', deps.voices);
      const text = beat.say?.line ?? beat.narrate!;
      const r = await synthesize(deps, { text, voiceId, model: deps.config.voice.model, format: deps.config.voice.format });
      const file = `audio/${si}.${bi}.mp3`;
      const dest = jobPath(root, id, file);
      if (!existsSync(dest)) copyFileSync(r.mp3, dest);
      lines.push({ beatId: `${si}.${bi}`, file, duration: r.duration, words: r.words });
    }
  }
  writeFileSync(jobPath(root, id, 'timing.json'), JSON.stringify({ lines } satisfies Timing, null, 2));
  setStatus(root, id, 'voiced');
}
