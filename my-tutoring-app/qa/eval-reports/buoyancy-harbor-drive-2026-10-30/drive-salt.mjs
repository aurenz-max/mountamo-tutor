// Drive buoyancy-harbor's salt_water in the Physics tester (offline workspace), pinned to "Salt Water": foods dropped
// into fresh water with a guess (all sink), salt added spoon by spoon until a food rises, too much salt -> named miss ->
// Try again keeps the water -> pour some out -> pass; the rest set to their fewest spoons; finale.
// Usage: node drive-salt.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 4';
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
  if (await page.getByRole('button', { name: /Sink or Float Harbor/ }).count()) break;
}
await page.getByRole('button', { name: /Sink or Float Harbor/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));
await page.getByRole('button', { name: /Salt Water/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
// The model, for the drive's own choices: water 1 + 0.02 per spoon; a food floats when its density is below.
const need = t => Math.floor((t.density - 1) / 0.02) + 1;
const window = c => {
  const lo = Math.max(...c.things.filter(t => c.floatGoal.includes(t.key)).map(need));
  const sinks = c.things.filter(t => c.sinkGoal.includes(t.key)).map(need);
  return [lo, sinks.length ? Math.min(...sinks) - 1 : 8];
};
check('generated 4 salt items', items.length === 4 && items.every(c => c.type === 'salt_water'),
  items.map(c => `${c.things.map(t => t.name).join('+')} [${window(c).join('-')}]`).join('; '));
await page.waitForTimeout(8000);
const scene = await page.locator('[data-harbor-scene]').first().getAttribute('data-harbor-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); console.log('ERRORS', errors.slice(0, 6)); await browser.close(); process.exit(1); }
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-harbor-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const spoonsNow = async () => Number(await page.locator('[data-harbor-spoons]').first().getAttribute('data-harbor-spoons'));
async function setSpoons(n) {
  for (let k = 0; k < 12 && await spoonsNow() !== n; k++) {
    await btn(await spoonsNow() < n ? 'Add a spoon of salt' : 'Pour some out, add fresh water').click();
    await page.waitForTimeout(350);
  }
}
async function advance(nextInstr) {
  for (let k = 0; k < 12; k++) {
    if (nextInstr && await page.getByText(nextInstr.slice(0, 40)).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return nextInstr ? !!(await page.getByText(nextInstr.slice(0, 40)).count()) : true;
}

for (let i = 0; i < items.length; i++) {
  const c = items[i];
  const [lo, hi] = window(c);
  check(`salt ${i + 1}: goal stated`, (await page.getByText(c.instruction.slice(0, 40)).count()) > 0, c.instruction);
  const early = (await btn('Add a spoon of salt').count()) > 0;
  check(`salt ${i + 1}: no salt controls before the foods are in`, !early);
  if (early) { await full(`x-early-${i + 1}`); console.log('STEP', await page.locator('[data-harbor-step]').first().getAttribute('data-harbor-step'), 'SPOONS', await spoonsNow()); }
  if (i === 0) await shot('s1-foods-on-pier');
  for (const t of c.things) await btn(`Guess the ${t.name} will float`).click();
  await page.waitForTimeout(3500);
  if (i === 0) await shot('s2-all-sank-fresh');
  check(`salt ${i + 1}: every food sank in fresh water`, (await body()).split('On the bottom').length - 1 >= c.things.length);
  if (i === 0) {
    await setSpoons(lo);
    await page.waitForTimeout(3500);
    await shot('s3-first-floats');
    check('a float-goal food rises at its spoon', /Floats/.test(await body()), `spoons=${await spoonsNow()}`);
    if (c.sinkGoal.length) {
      await setSpoons(hi + 1);
      await page.waitForTimeout(3500);
      await shot('s4-too-salty');
      await btn("I'm done!").click();
      await page.waitForTimeout(1200);
      check('too much salt is a named miss', /The water pushes up too hard/.test(await body()));
      const tryAgain = page.getByRole('button', { name: /Try again/i });
      if (await tryAgain.count()) await tryAgain.first().click();
      await page.waitForTimeout(1000);
      check('Try again keeps the water', await spoonsNow() === hi + 1);
      await setSpoons(hi);
      await page.waitForTimeout(3000);
      await shot('s5-just-right');
    }
  } else {
    await setSpoons(lo);
    await page.waitForTimeout(2500);
  }
  await btn("I'm done!").click();
  await page.waitForTimeout(1500);
  const b = await body();
  check(`salt ${i + 1}: credited`, /Salt makes the water heavier/.test(b) || (i === items.length - 1 && /Harbor tests done!/.test(b)),
    b.match(/With \d+ spoons? of salt[^\n]*/)?.[0] ?? '');
  if (i < items.length - 1) check(`advance to salt ${i + 2}`, await advance(items[i + 1].instruction));
}
await advance(null);
await page.waitForTimeout(2000);
check('finale shows', /Harbor tests done!|like a scientist/.test(await body()));
await full('s9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>/i.test(e));
check('no page errors (beyond the known SVG ellipse/circle warnings)', real.length === 0, real.slice(0, 4).join(' | '));
console.log('BAD RESPONSES', bad);
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, bad, items: items.map(c => ({ things: c.things.map(t => t.key), floatGoal: c.floatGoal, sinkGoal: c.sinkGoal })), log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
