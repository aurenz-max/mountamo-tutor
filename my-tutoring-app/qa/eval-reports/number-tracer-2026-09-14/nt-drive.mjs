// Runtime drive of number-tracer in the real app (:3000 math tester, real generation, real vision grader).
// Mouse strokes are the canonical numeral paths with a child-like slant and wobble.
// RUN=<label> MODE=sequence TIER=easy node nt-drive.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app';
const SCRATCH = 'C:/Users/xbox3/AppData/Local/Temp/claude/c--Users-xbox3-claude-web-tutor/03e007a5-f462-47e1-8daf-ac88674f75a2/scratchpad';
const RUN = process.env.RUN ?? 'before', MODE = process.env.MODE ?? 'sequence', TIER = process.env.TIER ?? 'Easy';
const OUT = join(SCRATCH, 'nt-drive', `${RUN}-${MODE}-${TIER}`);
await mkdir(OUT, { recursive: true });

process.chdir(ROOT);
const nextEnv = await import(pathToFileURL(join(ROOT, 'node_modules/@next/env/dist/index.js')).href);
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);
const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const react = (await import(pathToFileURL(join(ROOT, 'node_modules/@vitejs/plugin-react/dist/index.js')).href)).default;
const server = await vite.createServer({ configFile: false, plugins: [react()], root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const geo = await runner.import('/src/components/lumina/primitives/visual-primitives/math/NumberTracer.tsx');

let seed = Number(process.env.SEED ?? 11);
const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
function childStrokes(n, { slant = 0.06, wobble = 8 } = {}) {
  const paths = geo.getDigitPaths(n), pts = paths.flat();
  const cx = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
  const cy = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
  const s = 0.75 + rand() * 0.2, th = (rand() - 0.5) * 2 * slant;
  return paths.map(stroke => {
    const dense = [];
    for (let i = 0; i < stroke.length - 1; i++) for (let k = 0; k < 3; k++) {
      const t = k / 3; dense.push({ x: stroke[i].x + t * (stroke[i + 1].x - stroke[i].x), y: stroke[i].y + t * (stroke[i + 1].y - stroke[i].y) });
    }
    dense.push(stroke[stroke.length - 1]);
    return dense.map(p => { const x = p.x - cx, y = p.y - cy;
      return { x: cx + (x * Math.cos(th) - y * Math.sin(th)) * s + (rand() - 0.5) * wobble, y: cy + (x * Math.sin(th) + y * Math.cos(th)) * s + (rand() - 0.5) * wobble }; });
  });
}
const geoOf = (strokes, target, normalize) => Math.round(geo.scoreStrokeAccuracy(strokes, geo.getDigitPaths(target), normalize) * 0.6
  + geo.computePathCoverage(strokes, geo.getDigitPaths(target), normalize) * 0.4);
/** Find a drawing of `written` whose geometry score against `target` lies in [lo, hi]. */
function drawingFor(written, target, lo, hi, normalize, opts) {
  for (let i = 0; i < 400; i++) { const s = childStrokes(written, opts); const g = geoOf(s, target, normalize); if (g >= lo && g <= hi) return { strokes: s, geo: g }; }
  return null;
}

const require = createRequire(join(SCRATCH, 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
const log = { run: RUN, mode: MODE, tier: TIER, generated: null, checks: [], consoleErrors: [] };
page.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); });
const pending = [];
page.on('response', async res => {
  if (!res.url().endsWith('/api/lumina') || res.request().method() !== 'POST') return;
  const body = JSON.parse(res.request().postData() ?? '{}');
  const json = await res.json().catch(() => null);
  if (body.action === 'evaluateDigitDrawing') {
    const b64 = String(body.params.canvasBase64).split(',')[1];
    pending.push({ targetDigit: body.params.targetDigit, challengeType: body.params.challengeType, imageBytes: b64.length, response: json, png: b64 });
  } else if (json?.data?.challenges || json?.challenges) log.generated = json.data ?? json;
});

await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(6000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10 && !(await page.getByRole('button', { name: /Number Tracer/ }).count()); i++) {
  await page.getByText('Math Primitives', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
}
await page.getByRole('button', { name: /Number Tracer/ }).first().click();
await page.locator('label:has-text("Grade Level") + select').selectOption('kindergarten');
await page.getByRole('button', { name: new RegExp(`^${MODE[0].toUpperCase()}${MODE.slice(1)} \\(Tier`) }).first().click();
if (TIER !== 'Auto') await page.getByRole('button', { name: TIER, exact: true }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).click();
await page.waitForSelector('canvas[data-pip-object="canvas"]', { timeout: 180000 });
for (let i = 0; i < 60 && !log.generated; i++) await page.waitForTimeout(500);
await page.waitForTimeout(1500);
const challenges = log.generated?.challenges ?? [];
const canvas = page.locator('canvas[data-pip-object="canvas"]').first();
console.log('canvases', await page.locator('canvas').count(), 'tracer canvas', await canvas.count());

async function draw(strokes) {
  const box = await canvas.boundingBox();
  const sx = box.width / 500, sy = box.height / 400;
  for (const stroke of strokes) {
    await page.mouse.move(box.x + stroke[0].x * sx, box.y + stroke[0].y * sy);
    await page.mouse.down(); await page.waitForTimeout(40);
    for (const p of stroke.slice(1)) { await page.mouse.move(box.x + p.x * sx, box.y + p.y * sy); await page.waitForTimeout(4); }
    await page.mouse.up(); await page.waitForTimeout(60);
  }
}
async function check(label, target, written, drawing) {
  const before = pending.length;
  await canvas.screenshot({ path: join(OUT, `ink-${log.checks.length}-${label}.png`) });
  await page.getByRole('button', { name: /^Check/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Checking your writing'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  const feedback = await page.locator('main, body').first().innerText();
  const accepted = await page.getByRole('button', { name: /^(Next|Finish)/ }).count() > 0;
  const vision = pending.slice(before)[0];
  if (vision) await writeFile(join(OUT, `${log.checks.length}-${label}-t${target}-w${written}.png`), Buffer.from(vision.png, 'base64'));
  const row = { label, target, written, geoNormalized: drawing.geo, accepted, visionCalled: !!vision,
    vision: vision && { ...vision.response, imageBytes: vision.imageBytes },
    feedbackLine: feedback.split('\n').find(l => /look|draw|job|writing|try|keep|number/i.test(l) && l.length < 200) ?? null };
  log.checks.push(row); console.log(JSON.stringify(row));
  return accepted;
}
async function clear() { await page.getByRole('button', { name: 'Clear', exact: true }).click(); await page.waitForTimeout(200); }
async function next() { await page.getByRole('button', { name: /^(Next|Finish)/ }).click(); await page.waitForTimeout(1200); }

await canvas.screenshot({ path: join(OUT, 'item1-before-ink.png') });
const normalize = MODE !== 'trace';
for (const [i, ch] of challenges.entries()) {
  const t = ch.digit;
  if (i === 0) {
    // NT-5: a correct numeral, slanted enough that geometry falls below 90 → the vision judge decides.
    const d = drawingFor(t, t, 55, 88, normalize, { slant: 0.45, wobble: 14 }) ?? drawingFor(t, t, 40, 88, normalize, { slant: 0.8, wobble: 22 }) ?? drawingFor(t, t, 0, 89, normalize, { slant: 1.1, wobble: 30 });
    await draw(d.strokes); if (!(await check('correct-slanted', t, t, d))) { await clear(); const ok = drawingFor(t, t, 90, 100, normalize); await draw(ok.strokes); await check('correct-clean', t, t, ok); }
  } else if (i === 1) {
    // NT-6: a different numeral whose geometry against the target is >= 90.
    let found = null;
    for (const w of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(w => w !== t)) { const d = drawingFor(w, t, 90, 100, normalize); if (d) { found = { w, d }; break; } }
    if (found) { await draw(found.d.strokes); if (!(await check('wrong-geo-high', t, found.w, found.d))) await clear(); }
    else log.checks.push({ label: 'wrong-geo-high', target: t, note: 'no numeral 0-9 reaches geometry >= 90 against this target' });
    if (await page.getByRole('button', { name: /^Check/ }).count()) { const ok = drawingFor(t, t, 90, 100, normalize); await draw(ok.strokes); await check('correct-clean', t, t, ok); }
  } else if (i === 2) {
    // A different numeral with low geometry (the vision judge decides).
    const w = t === 9 ? 1 : t + 1 < 10 ? (t + 3) % 10 : 1;
    const d = drawingFor(w, t, 0, 89, normalize); await draw(d.strokes);
    if (!(await check('wrong-geo-low', t, w, d))) { await clear(); const ok = drawingFor(t, t, 90, 100, normalize); await draw(ok.strokes); await check('correct-clean', t, t, ok); }
  } else {
    const ok = drawingFor(t, t, 90, 100, normalize); await draw(ok.strokes); await check('correct-clean', t, t, ok);
  }
  if (await page.getByRole('button', { name: /^(Next|Finish)/ }).count()) await next(); else break;
  if (i === 0) await canvas.screenshot({ path: join(OUT, 'item2-before-ink.png') }).catch(() => {});
}
log.pending = pending.map(({ png, ...rest }) => rest);
await writeFile(join(OUT, 'drive.json'), JSON.stringify(log, null, 2));
console.log('GENERATED', JSON.stringify(challenges.map(c => ({ id: c.id, digit: c.digit, seq: c.sequenceNumbers, miss: c.missingIndex, ghost: c.showGhostDigit, dot: c.showStartDot, tier: c.supportTier }))));
console.log('CONSOLE_ERRORS', log.consoleErrors.length);
await browser.close(); await server.close();
