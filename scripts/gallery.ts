import { galleryStory } from '../src/build/gallery.ts';
import { renderJob } from './fixture-lib.ts';

const { result } = await renderJob('gallery', galleryStory());
if (result && !result.ok) process.exitCode = 1;
