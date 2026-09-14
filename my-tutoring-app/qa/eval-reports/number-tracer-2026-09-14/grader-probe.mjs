// Design probe: does number-tracer's shipped grader (geometry + Gemini vision) reject a wrong
// number in sequence mode, accept reversals, and what does vision say? Real engines, no writes.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app';
const SCRATCH = 'C:/Users/xbox3/AppData/Local/Temp/claude/c--Users-xbox3-claude-web-tutor/03e007a5-f462-47e1-8daf-ac88674f75a2/scratchpad';
const OUT = join(SCRATCH, 'grader-probe', process.env.RUN ?? 'baseline');
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
const { evaluateDigitDrawing } = await runner.import('/src/components/lumina/service/math/gemini-digit-evaluation.ts');

const require = createRequire(join(SCRATCH, 'package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="500" height="400"></canvas>');

let seed = Number(process.env.SEED ?? 7);
const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
/** A child's attempt at writing `n`: the canonical strokes, scaled, shifted, tilted, wobbled, optionally mirrored. */
const WOBBLE = Number(process.env.WOBBLE ?? 8);
function childStrokes(n, { mirror = false, wobble = WOBBLE } = {}) {
  const paths = geo.getDigitPaths(n);
  const pts = paths.flat();
  const cx = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
  const cy = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
  const s = 0.8 + rand() * 0.25, dx = (rand() - 0.5) * 60, dy = (rand() - 0.5) * 30, th = (rand() - 0.5) * 0.12;
  return paths.map(stroke => {
    const dense = [];
    for (let i = 0; i < stroke.length - 1; i++) for (let k = 0; k < 4; k++) {
      const t = k / 4; dense.push({ x: stroke[i].x + t * (stroke[i + 1].x - stroke[i].x), y: stroke[i].y + t * (stroke[i + 1].y - stroke[i].y) });
    }
    dense.push(stroke[stroke.length - 1]);
    return dense.map(p => {
      let x = p.x - cx, y = p.y - cy;
      if (mirror) x = -x;
      const rx = x * Math.cos(th) - y * Math.sin(th), ry = x * Math.sin(th) + y * Math.cos(th);
      return { x: cx + rx * s + dx + (rand() - 0.5) * wobble, y: cy + ry * s + dy + (rand() - 0.5) * wobble };
    });
  });
}

async function render(strokes, fill = null) {
  return page.evaluate(([strokes, fill]) => {
    const c = document.getElementById('c'); const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 500, 400);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, 500, 400); }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 500; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke(); }
    for (let y = 0; y <= 400; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(500, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(100, 350); ctx.lineTo(400, 350); ctx.stroke(); ctx.setLineDash([]);
    for (const s of strokes) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); ctx.stroke();
    }
    return c.toDataURL('image/png');
  }, [strokes, fill]);
}

// Expected outcomes written before running.
const cases = [
  ...[2, 3, 4, 5, 6, 7, 8, 9].map(t => ({ group: 'correct', target: t, written: t, expect: 'accepted' })),
  ...[[5, 4], [5, 6], [5, 7], [7, 8], [3, 2], [6, 9], [9, 6], [1, 7], [7, 1], [2, 5], [3, 8], [8, 3], [4, 9], [0, 6]]
    .map(([t, w]) => ({ group: 'wrong-number', target: t, written: w, expect: 'rejected' })),
  ...[2, 3, 5, 6, 7, 9].map(t => ({ group: 'mirrored', target: t, written: t, mirror: true, expect: 'accepted (prompt rule 5 scores reversed 70-84)' })),
];
const rows = [];
for (const [i, c] of cases.entries()) {
  const strokes = childStrokes(c.written, { mirror: !!c.mirror });
  const ideal = geo.getDigitPaths(c.target);
  const accuracy = geo.scoreStrokeAccuracy(strokes, ideal, true);
  const coverage = geo.computePathCoverage(strokes, ideal, true);
  const geoScore = Math.round(accuracy * 0.6 + coverage * 0.4);
  const png = await render(strokes);
  await writeFile(join(OUT, `${i}-${c.group}-t${c.target}-w${c.written}.png`), Buffer.from(png.split(',')[1], 'base64'));
  const vision = geoScore >= 90 ? null : await evaluateDigitDrawing(png, c.target, 'sequence');
  const final = geoScore >= 90 ? geoScore : vision && vision.confidence >= 60 ? vision.score : geoScore;
  const row = { ...c, accuracy, coverage, geoScore, vision, final, accepted: final >= 50 };
  rows.push(row);
  console.log(JSON.stringify({ g: c.group, t: c.target, w: c.written, m: !!c.mirror, geoScore, v: vision && { s: vision.score, c: vision.confidence, r: vision.recognized, var: vision.variant, read: vision.readAs, fb: vision.feedback }, accepted: row.accepted }));
}
await writeFile(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2));
const tally = g => { const r = rows.filter(x => x.group === g); return `${r.filter(x => x.accepted).length}/${r.length} accepted`; };
console.log('SUMMARY', { correct: tally('correct'), wrongNumber: tally('wrong-number'), mirrored: tally('mirrored') });
await browser.close(); await server.close();
