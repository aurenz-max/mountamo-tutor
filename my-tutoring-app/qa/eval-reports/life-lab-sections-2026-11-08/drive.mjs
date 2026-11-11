// Play a saved life-lab lesson in the Biology tester (the saved payload stands in for the generation, so it is free): tap
// through the drawn teach frames, reach the task, open Learn more. Usage: node drive.mjs <payload.json> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const [PAYLOAD, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const saved = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
const data = saved.data ?? saved;
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/api/lumina', async route => {
  if ((route.request().postData() ?? '').includes('generateComponentContent')) return route.fulfill({ json: { type: 'life-lab', instanceId: 'life-lab', data } });
  return route.continue();
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
await page.getByRole('button', { name: /Generate Content/ }).first().click();
const panel = page.locator('[data-teach-panel]');
for (let k = 0; k < 60 && !(await panel.count()); k++) await page.waitForTimeout(1000);
check('the question opens on drawn frames', (await panel.count()) > 0, await page.locator('[data-teach-says]').first().innerText().catch(() => ''));
check('no drawer while teaching', !(await page.getByRole('button', { name: 'Learn more' }).count()));
await panel.screenshot({ path: `${OUT}/1-frame.png` });
for (let k = 0; k < 6 && (await panel.count()); k++) { await page.locator('[data-pip-object="teach-next"]').click(); await page.waitForTimeout(350); }
check('the task opens', (await page.locator('[data-life-ask]').count()) > 0, await page.locator('[data-life-ask]').first().innerText().catch(() => ''));
const drawer = page.getByRole('button', { name: 'Learn more' });
check('the drawer starts closed', (await drawer.getAttribute('aria-expanded')) === 'false');
await page.locator('[data-pip-object="workspace"]').first().screenshot({ path: `${OUT}/2-task.png` }).catch(() => {});
await drawer.click();
await page.waitForTimeout(600);
check('the drawer opens with its words', (await drawer.getAttribute('aria-expanded')) === 'true', (await page.locator('[data-learn-term]').first().innerText().catch(() => '')).slice(0, 120));
await page.locator('[data-pip-object="workspace"]').first().screenshot({ path: `${OUT}/3-learn-more.png` }).catch(() => {});
const real = errors.filter(e => !/ellipse|circle|WebSocket|ws:\/\//i.test(e));
check('no page errors', real.length === 0, real.slice(0, 3).join(' || '));
await browser.close();
