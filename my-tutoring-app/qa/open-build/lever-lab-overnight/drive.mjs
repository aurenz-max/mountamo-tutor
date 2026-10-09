// lever-lab open builds (build_balance, build_lift), driven in headless Chromium through the Engineering tester: real
// generation, real watcher. Balance: one over -> "tipped down on the right" -> Try again keeps the build -> fix -> pass;
// item 2 the same seating -> "same way" -> Start over -> a different seating -> pass; item 3 under -> "tipped down on
// the left" -> pass -> results. Lift: fulcrum too far -> "rock stayed down" -> pass; item 2 same fulcrum -> "same
// place" -> pass; item 3 helper on the rock side -> named -> pass. Watcher lines against the leak rules; phone width.
// Needs next dev on :3000. Run from a folder with playwright-core installed (cached chromium-1169).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/lever-lab-overnight/';
mkdirSync(`${OUT}shots`, { recursive: true });
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const NEVER = ['level', 'balance', 'balanced', 'tip', 'tips', 'tilt', 'heavy', 'heavier', 'light', 'lighter', 'even', 'equal',
  'lift', 'lifts', 'lifting', 'strong', 'stronger', 'weak', 'enough', 'right', 'wrong', 'correct', 'win', 'done', 'ready'];
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Engineering', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByText('Engineering Primitives Tester').count()) break;
}
await page.getByRole('button', { name: /Lever Lab/ }).first().click();
await page.waitForTimeout(800);

const scene = () => page.locator('svg[data-build-scene]');
const placed = () => page.locator('svg[data-build-scene] [data-placed]');
const shot = (name) => page.screenshot({ path: `${OUT}shots/${name}.png`, fullPage: false });
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const press = async (name) => { await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(400); };
const done = async () => { await press("I'm done!"); await page.waitForTimeout(1200); };
const next = async () => { await page.getByRole('button', { name: /^(Next →|See results →)$/ }).click(); await page.waitForTimeout(800); };
const pick = async (w) => { await page.locator(`[data-pip-object="tray-${w}"]`).click(); await page.waitForTimeout(100); };
const seat = async (d) => { await page.locator(`svg[data-build-scene] [data-seat="${d}"]`).click(); await page.waitForTimeout(150); };
const seatAll = async (seating) => { for (const k of seating) { await pick(k.weight); await seat(k.seat); } };
const watch = async (label) => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  const leaks = line ? NEVER.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(line)).concat(/\d/.test(line) ? ['digit'] : []) : [];
  watcherLines.push({ build: label, line, leaks });
};
const generate = async (modeLabel, grade) => {
  await page.locator('label:has-text("Grade Level") + select').selectOption({ label: grade }).catch(() => {});
  await page.locator('#lever-task').selectOption({ label: modeLabel });
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate Content/ }).click();
  const body = await (await resp).json().catch(() => null);
  await page.waitForTimeout(3000);
  await scene().scrollIntoViewIfNeeded().catch(() => {});
  return body?.data ?? body;
};
// The judge's own arithmetic, so the drive builds wrong and right seatings from the generated item.
const leftTurn = c => c.given.reduce((s, k) => s + k.weight * -k.seat, 0);
function seatings(target, palette, maxKids = 4) {
  const out = [];
  const walk = (s, sum, kids) => {
    if (sum > target) return;
    if (s > 5) { if (sum === target && kids.length) out.push(kids); return; }
    walk(s + 1, sum, kids);
    if (kids.length >= maxKids) return;
    for (const w of palette) walk(s + 1, sum + w * s, [...kids, { seat: s, weight: w }]);
  };
  walk(1, 0, []);
  return out.sort((a, b) => a.length - b.length);
}
const fulcrums = (rock, helper) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(f => helper * (10 - f) >= rock * f);

// ── build_balance (Kindergarten) ──
let data = await generate('Balance the Seesaw (open build)', 'Kindergarten');
let chs = data?.challenges ?? [];
ok('balance: 3 items, all build_balance, item 2 a different way on item 1',
  chs.length === 3 && chs.every(c => c.type === 'build_balance') && chs[1].differentFrom === chs[0].id, chs.map(c => c.instruction).join(' | '));
ok('balance: opens empty, blocks under the seesaw, I\'m done! off', await placed().count() === 0
  && await page.locator('[data-chock]').count() === 2 && await page.getByRole('button', { name: "I'm done!" }).isDisabled());
ok('balance: no running total or target on screen', !/total|torque/i.test(await text()));
await shot('b-0-empty');
let c = chs[0];
const T1 = leftTurn(c);
const big = Math.max(...c.palette);
await seatAll([{ seat: 5, weight: big }]);
await watch('balance item 1: one big kid at the far end');
await done();
ok('balance: one over -> tipped down on the right', /tipped down on the right/.test(await text()), `target ${T1}, built ${big * 5}`);
ok('balance: the bar tips after the blocks come away', await page.locator('[data-beam]').first().getAttribute('data-tilt') === '1'
  && await page.locator('[data-chock]').count() === 0);
