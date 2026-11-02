// Drive buoyancy-harbor's levers in the Physics tester (offline workspace + lever bench). Drop test: test both things,
// pull x-ray, material tags and the same-stuff pair, screenshot; pull the easier test (Practice). Boat: pull the model
// boats, launch a boat, pull x-ray, screenshot. Usage: node drive-levers.mjs <outDir> [grade]  (PW_DIR = playwright-core)
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

// ── Drop test ──
const drops = await generate(/Drop Test/);
check('drop test generated', drops.length === 5);
const c = drops[0];
check('before testing: no x-ray offered', !(await benchLevers()).includes('xray'), (await benchLevers()).join(','));
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await btn(`Guess the ${c.tested[0].name} will float`).click();
await btn(`Guess the ${c.tested[1].name} will sink`).click();
await page.waitForTimeout(4500);
check('after testing: x-ray offered', (await benchLevers()).includes('xray'), (await benchLevers()).join(','));
await pull('xray');
await pull('material_tags');
await pull('side_by_side');
await page.waitForTimeout(4000);
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await shot('l1-drop-xray-tags-pair');
await pull('one_step_less');
check('practice item on screen', /Practice/.test(await body()));
await shot('l2-drop-practice');

// ── Boat ──
const boats = await generate(/Build a Boat/);
check('boat items generated', boats.length === 4);
await pull('solved_boat');
await page.waitForTimeout(3000);
const m = boats[0].materials.includes('foil') ? 'foil' : boats[0].materials[0];
const label = { foil: 'foil', clay: 'clay', sticks: 'craft sticks' }[m];
await btn(`Make it of ${label}`).click(); await btn('Shape: low sides').click(); await btn('Size: small').click();
await btn('Put it in the water').click();
await page.waitForTimeout(2500);
for (let k = 0; k < 2; k++) { await btn('Add a penny').click(); await page.waitForTimeout(250); }
check('x-ray offered while the boat is in the water', (await benchLevers()).includes('xray'));
await pull('xray');
await page.waitForTimeout(2500);
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await shot('l3-boat-models-xray');
await page.screenshot({ path: `${OUT}/l3-page.png` });

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
