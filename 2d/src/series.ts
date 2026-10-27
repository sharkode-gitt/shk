import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadRoster } from './characters/roster.ts';
import { createJob, jobIds, jobPath, setStatus, setTitle } from './jobs/store.ts';
import { validateStory } from './story/schema.ts';
import { estimateSeconds, storyMarkdown } from './write/markdown.ts';

/**
 * Turns every `ep<N>.json` of a series folder into an approved job named `<series>-ep<N>` (a job that already
 * exists is left alone). Returns the job ids in episode order; throws, naming the file, on an invalid episode.
 */
export function importSeries(dir: string, root: string, assetsDir: string): string[] {
  const series = basename(dir.replace(/\/+$/, ''));
  const files = readdirSync(dir).filter((f) => /^ep\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
  if (!files.length) throw new Error(`no ep<N>.json files in ${dir}`);
  const roster = loadRoster(assetsDir);
  const ids: string[] = [];
  for (const f of files) {
    const v = validateStory(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    if (!v.ok) throw new Error(`${f}: ${v.errors.join('; ')}`);
    const id = `${series}-${f.replace('.json', '')}`;
    ids.push(id);
    if (jobIds(root).includes(id) || existsSync(jobPath(root, id))) continue;
    const jobDir = createJob(root, id);
    writeFileSync(join(jobDir, 'story.json'), JSON.stringify(v.story, null, 2));
    writeFileSync(join(jobDir, 'story.md'), storyMarkdown(v.story, estimateSeconds(v.story), roster));
    setTitle(root, id, v.story.title);
    setStatus(root, id, 'approved');
  }
  return ids;
}
