import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { listJobs } from '../src/jobs/store.ts';
import { importSeries } from '../src/series.ts';

test('importSeries creates one approved job per episode and is idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'series-'));
  const ids = importSeries('series/emily-and-lokii', root, 'assets');
  assert.deepEqual(ids, [1, 2, 3, 4].map((n) => `emily-and-lokii-ep${n}`));
  assert.ok(listJobs(root).every((j) => j.state === 'approved'));
  assert.deepEqual(importSeries('series/emily-and-lokii', root, 'assets'), ids);
  assert.equal(listJobs(root).length, 4);
});
