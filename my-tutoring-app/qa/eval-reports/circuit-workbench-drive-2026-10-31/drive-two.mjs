// Drive circuit-workbench's two_bulbs (Grade 4 by default, any tier) in the Physics tester (offline workspace): guess -> battery in -> the start wires
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


await page.getByRole('button', { name: /Two Bulbs/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(14000);
const scene = await page.locator('[data-circuit-scene]').first().getAttribute('data-circuit-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-circuit-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-circuit-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
const litNow = () => page.locator('[data-circuit-lit]').first().getAttribute('data-circuit-lit').catch(() => null);
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
const N = await total();
check('a switch session', N >= 3, `items=${N}`);
const chip = (w) => btn(`Clip: ${w}`);
const removeAll = async () => { for (let k = 0; k < 6; k++) { const r = page.getByRole('button', { name: /^Remove the wire/ }); if (!(await r.count())) return; await r.first().click(); await page.waitForTimeout(150); } };
for (let i = 0; i < N; i++) {
  const instr = await page.locator('[data-circuit-step]').first().locator('xpath=..').innerText();
  const want = /in a row/.test(instr) ? 'row' : 'side';
  check(`two ${i + 1}: guess first`, (await btn('Guess it will light').count()) > 0);
  await btn('Guess it will stay off').click(); await page.waitForTimeout(600);
  if (i === 0) {
    await btn("I'm done!").click(); await page.waitForTimeout(1000);
    check('the start wiring is a named miss', /Not both bulbs|in a row|own path|skip the bulbs/.test(await body()));
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(800);
  }
  await removeAll();
  const pairs = want === 'row'
    ? [["the battery's + end", "the red bulb's left clip"], ["the red bulb's right clip", "the blue bulb's left clip"], ["the blue bulb's right clip", "the battery's − end"]]
    : [["the battery's + end", "the red bulb's left clip"], ["the battery's + end", "the blue bulb's left clip"], ["the red bulb's right clip", "the battery's − end"], ["the blue bulb's right clip", "the battery's − end"]];
  for (const [a, b2] of pairs) { await chip(a).click(); await chip(b2).click(); }
  await page.waitForTimeout(1500);
  const both = await litNow();
  if (i < 2) await shot(`t-${want}-${i + 1}`);
  await btn('Take out the red bulb').click(); await page.waitForTimeout(800);
  const afterOut = await litNow();
  await btn('Put the red bulb back').click(); await page.waitForTimeout(400);
  check(`two ${i + 1}: ${want}: both lit, then red out -> ${want === 'row' ? 'none' : 'blue'}`, both === 'red,blue' && afterOut === (want === 'row' ? 'none' : 'blue'), `both=${both} out=${afterOut}`);
  await btn("I'm done!").click(); await page.waitForTimeout(1500);
  check(`two ${i + 1}: credited`, /In a row!|Side by side!/.test(await body()) || (i === N - 1 && /Workbench done!/.test(await body())));
  if (i < N - 1) check(`advance to two ${i + 2}`, await nextItem(i + 2));
}
for (let k = 0; k < 6 && !/Workbench done!/.test(await body()); k++) {
  const next = page.getByRole('button', { name: /^(Next|Continue)/i });
  if (await next.count()) await next.first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
check('finale shows', /Workbench done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors (beyond known dev warnings and the offline observer 400s)', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, bad, log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
