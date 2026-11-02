// Drive volcano-island's save_the_village (walls from a port of the lava rule on the generated maps) in the Physics tester (offline workspace): guess -> battery in -> the start wires
// light nothing -> I'm done! is a named miss -> Try again keeps the wires -> one wire tapped on the 3D posts, the rest
// through the clip chips -> the bulb lights -> credited; finale. Reads every item from the screen.
// Usage: node drive-light.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Kindergarten';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Volcano Island/ }).count()) break;
}
await page.getByRole('button', { name: /Volcano Island/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));


await page.getByRole('button', { name: /Save the Village/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const items = ((await (await resp).json().catch(() => null))?.data?.challenges) ?? [];
await page.waitForTimeout(12000);
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
async function nextItem(n) {
  for (let k = 0; k < 15; k++) {
    if (await counter() === n) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return await counter() === n;
}
// The lava rule, ported from villageModel.ts.
const S = 9;
const nb = (c) => { const x = c % S, y = Math.floor(c / S); return [[x, y + 1], [x - 1, y], [x + 1, y], [x, y - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < S && b < S).map(([a, b]) => b * S + a); };
function path(c, walls) {
  const wall = new Set(walls), done = [c.crater], inL = new Set(done);
  while (done.length < c.volume) {
    let best = null;
    for (const f of done) for (const n of nb(f)) {
      if (inL.has(n) || wall.has(n) || c.heights[n] > c.heights[f]) continue;
      if (best == null || c.heights[n] < c.heights[best] || (c.heights[n] === c.heights[best] && n > best)) best = n;
    }
    if (best == null) break; done.push(best); inL.add(best);
  }
  return done;
}
const safe = (c, w) => !c.village.some(v => path(c, w).includes(v));
function fix(c) {
  const cand = path(c, []).filter(x => x !== c.crater && !c.village.includes(x));
  const pick = (k, st, ch) => { if (ch.length === k) return safe(c, ch) ? ch : null; for (let i = st; i < cand.length; i++) { const r = pick(k, i + 1, [...ch, cand[i]]); if (r) return r; } return null; };
  for (let k = 1; k <= c.maxWalls; k++) { const r = pick(k, 0, []); if (r) return r; }
  return null;
}
check('generated village maps', items.length >= 3 && items.every(c => c.type === 'save_the_village'), `items=${items.length}`);
const sq = (w) => btn(`Square row ${Math.floor(w / S) + 1}, column ${(w % S) + 1}`);
for (let i = 0; i < items.length; i++) {
  const c = items[i];
  await btn('Erupt to test').click();
  await page.waitForTimeout(3500);
  check(`village ${i + 1}: an unblocked test reaches the village`, /The lava reached the village!/.test(await body()));
  if (i === 0) await full('vg1-lava-hits');
  const w = fix(c);
  for (const cell of w) await sq(cell).click();
  await btn('Erupt to test').click();
  await page.waitForTimeout(3500);
  check(`village ${i + 1}: ${w.length} walls turn the lava aside`, /The lava missed the village!/.test(await body()));
  if (i === 0) await full('vg2-saved');
  await btn("I'm done!").click(); await page.waitForTimeout(1500);
  check(`village ${i + 1}: credited`, /The village is safe!/.test(await body()) || (i === items.length - 1 && /Eruptions done!/.test(await body())));
  if (i < items.length - 1) check(`advance to village ${i + 2}`, await nextItem(i + 2));
}
for (let k = 0; k < 6 && !/Eruptions done!/.test(await body()); k++) {
  const next = page.getByRole('button', { name: /^(Next|Continue)/i });
  if (await next.count()) await next.first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
check('finale shows', /Eruptions done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
