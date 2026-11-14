// Draw the items an agent author built, as the kit's look stage draws them (`itemHtml` in
// service/agent-kit/look.ts), in real headless Chromium at phone and desktop width. No model call,
// no tutor session: this is the reader's view, not the component (which renders only on the teaching
// workspace). Use it after an author trace to see what shipped (`/lesson-evidence`, Phase 3).
//
// Usage: node scripts/render-surface-items.mjs --trace=<topic-trace json> [--component=practice-studio] [--out=<dir>] [--widths=390,760]
// (flags take `=`). Reads `components[].data.challenges` of the named component and writes <out>/<component>-<n>-<width>.png.
// Needs playwright-core, which is not in the repo: set PLAYWRIGHT_CORE to an install (`npm install playwright-core@1.52.0`
// in a scratchpad, never the project); the default below is one session's scratchpad and will not exist elsewhere.
// Also needs the cached chromium-1169 (or LUMINA_CHROME_PATH).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const tracePath = arg('trace');
if (!tracePath) throw new Error('Usage: node scripts/render-surface-items.mjs --trace=<json> [--component=practice-studio] [--out=<dir>] [--widths=390,760]');
const componentId = arg('component', 'practice-studio');
const out = resolve(arg('out', 'qa/topic-traces/renders'));
const widths = arg('widths', '390,760').split(',').map(Number);
const PW = process.env.PLAYWRIGHT_CORE ?? ''; // path to a playwright-core install (not a dependency of this app)
const CHROME = process.env.LUMINA_CHROME_PATH ?? 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
if (!PW || !existsSync(PW)) throw new Error(`playwright-core not found at '${PW}'; set PLAYWRIGHT_CORE`);
if (!existsSync(CHROME)) throw new Error(`chromium not found at ${CHROME}; set LUMINA_CHROME_PATH`);

// The look stage's module imports the metered Gemini client, which reads the key at import time.
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const look = await runner.import('/src/components/lumina/service/agent-kit/look.ts');

const trace = JSON.parse(readFileSync(resolve(tracePath), 'utf8'));
const comps = (trace.components ?? []).filter(c => c.componentId === componentId);
if (!comps.length) throw new Error(`no ${componentId} component in ${tracePath}`);
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(PW);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let n = 0;
for (const comp of comps) {
  for (const item of comp.data?.challenges ?? []) {
    n++;
    const html = look.itemHtml(item);
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 700 } });
      await page.setContent(html.replace('width:760px', `width:${w - 32}px`));
      await page.waitForTimeout(300);
      const file = join(out, `${componentId}-${n}-${w}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
    }
    writeFileSync(join(out, `${componentId}-${n}.html`), html);
    console.error(`item ${n}: ${item.surface} ${item.tier} — ${item.prompt}`);
  }
}
await browser.close();
await server.close();
console.error(`${n} item(s) → ${out}`);
