// Drive circuit-workbench's light_it in the Physics tester (offline workspace): guess -> battery in -> the start wires
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
await page.waitForTimeout(9000);
const scene = await page.locator('[data-circuit-scene]').first().getAttribute('data-circuit-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); console.log('ERRORS', errors.slice(0, 6)); await browser.close(); process.exit(1); }
await page.locator('[data-circuit-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-circuit-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const litNow = () => page.locator('[data-circuit-lit]').first().getAttribute('data-circuit-lit').catch(() => null);
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
const removeAll = async () => {
  for (let k = 0; k < 6; k++) {
    const r = page.getByRole('button', { name: /^Remove the wire/ });
    if (!(await r.count())) return;
    await r.first().click(); await page.waitForTimeout(200);
  }
};
const chip = (words) => btn(`Clip: ${words}`);
// Tap a post on the 3D canvas through the scene's drive hook.
async function tap3d(clip) {
  const canvas = page.locator('[data-circuit-scene] canvas').first();
  const pt = await canvas.evaluate((el, c) => el.__circuitPoint?.(`clip:${c}`), clip);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(300);
  return true;
}

for (let i = 0; i < 5; i++) {
  const instr = await page.locator('[data-circuit-step]').first().locator('xpath=..').innerText();
  const two = /but not the/.test(instr);
  const target = two ? (instr.match(/Make the (red|blue) bulb/) || [])[1] : 'red';
  const name = two ? `the ${target} bulb` : 'the bulb';
  check(`light ${i + 1}: goal stated, no wiring before the guess`, /light up/.test(instr) && !(await chip("the battery's + end").count()), instr.split('\n')[0]);
  if (i === 0) await shot('c1-table-before');
  await btn(i % 2 ? 'Guess it will light' : 'Guess it will stay off').click();
  await page.waitForTimeout(800);
  const startLit = await litNow();
  check(`light ${i + 1}: the start lights nothing`, startLit === 'none' || startLit === 'short' || (two && !startLit.includes(target)), `lit=${startLit}`);
  if (i === 0) {
    await btn("I'm done!").click();
    await page.waitForTimeout(1000);
    check('a not-lit circuit is a named miss', /The bulb is not lit|same end|battery gets warm/.test(await body()));
    await full('c2-miss');
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(1000);
    check('Try again keeps the wires', (await page.getByRole('button', { name: /^Remove the wire/ }).count()) > 0);
  }
  await removeAll();
  // The first wire through the 3D posts on item 1; chips otherwise.
  if (i === 0) {
    const ok = (await tap3d('bat+')) && (await tap3d(`${target}.left`));
    check('a wire tapped on the 3D posts', ok && (await page.locator('[data-circuit-wire]').count()) === 1);
  } else { await chip("the battery's + end").click(); await chip(`${name}'s left clip`).click(); }
  if (!(await page.locator('[data-circuit-wire]').count())) { await chip("the battery's + end").click(); await chip(`${name}'s left clip`).click(); }
  await chip(`${name}'s right clip`).click(); await chip("the battery's − end").click();
  await page.waitForTimeout(1500);
  check(`light ${i + 1}: ${name} lights`, await litNow() === target, `lit=${await litNow()}`);
  if (i === 0 || two) await shot(`c3-lit-${i + 1}`);
  await btn("I'm done!").click();
  await page.waitForTimeout(1500);
  check(`light ${i + 1}: credited`, /closed loop/.test(await body()) || (i === 4 && /Workbench done!/.test(await body())));
  if (i < 4) check(`advance to light ${i + 2}`, await nextItem(i + 2));
}
for (let k = 0; k < 6 && !/Workbench done!/.test(await body()); k++) {
  const next = page.getByRole('button', { name: /^(Next|Continue)/i });
  if (await next.count()) await next.first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
check('finale shows', /Workbench done!|electrician/.test(await body()));
await full('c9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors (beyond known dev warnings and the offline observer 400s)', real.length === 0, real.slice(0, 4).join(' | '));
console.log('BAD RESPONSES', bad);
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, bad, log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
