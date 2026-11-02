// Drive buoyancy-harbor's build_boat in the Physics tester (offline workspace), pinned to "Build a Boat": an empty
// build (nothing chosen), a clay ball that sinks empty -> named miss -> Try again keeps the build, a small foil boat with
// low sides tested penny by penny to the sink (notebook row), a boat with tall sides passes and is loaded with the
// goal, the rest by a big tall boat, finale. Usage: node drive-boat.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 1';
const TIER = process.argv[4] || '';
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
await page.getByRole('button', { name: /Build a Boat/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
check('generated 4 boat items', items.length === 4 && items.every(c => c.type === 'build_boat'),
  items.map(c => `${c.goal}p [${c.materials.join('/')}]`).join('; '));
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
const label = { foil: 'foil', clay: 'clay', sticks: 'craft sticks' };
async function build(material, shape, size) {
  await btn(`Make it of ${label[material]}`).click();
  await btn(`Shape: ${shape}`).click();
  await btn(`Size: ${size}`).click();
  await page.waitForTimeout(500);
}
async function advance(nextInstr) {
  for (let k = 0; k < 12; k++) {
    if (nextInstr && await page.getByText(nextInstr.slice(0, 50)).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return nextInstr ? !!(await page.getByText(nextInstr.slice(0, 50)).count()) : true;
}

const doneDisabled = await btn("I'm done!").isDisabled();
check('nothing chosen at start; I\'m done! and the water closed', doneDisabled && (await btn('Put it in the water').isDisabled()));
await shot('b1-start');

for (let i = 0; i < items.length; i++) {
  const c = items[i];
  check(`boat ${i + 1}: goal stated`, (await page.getByText(c.instruction.slice(0, 50)).count()) > 0, c.instruction);
  if (i === 0) {
    if (c.materials.includes('clay')) {
      await build('clay', 'a ball', 'big');
      await shot('b2-clay-ball-on-stand');
      await btn('Put it in the water').click();
      await page.waitForTimeout(3500);
      await shot('b3-clay-ball-sank');
      check('clay ball sinks empty', /It sank with 0 pennies!/.test(await body()) || (await page.locator('[data-harbor-pennies="0"]').count()) > 0);
      await btn('Fish it out').click();
      await btn("I'm done!").click();
      await page.waitForTimeout(1200);
      check('sinks-empty miss feedback', /It sinks with nothing in it/.test(await body()));
      const tryAgain = page.getByRole('button', { name: /Try again/i });
      check('Try again shown after a miss', (await tryAgain.count()) > 0);
      if (await tryAgain.count()) await tryAgain.first().click();
      await page.waitForTimeout(1000);
      // The build is whole only if all three choices survived; an emptied build keeps "Put it in the water" closed.
      check('Try again keeps the build', !(await btn('Put it in the water').isDisabled()));
    }
    const m = c.materials.includes('foil') ? 'foil' : c.materials[0];
    await build(m, 'low sides', 'small');
    await btn('Put it in the water').click();
    await page.waitForTimeout(2500);
    await shot('b4-low-boat-floating');
    let sankAt = 0;
    for (let k = 1; k <= 30; k++) {
      await btn('Add a penny').click();
      await page.waitForTimeout(250);
      if (/It sank with/.test(await body())) { sankAt = k; break; }
    }
    await page.waitForTimeout(2500);
    await shot('b5-low-boat-sank');
    check('penny test runs to the sink and the notebook records it', sankAt > 0 && /Lab notebook/.test(await body()) && /Sank/.test(await body()), `sank at ${sankAt}`);
    await btn('Fish it out').click();
  }
  const m = c.materials.includes('foil') ? 'foil' : c.materials[0];
  await build(m, 'tall sides', 'big');
  await btn("I'm done!").click();
  await page.waitForTimeout(900 + c.goal * 320 + 2500);
  const b = await body();
  check(`boat ${i + 1}: big tall boat credited and loaded`, /It floats with all \d+ pennies!/.test(b) || (i === items.length - 1 && /Harbor tests done!/.test(b)),
    b.match(/It floats with all \d+ pennies![^\n]*/)?.[0] ?? '');
  if (i === 0) await shot('b6-loaded');
  if (i < items.length - 1) check(`advance to boat ${i + 2}`, await advance(items[i + 1].instruction));
  if (i < items.length - 1) check(`boat ${i + 2}: fresh empty build`, (await btn('Put it in the water').isDisabled()));
}
await advance(null);
await page.waitForTimeout(2000);
check('finale shows', /Harbor tests done!|like a scientist/.test(await body()));
await full('b9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>/i.test(e));
check('no page errors (beyond the known SVG ellipse/circle warnings)', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, items: items.map(c => ({ goal: c.goal, materials: c.materials })), log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
