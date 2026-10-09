// tower-stacker open builds, driven in headless Chromium through the Engineering tester (scripted path, real
// generation, real watcher). Per mode: a miss build -> the named verdict + the fallen part -> revise -> pass.
// Watcher lines are recorded and checked against the leak rules. Phone width at the end.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/tower-stacker-2026-10-08/';
mkdirSync(OUT, { recursive: true });
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const NEVER = ['stable', 'unstable', 'steady', 'wobbly', 'wobble', 'tip', 'tips', 'tipping', 'topple', 'fall', 'falls', 'falling',
  'collapse', 'balance', 'balanced', 'wide', 'wider', 'narrow', 'skinny', 'base', 'strong', 'sturdy', 'solid', 'safe', 'reach',
  'reaches', 'short', 'shorter', 'taller', 'wind', 'line', 'goal', 'center', 'centre', 'heavy', 'heavier'];
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
const rawWatch = [];
page.on('response', async r => {
  if (!r.url().includes('/api/lumina') || r.request().method() !== 'POST' || !(r.request().postData() ?? '').includes('watchBuild')) return;
  rawWatch.push(await r.json().catch(() => ({ status: r.status() })));
});
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Engineering', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByText('Engineering Primitives Tester').count()) break;
}

const text = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const pieces = () => page.locator('svg[data-build-scene="tower"] [data-placed]');
const tray = (kind) => page.locator(`[data-pip-object="tray-${kind}"]`);
/** Tap a column near the top of the area, above any tower, the way a child taps where to drop. */
const drop = async (kind, columns, turn = false) => {
  await tray(kind).click();
  if (turn) await page.getByRole('button', { name: 'Turn', exact: true }).click();
  for (const c of columns) { await page.locator(`[data-pip-object="column-${c}"]`).click({ position: { x: 14, y: 4 } }); await page.waitForTimeout(120); }
};
const watch = async (label) => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  const leaks = line ? NEVER.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(line)).concat(/\d/.test(line) ? ['digit'] : []) : [];
  watcherLines.push({ build: label, line, leaks });
  return line;
};
const done = async () => { await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(1500); };
const verdict = async () => (await page.locator('text=/^(Not yet\.|Yes!) /').first().innerText().catch(() => '')).trim();
const generate = async (modeLabel) => {
  await page.locator('#tower-task').selectOption({ label: modeLabel });
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate Content/ }).click();
  const body = await (await resp).json().catch(() => null);
  await page.waitForTimeout(3000);
  return body?.data ?? body;
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
const scrollToScene = () => page.locator('svg[data-build-scene="tower"]').scrollIntoViewIfNeeded();

// ── build_windproof ──
let data = await generate('Build a Windproof Tower (open build)');
let c = data.challenges[0];
ok('windproof: 3 towers generated', data.challenges.length === 3, data.challenges.map(x => `${x.type}@${x.targetHeight}`).join(', '));
await scrollToScene();
ok('windproof: area starts empty, no readouts', await pieces().count() === 0 && !/stability|center of gravity|wide base|tower building tips/i.test(await text()));
ok('windproof: wind arrows drawn', await page.locator('[data-wind-arrow]').count() === 3);
await drop('block', Array(c.targetHeight).fill(6));
ok('windproof: a block column to the line', await pieces().count() === c.targetHeight);
await watch(`windproof column of ${c.targetHeight} blocks`);
await shot('wind-1-column');
await done();
ok('windproof: column is blown over', /wind blew/i.test(await verdict()), await verdict());
ok('windproof: the fallen part is drawn turned', await page.locator('[data-falling]').count() === 1);
await shot('wind-2-blown');
ok('windproof: scripted miss keeps the tower', await pieces().count() === c.targetHeight);
await page.getByRole('button', { name: 'Clear', exact: true }).click();
await drop('beam', Array(c.targetHeight).fill(6));
await watch(`windproof flat beams x${c.targetHeight}`);
await done();
ok('windproof: flat beams pass', /stood up to the wind/i.test(await verdict()), await verdict());
await shot('wind-3-pass');
await page.getByRole('button', { name: /Next tower/ }).click(); await page.waitForTimeout(800);
ok('windproof: next tower opens empty', await pieces().count() === 0);

