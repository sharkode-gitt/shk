// Renders scripts/face-sheet.html headlessly to tests/visual/approved/face-sheet.png.
// Usage: node scripts/face-sheet.mjs [out.png]   (needs Playwright + Chromium, local or global)
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'tests/visual/approved/face-sheet.png'));

let playwright;
try {
  playwright = await import('playwright');
} catch {
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  playwright = createRequire(path.join(globalRoot, 'noop.js'))('playwright');
}

const { outputFiles } = await build({
  entryPoints: [path.join(root, 'src/engine/faces/draw.ts')],
  bundle: true, format: 'iife', globalName: 'Faces', write: false,
});

const browser = await playwright.chromium.launch({ args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.addInitScript({ content: `${outputFiles[0].text}\nglobalThis.Faces = Faces;` });
  await page.goto(pathToFileURL(path.join(root, 'scripts/face-sheet.html')).href);
  await page.waitForSelector('body[data-ready]', { timeout: 10000 });
  await page.locator('body').screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
