import { ACTS, FACES, HAIRS, HATS, MUSIC, PROPS, SETS, SHOT_KINDS, TIMES, VOICES } from '../vocab.ts';
import type { Story } from '../types.ts';

export type Hero = { name: string; age: number; personality: string; look: string };
export type PromptOpts = { hero: Hero; recentTitles: string[]; idea?: string; rejectNote?: string; previous?: Story };

/** How many past titles (newest first) go into the prompt, rejected ones included, so ideas don't repeat. */
export const RECENT_TITLES = 30;

const list = (xs: readonly (string | null)[]) => xs.map((x) => (x === null ? 'null' : x)).join(', ');

/**
 * `system` is identical for every call (so the API can cache it): persona, rules and the whole vocabulary.
 * Everything that changes per call lives in `user`.
 */
export function buildPrompt({ hero, recentTitles, idea, rejectNote, previous }: PromptOpts): { system: string; user: string } {
  const system = `You write scripts for a channel of 3D short videos (YouTube Shorts) with blocky, Roblox-style characters. Each video tells a short story with ${hero.name} at its centre.

# The protagonist
${hero.name} is ${hero.age}. Personality: ${hero.personality}. Look: ${hero.look}. She is always in the cast as { "id": "emily", "ref": "hero" } (no name, voice or look), she narrates in the first person, and the story is about her.

# Rules
- The spoken text totals 110 to 150 words across all narration and dialogue (about 35 to 55 seconds).
- A hook in the first 2 seconds: the very first beat states the problem or the surprise.
- A twist or a payoff in the last beat.
- 2 to 4 characters in the cast, always including emily. At most 3 different sets in the whole story.
- Every beat has exactly one of "narrate" (emily's voice-over) or "say" ({ "who": cast id, "line": text }), a "shot", and a "do" list of what the characters do on screen.
- Lines are written to be spoken aloud: short sentences, no stage directions. You may start a line with one ElevenLabs v3 emotion tag in square brackets: [sad], [smug], [shouting], [whispers], [laughs]. Tags are never read as words.
- Content is safe for kids and teens: no explicit violence, no sexual content, no real brands, logos, people or the word "Roblox".
- Use only the vocabulary below. "do[].at" is a cast id or a mark of the set ("door", "center", "sofa", "bed", "table"...). A shot "closeup:ID", "push_in:ID" and "over_shoulder:ID" take one cast id; "two_shot:ID,ID" takes two different ones.
- If the story needs something the vocabulary lacks (a swimming pool, a bicycle), do NOT invent it: use the nearest item and list the missing thing, in English, in "wants". Otherwise "wants" is [].

# Vocabulary
- sets: ${list(SETS)}
- time: ${list(TIMES)}
- acts: ${list(ACTS)}
- faces: ${list(FACES)}
- hair: ${list(HAIRS)}
- hat: ${list(HATS)}
- props (scenery you may mention): ${list(PROPS)}
- shots: ${list(SHOT_KINDS)} (closeup, over_shoulder and push_in need ":ID"; two_shot needs ":ID,ID")
- music (story-level and per scene): ${list(MUSIC)}
- voices (for non-hero cast): ${list(VOICES)}
- look colours (shirt, pants, skin) are hex strings like "#7b5cff".

Answer with the story as JSON that matches the required schema.`;

  const parts: string[] = [];
  parts.push(idea ? `Story idea: ${idea}` : 'Pick an original idea yourself: an everyday school, family or friends situation with a clear problem and a twist.');
  const titles = recentTitles.slice(0, RECENT_TITLES);
  parts.push(titles.length
    ? `Titles already used (newest first; do not repeat or closely imitate any of them):\n${titles.map((t) => `- ${t}`).join('\n')}`
    : 'No titles have been used yet.');
  if (rejectNote) {
    parts.push(`The previous draft was rejected with this note: ${rejectNote}`);
    if (previous) parts.push(`The previous draft was:\n${JSON.stringify(previous)}\nWrite a new story that fixes the note; do not just edit this one.`);
  }
  return { system, user: parts.join('\n\n') };
}
