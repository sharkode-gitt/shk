import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type JobState = 'drafted' | 'approved' | 'voiced' | 'built' | 'rendered' | 'rejected' | 'failed' | 'needs-review';
export type JobStatus = { state: JobState; title?: string; error?: string; history: { state: JobState; at: string; note?: string }[] };
export type Job = JobStatus & { id: string };

/** Where each state may go. `failed` and `needs-review` go back to `approved` once the cause is fixed. */
const NEXT: Record<JobState, JobState[]> = {
  drafted: ['approved', 'rejected', 'failed'],
  approved: ['voiced', 'rejected', 'failed'],
  voiced: ['built', 'failed'],
  built: ['rendered', 'needs-review', 'failed'],
  rendered: [],
  'needs-review': ['approved', 'rejected'],
  failed: ['approved', 'rejected'],
  rejected: [],
};

export const jobPath = (root: string, id: string, ...parts: string[]) => join(root, id, ...parts);

const write = (root: string, id: string, s: JobStatus) => writeFileSync(jobPath(root, id, 'status.json'), JSON.stringify(s, null, 2));

export function readStatus(root: string, id: string): JobStatus {
  const file = jobPath(root, id, 'status.json');
  if (!existsSync(file)) throw new Error(`no job "${id}" in ${root}`);
  return JSON.parse(readFileSync(file, 'utf8')) as JobStatus;
}

/** Creates the job folder with a `drafted` status. Returns the folder. */
export function createJob(root: string, id: string): string {
  if (existsSync(jobPath(root, id, 'status.json'))) throw new Error(`job "${id}" already exists`);
  mkdirSync(jobPath(root, id), { recursive: true });
  write(root, id, { state: 'drafted', history: [{ state: 'drafted', at: new Date().toISOString() }] });
  return jobPath(root, id);
}

/** Moves a job to `state`, throwing when that move is not allowed. `message` becomes the job's error (or is cleared). */
export function setStatus(root: string, id: string, state: JobState, message?: string): JobStatus {
  const s = readStatus(root, id);
  if (!NEXT[s.state].includes(state)) throw new Error(`job ${id} cannot go from ${s.state} to ${state}`);
  s.state = state;
  s.error = message;
  s.history.push({ state, at: new Date().toISOString(), ...(message ? { note: message } : {}) });
  write(root, id, s);
  return s;
}

export function setTitle(root: string, id: string, title: string): void {
  write(root, id, { ...readStatus(root, id), title });
}

/** Ids of every job folder (with a status) under root. */
export const jobIds = (root: string): string[] =>
  existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(jobPath(root, d.name, 'status.json'))).map((d) => d.name) : [];

/** Every job, newest first (ids are dated or numbered, so by id). */
export const listJobs = (root: string): Job[] =>
  jobIds(root)
    .map((id) => ({ id, ...readStatus(root, id) }))
    .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));

/** The next free `YYYY-MM-DD-NNN` id for the local date of `now`. */
export function newJobId(now: Date, existing: string[]): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const used = existing.filter((id) => id.startsWith(`${day}-`)).map((id) => Number(id.slice(day.length + 1))).filter(Number.isInteger);
  return `${day}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
}
