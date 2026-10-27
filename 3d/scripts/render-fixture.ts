import { fixture, renderJob } from './fixture-lib.ts';

const { result } = await renderJob('fixture', fixture());
if (result && !result.ok) process.exitCode = 1;
