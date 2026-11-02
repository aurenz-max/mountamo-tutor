// Drive buoyancy-harbor's cargo_two_designs in the Physics tester (offline workspace), pinned to "Two Boats": on each item
// boat B is built one change from boat A (or both built at hard), a guess is made, both boats are loaded until they sink,
// and the claim is read from the counts. Item 1 first claims the wrong boat -> named miss -> Try again -> the right claim.
// Usage: node drive-cargo.mjs <outDir> [grade label] [tier: easy|medium|hard]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 2';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
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
await page.getByRole('button', { name: /Two Boats/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
check('generated 3 two-boat items', items.length === 3 && items.every(c => c.type === 'cargo_two_designs'),
  items.map(c => c.question ? `Q:${c.question}` : `A=${c.given.material}/${c.given.shape}/${c.given.size}${c.oneChange ? ' one-change' : ''}`).join('; '));
await page.waitForTimeout(8000);
const scene = await page.locator('[data-harbor-scene]').first().getAttribute('data-harbor-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); await browser.close(); process.exit(1); }
const shot = (name) => page.locator('[data-harbor-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const LABEL = { foil: 'foil', clay: 'clay', sticks: 'craft sticks' };
const shapeAria = (shape, material) => shape === 'ball' ? (material === 'sticks' ? 'a bundle' : 'a ball')
  : shape === 'flat' ? (material === 'sticks' ? 'a flat raft' : 'flat') : shape === 'low_sides' ? 'low sides' : 'tall sides';
async function build(b) {
  await btn(`Make it of ${LABEL[b.material]}`).click();
  await btn(`Shape: ${shapeAria(b.shape, b.material)}`).click();
  await btn(`Size: ${b.size}`).click();
}
/** Loads the boat on the panel until it sinks; returns the pennies it carried. */
async function testBoat(k) {
  await btn(`Put boat ${k} in the water`).click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 31; i++) {
    const t = await body();
    const m = t.match(/It sank with (\d+) penn/);
    if (m) { const n = Number(m[1]); await btn('Fish it out').click(); await page.waitForTimeout(300); return Math.max(0, n - 1); }
    await btn('Add a penny').click();
    await page.waitForTimeout(120);
  }
  return null;
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

const B_FOR = (a) => ({ ...a, shape: a.shape === 'tall_sides' ? 'low_sides' : 'tall_sides' });
for (let i = 0; i < items.length; i++) {
  const c = items[i];
  check(`item ${i + 1}: instruction shown`, (await page.getByText(c.instruction.slice(0, 40)).count()) > 0, c.instruction);
  check(`item ${i + 1}: no claim before the tests`, (await page.getByText('Which boat carried more pennies?').count()) === 0);
  let a = c.given;
  if (!a) {
    // Hard: build A, then B differing only in the asked part.
    a = { material: c.materials[0], shape: 'low_sides', size: 'small' };
    await btn('Show boat A').click();
    await build(a);
  }
  const b = c.question === 'material' ? { ...a, material: c.materials[1] } : c.question === 'size' ? { ...a, size: 'big' } : B_FOR(a);
  await btn('Show boat B').click();
  await build(b);
  await btn('Guess: Boat A').click();
  if (i === 0) await shot('c1-boat-b-built');
  const hb = await testBoat('B');
  if (i === 0) await shot('c2-boat-b-tested');
  await btn('Show boat A').click();
  const ha = await testBoat('A');
  check(`item ${i + 1}: both boats tested`, ha != null && hb != null, `A carried ${ha}, B carried ${hb}`);
  const right = ha === hb ? 'The same' : ha > hb ? 'Boat A' : 'Boat B';
  if (i === 0) {
    const wrong = right === 'Boat A' ? 'Boat B' : 'Boat A';
    await btn(`Carried more: ${wrong}`).click();
    await btn('Check').click();
    await page.waitForTimeout(1200);
    check('a claim the tests do not show is a named miss', /That was your guess|Look at the lab notebook again/.test(await body()));
    await full('c3-miss');
    const again = page.getByRole('button', { name: /Try again/i });
    if (await again.count()) await again.first().click();
    await page.waitForTimeout(1000);
  }
  await btn(`Carried more: ${right}`).click();
  await btn('Check').click();
  await page.waitForTimeout(1500);
  const t = await body();
  check(`item ${i + 1}: credited`, /^Yes!|Yes! /m.test(t) || (i === items.length - 1 && /Harbor tests done!/.test(t)), t.match(/Yes![^\n]*/)?.[0]?.slice(0, 160) ?? '');
  if (i === 0) await full('c4-pass');
  if (i < items.length - 1) check(`advance to item ${i + 2}`, await advance(items[i + 1].instruction));
}
await advance(null);
await page.waitForTimeout(2000);
check('finale shows', /Harbor tests done!|like a scientist/.test(await body()));
await full('c9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|observe-(dialogue|learner)|status of 400|<details>|hydrat/i.test(e));
check('no page errors (beyond the known SVG warnings, observer 400s and the IdleScreen hydration warning)', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, items, log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
