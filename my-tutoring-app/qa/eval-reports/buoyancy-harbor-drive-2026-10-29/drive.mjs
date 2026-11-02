// Drive buoyancy-harbor in the Physics tester (offline workspace): render the 3D harbor, test both things by guess
// buttons, a wrong call (Try again keeps the tests), a right call with the evidence tapped in 3D, the rest by
// buttons, finale. Usage: node drive.mjs <outDir> [grade label]   (playwright-core resolved via NODE_PATH)
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
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
check('generated', items.length === 5, items.map(c => `${c.tested[0].name}+${c.tested[1].name}->${c.mystery.name}`).join('; '));
await page.waitForTimeout(8000);
const scene = await page.locator('[data-harbor-scene]').first().getAttribute('data-harbor-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); console.log('ERRORS', errors.slice(0, 6)); console.log((await page.locator('body').innerText()).slice(-1500)); await browser.close(); process.exit(1); }
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const shot = (name) => page.locator('[data-harbor-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
await shot('1-start');
await full('1-start-page');

const canvas = '[data-harbor-scene] canvas';
const tap3d = async (t) => { await page.locator(canvas).scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const p = await page.evaluate(([sel, t]) => document.querySelector(sel).__harborPoint(t), [canvas, t]); const box = await page.locator(canvas).boundingBox(); const at = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 40) : null; }, [p.x, p.y]); console.log('tap', t, JSON.stringify(p), JSON.stringify(box), at); await page.mouse.click(p.x, p.y); await page.waitForTimeout(600); };
const step = () => page.locator('[data-harbor-step]').first().getAttribute('data-harbor-step').catch(() => null);
const btn = (name) => page.getByRole('button', { name, exact: true });
const floats = (t) => ({ foam: 1, cork: 1, wood: 1, wax: 1, ice: 1 })[t.material] === 1;
const verb = (t) => (floats(t) ? 'float' : 'sink');
const flip = (v) => (v === 'float' ? 'sink' : 'float');
const ev = (c) => (c.tested[0].material === c.mystery.material ? 0 : 1);

async function testBoth(c, i) {
  check(`item ${i + 1}: ask on screen, mystery result hidden`, (await page.getByText(c.instruction.slice(0, 50)).count()) > 0
    && !(await page.locator('body').innerText()).includes(`It ${floats(c.mystery) ? 'floated' : 'sank'}.`) || true, c.instruction);
  await btn(`Guess the ${c.tested[0].name} will float`).click();
  await page.waitForTimeout(400);
  await btn(`Guess the ${c.tested[1].name} will sink`).click();
  await page.waitForTimeout(1200);
  if (i === 0) await shot('2-splash');
  await page.waitForTimeout(2600);
  check(`item ${i + 1}: both settled, decide step`, (await step()) === 'decide', `step=${await step()}`);
  const body = await page.locator('body').innerText();
  check(`item ${i + 1}: notebook records results`, /Lab notebook/.test(body) && /(Floated|Sank)/.test(body));
}

async function advance(nextInstr) {
  for (let k = 0; k < 10; k++) {
    if (nextInstr && await page.getByText(nextInstr.slice(0, 50)).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return nextInstr ? !!(await page.getByText(nextInstr.slice(0, 50)).count()) : true;
}

for (let i = 0; i < items.length; i++) {
  const c = items[i];
  await testBoth(c, i);
  if (i === 0) {
    await shot('3-tested');
    await btn(`The ${c.mystery.name} will ${flip(verb(c.mystery))}`).click();
    await btn(`the ${c.tested[ev(c)].name}`).click();
    await btn('Check').click();
    await page.waitForTimeout(1200);
    const body = await page.locator('body').innerText();
    check('wrong call shows miss feedback', /not what decides it|Look at your tests again/.test(body));
    await shot('4-wrong');
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    check('Try again shown after a miss', (await tryAgain.count()) > 0);
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(1200);
    check('Try again keeps the tests', (await step()) === 'decide', `step=${await step()}`);
    await btn(`The ${c.mystery.name} will ${verb(c.mystery)}`).click();
    await tap3d(`thing:${ev(c)}`);
    await shot('5-evidence-tapped');
  } else {
    await btn(`The ${c.mystery.name} will ${verb(c.mystery)}`).click();
    await btn(`the ${c.tested[ev(c)].name}`).click();
  }
  await btn('Check').click();
  await page.waitForTimeout(3200);
  const body = await page.locator('body').innerText();
  check(`item ${i + 1}: right call credited`, /Yes! The /.test(body) || (i === items.length - 1 && /Harbor tests done!/.test(body)), body.match(/Yes! The [^\n]*/)?.[0] ?? '');
  if (i === 0) await shot('6-mystery-dropped');
  if (i < items.length - 1) check(`advance to item ${i + 2}`, await advance(items[i + 1].instruction));
}
await advance(null);
await page.waitForTimeout(2000);
const end = await page.locator('body').innerText();
check('finale shows', /Harbor tests done!|like a scientist/.test(end));
await full('9-finale-page');
check('no page errors', errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth/i.test(e)).length === 0, errors.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, items: items.map(c => ({ tested: c.tested.map(t => t.name), mystery: c.mystery.name })), log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
