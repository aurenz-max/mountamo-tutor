// Drive circuit-workbench's magnet_poles (Grade 3, the tester's medium tier): item 1 taps the 3D magnets (the left one
// slides them together, the right one turns), later items use the fallback buttons; no calls until both ways are
// tested; a same-ends pair called a pull is a named miss; Try again keeps the tests; right calls are credited; finale.
// Usage: node drive-poles.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
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


await page.getByRole('button', { name: /Magnet Poles/ }).first().click();
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await page.waitForTimeout(14000);
const scene = await page.locator('[data-circuit-scene]').first().getAttribute('data-circuit-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-circuit-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-circuit-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const body = () => page.locator('body').innerText();
const counter = async () => Number(((await body()).match(/Challenge (\d+) of/) || [])[1] || 0);
const total = async () => Number(((await body()).match(/Challenge \d+ of (\d+)/) || [])[1] || 0);
const facing = () => page.locator('[data-circuit-pole-panel]').first().getAttribute('data-circuit-pole-facing');
const result = () => page.locator('[data-circuit-pole-result]').first().getAttribute('data-circuit-pole-result').catch(() => null);
async function tapMagnet(target) {
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
check('a poles session', N >= 3, `items=${N}`);
// "A ring magnet's N side facing a bar magnet's N end" -> same ends push.
const answerOf = (pair) => { const [a, b] = [...pair.matchAll(/'s ([NS]) (?:end|side)/g)].map(m => m[1]); return a === b ? 'push apart' : 'pull together'; };
for (let i = 0; i < N; i++) {
  const inWorld = i === 0;
  const slide = async () => { if (!(inWorld && await tapMagnet('mag:a'))) await page.getByRole('button', { name: 'Slide them together' }).click(); await page.waitForTimeout(1600); };
  const turn = async () => { if (!(inWorld && await tapMagnet('mag:b'))) await page.getByRole('button', { name: 'Turn the right magnet' }).click(); await page.waitForTimeout(1200); };
  const f0 = await facing();
  await slide();
  const r1 = await result();
  check(`poles ${i + 1}: first test shows a result${inWorld ? ' (3D tap)' : ''}`, r1 === 'push' || r1 === 'pull', `facing=${f0} result=${r1}`);
  check(`poles ${i + 1}: no calls after one test`, (await page.locator('[data-circuit-pole-calls]').count()) === 0);
  if (inWorld) await shot('poles1-first-test');
  await turn();
  check(`poles ${i + 1}: the right magnet turned${inWorld ? ' (3D tap)' : ''}`, (await facing()) !== f0, `facing=${await facing()}`);
  await slide();
  const r2 = await result();
  check(`poles ${i + 1}: second test is the other result`, r2 && r2 !== r1, `result=${r2}`);
  if (inWorld) await shot('poles1-second-test');
  const calls = page.locator('[data-circuit-pole-calls]');
  check(`poles ${i + 1}: calls open after both ways`, (await calls.count()) === 1);
  const pairs = (await calls.innerText()).split('\n').filter(l => /facing/.test(l)).map(l => l.trim());
  check(`poles ${i + 1}: pairs to call`, pairs.length >= 1, pairs.join(' | '));
  if (i === 0) {
    for (const p of pairs) await page.getByRole('button', { name: `${p}: pull together`, exact: true }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click(); await page.waitForTimeout(1000);
    check('a wrong call is a named miss', /same ends faced|different ends faced/.test(await body()));
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(800);
    check('Try again keeps the tests', (await page.locator('[data-circuit-pole-calls]').count()) === 1);
  }
  for (const p of pairs) await page.getByRole('button', { name: `${p}: ${answerOf(p)}`, exact: true }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click(); await page.waitForTimeout(1500);
  if (i === 0) await page.screenshot({ path: `${OUT}/poles1-credited.png`, fullPage: true });
  check(`poles ${i + 1}: credited`, /Different ends pull together/.test(await body()) || (i === N - 1 && /Workbench done!/.test(await body())));
  if (i < N - 1) check(`advance to poles ${i + 2}`, await nextItem(i + 2));
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
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors: real, bad }, null, 2));
await browser.close();
