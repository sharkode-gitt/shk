// Generates the background tracks a mood is still missing, with the ElevenLabs Music API.
// Usage: npm run music            (all missing moods)   |   npm run music -- tense sad
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ quiet: true });
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set (put it in .env)'); process.exit(1); }

const TRACKS = {
  tense: ['school-suspense', 'Instrumental background music for a kids cartoon mystery: light suspenseful pizzicato strings, soft low drums, mischievous and curious mood, no vocals, steady and loopable, quiet enough to sit under dialogue'],
  sad: ['quiet-piano', 'Instrumental background music for a gentle sad moment in a kids cartoon: soft solo piano with warm light strings, tender and hopeful, slow tempo, no vocals, quiet enough to sit under dialogue'],
  funny: ['playful-pizzicato', 'Instrumental background music for a funny kids cartoon: bouncy pizzicato strings, light xylophone and woodwinds, playful and quirky, no vocals, steady and loopable, quiet enough to sit under dialogue'],
  happy: ['sunny-ukulele', 'Instrumental background music for a happy kids cartoon: bright ukulele, claps and light percussion, cheerful and warm, no vocals, steady and loopable, quiet enough to sit under dialogue'],
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TRACKS);
for (const mood of wanted) {
  const spec = TRACKS[mood];
  if (!spec) { console.error(`unknown mood "${mood}" (known: ${Object.keys(TRACKS).join(', ')})`); process.exit(1); }
  const dir = join('assets', 'music', mood);
  if (existsSync(dir) && readdirSync(dir).some((f) => /\.(mp3|wav|m4a)$/i.test(f))) { console.log(`${mood}: already has a track, skipped`); continue; }
  console.log(`${mood}: generating...`);
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: spec[1], music_length_ms: 40000, force_instrumental: true }),
  });
  if (!res.ok) { console.error(`${mood}: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${spec[0]}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log(`${mood}: saved ${join(dir, `${spec[0]}.mp3`)}`);
}
