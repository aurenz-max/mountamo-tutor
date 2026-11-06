// Drive wave-tank's knock_it_down (the tester's tier): item 1 taps the 3D knobs and the paddle, later items use the
// fallback chips. Each item: the first wave plays and leaves the tower up; a one-step size change is sent and committed
// (a named miss unless one step is enough), Try again keeps the waves; then, like a child, push speed goes up one step
// at a time (size as the first wave) until a wave knocks the tower down, and that is committed; finale.
// Usage: node drive-knock.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
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
let generated = null;
page.on('response', async r => {
  if (r.request().method() === 'POST' && /\/api\/lumina$/.test(r.url())) {
    try { const j = await r.json(); const d = j?.data?.challenges ? j.data : j?.challenges ? j : null; if (d) generated = d; } catch {}
  }
});
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Wave Tank/ }).count()) break;
}
await page.getByRole('button', { name: /Wave Tank/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(8000);
const scene = await page.locator('[data-wave-scene]').first().getAttribute('data-wave-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-wave-scene]').first().scrollIntoViewIfNeeded();
const shot = (name) => page.locator('[data-wave-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
const outcome = () => page.locator('[data-wave-outcome]').first().getAttribute('data-wave-outcome').catch(() => null);
const step = () => page.locator('[data-wave-step]').first().getAttribute('data-wave-step').catch(() => null);
const rows = async () => Math.max(0, (await page.locator('table tr').count()) - 1);
async function tap(target) {
  await page.locator('[data-wave-scene]').first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const pt = await page.evaluate(t => document.querySelector('[data-wave-scene] canvas').__wavePoint?.(t), target);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  return true;
}
async function settle() {
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(500); const s = await step(); if (s !== 'moving' && s !== 'first') break; }
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
check('a wave session', N >= 3, `items=${N} tier=${generated?.supportTier}`);
check('the generated data reached the page', !!generated?.challenges?.length);

for (let i = 0; i < N; i++) {
  const inWorld = i === 0;
  const item = generated.challenges[i];
  const chip = (kind, n) => page.getByRole('button', { name: `${kind === 'size' ? 'Size' : 'Speed'} ${n}`, exact: true });
  const setKnob = async (kind, n) => {
    if ((await chip(kind, n).getAttribute('aria-pressed')) === 'true') return;
    if (inWorld && await tap(`${kind}:${n}`)) {
      await page.waitForTimeout(400);
      const ok = (await chip(kind, n).getAttribute('aria-pressed')) === 'true';
      check(`3D tap sets ${kind} ${n}`, ok);
      if (ok) return;
    }
    await chip(kind, n).click();
    await page.waitForTimeout(300);
  };
  const send = async () => { if (!(inWorld && await tap('paddle'))) await page.getByRole('button', { name: 'Send a wave' }).click(); return settle(); };
  if (inWorld) { await page.waitForTimeout(2500); await shot('wave1-first-wave'); }
  const first = await settle();
  check(`item ${i + 1}: the first wave leaves the tower up`, first === 'stood', `outcome=${first}`);
  check(`item ${i + 1}: notebook starts with the first wave`, (await rows()) === 1, `rows=${await rows()}`);

  let sent = 0;
  if (i === 0) {
    // One step bigger, committed: right only when one step is enough (easy), else a named miss.
    await setKnob('size', item.start.size + 1 <= item.sizeCap ? item.start.size + 1 : item.start.size);
    if (item.start.size + 1 > item.sizeCap) await setKnob('size', item.start.size - 1);
    check('a 3D knob tap asks for the guess', (await step()) === 'go', `step=${await step()}`);
    await tap('paddle');
    await page.waitForTimeout(1500); await shot('wave1-mid-small');
    await page.waitForTimeout(1300); await shot('wave1-arrives-small');
    const o = await settle(); sent++;
    check('the wave ends and the notebook gets a row', !!o && (await rows()) === 2, `outcome=${o} rows=${await rows()}`);
    await page.getByRole('button', { name: "I'm done!" }).click();
    await page.waitForTimeout(1200);
    const t = await body();
    fs.writeFileSync(`${OUT}/after-first-commit.txt`, t);
    if (o === 'fell') {
      check('one step was enough here (easy) and is credited', /Down it goes/.test(t) || (await counter()) === 2);
      if (i < N - 1) check('moves to item 2', await nextItem(2));
      continue;
    }
    check('a change that leaves the tower up is answered with why', /stayed up|less energy/.test(t), '');
    for (let k = 0; k < 10 && !(await page.getByRole('button', { name: /Try again/i }).count()); k++) await page.waitForTimeout(1000);
    const again = page.getByRole('button', { name: /Try again/i });
    if (await again.count()) { await again.first().click(); await page.waitForTimeout(1200); }
    check('Try again keeps the waves', (await rows()) === 2, `rows=${await rows()}`);
    // Both changed: not a fair test.
    await setKnob('size', item.start.size === 1 ? 2 : 1);
    await setKnob('speed', item.start.speed + 1);
    await page.getByRole('button', { name: "I'm done!" }).click();
    await page.waitForTimeout(1200);
    check('both settings changed is answered as not fair', /changed both/.test(await body()));
    const again2 = page.getByRole('button', { name: /Try again/i });
    for (let k = 0; k < 10 && !(await again2.count()); k++) await page.waitForTimeout(1000);
    if (await again2.count()) { await again2.first().click(); await page.waitForTimeout(1200); }
  }
  // Size back to the first wave's; push speed up a step at a time until the tower falls.
  await setKnob('size', item.start.size);
  let fell = false;
  for (let s = item.start.speed + 1; s <= 5 && !fell; s++) {
    await setKnob('speed', s);
    if (inWorld) { await tap('paddle'); await page.waitForTimeout(1500); await shot(`wave1-mid-speed${s}`); fell = (await settle()) === 'fell'; }
    else fell = (await send()) === 'fell';
    sent++;
    if (inWorld && fell) await shot('wave1-tower-falls');
  }
  check(`item ${i + 1}: a faster push knocks the tower down`, fell);
  check(`item ${i + 1}: notebook has a row per wave`, (await rows()) === 1 + sent, `rows=${await rows()} sent=${sent}`);
  await page.getByRole('button', { name: "I'm done!" }).click();
  await page.waitForTimeout(1500);
  const t = await body();
  check(`item ${i + 1}: one change that works is credited`, /Down it goes|Waves done!/.test(t) || (await counter()) === i + 2);
  if (i < N - 1) check(`moves to item ${i + 2}`, await nextItem(i + 2));
}
await page.waitForTimeout(3000);
check('finale', /Waves done!/.test(await body()));
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|Extra attributes|400 \(Bad Request\)/i.test(e));
check('no page errors', real.length === 0, real.slice(0, 4).join(' | '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors, generated }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
