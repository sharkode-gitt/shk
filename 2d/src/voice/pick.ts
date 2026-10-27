import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VOICES } from '../vocab.ts';

export type AccountVoice = { id: string; name: string; gender: string; age: string; category: string; description: string };

/** The account's voices (premade ones, plus any cloned or added from the Voice Library). */
export async function listVoices(deps: { fetch: typeof fetch; apiKey: string }): Promise<AccountVoice[]> {
  const res = await deps.fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': deps.apiKey } });
  if (!res.ok) throw new Error(`ElevenLabs could not list voices (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { voices?: { voice_id: string; name: string; category?: string; description?: string; labels?: Record<string, string> }[] };
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id, name: v.name, category: v.category ?? '', description: v.description ?? '',
    gender: (v.labels?.gender ?? '').toLowerCase(), age: (v.labels?.age ?? '').toLowerCase().replace(/[\s-]+/g, '_'),
  }));
}

/** What each archetype should sound like, best match first: [gender, age]. */
const WANTED: Record<(typeof VOICES)[number], [string, string][]> = {
  mom: [['female', 'middle_aged'], ['female', 'young'], ['female', '']],
  dad: [['male', 'middle_aged'], ['male', 'old'], ['male', '']],
  teen_girl: [['female', 'young'], ['female', '']],
  little_brother: [['male', 'young'], ['male', '']],
  boy: [['male', 'young'], ['male', 'middle_aged'], ['male', '']],
  teacher: [['female', 'middle_aged'], ['male', 'middle_aged'], ['', 'middle_aged']],
  old_lady: [['female', 'old'], ['female', 'middle_aged'], ['female', '']],
};
/** "Emily" is filled in by the user (a girl of about 12); the helper only fills the others. */
const matches = (v: AccountVoice, [gender, age]: [string, string]) => (!gender || v.gender === gender) && (!age || v.age === age);

/**
 * Suggests a voice for every archetype that is still empty in `current`, never giving the same voice to two roles
 * while another candidate exists. Roles already filled are left alone (and their voices are not reused).
 */
export function pickVoices(voices: AccountVoice[], current: Record<string, string>): { picks: Record<string, AccountVoice>; missing: string[] } {
  const used = new Set(Object.values(current).filter(Boolean));
  const picks: Record<string, AccountVoice> = {};
  const missing: string[] = [];
  for (const role of VOICES) {
    if (current[role]) continue;
    let found: AccountVoice | undefined;
    for (const want of WANTED[role]) {
      found = voices.find((v) => matches(v, want) && !used.has(v.id));
      if (found) break;
    }
    if (found) { picks[role] = found; used.add(found.id); } else missing.push(role);
  }
  return { picks, missing };
}

/** Writes the picks into assets/voices.json, only into empty slots. */
export function saveVoices(assetsDir: string, picks: Record<string, AccountVoice>): void {
  const file = join(assetsDir, 'voices.json');
  const current = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  for (const [role, v] of Object.entries(picks)) if (!current[role]) current[role] = v.id;
  writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
}
