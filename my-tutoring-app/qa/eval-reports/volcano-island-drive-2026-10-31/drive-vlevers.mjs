// Drive volcano-island's levers: changes_marked, fizz_pairs after both erupt, one_step_less practice in the Physics tester (offline workspace): guess -> battery in -> the start wires
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


await page.getByRole('button', { name: /Kitchen Volcano/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(12000);
const scene = await page.locator('[data-volcano-scene]').first().getAttribute('data-volcano-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-volcano-scene]').first().scrollIntoViewIfNeeded();
const shot = (name) => page.locator('[data-volcano-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
async function nextItem(n) {
  for (let k = 0; k < 15; k++) {
    if (await counter() === n) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return await counter() === n;
}
const benchOn = async () => { await page.locator('button[title="Show lever bench"]').first().click().catch(() => {}); await page.waitForTimeout(600); };
const benchOff = async () => { await page.locator('button[title="Hide lever bench"]').first().click().catch(() => {}); await page.waitForTimeout(600); };
const benchLevers = async () => { await benchOn(); const ids = await page.locator('[data-bench-lever]').evaluateAll(els => els.map(e => e.getAttribute('data-bench-lever'))); await benchOff(); return ids; };
const pull = async (id) => {
  await benchOn();
  const b = page.locator(`[data-bench-lever="${id}"] button`);
  if (!(await b.count())) { check(`lever ${id} offered`, false); await benchOff(); return false; }
  await b.first().click(); await page.waitForTimeout(1500);
  await benchOff();
  return true;
};

const instr = await page.locator('[data-volcano-step]').first().locator('xpath=..').innerText();
const m = instr.match(/different amount of (baking soda|vinegar)/);
check('before eruptions: changes_marked and one_step_less, no fizz pairs', (await benchLevers()).join(',') === 'changes_marked,one_step_less', (await benchLevers()).join(','));
await btn(`More ${m[1]}`).click();
await pull('changes_marked');
check('the changed amount is marked', (await page.locator('[data-volcano-changed]').count()) === 1);
await btn('Guess: volcano A').click();
await btn('Erupt volcano A').click(); await btn('Erupt volcano B').click();
await page.waitForTimeout(3500);
check('after both erupt: fizz pairs offered', (await benchLevers()).includes('fizz_pairs'));
await pull('fizz_pairs');
check('the fizz pairs are drawn for A and B', (await page.locator('[data-volcano-fizz-row]').count()) === 2);
await full('vl1-fizz-pairs');
await pull('one_step_less');
check('the easier item is practice', /practice/i.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
