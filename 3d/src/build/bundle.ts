import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../engine/main.ts', import.meta.url));

/** Bundles the browser engine (three included) into one minified ESM file. */
export async function bundleEngine(outFile: string): Promise<void> {
  await build({ entryPoints: [ENTRY], outfile: outFile, bundle: true, format: 'esm', platform: 'browser', minify: true, logLevel: 'warning' });
}