await shot('b-1-over');
await press('Try again');
ok('balance: Try again keeps the build', await placed().count() === 1);
await page.locator('svg[data-build-scene] [data-placed="5"]').click();
const ways = seatings(T1, c.palette);
const first = ways[0], second = ways.find(w => JSON.stringify(w) !== JSON.stringify(first) && w.length >= 1);
await seatAll(first);
await watch('balance item 1: reference seating');
await done();
ok('balance: a levelling seating passes', /stayed level/.test(await text()), JSON.stringify(first));
await shot('b-2-pass');
await next();

ok('balance item 2 opens empty', await placed().count() === 0);
await seatAll(first);
await done();
ok('balance: the same seating again -> same way', /same way as last time/.test(await text()));
await press('Try again');
await press('Start over');
ok('balance: Start over clears', await placed().count() === 0);
await seatAll(second);
await watch('balance item 2: a different seating');
await done();
ok('balance: a different levelling seating passes', /stayed level/.test(await text()), JSON.stringify(second));
await shot('b-3-different');
await next();

c = chs[2];
await seatAll([{ seat: 1, weight: Math.min(...c.palette) }]);
await done();
ok('balance: one under -> tipped down on the left', /tipped down on the left/.test(await text()), `target ${leftTurn(c)}`);
await press('Try again');
await press('Start over');
await seatAll(seatings(leftTurn(c), c.palette)[0]);
await done();
ok('balance item 3 passes', /stayed level/.test(await text()));
await next();
ok('balance: results panel after See results', /Lever Lab Complete/.test(await text()));
await shot('b-4-results');

// ── build_lift (Elementary) ──
data = await generate('Lift the Rock (open build)', 'Elementary');
chs = data?.challenges ?? [];
ok('lift: 3 items, all build_lift, helper lighter than the rock',
  chs.length === 3 && chs.every(x => x.type === 'build_lift' && x.pusherWeight < x.rockWeight), chs.map(x => `${x.rockWeight}/${x.pusherWeight}`).join(' '));
c = chs[0];
let spots = fulcrums(c.rockWeight, c.pusherWeight);
const slot = async (p) => { await page.locator(`svg[data-build-scene] [data-fulcrum-slot="${p}"]`).click(); await page.waitForTimeout(150); };
const spot = async (p) => { await page.locator(`svg[data-build-scene] [data-spot="${p}"]`).click(); await page.waitForTimeout(150); };
await slot(spots[spots.length - 1] + 1);
await spot(10);
await watch('lift item 1: fulcrum one past the last spot');
await done();
ok('lift: fulcrum too far from the rock -> rock stayed down', /rock stayed down/.test(await text()));
await shot('l-1-weak');
await press('Try again');
ok('lift: Try again keeps the helper and fulcrum', await page.locator('[data-pusher="10"]').count() === 1 && await page.locator('[data-fulcrum]').count() === 1);
await page.locator('svg[data-build-scene] [data-fulcrum]').click();
await slot(spots[0]);
await watch('lift item 1: fulcrum close to the rock');
await done();
ok('lift: a lever that lifts passes', /lifted the rock/.test(await text()));
ok('lift: the rock end comes up', await page.locator('[data-beam]').first().getAttribute('data-tilt') === '1');
await shot('l-2-pass');
await next();

await slot(spots[0]); await spot(10); await done();
ok('lift item 2: the same fulcrum spot -> same place', /same place as last time/.test(await text()));
await press('Try again');
await page.locator('svg[data-build-scene] [data-fulcrum]').click();
await slot(spots[1]);
await done();
ok('lift item 2: a different fulcrum spot passes', /lifted the rock/.test(await text()));
await next();

c = chs[2];
spots = fulcrums(c.rockWeight, c.pusherWeight);
await slot(3); await spot(1); await done();
ok('lift item 3: helper on the rock side -> named', /same side of the fulcrum/.test(await text()));
await press('Try again');
await press('Start over');
await slot(spots[0]); await spot(10); await done();
ok('lift item 3 passes', /lifted the rock/.test(await text()));
await shot('l-3-pass');

// ── watcher, phone width, errors ──
ok('watcher produced lines', watcherLines.filter(w => w.line).length >= 3, `${watcherLines.filter(w => w.line).length} of ${watcherLines.length} looks`);
ok('watcher lines pass the leak rules', watcherLines.every(w => !w.leaks.length), JSON.stringify(watcherLines));

data = await generate('Balance the Seesaw (open build)', 'Elementary');
await page.locator('svg[data-build-scene]').evaluate(svg => {
  const card = svg.closest('[class*="max-w-4xl"]') ?? svg.parentElement;
  card.style.width = '358px'; card.style.maxWidth = '358px';
});
await page.waitForTimeout(500);
const seatBox = await page.locator('svg[data-build-scene] [data-seat="1"] rect').boundingBox();
ok('phone column: seat tap target at least 28 x 44 px', !!seatBox && seatBox.width >= 28 && seatBox.height >= 44, JSON.stringify(seatBox));
const trayBox = await page.locator('[data-pip-object="tray-1"]').boundingBox();
ok('phone column: tray buttons 44 px tall', !!trayBox && trayBox.height >= 44, JSON.stringify(trayBox));
await page.locator('svg[data-build-scene]').scrollIntoViewIfNeeded();
await shot('phone-358');
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth|favicon/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${OUT}drive.json`, JSON.stringify({ checks, watcherLines, errors }, null, 2));
console.log(`${checks.filter(x => x.pass).length}/${checks.length}`);
await browser.close();
