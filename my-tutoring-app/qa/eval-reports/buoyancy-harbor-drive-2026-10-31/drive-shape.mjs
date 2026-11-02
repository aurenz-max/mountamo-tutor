// Drive buoyancy-harbor's salt_water in the Physics tester (offline workspace), pinned to "Make It Float": foods dropped
// into fresh water with a guess (all sink), salt added spoon by spoon until a food rises, too much salt -> named miss ->
// Try again keeps the water -> pour some out -> pass; the rest set to their fewest spoons; finale.
// Usage: node drive-salt.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 1';
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
await page.getByRole('button', { name: /Make It Float/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
// The model, for the drive's own choices: clay 1.5 g/cm³; floor small 10 / big 20 cm²; wall low 1.5 / tall 3 cm; penny 2.5 g.
const CLAY = { small: { m: 24, v: 16, floor: 10 }, big: { m: 36, v: 24, floor: 20 } };
const cap = (size, wall) => { const k = CLAY[size]; const spare = k.floor * wall + k.v - k.m; return spare < 0 ? -1 : Math.floor(spare / 2.5); };
check('generated 4 shape items', items.length === 4 && items.every(c => c.type === 'make_it_float'),
  items.map(c => `${c.size} goal ${c.goal}`).join('; '));
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
const penniesNow = async () => Number(await page.locator('[data-harbor-pennies]').first().getAttribute('data-harbor-pennies'));
async function advance(nextInstr) {
  for (let k = 0; k < 12; k++) {
    if (nextInstr && await page.getByText(nextInstr.slice(0, 60)).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return nextInstr ? !!(await page.getByText(nextInstr.slice(0, 60)).count()) : true;
}
const guessIn = (g) => btn(`Guess the clay will ${g}, and put it in the water`).click();

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
for (let i = 0; i < 4; i++) {
  // What is on screen decides the drive's choices: the goal from the instruction, the clay's size from the panel.
  const instr = await page.locator('[data-harbor-step]').first().locator('xpath=..').innerText();
  const goal = Number((instr.match(/carrying (\d+)/) || [0, 0])[1]);
  const size = await page.locator('[data-harbor-clay]').first().getAttribute('data-harbor-clay');
  check(`shape ${i + 1}: goal stated`, /This ball of clay sinks/.test(instr), `${size} clay, goal ${goal}`);
  check(`shape ${i + 1}: only the shape can change`, !(await btn('Make it of clay').count()) && !(await btn('Size: big').count()) && !!size);
  await guessIn('float');
  await page.waitForTimeout(3000);
  if (i === 0) await shot('m1-ball-sank');
  check(`shape ${i + 1}: the ball sinks`, /It sank with 0 pennies!/.test(await body()));
  await btn('Fish it out').click();
  if (i === 0) {
    await btn('Shape: flat').click();
    await guessIn('float');
    await page.waitForTimeout(3000);
    check('flat clay sinks too', /It sank with 0 pennies!/.test(await body()));
    await btn('Fish it out').click();
    await btn("I'm done!").click();
    await page.waitForTimeout(1200);
    check('flat is a named miss', /Flat clay still sinks/.test(await body()));
    await full('m2-flat-miss');
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(1000);
    const flatKept = await btn('Shape: flat').getAttribute('aria-pressed').catch(() => null);
    check('Try again keeps the shape', flatKept === 'true', `aria-pressed=${flatKept}`);
  }
  const shape = cap(size, 1.5) >= goal ? 'low sides' : 'tall sides';
  await btn(`Shape: ${shape}`).click();
  await guessIn('float');
  await page.waitForTimeout(2500);
  for (let k = 0; k < goal; k++) { await btn('Add a penny').click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  if (i === 0 || goal > 3) await shot(`m3-floats-loaded-${i + 1}`);
  check(`shape ${i + 1}: ${shape} floats with ${goal}`, !/It sank with [1-9]/.test(await body()) && await penniesNow() === goal);
  await btn('Take it out').click();
  await btn("I'm done!").click();
  await page.waitForTimeout(1500);
  const b = await body();
  check(`shape ${i + 1}: credited`, /same clay, just as heavy/.test(b) || (i === 3 && /Harbor tests done!/.test(b)));
  if (i < 3) check(`advance to shape ${i + 2}`, await nextItem(i + 2));
}
await advance(null);
await page.waitForTimeout(2000);
check('finale shows', /Harbor tests done!|like a scientist/.test(await body()));
await full('m9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>/i.test(e));
check('no page errors (beyond the known SVG ellipse/circle warnings)', real.length === 0, real.slice(0, 4).join(' | '));
console.log('BAD RESPONSES', bad);
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, bad, items: items.map(c => ({ size: c.size, goal: c.goal })), log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
