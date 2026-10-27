import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** How a 2D character is drawn (cartoon sprite with a thick outline, see src/engine/art2d.ts). */
export const ArtSchema = z.object({
  skin: Hex, shirt: Hex, pants: Hex,
  outline: Hex.default('#1a1a1f'),
  build: z.enum(['slim', 'round']).default('slim'),
  hair: z.object({ style: z.enum(['none', 'short', 'long', 'bob', 'spiky', 'messy']), color: Hex }).default({ style: 'none', color: '#111111' }),
  /** Extras drawn on top: crown, fedora, tophat, skullmask, bunnymask, furcollar, jacket, glasses, bow, catears, bag. */
  accessories: z.array(z.string()).default([]),
});

/** One character of the roster: who they are (for the story writer) and how they are drawn (for the engine). */
export const CharacterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'id must be lowercase letters, digits and underscores'),
  name: z.string().min(1),
  age: z.number().int().positive(),
  personality: z.string().min(1),
  look: z.string().min(1),
  /** Caption colour of this character's lines. */
  color: Hex.default('#ffd166'),
  art: ArtSchema,
});
export type CharacterInfo = z.infer<typeof CharacterSchema>;
export type Roster = Record<string, CharacterInfo>;

export const charactersDir = (assetsDir: string) => join(assetsDir, 'characters');

/** Every `<assets>/characters/<id>/character.json`, validated; the folder name must equal the id. */
export function loadRoster(assetsDir: string): Roster {
  const dir = charactersDir(assetsDir);
  const roster: Roster = {};
  if (!existsSync(dir)) return roster;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name, 'character.json');
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const parsed = CharacterSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.success) {
      throw new Error(`${file} is invalid: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
    }
    if (parsed.data.id !== entry.name) throw new Error(`${file}: id "${parsed.data.id}" must match its folder name "${entry.name}"`);
    roster[parsed.data.id] = parsed.data;
  }
  return roster;
}

/** The stories' default protagonist when none is asked for. */
export const DEFAULT_CHARACTER = 'emily';
