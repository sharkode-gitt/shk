import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadConfig, requireEnv, type Config, type SecretName } from './config.ts';
import { jobPath, listJobs, setStatus } from './jobs/store.ts';
import { makeApproved, makeJob, realBuild, realRender, type MakeDeps } from './make.ts';
import { createStoryClient } from './write/claude-code.ts';
import { rejectStory, writeStory, type StoryClient } from './write/write.ts';
import { QuotaExceededError } from './voice/eleven.ts';
import { loadVoices, voiceJob } from './voice/voice.ts';
import { listVoices, pickVoices, saveVoices, type AccountVoice } from './voice/pick.ts';

export const EXIT = { ok: 0, error: 1, quota: 2 } as const;

export type CliDeps = {
  config: Config;
  out: (line: string) => void;
  err: (line: string) => void;
  /** Throws, naming the variable, when a secret is missing. Called before any command that needs it does any work. */
  requireEnv: (name: SecretName) => string;
  storyClient: () => StoryClient;
  make: () => MakeDeps;
  gallery: () => Promise<boolean>;
  /** The voices of the ElevenLabs account (needs ELEVENLABS_API_KEY). */
  accountVoices: () => Promise<AccountVoice[]>;
};

const USAGE = `story <command>

  new ["idea"] [--count N]   write N stories with Claude and leave them as drafts
  approve <id>               accept a draft so "make" can produce it
  reject <id> "<note>"       throw a draft away and write a new one that follows the note
  make <id> | --approved     voice, build and render (resumes where it stopped)
  list                       every job with its state and title
  gallery                    render the QA video that shows every action, face and shot
  voices [--fill]            list the ElevenLabs voices; --fill puts a suggested voice into every empty slot of assets/voices.json`;

export async function main(argv: string[], deps: CliDeps): Promise<number> {
  const { config, out, err } = deps;
  const root = config.paths.jobs;
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { count: { type: 'string' }, approved: { type: 'boolean' }, fill: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
    const [cmd, ...rest] = positionals;
    if (!cmd || values.help) { out(USAGE); return cmd || values.help ? EXIT.ok : EXIT.error; }

    switch (cmd) {
      case 'new': {
        const count = values.count === undefined ? 1 : Number(values.count);
        if (!Number.isInteger(count) || count < 1) throw new Error('--count must be a whole number of 1 or more');
        const client = deps.storyClient();
        let failed = 0;
        for (let i = 0; i < count; i++) {
          const id = await writeStory({ client, root, config }, { idea: rest[0] });
          const job = listJobs(root).find((j) => j.id === id)!;
          if (job.state === 'drafted') out(`${id}\t${jobPath(root, id, 'story.md')}`);
          else { failed++; err(`${id}: ${job.state}: ${job.error}`); }
        }
        return failed ? EXIT.error : EXIT.ok;
      }
      case 'approve': {
        const id = need(rest[0], 'approve <id>');
        setStatus(root, id, 'approved');
        out(`${id} approved`);
        return EXIT.ok;
      }
      case 'reject': {
        const id = need(rest[0], 'reject <id> "<note>"');
        const note = need(rest[1], 'reject <id> "<note>"');
        const newId = await rejectStory({ client: deps.storyClient(), root, config }, id, note);
        const job = listJobs(root).find((j) => j.id === newId)!;
        if (job.state !== 'drafted') { err(`${newId}: ${job.state}: ${job.error}`); return EXIT.error; }
        out(`${newId}\t${jobPath(root, newId, 'story.md')}`);
        return EXIT.ok;
      }
      case 'make': {
        if (!rest[0] && !values.approved) throw new Error('usage: make <id> | make --approved');
        deps.requireEnv('ELEVENLABS_API_KEY'); // fail now, naming the variable, not after a half-finished render
        const stages = deps.make();
        if (values.approved) {
          const { results, quotaExceeded } = await makeApproved(stages, root);
          for (const r of results) out(`${r.id}\t${r.state}`);
          if (quotaExceeded) { err('ElevenLabs credits are used up: the remaining approved jobs were left untouched. Add credits and run make --approved again.'); return EXIT.quota; }
          return results.some((r) => r.state === 'failed') ? EXIT.error : EXIT.ok;
        }
        const state = await makeJob(stages, root, rest[0]);
        out(`${rest[0]}\t${state}`);
        return state === 'failed' ? EXIT.error : EXIT.ok;
      }
      case 'list': {
        const jobs = listJobs(root);
        if (!jobs.length) out('no jobs yet; try: story new');
        for (const j of jobs) out(`${j.id}\t${j.state}\t${j.title ?? ''}`);
        return EXIT.ok;
      }
      case 'voices': {
        deps.requireEnv('ELEVENLABS_API_KEY');
        const voices = await deps.accountVoices();
        for (const v of voices) out(`${v.id}\t${v.name}\t${v.gender || '-'}\t${v.age || '-'}\t${v.category}`);
        if (values.fill) {
          const current = JSON.parse(readFileSync(join(config.paths.assets, 'voices.json'), 'utf8')) as Record<string, string>;
          const { picks, missing } = pickVoices(voices, current);
          saveVoices(config.paths.assets, picks);
          for (const [role, v] of Object.entries(picks)) out(`${role} -> ${v.name} (${v.id})`);
          if (missing.length) err(`no suitable voice found for: ${missing.join(', ')}. Add voices to your ElevenLabs account and run again.`);
          if (!current.emily) err('assets/voices.json has no voice for "emily": paste its voice id there.');
        }
        return EXIT.ok;
      }
      case 'gallery':
        return (await deps.gallery()) ? EXIT.ok : EXIT.error;
      default:
        err(`unknown command "${cmd}"\n${USAGE}`);
        return EXIT.error;
    }
  } catch (e) {
    if (e instanceof QuotaExceededError) { err(e.message); return EXIT.quota; }
    err((e as Error).message);
    return EXIT.error;
  }
}

function need(value: string | undefined, usage: string): string {
  if (!value) throw new Error(`usage: ${usage}`);
  return value;
}

// --- real wiring, used only when run as a program ---

async function realDeps(): Promise<CliDeps> {
  const config = loadConfig();
  return {
    config,
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    requireEnv: (n) => requireEnv(n),
    storyClient: () => createStoryClient(config),
    make: () => {
      const voiceDeps = { config, voices: loadVoices(config.paths.assets), apiKey: requireEnv('ELEVENLABS_API_KEY'), fetch, cacheDir: config.paths.cache };
      return { voice: (root, id) => voiceJob(voiceDeps, root, id), build: realBuild(config), render: realRender() };
    },
    accountVoices: () => listVoices({ fetch, apiKey: requireEnv('ELEVENLABS_API_KEY') }),
    gallery: async () => {
      const { galleryStory } = await import('./build/gallery.ts');
      const { renderJob } = await import('../scripts/fixture-lib.ts');
      const { result } = await renderJob('gallery', galleryStory());
      return !result || result.ok;
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config: loadEnv } = await import('dotenv');
  loadEnv({ quiet: true });
  process.exitCode = await main(process.argv.slice(2), await realDeps());
}
