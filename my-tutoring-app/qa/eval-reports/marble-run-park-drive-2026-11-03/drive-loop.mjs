// Drive marble-run-park's make_the_loop (the tester's tier): item 1 taps the 3D pegs and the marble, later items use the
// fallback chips; each item runs the marble from low pegs upward until it makes the loop (as a child would), the
// notebook fills, a failing peg is a named miss, Try again keeps the runs, the lowest working peg passes; finale.
// Usage: node drive-loop.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
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
const scene = await page.locator('[data-marble-scene]').first().getAttribute('data-marble-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-marble-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-marble-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
const outcome = () => page.locator('[data-marble-outcome]').first().getAttribute('data-marble-outcome').catch(() => null);
const step = () => page.locator('[data-marble-step]').first().getAttribute('data-marble-step').catch(() => null);
const rows = async () => Math.max(0, (await page.locator('table tr').count()) - 1);
async function tap(target) {
  // A feedback card can scroll the page; bring the whole park back into view first.
  await page.locator('[data-marble-scene]').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const pt = await page.evaluate(t => document.querySelector('[data-marble-scene] canvas').__marblePoint?.(t), target);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  return true;
}
async function waitRun() {
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(500); if (await step() !== 'rolling') break; }
  return outcome();
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
check('a marble session', N >= 3, `items=${N}`);
const instruction = (await body()).match(/(Pick a peg|Find the lowest|There is a strip)[^\n]*/)?.[0] ?? '';
const lowest = !/^Pick a peg/.test(instruction);
check('the item says its goal', !!instruction, instruction.slice(0, 60));

for (let i = 0; i < N; i++) {
  const inWorld = i === 0;
  const chip = (k) => page.getByRole('button', { name: `Peg ${k + 1}`, exact: true });
  const putOn = async (k) => {
    if (inWorld && await tap(`peg:${k}`)) {
      await page.waitForTimeout(400);
      const ok = (await chip(k).getAttribute('aria-pressed')) === 'true';
      check(`3D tap selects peg ${k + 1}`, ok);
      if (!ok) {
        const pt = await page.evaluate(t => document.querySelector('[data-marble-scene] canvas').__marblePoint?.(t), `peg:${k}`);
        const info = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return `${el?.tagName} ${el?.className?.toString().slice(0, 80)}`; }, [pt.x, pt.y]);
        console.log('tap miss at', JSON.stringify(pt), info);
        await page.screenshot({ path: `${OUT}/tap-miss-${k + 1}.png` });
      }
      if (ok) return;
    }
    await chip(k).click();
    await page.waitForTimeout(500);
  };
  const letGo = async () => { if (!(inWorld && await tap('marble'))) await page.getByRole('button', { name: 'Let it go' }).click(); };
  // Run from peg 1 upward until it makes the loop.
  let first = -1, failing = -1;
  for (let k = 0; k < 8; k++) {
    await putOn(k);
    if (inWorld && k === 0) check('a 3D tap on a peg puts the marble there', (await step()) === 'go', `step=${await step()}`);
    await letGo();
    if (inWorld && k === 0) { await page.waitForTimeout(700); await shot('loop1-rolling'); }
    const o = await waitRun();
    if (inWorld && k === 0) check('a 3D tap on the marble lets it go; it ends somewhere', !!o, `outcome=${o}`);
    if (o === 'made_it') { first = k; if (inWorld) await shot('loop1-made-it'); break; }
    failing = k;
    if (inWorld && o === 'fell') await shot('loop1-fell');
  }
  check(`loop ${i + 1}: a peg made the loop`, first > 0, `first=${first + 1}`);
  check(`loop ${i + 1}: the notebook has a row per run`, (await rows()) === first + 1, `rows=${await rows()}`);
  if (i === 0) {
    // A failing peg first: a named miss, then Try again keeps the runs.
    await putOn(failing);
    await page.getByRole('button', { name: "I'm done!" }).click();
    await page.waitForTimeout(1200);
    const t = await body();
    check('a failing peg is answered with why', /top of the loop/.test(t), '');
    fs.writeFileSync(`${OUT}/after-miss.txt`, t);
    for (let k = 0; k < 10 && !(await page.getByRole('button', { name: /Try again/i }).count()); k++) await page.waitForTimeout(1000);
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) { await tryAgain.first().click(); await page.waitForTimeout(1200); }
    check('Try again keeps the runs', (await rows()) === first + 1, `rows=${await rows()}`);
    if (lowest && first + 1 < 8) {
      await putOn(first + 1);
      await page.getByRole('button', { name: "I'm done!" }).click();
      await page.waitForTimeout(1200);
      check('a higher working peg is not the lowest', /a lower peg works too/.test(await body()));
      fs.writeFileSync(`${OUT}/after-second.txt`, `${await body()}\nSTEP ${await step()}\nTRYAGAIN ${await page.getByRole('button', { name: /Try again/i }).count()}`);
      const again = page.getByRole('button', { name: /Try again/i });
      if (await again.count()) { await again.first().click(); await page.waitForTimeout(1200); }
    }
  }
  await putOn(first);
  await page.getByRole('button', { name: "I'm done!" }).click();
  await page.waitForTimeout(1500);
  const t = await body();
  check(`loop ${i + 1}: the lowest working peg is credited`, /Yes! That is the lowest peg|Round it goes|Runs done!/.test(t) || (await counter()) === i + 2, '');
  if (i < N - 1) check(`moves to loop ${i + 2}`, await nextItem(i + 2));
}
await page.waitForTimeout(3000);
check('finale', /Runs done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
