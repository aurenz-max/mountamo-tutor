// Drive circuit-workbench's magnet_distance (Grade 3, the tester's medium tier: one magnet, then calls on another):
// item 1 taps the 3D ruler marks and magnet, later items use the fallback chips; no question until a pull and a miss are
// seen; a call against closer-is-stronger is a named miss; Try again keeps the tests; right calls are credited; finale.
// Usage: node drive-distance.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 3';
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

await page.getByRole('button', { name: /Magnet Distance/ }).first().click();
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
const result = () => page.locator('[data-circuit-dist-result]').first().getAttribute('data-circuit-dist-result').catch(() => null);
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
check('a distance session', N >= 3, `items=${N}`);
// "Another magnet pulled a ball on mark 4. Would it pull a ball on mark 2?" -> Yes; "did not pull ..." -> No.
const answerOf = (call) => (/did not pull/.test(call) ? 'No' : 'Yes');
const flip = (a) => (a === 'Yes' ? 'No' : 'Yes');
for (let i = 0; i < N; i++) {
  const inWorld = i === 0;
  const tryIt = async () => { if (!(inWorld && await tap('mag:a'))) await page.getByRole('button', { name: 'Try the magnet' }).click(); await page.waitForTimeout(1500); };
  const place = async (k) => { if (!(inWorld && await tap(`mark:0:${k}`))) await page.getByRole('button', { name: `Put the ball on mark ${k}` }).click(); await page.waitForTimeout(900); };
  await tryIt();
  const r1 = await result();
  check(`distance ${i + 1}: first try shows a result${inWorld ? ' (3D tap)' : ''}`, r1 === 'pulled' || r1 === 'stayed', `result=${r1}`);
  check(`distance ${i + 1}: no question after one try`, (await page.locator('[data-circuit-dist-decide]').count()) === 0);
  if (inWorld) await shot('distance1-first-try');
  // Mark 1 always pulls, the far end never does: go the other way.
  await place(r1 === 'pulled' ? 6 : 1);
  await tryIt();
  const r2 = await result();
  check(`distance ${i + 1}: second try is the other result${inWorld ? ' (3D tap)' : ''}`, r2 && r2 !== r1, `result=${r2}`);
  if (inWorld) await shot('distance1-second-try');
  const decide = page.locator('[data-circuit-dist-decide]');
  check(`distance ${i + 1}: question opens after a pull and a miss`, (await decide.count()) === 1);
  const calls = (await decide.innerText()).split('\n').filter(l => /^Another magnet/.test(l.trim())).map(l => l.trim());
  check(`distance ${i + 1}: calls on another magnet`, calls.length >= 1, calls.join(' | '));
  const rows = await body();
  check(`distance ${i + 1}: lab notebook has both tries`, /Rolled to the magnet/.test(rows) && /Stayed put/.test(rows));
  if (i === 0) {
    for (const c of calls) await page.getByRole('button', { name: `${c} ${flip(answerOf(c))}`, exact: true }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click(); await page.waitForTimeout(1000);
    check('a wrong call is a named miss', /even farther away|closer to it/.test(await body()));
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    if (await tryAgain.count()) await tryAgain.first().click();
    await page.waitForTimeout(800);
    check('Try again keeps the tests', (await page.locator('[data-circuit-dist-decide]').count()) === 1);
  }
  for (const c of calls) await page.getByRole('button', { name: `${c} ${answerOf(c)}`, exact: true }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click(); await page.waitForTimeout(1500);
  if (i === 0) await page.screenshot({ path: `${OUT}/distance1-credited.png`, fullPage: true });
  check(`distance ${i + 1}: credited`, /The closer the ball, the stronger the pull/.test(await body()) || (i === N - 1 && /Workbench done!/.test(await body())));
  if (i < N - 1) check(`advance to distance ${i + 2}`, await nextItem(i + 2));
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
