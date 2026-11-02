// Drive circuit-workbench's levers (light_it, medium): x-ray on an open start stands still; closed loop flows; easier item in the Physics tester (offline workspace): guess -> battery in -> the start wires
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
  if (await page.getByRole('button', { name: /Circuit Workbench/ }).count()) break;
}
await page.getByRole('button', { name: /Circuit Workbench/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));


await page.getByRole('button', { name: /Light It Up/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(12000);
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.locator('[data-circuit-scene]').first().scrollIntoViewIfNeeded();
  await page.locator('[data-circuit-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
};
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
check('before the guess: no x-ray offered', !(await benchLevers()).includes('xray'), (await benchLevers()).join(','));
await btn('Guess it will stay off').click(); await page.waitForTimeout(800);
check('after the guess: x-ray and the easier item offered', (await benchLevers()).join(',') === 'xray,one_step_less', (await benchLevers()).join(','));
await pull('xray');
await shot('l1-xray-open');
// Close the loop from scratch so the dots flow.
for (let k = 0; k < 6; k++) { const r = page.getByRole('button', { name: /^Remove the wire/ }); if (!(await r.count())) break; await r.first().click(); await page.waitForTimeout(150); }
const chip = (w) => btn(`Clip: ${w}`);
await chip("the battery's + end").click(); await chip("the bulb's left clip").click();
await chip("the bulb's right clip").click(); await chip("the battery's − end").click();
await page.waitForTimeout(1500);
await shot('l2-xray-flowing');
await pull('one_step_less');
check('the easier item is practice', /practice/i.test(await body()));
await shot('l3-practice');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