// ── build_tall ──
data = await generate('Build a Tall Tower (open build)');
c = data.challenges[0];
await scrollToScene();
await drop('block', [1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(5, c.targetHeight)));
await watch('tall staircase');
await done();
ok('tall: a leaning staircase tips', /tipped over/i.test(await verdict()), await verdict());
ok('tall: the fallen part is drawn turned', await page.locator('[data-falling]').count() === 1);
await shot('tall-1-tipped');
// Take the steps off top first, then build straight up from the first.
// Highest first (smallest svg y); keep the bottom step.
const order = await pieces().evaluateAll(ns => ns.map(e => [e.getAttribute('data-placed'), Number(e.getAttribute('y'))]).sort((a, b) => a[1] - b[1]).map(x => x[0]));
for (const id of order.slice(0, -1)) {
  await page.locator(`svg[data-build-scene="tower"] [data-placed="${id}"]`).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
}
ok('tall: steps taken off top first', await pieces().count() === 1, `${await pieces().count()} left`);
await drop('block', Array(c.targetHeight - 1).fill(1));
await watch('tall straight column');
await done();
ok('tall: a straight column passes', /reaches the line and stands/i.test(await verdict()), await verdict());
await shot('tall-2-pass');

// ── build_few ──
data = await generate('Build With Few Pieces (open build)');
c = data.challenges[0];
await scrollToScene();
ok('few: the ask states the cap', (await text()).includes(`no more than ${c.maxPieces} pieces`), c.instruction);
await drop('small', Array(c.targetHeight).fill(6));
await watch(`few small blocks x${c.targetHeight}`);
await done();
ok('few: too many pieces is named', /more pieces than the job allows/i.test(await verdict()), await verdict());
await page.getByRole('button', { name: 'Clear', exact: true }).click();
await drop('beam', Array(Math.ceil(c.targetHeight / 4)).fill(6), true);
await watch('few beams on end');
await shot('few-1-beams-on-end');
await done();
ok('few: beams stood on end pass', /few enough pieces/i.test(await verdict()), await verdict());

// ── phone width: the primitive in a 358px column (390 less two 16px gutters); the tester shell is not responsive ──
await page.getByRole('button', { name: /Next tower/ }).click(); await page.waitForTimeout(800);
const fit = await page.evaluate(() => {
  const svg = document.querySelector('svg[data-build-scene="tower"]');
  let card = svg; while (card && !(card.parentElement && card.parentElement.getBoundingClientRect().width > 700)) card = card.parentElement;
  card.style.width = '358px'; card.style.maxWidth = '358px';
  return new Promise(res => requestAnimationFrame(() => {
    const c = card.getBoundingClientRect(), s = svg.getBoundingClientRect();
    const col = document.querySelector('[data-pip-object="column-0"]').getBoundingClientRect();
    const btn = document.querySelector('[data-pip-object="tray-beam"]').getBoundingClientRect();
    const wide = [...card.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > c.right + 1).map(e => e.tagName + '.' + (e.getAttribute('class') ?? '').slice(0, 40)).slice(0, 5);
    res({ card: Math.round(c.width), scene: [Math.round(s.width), Math.round(s.height)], column: [Math.round(col.width), Math.round(col.height)],
      trayButton: [Math.round(btn.width), Math.round(btn.height)], overflow: wide });
  }));
});
await page.locator('svg[data-build-scene="tower"]').scrollIntoViewIfNeeded();
await shot('phone-358-column');
ok('phone: the scene fits a 358px column', fit.scene[0] <= 358 && fit.overflow.length === 0, JSON.stringify(fit));
ok('phone: tray buttons are at least 44px tall', fit.trayButton[1] >= 44, JSON.stringify(fit.trayButton));
ok('phone: a tap column is at least 20px wide (full height)', fit.column[0] >= 20, JSON.stringify(fit.column));

const lineLeaks = watcherLines.filter(w => w.leaks.length);
ok(`watcher: ${watcherLines.filter(w => w.line).length} lines, none breaks a leak rule`, watcherLines.filter(w => w.line).length >= 5 && !lineLeaks.length, JSON.stringify(lineLeaks));
console.log('errors:', errors.slice(0, 8));
writeFileSync(`${OUT}browser-drive.json`, JSON.stringify({ checks, watcherLines, rawWatch, errors: errors.slice(0, 20) }, null, 1));
await browser.close();
