// Drive marble-run-park's levers (make_the_loop, the tester's tier) through the tester's lever bench: before a peg
// only the loop-top line and the easier item are offered; the line draws; on a peg the energy bar comes (all blue),
// and follows a run; after runs the peg rings come and the notebook sorts by peg; the easier item is practice.
// Usage: node drive-levers.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
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
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Marble Run Park/ }).count()) break;
}
await page.getByRole('button', { name: /Marble Run Park/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(12000);
const body = () => page.locator('body').innerText();
const step = () => page.locator('[data-marble-step]').first().getAttribute('data-marble-step').catch(() => null);
const shot = async (name) => {
  await page.locator('[data-marble-scene]').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(800);
  await page.locator('[data-marble-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
};
const benchOn = async () => { await page.locator('button[title="Show lever bench"]').first().click().catch(() => {}); await page.waitForTimeout(600); };
const benchOff = async () => { await page.locator('button[title="Hide lever bench"]').first().click().catch(() => {}); await page.waitForTimeout(600); };
const benchLevers = async () => { await benchOn(); const ids = await page.locator('[data-bench-lever]').evaluateAll(els => els.map(e => e.getAttribute('data-bench-lever'))); await benchOff(); return ids.join(','); };
const pull = async (id) => {
  await benchOn();
  const b = page.locator(`[data-bench-lever="${id}"] button`);
  if (!(await b.count())) { check(`lever ${id} offered`, false); await benchOff(); return false; }
  await b.first().click(); await page.waitForTimeout(1500);
  await benchOff();
  return true;
};
const chip = (k) => page.getByRole('button', { name: `Peg ${k + 1}`, exact: true });
async function runFrom(k) {
  await chip(k).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Let it go' }).click();
  for (let n = 0; n < 40; n++) { await page.waitForTimeout(500); if (await step() !== 'rolling') break; }
  return page.locator('[data-marble-outcome]').first().getAttribute('data-marble-outcome').catch(() => null);
}

check('no peg yet: the line and the easier item', (await benchLevers()) === 'loop_top_line,one_step_less', await benchLevers());
await pull('loop_top_line');
await shot('lv1-loop-top-line');
await chip(5).click(); await page.waitForTimeout(500);
check('on a peg: the energy bar is offered', (await benchLevers()).includes('xray'), await benchLevers());
await pull('xray');
check('the energy bar is drawn on the peg', (await page.locator('[data-marble-energy]').count()) === 1);
await shot('lv2-energy-on-peg');
// A run from a low peg (fails) and a high one (made it); catch the bar mid-run.
const low = await runFrom(1);
await chip(7).click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Let it go' }).click();
await page.waitForTimeout(1600);
await shot('lv3-energy-mid-run');
for (let n = 0; n < 40; n++) { await page.waitForTimeout(500); if (await step() !== 'rolling') break; }
const high = await page.locator('[data-marble-outcome]').first().getAttribute('data-marble-outcome').catch(() => null);
check('runs end: low fails, high makes it', low !== 'made_it' && high === 'made_it', `${low} / ${high}`);
check('after runs: the peg rings are offered', (await benchLevers()).includes('peg_results'), await benchLevers());
await pull('peg_results');
const order = await page.locator('table tr').evaluateAll(trs => trs.slice(1).map(tr => tr.children[1]?.textContent));
check('the notebook is sorted by peg', order.join(',') === 'Peg 2,Peg 8', order.join(','));
await shot('lv4-peg-rings');
const isLowest = /Find the lowest|There is a strip/.test(await body());
if (isLowest) {
  await pull('one_step_less');
  check('the easier item is practice, with no levers drawn', /practice/i.test(await body()) && (await page.locator('[data-marble-energy]').count()) === 0);
  await shot('lv5-practice');
}
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/levers-log.json`, JSON.stringify({ log, errors }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
