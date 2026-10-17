// Drive one ecosystem-diorama task in the Biology tester (offline bench, real WebGL): node drive-modes.mjs <out> <mode>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const MODE = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
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
await page.waitForTimeout(500);
await page.locator('#biology-task').selectOption(MODE);
await page.locator('label:has-text("Grade Level") + select').selectOption({ label: 'Kindergarten' });
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate Content/ }).click();
const data = (await (await resp).json().catch(() => null))?.data;
check('generated', !!data?.challenges?.length && data.challenges.every(c => MODE === 'mixed' || c.type === MODE), data ? `${data.title} | ${data.challenges.map(c => c.type).join(',')}` : 'no data');
await page.waitForTimeout(8000);
const scene = await page.locator('[data-ecosystem-scene]').first().getAttribute('data-ecosystem-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.locator('[data-ecosystem-scene]').first().scrollIntoViewIfNeeded();
const shot = (name) => page.locator('[data-ecosystem-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const canvas = '[data-ecosystem-scene] canvas';
const tap3d = async (t) => { const p = await page.evaluate(([sel, t]) => document.querySelector(sel).__ecosystemPoint(t), [canvas, t]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(600); };
const btn = (name) => page.getByRole('button', { name, exact: true }).first();
const click = async (name) => { await btn(name).click(); await page.waitForTimeout(400); };
const text = () => page.locator('body').innerText();
const tryAgain = async () => {
  const t = page.getByRole('button', { name: /Try again/i });
  check('Try again shown after a miss', (await t.count()) > 0);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(900); }
};
const advance = async (i) => {
  if (i >= data.challenges.length - 1) return;
  const nextInstr = data.challenges[i + 1].instruction.slice(0, 50);
  for (let k = 0; k < 8; k++) {
    const cur = await text();
    if (cur.includes(nextInstr) && (data.challenges[i].instruction.slice(0, 50) !== nextInstr || k > 2)) return;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
};
const credited = async (i, re) => { const t = await text(); check(`item ${i + 1} credited`, re.test(t) || (i === data.challenges.length - 1 && /Island work done/.test(t))); };
await shot('0-start');

const WINTER = { bear: 'den', bird: 'south', squirrel: 'hollow', deer: 'meadow' };
for (let i = 0; i < data.challenges.length; i++) {
  const c = data.challenges[i];
  const T = c.type;
  if (T === 'plant_needs') {
    if (i === 0) {
      // Leave it as it is (an empty pot or a drooping plant): it droops.
      await click('Watch it grow');
      await page.waitForTimeout(3500);
      check('a plant missing a need droops', /drooped|did not need/.test(await text()));
      await shot('1-drooped');
      await tryAgain();
    }
    const pressed = async (name) => (await btn(name).getAttribute('aria-pressed')) === 'true';
    if (!(await pressed('☀️ Sunny sand'))) await click('☀️ Sunny sand');
    if (!(await pressed('🟫 Soil'))) await click('🟫 Soil');
    if (await page.getByRole('button', { name: '💧 Water it', exact: true }).count()) await click('💧 Water it');
    for (const e of ['🪵 Den', '🫐 Berries']) if (await pressed(e)) await click(e);
    await click('Watch it grow');
    await credited(i, /It grew tall!/);
    await page.waitForTimeout(3500);
    if (i < 2) await shot(`2-grew-${i + 1}`);
  } else if (T === 'season_behavior') {
    await click('Bring winter ❄️');
    await page.waitForTimeout(i === 0 ? 2500 : 600);
    if (i === 0) await shot('1-winter-coming');
    await page.waitForTimeout(i === 0 ? 4000 : 500);
    if (i === 0) {
      await shot('2-winter');
      // A wrong move first: everyone to the meadow.
      for (const a of c.animals) { await tap3d(`animal:${a}`); await tap3d('place:meadow'); }
      await click('Done');
      check('a wrong winter place is a miss', /Think about the/.test(await text()));
      await tryAgain();
    }
    for (const a of c.animals) { await tap3d(`animal:${a}`); await tap3d(`place:${WINTER[a]}`); }
    await page.waitForTimeout(2500);
    if (i === 0) await shot('3-placed');
    await click('Done');
    await credited(i, /Yes! /);
  } else if (T === 'season_from_log') {
    await click('Play the month');
    await page.waitForTimeout(4200);
    if (i < 2) await shot(`1-playing-${c.season}`);
    await page.waitForTimeout(5500);
    check(`item ${i + 1} the log filled`, /20 of 20 days/.test(await text()));
    if (i === 0) {
      await full('2-log-filled');
      const n = {}; for (const d of c.days) n[d] = (n[d] ?? 0) + 1;
      const other = Object.keys(n).filter(w => w !== c.days.reduce((a, d) => (n[d] > n[a] ? d : a), c.days[0]))[0];
      await click(c.season);
      await btn(`${other} days row`).click(); await page.waitForTimeout(500);
      check('a present-but-not-most weather is a miss', /happened the MOST/.test(await text()));
      await tryAgain();
    }
    const n = {}; for (const d of c.days) n[d] = (n[d] ?? 0) + 1;
    const most = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    await click(c.season);
    await btn(`${most} days row`).click(); await page.waitForTimeout(500);
    await credited(i, /Yes! /);
  } else if (T === 'compare_logs') {
    await click('Play the months');
    await page.waitForTimeout(18500);
    check(`item ${i + 1} both logs filled`, ((await text()).match(/20 of 20 days/g) ?? []).length === 2);
    if (i === 0) {
      await full('1-two-logs');
      const wrong = c.answer === 'a' ? c.b.label : c.a.label;
      await click(`Pick ${wrong}`);
      check('picking the wrong log is a miss', /again/.test(await text()));
      await tryAgain();
    }
    await click(`Pick ${c.answer === 'a' ? c.a.label : c.b.label}`);
    await credited(i, /Yes! /);
    if (MODE !== 'mixed' && i >= 1) break; // two items are enough to show the loop; each is 17 s of days
  } else if (T === 'sun_test') {
    await tap3d(c.warmer === 'left' ? 'right' : 'left');
    await click('Let the day go by');
    await page.waitForTimeout(6500);
    await tap3d(c.warmer);
    await credited(i, /Yes! The red line/);
  } else if (T === 'keep_it_cool') {
    if (i === 0) {
      await click('Cover: clear sheet');
      await click('Let the day go by');
      await page.waitForTimeout(6500);
      check('a clear sheet lets it melt (miss)', /clear sheet/.test(await text()));
      await shot('1-melted');
      await tryAgain();
    }
    const works = c.covers.find(x => x !== 'clear sheet');
    await click(`Cover: ${works}`);
    await page.waitForTimeout(800);
    if (i < 2) await shot(`2-built-${works.replace(' ', '-')}`);
    await click('Let the day go by');
    await page.waitForTimeout(6500);
    await credited(i, /It stayed cool!/);
    if (i < 2) await shot(`3-cool-${i + 1}`);
  }
  await advance(i);
}
await page.waitForTimeout(2000);
await shot('9-end');
check('no page errors from the tank', errors.filter(e => !/Failed to load resource|favicon|WebSocket|ws:|<ellipse>|<circle>|Extra attributes/.test(e)).length === 0,
  errors.filter(e => !/<ellipse>|<circle>|Extra attributes|Failed to load/.test(e)).slice(0, 4).join(' || '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors, data }, null, 2));
console.log(`${log.filter(l => l.ok).length}/${log.length} checks passed`);
await browser.close();
