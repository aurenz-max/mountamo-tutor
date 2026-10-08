// Real build-watcher lines on molecule-constructor's make_molecule board. Input: BOARDS (a JSON list of
// { task, note, formula, miss, markup }), the real MoleculeBuildScene rendered to static markup in vitest. Each board's
// svg, less its `data-aid` parts, is drawn to a PNG in headless Chromium (what `svgPicture` does in the app) and sent to
// the real `watchBuild` (flash-lite). Pass --run; needs PLAYWRIGHT_CORE (a playwright-core install) and the cached
// ms-playwright Chromium. Writes qa/open-build/molecule-constructor-2026-10-07/watcher-lines.json.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
for (const envFile of ['.env.local', process.env.LUMINA_ENV_FILE].filter(Boolean)) {
  if (process.env.GEMINI_API_KEY || !existsSync(envFile)) continue;
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE);
const CHROME = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const BOARDS = JSON.parse(readFileSync(process.env.BOARDS, 'utf8'));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/molecule-constructor-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
// The component's own list (MoleculeConstructor.tsx WATCH_NEVER_SAY).
const NEVER_SAY = ['water', 'methane', 'ethane', 'ethene', 'ethylene', 'ethyne', 'acetylene', 'propane', 'propene', 'ammonia', 'ethanol',
  'methanol', 'alcohol', 'formaldehyde', 'dioxide', 'ozone', 'cyanide', 'valence', 'open', 'free', 'full', 'lonely', 'alone', 'unattached',
  'loose', 'dangling', 'spare', 'extra', 'unbonded', 'satisfied', 'parallel'];
const SCENE_NOTE = 'A dark board. The learner adds coloured circles marked with element letters and joins them with lines.';
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { watchBuild, keepWatchLine } = await loader.import('/src/components/lumina/service/build-layer/gemini-build-watch.ts');
  const page = await browser.newPage();
  const lines = [];
  for (const [n, b] of BOARDS.entries()) {
    await page.setContent(`<html><body style="margin:0;background:#000;width:560px">${b.markup}</body></html>`);
    const image = await page.evaluate(async () => {
      const svg = document.querySelector('svg[data-build-scene]');
      const clone = svg.cloneNode(true);
      clone.querySelectorAll('[data-aid]').forEach((node) => node.remove());
      const vb = svg.viewBox.baseVal;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = vb.width; canvas.height = vb.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    });
    if (n === 0) writeFileSync(resolve(out, 'board-ethene-short.png'), Buffer.from(image, 'base64'));
    for (let take = 0; take < 2; take++) {
      const { seeing } = await watchBuild({ task: b.task, sceneNote: SCENE_NOTE, numbers: 'never', neverSay: NEVER_SAY, image });
      const nameHit = /\b(water|methane|ethane|ethene|ethylene|ethyne|acetylene|propane|propene|ammonia|ethanol|methanol|formaldehyde|dioxide|ozone|cyanide)\b/i.test(seeing);
      lines.push({ task: b.task, build: b.note, formula: b.formula, miss: b.miss, seeing, kept: !!seeing,
        rechecked: !!seeing && keepWatchLine(seeing, 'never', NEVER_SAY) === seeing && !nameHit });
      console.log(`${b.note}: ${seeing || '(dropped by the filter)'}`);
    }
  }
  writeFileSync(resolve(out, 'watcher-lines.json'), JSON.stringify(lines, null, 1));
} finally {
  await browser.close();
  await server.close();
}
