import { z } from 'zod';
import { SETS, TIMES, ACTS, FACES, HAIRS, HATS, MUSIC, VOICES, SHOT_KINDS } from '../vocab.ts';
import type { Shot, ShotKind, Story } from '../types.ts';

const IDENT = /^[a-z_]+$/;
const HERO = 'emily';

const Look = z.object({
  skin: z.string().optional(), // default skin tone is applied later by the character builder
  shirt: z.string(),
  pants: z.string(),
  hair: z.enum(HAIRS),
  hat: z.literal([...HATS]),
});

// One flat shape (not a union) so zod reports field-level paths; hero vs non-hero is enforced in StorySchema.
const CastMember = z.object({
  id: z.string().regex(IDENT),
  ref: z.literal('hero').optional(),
  name: z.string().min(1).optional(),
  voice: z.enum(VOICES).optional(),
  look: Look.optional(),
});

const Do = z.object({
  who: z.string(),
  act: z.enum(ACTS),
  face: z.enum(FACES).optional(),
  at: z.string().regex(IDENT).optional(), // cast id or a set mark; marks are resolved by the engine
});

const Beat = z.object({
  narrate: z.string().min(1).optional(),
  say: z.object({ who: z.string(), line: z.string().min(1) }).optional(),
  shot: z.string(),
  do: z.array(Do),
});

const Scene = z.object({
  set: z.enum(SETS),
  time: z.enum(TIMES),
  music: z.enum(MUSIC).optional(),
  beats: z.array(Beat).min(1),
});

const SHOT_ARITY: Record<ShotKind, number> = {
  wide: 0, medium: 0, closeup: 1, over_shoulder: 1, two_shot: 2, push_in: 1, orbit: 0, shake: 0,
};

/** `"two_shot:a,b"` -> `{ kind: 'two_shot', targets: ['a','b'] }`. Throws on a malformed shot. */
export function parseShot(s: string): Shot {
  const [kind, rest, ...extra] = s.split(':');
  if (!(SHOT_KINDS as readonly string[]).includes(kind) || extra.length) throw new Error(`unknown shot "${s}"`);
  const targets = rest === undefined ? [] : rest.split(',');
  const want = SHOT_ARITY[kind as ShotKind];
  if (targets.length !== want || targets.some((t) => !IDENT.test(t)) || new Set(targets).size !== want) {
    throw new Error(`shot "${kind}" needs ${want} distinct target(s), got "${targets.join(',')}"`);
  }
  return { kind: kind as ShotKind, targets };
}

export const StorySchema = z
  .object({
    title: z.string().min(1),
    music: z.enum(MUSIC),
    cast: z.array(CastMember).min(2).max(4),
    scenes: z.array(Scene).min(1),
    wants: z.array(z.string()),
  })
  .superRefine((story, ctx) => {
    const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = story.cast.map((c) => c.id);
    if (!story.cast.some((c) => c.ref === 'hero')) bad(['cast'], 'cast must include emily as { "id": "emily", "ref": "hero" }');
    story.cast.forEach((c, i) => {
      if (c.ref === 'hero') {
        if (c.id !== HERO) bad(['cast', i, 'id'], `hero entry must have id "${HERO}"`);
        (['name', 'voice', 'look'] as const).forEach((k) => c[k] !== undefined && bad(['cast', i, k], `hero entry must not have ${k}`));
      } else {
        if (c.id === HERO) bad(['cast', i, 'id'], `id "${HERO}" is reserved for { "ref": "hero" }`);
        (['name', 'voice', 'look'] as const).forEach((k) => c[k] === undefined && bad(['cast', i, k], `${k} is required for non-hero cast members`));
      }
    });
    ids.forEach((id, i) => ids.indexOf(id) !== i && bad(['cast', i, 'id'], `duplicate cast id "${id}"`));
    const isCast = (id: string) => ids.includes(id);
    const castError = (id: string) => `"${id}" is not a cast id (${ids.join(', ')})`;

    if (new Set(story.scenes.map((s) => s.set)).size > 3) bad(['scenes'], 'at most 3 distinct sets are allowed');

    story.scenes.forEach((scene, si) =>
      scene.beats.forEach((beat, bi) => {
        const at = ['scenes', si, 'beats', bi];
        if ((beat.narrate === undefined) === (beat.say === undefined)) {
          bad(at, 'beat must have exactly one of narrate or say');
        }
        if (beat.say && !isCast(beat.say.who)) bad([...at, 'say', 'who'], castError(beat.say.who));
        try {
          parseShot(beat.shot).targets.forEach((t) => isCast(t) || bad([...at, 'shot'], castError(t)));
        } catch (e) {
          bad([...at, 'shot'], (e as Error).message);
        }
        beat.do.forEach((d, di) => isCast(d.who) || bad([...at, 'do', di, 'who'], castError(d.who)));
      }),
    );
  });

/** Who voices this beat: `say.who`, or Emily for narration. */
export const parseBeatSpeaker = (beat: { say?: { who: string } }): string => beat.say?.who ?? HERO;

const formatPath = (path: PropertyKey[]) =>
  path.map((p, i) => (typeof p === 'number' ? `[${p}]` : i ? `.${String(p)}` : String(p))).join('');

export function validateStory(json: unknown): { ok: true; story: Story } | { ok: false; errors: string[] } {
  const r = StorySchema.safeParse(json);
  if (r.success) return { ok: true, story: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${formatPath(i.path) || '(root)'}: ${i.message}`) };
}
