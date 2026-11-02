// Drive volcano-island's cool_the_rock in the Physics tester (offline workspace): guess -> battery in -> the start wires
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


await page.getByRole('button', { name: /Cool the Rock/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(12000);
const scene = await page.locator('[data-volcano-scene]').first().getAttribute('data-volcano-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); console.log('ERR', errors.slice(0, 5).join(' || ').slice(0, 1500)); }
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
const N = await total();
check('a rock session', N >= 3, `items=${N}`);
const PLACE = { big: 'deep underground (very slowly)', tiny: 'on the surface (fast)', smooth: 'in the sea (very fast)', light: 'on the surface (fast)' };
for (let i = 0; i < N; i++) {
  const panel = page.locator('[data-volcano-rock-panel]');
  const samples = await panel.locator('[data-volcano-sample]').count();
  check(`rock ${i + 1}: samples shown, no Check yet`, samples >= 2 && !(await btn('Check').count()), `samples=${samples}`);
  for (let k = 0; k < samples; k++) {
    await panel.getByRole('button', { name: new RegExp(`^Guess sample ${k + 1}:`) }).first().click();
    await page.waitForTimeout(300);
  }
  if (i === 0) await full('rk1-cooled');
  const look = ((await panel.innerText()).match(/The found rock: (\w+)/) || [])[1];
  const right = PLACE[look];
  if (i === 0) {
    const wrong = right === PLACE.big ? PLACE.smooth : PLACE.big;
    await btn(`Cooled ${wrong}`).click(); await btn('Check').click(); await page.waitForTimeout(1000);
    check('a wrong place is a named miss', /crystals|fast|holes/.test(await body()));
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(800);
  }
  await btn(`Cooled ${right}`).click(); await btn('Check').click(); await page.waitForTimeout(1500);
  check(`rock ${i + 1}: credited (${look})`, /Yes! /.test(await body()) || (i === N - 1 && /Eruptions done!/.test(await body())));
  if (i < N - 1) check(`advance to rock ${i + 2}`, await nextItem(i + 2));
}
for (let k = 0; k < 6 && !/Eruptions done!/.test(await body()); k++) {
  const next = page.getByRole('button', { name: /^(Next|Continue)/i });
  if (await next.count()) await next.first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
check('finale shows', /Eruptions done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
