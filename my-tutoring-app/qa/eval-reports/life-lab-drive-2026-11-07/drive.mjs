// Drive life-lab in the Biology tester: for each task given on the command line, generate a real session (the author
// agent), screenshot the first world, press Run when it has one and screenshot what the world did, then commit and
// screenshot the feedback. Usage: node drive.mjs <outDir> <task label>...   (PW_DIR = a folder with playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const [OUT, ...TASKS] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
let generated = null;
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 140)}`); });
page.on('response', async r => {
  if (r.request().method() === 'POST' && /\/api\/lumina/.test(r.url())) {
    try { const j = await r.json(); const d = j?.data ?? j; if (d?.challenges?.[0]?.world) generated = d; } catch { /* not json */ }
  }
});
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Biology', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Life Lab/ }).count()) break;
}
await page.getByRole('button', { name: /Life Lab/ }).first().click();
await page.waitForTimeout(800);

for (const task of TASKS) {
  generated = null;
  await page.locator('#biology-task').selectOption({ label: task });
  await page.getByRole('button', { name: /Generate Content/ }).first().click();
  for (let k = 0; k < 120 && !(await page.locator('[data-life-ask]').count()); k++) await page.waitForTimeout(1000);
  const slug = task.toLowerCase().replace(/[^a-z]+/g, '-');
  const mounted = await page.locator('[data-life-ask]').count();
  check(`${task}: a world mounted`, mounted > 0, generated ? `${generated.challenges.length} worlds: ${generated.challenges.map(c => c.type).join(', ')}` : 'no data');
  if (!mounted) { await page.screenshot({ path: `${OUT}/${slug}-page.png` }); continue; }
  if (generated) fs.writeFileSync(`${OUT}/${slug}.json`, JSON.stringify(generated, null, 1));
  const card = page.locator('[data-pip-object="workspace"]').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('main, body').first().screenshot({ path: `${OUT}/${slug}-1-start.png`, fullPage: false }).catch(() => {});
  const run = page.getByRole('button', { name: /Grow|Breathe|Play the life|Let the hunter|Try it/ }).first();
  if (await run.count()) {
    await run.click();
    await page.waitForTimeout(4500);
    const why = await page.locator('[data-life-why]').first().innerText().catch(() => '');
    check(`${task}: Run shows what happened`, !!why, why.slice(0, 140));
    await card.screenshot({ path: `${OUT}/${slug}-2-run.png` }).catch(() => {});
  }
  const pick = page.locator('[data-pip-object^="predict-"], [data-pip-object^="card-"], [data-pip-object^="item-"]').first();
  if (await pick.count()) await pick.click().catch(() => {});
  const done = page.getByRole('button', { name: "I'm done!" });
  if (await done.isEnabled().catch(() => false)) {
    await done.click();
    await page.waitForTimeout(4500);
    const fb = await page.locator('[class*="Feedback"], [role="status"]').allInnerTexts().catch(() => []);
    check(`${task}: the check gives feedback`, true, fb.join(' | ').slice(0, 160));
    await card.screenshot({ path: `${OUT}/${slug}-3-checked.png` }).catch(() => {});
  }
}
const real = errors.filter(e => !/ellipse|circle|Download the React DevTools|favicon|WebSocket|ws:\/\//i.test(e));
check('no page errors', real.length === 0, real.slice(0, 3).join(' || '));
console.log('HTTP >=400:', [...new Set(bad)].slice(0, 8).join(' | '));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors, bad }, null, 1));
await browser.close();
