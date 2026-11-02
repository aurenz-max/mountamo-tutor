// Drive buoyancy-harbor salt_water levers in the Physics tester (offline workspace + lever bench): x-ray only once the
// foods are in the water, x-ray arrows on the foods as salt goes in, the easier one-food practice item.
// Usage: node drive-salt-levers.mjs <outDir> [grade]  (PW_DIR = playwright-core)
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
const page = await browser.newPage({ viewport: { width: 2400, height: 1300 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 40; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Sink or Float Harbor/ }).count()) break;
}
await page.getByRole('button', { name: /Sink or Float Harbor/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(() => {});
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
// The open bench squeezes the preview column; hide it for the picture (it stays mounted), then show it again.
const shot = async (name) => {
  await page.locator('button[title="Hide lever bench"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
  await page.locator('[data-harbor-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
  await page.locator('button[title="Show lever bench"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
};

async function generate(modeLabel) {
  await page.getByRole('button', { name: modeLabel }).first().click();
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate with AI/ }).first().click();
  const data = (await (await resp).json().catch(() => null))?.data;
  await page.waitForTimeout(8000);
  const show = page.locator('button[title="Show lever bench"]');
  if (await show.count()) await show.first().click();
  await page.waitForTimeout(500);
  return data?.challenges ?? [];
}
const pull = async (id) => {
  const b = page.locator(`[data-bench-lever="${id}"] button`);
  if (!(await b.count())) { check(`lever ${id} offered`, false); return false; }
  await b.first().click();
  await page.waitForTimeout(1500);
  const pulled = /pulled/.test(await page.locator(`[data-bench-lever="${id}"]`).innerText().catch(() => ''));
  check(`pull ${id}`, pulled || id === 'one_step_less');
  return true;
};
const benchLevers = async () => page.locator('[data-bench-lever]').evaluateAll(els => els.map(e => e.getAttribute('data-bench-lever')));

// ── Salt water ──
const salts = await generate(/Salt Water/);
check('salt generated', salts.length === 4 && salts.every(c => c.type === 'salt_water'));
const c = salts[0];
check('before the foods are in: no x-ray offered', !(await benchLevers()).includes('xray'), (await benchLevers()).join(','));
for (const t of c.things) await btn(`Guess the ${t.name} will sink`).click();
await page.waitForTimeout(3500);
check('foods in the water: x-ray offered', (await benchLevers()).includes('xray'), (await benchLevers()).join(','));
await pull('xray');
await shot('l1-xray-fresh');
const need = t => Math.floor((t.density - 1) / 0.02) + 1;
const lo = Math.max(...c.things.filter(t => c.floatGoal.includes(t.key)).map(need));
for (let k = 0; k < lo; k++) { await btn('Add a spoon of salt').click(); await page.waitForTimeout(300); }
await page.waitForTimeout(3500);
await shot('l2-xray-salted');
await pull('one_step_less');
check('easier item is practice with one food', /Practice/.test(await body()) && (await page.getByRole('button', { name: /^Guess the .* will float$/ }).count()) === 1);
await shot('l3-practice');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|status of 400/i.test(e));
check('no page errors (beyond known tester warnings)', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
