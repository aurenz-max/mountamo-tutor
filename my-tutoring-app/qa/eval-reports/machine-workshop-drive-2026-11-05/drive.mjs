// Drive machine-workshop's spin_to_push in the Engineering tester (its default tier, medium at grade 4): the real
// author agent writes 3 machines; item 1 is built by 3D taps on the tray and the fitted part, then run through a wrong
// pair, a too-far crank and a jamming rod before the working build; items 2-3 use the chips (a cam build, a crank
// build); the principle shows on the last machine; finale. Usage: node drive.mjs <outDir>  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
let generated = null;
page.on('response', async r => {
  if (r.request().method() === 'POST' && /\/api\/lumina/.test(r.url())) {
    try { const j = await r.json(); const d = j?.data ?? j; if (d?.challenges?.[0]?.tray) generated = d; } catch { /* not json */ }
  }
});
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Engineering', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: 'Generate Content' }).count()) break;
}
await page.getByRole('button', { name: /Machine Workshop/ }).first().click();
await page.locator('label:has-text("Grade Level") + select').selectOption({ label: 'Grade 4' }).catch(e => console.log('grade select:', String(e).slice(0, 120)));
await page.getByRole('button', { name: 'Generate Content' }).click();
for (let k = 0; k < 60 && !(await page.locator('[data-machine-scene]').count()); k++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);
const scene = await page.locator('[data-machine-scene]').first().getAttribute('data-machine-scene').catch(() => null);
check('2D bench mounted', scene === '2d', `scene=${scene}`);
if (generated) fs.writeFileSync(`${OUT}/generated.json`, JSON.stringify(generated, null, 1));
check('authored by the agent', !!generated?.authoring, JSON.stringify(generated?.authoring?.sources ?? null));

const shot = (name) => page.locator('[data-machine-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
const outcome = () => page.locator('[data-machine-outcome]').first().getAttribute('data-machine-outcome').catch(() => null);
const step = () => page.locator('[data-machine-step]').first().getAttribute('data-machine-step').catch(() => null);
const rows = async () => Math.max(0, (await page.locator('table').filter({ hasText: /what happened/i }).locator('tr').count()) - 1);
const shaftChip = (label) => page.getByRole('button', { name: `Shaft part: ${label}`, exact: true });
const sliderChip = (label) => page.getByRole('button', { name: `Slider part: ${label}`, exact: true });
const pressed = async (loc) => (await loc.getAttribute('aria-pressed')) === 'true';
async function tap(target) {
  await page.locator('[data-machine-scene]').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const pt = await page.evaluate(t => document.querySelector('[data-machine-scene] canvas').__machinePoint?.(t), target);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(400);
  return true;
}
// Fit a part by chip, unless it is already fitted.
async function fit(shaft, slider) {
  if (!(await pressed(shaftChip(shaft)))) await shaftChip(shaft).click();
  if (!(await pressed(sliderChip(slider)))) await sliderChip(slider).click();
  await page.waitForTimeout(300);
}
async function run(snap) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  if (snap) { await page.waitForTimeout(1500); globalThis.lastTrail = await page.locator('[data-machine-trail]').count(); await shot(snap); }
  for (let k = 0; k < 20; k++) { await page.waitForTimeout(500); if (await step() !== 'running') break; }
  return outcome();
}
async function done() { await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(1500); return body(); }
async function tryAgain() {
  for (let k = 0; k < 10 && !(await page.getByRole('button', { name: /Try again/i }).count()); k++) await page.waitForTimeout(1000);
  const b = page.getByRole('button', { name: /Try again/i });
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(1200); }
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
check('a 3-machine session', N === 3, `items=${N}`);
const tier = generated?.supportTier ?? 'easy';
check('tester tier defaults to easy (only the pairing matters)', tier === 'easy', tier);
const easy = tier === 'easy';
const CRANK = easy ? 'crank disc' : 'medium crank disc';
const ROD = easy ? 'connecting rod' : 'long connecting rod';
// Room for the primitive: the side panels fold once generated.
const width = await page.locator('[data-machine-scene]').first().evaluate(el => el.getBoundingClientRect().width);
check('the bench gets most of a laptop-width page', width > 0.7 * 1280, `bench=${Math.round(width)}px of 1280`);
check('controls folded to a rail', (await page.getByRole('button', { name: 'Show controls' }).count()) === 1);
check('the part guide is open on the first machine', /a wheel with a peg near its edge/.test(await body()));
await page.screenshot({ path: `${OUT}/page-laptop.png` });
const leak = /\b(crank|cam|connecting|follower)\b/i;
const promptText = await page.locator('[data-machine-step]').first().evaluate(el => el.parentElement?.innerText ?? '');
check('the prompt does not name the parts to build', !leak.test(promptText.replace(/Tap a part[^\n]*/, '')), promptText.slice(0, 160).replace(/\n/g, ' | '));
await shot('item1-empty');

