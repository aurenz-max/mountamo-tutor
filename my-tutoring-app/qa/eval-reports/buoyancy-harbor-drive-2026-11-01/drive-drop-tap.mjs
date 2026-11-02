// Drive buoyancy-harbor's drop_test in the Physics tester (offline workspace): no guess chips; tap a test in the 3D
// tank scene, tap the water, it drops; the second test is chosen next and goes in on another water tap; the decide step
// opens. Also checks the tester gives the preview the full width after a generate.
// Usage: node drive-drop-tap.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 1';
fs.mkdirSync(OUT, { recursive: true });
const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Sink or Float Harbor/ }).count()) break;
}
await page.getByRole('button', { name: /Sink or Float Harbor/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE });
await page.getByRole('button', { name: /^Drop Test/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
await resp;
await page.waitForTimeout(8000);
const scene = page.locator('[data-harbor-scene]').first();
check('3D scene mounted', (await scene.getAttribute('data-harbor-scene')) === '3d');
const box = await scene.boundingBox();
check('preview takes the full width', box && box.width > 900, `scene width ${Math.round(box?.width ?? 0)}px`);
check('controls folded to one bar', await page.getByRole('button', { name: 'Change', exact: true }).count() === 1);
check('no guess chips', await page.getByRole('button', { name: /^Guess the/ }).count() === 0);
await page.screenshot({ path: `${OUT}/1-wide-start.png` });
await scene.scrollIntoViewIfNeeded();
const point = (t) => page.evaluate((t) => document.querySelector('[data-harbor-scene] canvas').__harborPoint(t), t);
const tap = async (t) => { const p = await point(t); await page.mouse.click(p.x, p.y); await page.waitForTimeout(400); };
const body = () => page.locator('body').innerText();
await tap('thing:0');
await tap('water');
await page.waitForTimeout(600);
check('tap thing, tap water: it drops', /Splash! Watch it/.test(await body()));
await scene.screenshot({ path: `${OUT}/2-splash.png` });
await page.waitForTimeout(3000);
check('it settles with a result', /It (floated|sank)\./.test(await body()));
await tap('water'); // the other test is chosen next
await page.waitForTimeout(3500);
check('second water tap drops the other test; decide step opens', await page.getByRole('button', { name: 'Check', exact: true }).count() === 1);
await page.screenshot({ path: `${OUT}/3-decide.png`, fullPage: true });
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
