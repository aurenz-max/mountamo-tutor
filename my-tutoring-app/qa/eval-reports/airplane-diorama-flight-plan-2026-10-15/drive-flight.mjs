// Drive airplane-diorama flight_plan (or mixed) in the Engineering tester (offline levers): real generation,
// a no-spare miss, Try again, every trip flown right, the finale, phone width.
// node drive-flight.mjs <outDir> <grade label> <task label: "Plan the Flight" | "Mixed (intent picks)">
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 4';
const TASK = process.argv[4] || 'Plan the Flight';
const TOPIC = process.argv[5] || '';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 30; i++) {
  await page.getByText('Engineering', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: 'Generate Content' }).count()) break;
}
const jet = page.getByRole('button', { name: /Airplane \(3D\)/ }).first();
await jet.waitFor({ timeout: 60000 }).catch(async () => { await page.screenshot({ path: `${OUT}/0-nav-fail.png` }); });
await jet.scrollIntoViewIfNeeded();
await jet.click();
await page.locator('label:has-text("Grade Level") + select').selectOption({ label: GRADE });
await page.locator('#family-task').selectOption({ label: TASK });
if (TOPIC) await page.locator('label:has-text("Topic") + input').fill(TOPIC);
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: 'Generate Content' }).click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
check('generated', items.length > 0, items.map(c => c.type === 'find_part' ? `find:${c.part}` : `${c.from}->${c.to} ${c.distance}${c.units}/${c.perTank}`).join(' | '));
check('framing has no digits', data && !/\d/.test(data.title + data.description), `${data?.title} / ${data?.description}`);
await page.waitForTimeout(6000);
const text = () => page.locator('body').innerText();
const need = c => Math.ceil(c.distance / c.perTank) + c.spare;

const press = async (name, n = 1) => { for (let i = 0; i < n; i++) { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(120); } };
const fly = async () => { await press('Fly!'); await page.waitForTimeout(5500); };

let shot = 0, missed = false;
for (let i = 0; i < items.length; i++) {
  const c = items[i];
  check(`item ${i + 1} on screen`, (await page.getByText(c.instruction).count()) > 0, c.instruction);
  if (c.type === 'find_part') {
    const pt = await page.evaluate((p) => document.querySelector('[data-airplane-scene] canvas').__airplanePartPoint(p), c.part);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(1500);
    check(`item ${i + 1} find credited`, /Yes! That's/.test(await text()), c.part);
  } else {
    const before = await text();
    check(`trip ${i + 1}: screen never shows the tank count before a flight`, !new RegExp(`\\b${need(c)} (spare )?tanks?\\b`).test(before), `key=${need(c)}`);
    check(`trip ${i + 1}: loader starts empty`, /No fuel loaded yet/.test(before) && /Tanks: 0/.test(before));
    if (!missed) {
      missed = true;
      await press('Add a tank', need(c) - 1);
      await page.screenshot({ path: `${OUT}/${++shot}-loaded.png` });
      await fly();
      const t = await text();
      check('no-spare flight: lands with empty tanks, named miss', /tanks were empty/.test(t), (t.match(/The jet reached[^.]+\./) || [''])[0]);
      await page.screenshot({ path: `${OUT}/${++shot}-no-spare.png` });
      const tryAgain = page.getByRole('button', { name: /Try again/i });
      check('Try again shown after a miss', (await tryAgain.count()) > 0);
      if (await tryAgain.count()) { await tryAgain.first().click(); await page.waitForTimeout(800); }
      check('bench logged miss no_spare_fuel', /no_spare_fuel/.test(await text()));
      check('loader empty on Try again', /Tanks: 0(?!\d)/.test(await text()));
      await press('Add a tank', need(c));
    } else {
      await press('Add a tank', need(c));
    }
    // Mid-flight frame.
    await press('Fly!');
    await page.waitForTimeout(700);
    if (shot < 6) await page.screenshot({ path: `${OUT}/${++shot}-flying.png` });
    await page.waitForTimeout(5000);
    const t = await text();
    // The last trip's feedback is replaced by the finale, which only shows once every item is credited.
    check(`trip ${i + 1} credited`, /Yes! The jet reached/.test(t) || (i === items.length - 1 && /Ready for takeoff!/.test(t)), (t.match(/Yes! The jet reached[^!]+!/) || [''])[0]);
    if (shot < 6) await page.screenshot({ path: `${OUT}/${++shot}-landed.png` });
  }
  for (let k = 0; k < 6; k++) {
    if (i === items.length - 1) break;
    if (await page.getByText(items[i + 1].instruction).count()) break;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
}
await page.waitForTimeout(4000);
check('finale summary', /Ready for takeoff!/.test(await text()));
await page.screenshot({ path: `${OUT}/${++shot}-finale.png` });

await page.setViewportSize({ width: 390, height: 844 });
await page.addStyleTag({ content: '.w-64, .w-80 { display: none !important; }' });
await page.waitForTimeout(1500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('no horizontal scroll at phone width', overflow <= 1, `overflow=${overflow}px`);
await page.screenshot({ path: `${OUT}/${++shot}-phone.png`, fullPage: false });

const ours = errors.filter(e => /airplane|three|webgl|AirplaneScene|FlightPlan|R3F|fiber/i.test(e));
check('no airplane/three errors in console', ours.length === 0, ours.slice(0, 3).join(' | '));
fs.writeFileSync(`${OUT}/drive.json`, JSON.stringify({ grade: GRADE, task: TASK, title: data?.title, items, log, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
