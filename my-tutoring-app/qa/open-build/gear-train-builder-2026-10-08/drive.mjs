// gear-train-builder open builds, driven in headless Chromium through the Engineering tester (scripted path, real
// generation, real watcher). Per mode: a miss train -> the named verdict -> revise -> pass. Watcher lines checked
// against the leak rules. Phone column at the end.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/gear-train-builder-2026-10-08/';
mkdirSync(OUT, { recursive: true });
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const NEVER = ['fast', 'faster', 'fastest', 'slow', 'slower', 'slowest', 'quick', 'quickly', 'speed', 'same', 'opposite', 'way', 'direction',
  'clockwise', 'counterclockwise', 'anticlockwise', 'backward', 'backwards', 'forward', 'turn', 'turns', 'turning', 'spin', 'spins', 'spinning',
  'rotate', 'rotates', 'times', 'twice', 'half', 'ratio', 'right', 'wrong', 'correct'];
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
await page.getByRole('button', { name: /Gear Train Builder/ }).first().click();
await page.waitForTimeout(800);

const gears = () => page.locator('svg[data-build-scene="gears"] [data-placed]');
const add = async (...teeth) => { for (const t of teeth) { await page.locator(`[data-pip-object="tray-${t}"]`).click(); await page.waitForTimeout(150); } };
const watch = async (label) => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  const leaks = line ? NEVER.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(line)).concat(/\d/.test(line) ? ['digit'] : []) : [];
  watcherLines.push({ build: label, line, leaks });
};
const done = async () => { await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(1600); };
const verdict = async () => (await page.locator('text=/^(Not yet\\.|Yes!) /').first().innerText().catch(() => '')).trim();
const generate = async (modeLabel, grade) => {
  if (grade) await page.locator('label:has-text("Grade Level") + select').selectOption({ label: grade }).catch(() => {});
  await page.locator('#gear-task').selectOption({ label: modeLabel });
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate Content/ }).click();
  const body = await (await resp).json().catch(() => null);
  await page.waitForTimeout(3000);
  await page.locator('svg[data-build-scene="gears"]').scrollIntoViewIfNeeded();
  return body?.data ?? body;
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
const clear = () => page.getByRole('button', { name: 'Clear', exact: true }).click();

// ── build_direction ──
let data = await generate('Which Way? (open build)');
let c = data.challenges[0];
ok('direction: 3 trains generated', data.challenges.length === 3, data.challenges.map(x => x.instruction).join(' | '));
ok('direction: track starts empty, no arrows', await gears().count() === 0 && await page.locator('[data-lever]').count() === 0);
const n = c.minGears + (c.way === 'same' ? (c.minGears % 2 === 1 ? 1 : 0) : (c.minGears % 2 === 0 ? 1 : 0));
await add(...Array(n).fill(16));
await watch(`direction ${n} gears (wrong way)`);
await shot('dir-1-wrong-way');
await done();
ok('direction: the wrong count of gears turns the last gear the wrong way', /turns the wrong way/i.test(await verdict()), await verdict());
await page.locator('svg[data-build-scene="gears"] [data-placed]').last().click();
await page.waitForTimeout(300);
ok('direction: tapping a gear takes it out', await gears().count() === n - 1);
await watch('direction one gear fewer');
await done();
ok('direction: one gear fewer passes', /just what the job asks/i.test(await verdict()), await verdict());
await shot('dir-2-pass');

// ── build_speed ──
data = await generate('Faster or Slower (open build)');
c = data.challenges[0];
const pair = c.speed === 'faster' ? [12, 24] : [24, 12];
const mid = c.way === 'same' ? [16] : [];
await add(pair[0], ...mid, pair[1]);
await watch('speed backwards pair');
await done();
ok(`speed: the pair the wrong way round is not ${c.speed}`, new RegExp(`does not turn ${c.speed}`).test(await verdict()), await verdict());
await shot('speed-1-miss');
await clear();
await add(pair[1], ...mid, 32, pair[0]);
await page.locator('svg[data-build-scene="gears"] [data-placed]').nth(mid.length + 1).click();
await page.waitForTimeout(300);
await watch('speed revised');
await done();
ok(`speed: the pair the right way round passes`, /just what the job asks/i.test(await verdict()), await verdict());

// ── build_ratio ──
data = await generate('Exact Turns (open build)', 'Upper Elementary');
c = data.challenges.find(x => (x.ratio ?? 0) > 1) ?? data.challenges[0];
// Advance to that item on the scripted path by passing earlier ones with the reference train.
const reference = (t) => {
  const r = t.ratio ?? 2; const p = r >= 1 ? [8 * r, 8] : [8, 8 / r];
  let k = Math.max(2, t.minGears); if (t.way && (k % 2 === 1 ? 'same' : 'opposite') !== t.way) k++;
  return [p[0], ...Array(k - 2).fill(16), p[1]];
};
for (const t of data.challenges) {
  if (t.id === c.id) break;
  await add(...reference(t)); await done();
  await page.getByRole('button', { name: /Next train/ }).click(); await page.waitForTimeout(800);
}
const ref = reference(c);
await add(ref[ref.length - 1], ...ref.slice(1, -1), ref[0]);
await done();
ok('ratio: first and last swapped turns too slowly', /too few times/i.test(await verdict()), `${c.instruction} :: ${await verdict()}`);
await clear();
await add(...ref);
await watch('ratio reference');
await shot('ratio-1-reference');
await done();
ok('ratio: the reference train passes', /just what the job asks/i.test(await verdict()), await verdict());
await shot('ratio-2-pass');

// ── phone column ──
await page.getByRole('button', { name: /Next train/ }).click().catch(() => {}); await page.waitForTimeout(800);
await add(32, 32, 32, 32, 32, 32);
const fit = await page.evaluate(() => {
  const svg = document.querySelector('svg[data-build-scene="gears"]');
  let card = svg; while (card && !(card.parentElement && card.parentElement.getBoundingClientRect().width > 700)) card = card.parentElement;
  card.style.width = '358px'; card.style.maxWidth = '358px';
  return new Promise(res => requestAnimationFrame(() => {
    const cr = card.getBoundingClientRect(), s = svg.getBoundingClientRect();
    const g = [...document.querySelectorAll('[data-placed]')].map(e => e.getBoundingClientRect()).map(r => [Math.round(r.width), Math.round(r.height)]);
    const btn = document.querySelector('[data-pip-object="tray-8"]').getBoundingClientRect();
    const wide = [...card.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > cr.right + 1).map(e => e.tagName).slice(0, 5);
    res({ card: Math.round(cr.width), scene: [Math.round(s.width), Math.round(s.height)], gears: g, trayButton: [Math.round(btn.width), Math.round(btn.height)], overflow: wide });
  }));
});
await page.locator('svg[data-build-scene="gears"]').scrollIntoViewIfNeeded();
await shot('phone-358-six-big-gears');
ok('phone: six 32-tooth gears fit a 358px column', fit.scene[0] <= 358 && fit.overflow.length === 0, JSON.stringify(fit));
ok('phone: tray buttons are at least 44px tall', fit.trayButton[1] >= 44, JSON.stringify(fit.trayButton));

const kept = watcherLines.filter(w => w.line);
ok(`watcher: ${kept.length} lines, none breaks a leak rule`, kept.length >= 4 && !watcherLines.some(w => w.leaks.length), JSON.stringify(watcherLines.filter(w => w.leaks.length)));
console.log('errors:', errors.slice(0, 6));
writeFileSync(`${OUT}browser-drive.json`, JSON.stringify({ checks, watcherLines, errors: errors.slice(0, 20) }, null, 1));
await browser.close();
