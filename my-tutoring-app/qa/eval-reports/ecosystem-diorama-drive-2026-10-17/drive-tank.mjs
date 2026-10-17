// Drive ecosystem-diorama in the Biology tester (offline levers): render, guess, drag the sun, wrong read,
// Try again, right read, the rest by "Let the day go by", finale.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
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
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Biology/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Generate Content/ }).count()) break;
}
await page.getByRole('button', { name: /Island Tank \(3D\)/ }).first().click();
await page.locator('#biology-task').selectOption('sun_test');
await page.locator('label:has-text("Grade Level") + select').selectOption({ label: GRADE });
console.log(`errors before generate: ${errors.length}`, errors.slice(0,2));
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate Content/ }).click();
const data = (await (await resp).json().catch(() => null))?.data;
check('generated', !!data?.challenges?.length, data ? `${data.title} | ${data.islandName} | ` + data.challenges.map(c => `${c.variable}:${c.left.name}/${c.right.name}->${c.warmer}`).join('; ') : 'no data');
await page.waitForTimeout(8000);
const scene = await page.locator('[data-ecosystem-scene]').first().getAttribute('data-ecosystem-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
console.log(`errors after mount: ${errors.length}`);
await page.locator('[data-ecosystem-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const shot = (name) => page.locator('[data-ecosystem-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
await shot('1-start');
await full('1-start-page');

const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
check('frame rate measured', fps > 0, `${fps.toFixed(0)} fps (headless SwiftShader, software GL)`);

const canvas = '[data-ecosystem-scene] canvas';
const point = (t) => page.evaluate(([sel, t]) => document.querySelector(sel).__ecosystemPoint(t), [canvas, t]);
const tap = async (side) => { const p = await point(side); await page.mouse.click(p.x, p.y); await page.waitForTimeout(700); };
const text = () => page.locator('body').innerText();
const other = (s) => (s === 'left' ? 'right' : 'left');
const step = () => page.locator('[data-ecosystem-step]').first().getAttribute('data-ecosystem-step').catch(() => null);

async function dragSun() {
  const s = await point('sun');
  const box = await page.locator(canvas).boundingBox();
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  const endX = box.x + box.width * 0.02, endY = s.y;
  for (let k = 1; k <= 24; k++) {
    // Up and over: follow a rough arc across the top of the canvas.
    const t = k / 24;
    const x = s.x + (endX - s.x) * t;
    const y = s.y - Math.sin(Math.PI * t) * box.height * 0.25;
    await page.mouse.move(x, y);
    await page.waitForTimeout(60);
    if (k === 12) await shot('3-midday');
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

async function advance(nextInstr) {
  for (let k = 0; k < 8; k++) {
    if (await page.getByText(nextInstr, { exact: false }).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return !!(await page.getByText(nextInstr, { exact: false }).count());
}

const tests = data.challenges;
for (let i = 0; i < tests.length; i++) {
  const c = tests[i];
  check(`test ${i + 1} ask on screen`, (await page.getByText(c.instruction.slice(0, 60), { exact: false }).count()) > 0, c.instruction.slice(0, 90));
  if (i > 0) await shot(`t${i + 1}-setup`);
  const guess = i === 0 ? other(c.warmer) : c.warmer;
  await tap(guess);
  check(`test ${i + 1} guess taken, sun unlocked`, (await step()) === 'run', `step=${await step()}`);
  if (i === 0) {
    await shot('2-guessed');
    await dragSun();
  } else {
    await page.getByRole('button', { name: 'Let the day go by' }).click();
    await page.waitForTimeout(6500);
  }
  check(`test ${i + 1} day over, reading step`, (await step()) === 'read', `step=${await step()}`);
  if (i === 0) {
    await shot('4-day-over');
    await tap(other(c.warmer));
    const t = await text();
    check('wrong read sends back to the thermometers', /Look at the two thermometers again/.test(t));
    check('wrong read does not name the warmer one', !t.includes(`The red line by ${c[c.warmer].name}`));
    await shot('5-wrong');
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    check('Try again shown after a miss', (await tryAgain.count()) > 0);
    if (await tryAgain.count()) { await tryAgain.first().click(); await page.waitForTimeout(900); }
    check('Try again keeps the finished day', (await step()) === 'read', `step=${await step()}`);
  }
  await tap(c.warmer);
  const t = await text();
  check(`test ${i + 1} right read credited`, /Yes! The red line by/.test(t) || (i === tests.length - 1 && /Island work done!/.test(t)), (t.match(/Yes! [^\n]+/) || [''])[0].slice(0, 160));
  if (i === 0 || c.variable === 'place') await shot(`t${i + 1}-correct`);
  if (i < tests.length - 1) check(`advanced to test ${i + 2}`, await advance(tests[i + 1].instruction.slice(0, 60)));
}
await page.waitForTimeout(2500);
const end = await text();
check('finale shows', /Island work done!|like a scientist/.test(end));
await shot('9-finale');
await full('9-finale-page');
check('no page errors', errors.filter(e => !/Failed to load resource|favicon|WebSocket|ws:/.test(e)).length === 0, errors.slice(0, 5).join(' || '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors, data }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} checks passed`);
await browser.close();
