// Drive circuit-workbench's electromagnet (Grade 4, the tester's medium tier: exactly N clips on one battery): item 1
// taps the 3D switch, core and clip tray, later items use the panel buttons; switched off it lifts nothing; I'm done!
// with the wrong count is a named miss; Try again keeps the build; changing the wraps to the right count is credited.
// Usage: node drive-electro.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
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
  if (await page.getByRole('button', { name: /Circuit Workbench/ }).count()) break;
}
await page.getByRole('button', { name: /Circuit Workbench/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));

await page.getByRole('button', { name: /^Electromagnet/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(14000);
const scene = await page.locator('[data-circuit-scene]').first().getAttribute('data-circuit-scene').catch(() => null);
await page.waitForSelector('[data-circuit-scene="3d"]', { timeout: 20000 }).catch(() => {});
const scene3d = await page.locator('[data-circuit-scene]').first().getAttribute('data-circuit-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene3d === '3d', `scene=${scene3d}`);
await page.locator('[data-circuit-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-circuit-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
const lifted = async () => Number(await page.locator('[data-circuit-em-result]').first().getAttribute('data-circuit-em-result').catch(() => -1));
const build = async () => { const [core, turns, bats, on] = ((await page.locator('[data-circuit-em-panel]').first().getAttribute('data-circuit-em-build')) || '').split(':'); return { core, turns: Number(turns), bats: Number(bats), on: on === 'on' }; };
async function tap(target) {
  const pt = await page.evaluate(t => document.querySelector('[data-circuit-scene] canvas').__circuitPoint?.(t), target);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  return true;
}
async function nextItem(n) {
  for (let k = 0; k < 15; k++) {
    if (await counter() === n) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return await counter() === n;
}
const N = await total();
check('an electromagnet session', N >= 3, `items=${N}`);
for (let i = 0; i < N; i++) {
  const inWorld = i === 0;
  const act = async (target, button) => { if (!(inWorld && await tap(target))) await page.getByRole('button', { name: button }).click(); await page.waitForTimeout(700); };
  const dip = async () => { await act('em:clips', 'Dip in the clips'); await page.waitForTimeout(900); };
  const goal = Number(((await body()).match(/picks up exactly (\d+) paper clip/) || [])[1] || 0);
  check(`electro ${i + 1}: an exact goal`, goal >= 2 && goal <= 5, `goal=${goal}`);
  const b0 = await build();
  check(`electro ${i + 1}: opens switched off with some wraps`, !b0.on && b0.turns >= 2, JSON.stringify(b0));
  await dip();
  check(`electro ${i + 1}: switched off it lifts nothing${inWorld ? ' (3D tap)' : ''}`, (await lifted()) === 0);
  await act('em:switch', 'Switch on');
  check(`electro ${i + 1}: the switch went on${inWorld ? ' (3D tap)' : ''}`, (await build()).on);
  await dip();
  const n1 = await lifted();
  check(`electro ${i + 1}: switched on it lifts the wraps' clips`, n1 === Math.floor(b0.turns / 2), `lifted=${n1} wraps=${b0.turns}`);
  if (inWorld) await shot('electro1-lifted');
  if (i === 0) {
    await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(1000);
    check('a wrong count is a named miss', /not strong enough yet|too strong/.test(await body()));
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(800);
    check('Try again keeps the build', (await build()).turns === b0.turns);
  }
  // Two wraps per clip on one battery.
  const want = goal * 2;
  for (let k = 0; k < 12 && (await build()).turns !== want; k++) {
    if ((await build()).turns < want) await act('em:coil', 'Add a wrap'); else await page.getByRole('button', { name: 'Take a wrap off' }).click();
    await page.waitForTimeout(250);
  }
  check(`electro ${i + 1}: wraps set${inWorld ? ' (3D taps)' : ''}`, (await build()).turns === want, `turns=${(await build()).turns}`);
  await dip();
  check(`electro ${i + 1}: lifts the goal`, (await lifted()) === goal, `lifted=${await lifted()}`);
  if (inWorld) await shot('electro1-goal');
  await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(1500);
  if (i === 0) await page.screenshot({ path: `${OUT}/electro1-credited.png`, fullPage: true });
  check(`electro ${i + 1}: credited`, /Electricity flowing round the wire makes the steel a magnet/.test(await body()) || (i === N - 1 && /Workbench done!/.test(await body())));
  if (i < N - 1) check(`advance to electro ${i + 2}`, await nextItem(i + 2));
}
for (let k = 0; k < 6 && !/Workbench done!/.test(await body()); k++) {
  const next = page.getByRole('button', { name: /^(Next|Continue)/i });
  if (await next.count()) await next.first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
check('finale shows', /Workbench done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors: real }, null, 2));
await browser.close();
