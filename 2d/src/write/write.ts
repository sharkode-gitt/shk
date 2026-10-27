import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config.ts';
import { createJob, jobIds, jobPath, listJobs, newJobId, setStatus, setTitle } from '../jobs/store.ts';
import { StorySchemaForModel } from '../story/model-schema.ts';
import { validateStory } from '../story/schema.ts';
import type { Story } from '../types.ts';
import { estimateSeconds, spokenWords, storyMarkdown } from './markdown.ts';
import { buildPrompt } from './prompt.ts';
import { loadRoster, type Roster } from '../characters/roster.ts';
import { protagonistOf, rosterIdOf } from '../story/cast.ts';

export type StoryClient = {
  generate(system: string, user: string): Promise<{ kind: 'ok'; json: unknown } | { kind: 'refusal'; category: string | null }>;
};
export type WriteDeps = { client: StoryClient; root: string; config: Config; roster?: Roster; now?: () => Date };

export const MAX_ATTEMPTS = 3;
/** The prompt asks for 110-150 spoken words; a little slack avoids retrying over a handful of words. */
export const WORD_RANGE = { min: 100, max: 165 };

/** The real client: structured outputs on Claude, with server-side fallbacks for safety declines. */
export function anthropicStoryClient(config: Config, apiKey: string): StoryClient {
  const client = new Anthropic({ apiKey });
  return {
    async generate(system, user) {
      const response = await client.beta.messages.parse({
        model: config.writer.model,
        max_tokens: 16000,
        output_config: { effort: config.writer.effort, format: zodOutputFormat(StorySchemaForModel) },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
      // A decline comes back as a normal 200: check it before reading any content.
      if (response.stop_reason === 'refusal') return { kind: 'refusal', category: response.stop_details?.category ?? null };
      if (response.parsed_output) return { kind: 'ok', json: response.parsed_output };
      const text = response.content.find((b) => b.type === 'text');
      return { kind: 'ok', json: text && text.type === 'text' ? safeJson(text.text) : null };
    },
  };
}
const safeJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };

function validate(json: unknown, roster: Roster, character?: string): { ok: true; story: Story } | { ok: false; errors: string[] } {
  const v = validateStory(json);
  if (!v.ok) return v;
  const errors: string[] = [];
  for (const c of v.story.cast) {
    const ref = rosterIdOf(c);
    if (ref && !roster[ref]) errors.push(`cast member "${c.id}" refers to "${ref}", which is not one of the channel's characters (${Object.keys(roster).join(', ')})`);
  }
  if (character && protagonistOf(v.story) !== character) errors.push(`the protagonist must be "${character}"`);
  if (errors.length) return { ok: false, errors };
  const words = spokenWords(v.story);
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    return { ok: false, errors: [`the story has ${words} spoken words; it must have 110 to 150`] };
  }
  return v;
}

/** Writes one story into a new job. The job ends `drafted` (ready to approve) or `failed` (with the reason). Returns its id. */
export async function writeStory(deps: WriteDeps, opts: { idea?: string; character?: string; rejectNote?: string; previous?: Story } = {}): Promise<string> {
  const { client, root, config } = deps;
  const roster = deps.roster ?? loadRoster(config.paths.assets);
  if (!Object.keys(roster).length) throw new Error(`no characters in ${config.paths.assets}/characters; add at least one`);
  if (opts.character && !roster[opts.character]) throw new Error(`unknown character "${opts.character}"; available: ${Object.keys(roster).join(', ')}`);
  const recentTitles = listJobs(root).map((j) => j.title).filter((t): t is string => !!t);
  const id = newJobId((deps.now ?? (() => new Date()))(), jobIds(root));
  const dir = createJob(root, id);
  if (opts.idea) writeFileSync(join(dir, 'idea.txt'), opts.idea);
  if (opts.character) writeFileSync(join(dir, 'character.txt'), opts.character);

  const { system, user } = buildPrompt({ roster: Object.values(roster), recentTitles, idea: opts.idea, character: opts.character, rejectNote: opts.rejectNote, previous: opts.previous });
  let prompt = user;
  let errors: string[] = [];
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await client.generate(system, prompt);
      if (res.kind === 'refusal') {
        setStatus(root, id, 'failed', `the model declined to write this story${res.category ? ` (category: ${res.category})` : ''}`);
        return id;
      }
      const v = validate(res.json, roster, opts.character);
      if (v.ok) {
        writeFileSync(join(dir, 'story.json'), JSON.stringify(v.story, null, 2));
        writeFileSync(join(dir, 'story.md'), storyMarkdown(v.story, estimateSeconds(v.story), roster));
        setTitle(root, id, v.story.title);
        return id; // stays drafted
      }
      errors = v.errors;
      prompt = `${user}\n\nYour previous output failed validation: ${errors.join('; ')}. Fix every one of these and answer again.`;
    }
    setStatus(root, id, 'failed', `no valid story after ${MAX_ATTEMPTS} attempts: ${errors.join('; ')}`);
    return id;
  } catch (e) {
    setStatus(root, id, 'failed', `story generation error: ${(e as Error).message}`);
    throw e;
  }
}

/** Marks a drafted job `rejected` and writes a replacement that takes the note into account. Returns the new id. */
export async function rejectStory(deps: WriteDeps, id: string, note: string): Promise<string> {
  const { root } = deps;
  const storyFile = jobPath(root, id, 'story.json');
  const previous = existsSync(storyFile) ? (JSON.parse(readFileSync(storyFile, 'utf8')) as Story) : undefined;
  const ideaFile = jobPath(root, id, 'idea.txt');
  const idea = existsSync(ideaFile) ? readFileSync(ideaFile, 'utf8') : undefined;
  const characterFile = jobPath(root, id, 'character.txt');
  const character = existsSync(characterFile) ? readFileSync(characterFile, 'utf8') : undefined;
  setStatus(root, id, 'rejected', note); // throws if the job is not in a state that can be rejected
  return writeStory(deps, { idea, character, rejectNote: note, previous });
}