// ── Item 1: fit and remove on the 2D bench, then named failures, then the working build ──
check('the bench shows the goal: wheel spins, working end must go up and down', (await page.locator('[data-machine-goal]').count()) === 1);
await shaftChip('cam').click(); await page.waitForTimeout(300);
check('a picture button fits a part on the wheel', await pressed(shaftChip('cam')));
await page.locator('[data-machine-target="placed:driver"]').first().click(); await page.waitForTimeout(300);
check('tapping the fitted part on the bench takes it off', !(await pressed(shaftChip('cam'))));
await fit('cam', ROD);
let o = await run();
check('cam + rod: nothing moves (no pin)', o === 'no_pin', `outcome=${o}`);
check('the run explains why, before any check', (await page.locator('[data-machine-why]').count()) === 1
  && /that wheel has no peg/.test(await body()));
await shot('item1-no-peg');
let t = await done();
check('wrong pair is answered with why', /that wheel has no peg/.test(t));
await tryAgain();
check('Try again keeps the notebook', (await rows()) === 1, `rows=${await rows()}`);
let runsSoFar = 1;
if (easy) {
  await fit('gear', 'rack');
  o = await run('item1-ran-out');
  check('gear + rack: pushes one way and runs out', o === 'ran_out', `outcome=${o}`);
  runsSoFar++;
} else {
  await fit('large crank disc', ROD);
  o = await run('item1-too-far');
  check('large crank: goes too far and bangs the end', o === 'hits_end', `outcome=${o}`);
  await fit(CRANK, 'short connecting rod');
  o = await run('item1-jam');
  check('short rod on the medium crank jams', o === 'jams', `outcome=${o}`);
  runsSoFar += 2;
}
await fit(CRANK, ROD);
o = await run('item1-works');

check('crank + rod works', o === 'works', `outcome=${o}`);
check('while it runs, the peg circle and slider line are traced', globalThis.lastTrail === 1);
check('notebook has a row per run', (await rows()) === runsSoFar + 1, `rows=${await rows()}`);
t = await done();
check('item 1 credited with the principle', /uses a (crank|cam)/.test(t), (t.match(/Your [^\n]*/)?.[0] ?? '').slice(0, 220));
fs.writeFileSync(`${OUT}/after-item1.txt`, t);
check('moves to machine 2', await nextItem(2));

// ── Item 2: the cam build ──
await page.waitForTimeout(800);
await fit('cam', 'follower');
o = await run('item2-cam');
check('machine 2: cam + follower works', o === 'works', `outcome=${o}`);
t = await done();
check('machine 2 credited', /uses a (crank|cam)/.test(t));
check('moves to machine 3', await nextItem(3));

// ── Item 3: the crank build; the principle stays on screen after the last machine ──
await page.waitForTimeout(800);
await fit(CRANK, ROD);
o = await run();
check('machine 3: crank + rod works', o === 'works', `outcome=${o}`);
t = await done();
await page.waitForTimeout(2500);
t = await body();
check('finale', /Machines built!/.test(t));
check('the last machine\'s principle is still shown', /uses a (crank|cam)/.test(t));
await page.locator('[data-machine-scene]').first().evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});
await shot('item3-solved');
fs.writeFileSync(`${OUT}/finale.txt`, t);
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
