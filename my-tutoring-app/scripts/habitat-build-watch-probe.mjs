// Real build-watcher lines on habitat-diorama build_habitat: renders the build scene (the same component the learner
// sees) to the picture the watcher gets (aids removed), screenshots it in headless Chromium, and asks the real watcher
// (flash-lite, `watchBuild`) for its line, with the habitat's neverSay list. Each line is re-checked against the leak
// rules: no need named, no advice, no verdict. Usage (from my-tutoring-app):
//   node scripts/habitat-build-watch-probe.mjs --run [--env <path to .env.local>] [--playwright <path to playwright-core>]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const envFile = arg('--env', '.env.local');
if (!process.env.GEMINI_API_KEY && existsSync(envFile)) {
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const pwPath = arg('--playwright', 'C:/Users/xbox3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(pwPath).href);
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';

const root = process.cwd();
const out = resolve(root, 'qa/open-build/habitat-diorama-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
  esbuild: { jsx: 'automatic' },
});
const browser = await chromium.launch({ executablePath: EXE, headless: true });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HabitatBuildScene } = await loader.import('/src/components/lumina/primitives/visual-primitives/biology/HabitatBuildScene.tsx');
  const hb = await loader.import('/src/components/lumina/primitives/visual-primitives/biology/habitatBuild.ts');
  const { watchBuild, keepWatchLine } = await loader.import('/src/components/lumina/service/build-layer/gemini-build-watch.ts');
  const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
  // A build at several stages: partial, one need short, another animal's piece, a harmful piece, complete.
  const builds = [
    ['frog', ['pond']], ['frog', ['pond', 'flies']], ['frog', ['pond', 'flies', 'log']], ['frog', ['pond', 'flies', 'log', 'snow']],
    ['frog', ['pond', 'flies', 'log', 'rain']], ['penguin', ['sea', 'fish']], ['penguin', ['sea', 'fish', 'ice', 'sun']],
    ['owl', ['tree', 'stream']], ['rabbit', ['burrow', 'carrots', 'pond', 'rain']], ['deer', ['tree', 'clover', 'sea']],
    ['squirrel', ['tree', 'nuts']], ['squirrel', ['tree', 'nuts', 'stream', 'snow']],
  ];
  const needWord = /\b(food|water|shelter|weather|need|needs|eat|eats|drink|hungry|thirsty|hide|home|live|lives|survive|safe|cold|warm|hot|missing)\b/i;
  const lines = [];
  for (const [animalId, placed] of builds) {
    const animal = hb.animalById(animalId);
    const needs = hb.needsForBand('3-5');
    const svg = renderToStaticMarkup(React.createElement(HabitatBuildScene, { animal, placed, tags: false, disabled: false, onRemove: () => {} }));
    await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
    // The picture the watcher gets: the svg less its aids, as `svgPicture` sends it.
    await page.evaluate(() => document.querySelectorAll('[data-aid]').forEach(n => n.remove()));
    const png = await page.locator('svg').screenshot();
    if (process.argv.includes('--shots')) writeFileSync(resolve(out, `watch-${animalId}-${placed.join('-')}.png`), png);
    const image = png.toString('base64');
    const task = hb.buildAsk(animal, needs);
    const sceneNote = hb.habitatSceneNote(animal);
    const seeing = [];
    for (let k = 0; k < 2; k++) {
      const { seeing: line } = await watchBuild({ task, sceneNote, numbers: 'allowed', neverSay: hb.HABITAT_WATCH_NEVER_SAY, image });
      seeing.push(line);
    }
    const read = hb.readHabitatBuild(animal, needs, placed);
    const kept = seeing.filter(Boolean);
    const leaks = kept.filter(l => needWord.test(l) || keepWatchLine(l, 'allowed', hb.HABITAT_WATCH_NEVER_SAY) !== l);
    const entry = { task, animal: animalId, placed, needsMet: read.needsMet, miss: read.miss ?? null, seeing, kept: kept.length, leaks };
    lines.push(entry);
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
  const total = lines.reduce((s, l) => s + l.seeing.length, 0), kept = lines.reduce((s, l) => s + l.kept, 0);
  const leaks = lines.flatMap(l => l.leaks);
  writeFileSync(resolve(out, 'watcher-lines.json'), JSON.stringify({ generatedAt: new Date().toISOString(), model: 'gemini-flash-lite-latest',
    asked: total, kept, droppedByFilter: total - kept, leaksInKeptLines: leaks, lines }, null, 1) + '\n');
  process.stdout.write(JSON.stringify({ asked: total, kept, leaks: leaks.length }) + '\n');
  if (leaks.length) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
