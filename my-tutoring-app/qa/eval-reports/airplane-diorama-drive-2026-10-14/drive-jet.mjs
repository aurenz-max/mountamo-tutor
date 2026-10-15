// Drive airplane-diorama in the Engineering tester (offline levers): render, wrong tap, Try again, right taps, finale.
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
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Engineering', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: 'Generate Content' }).count()) break;
}
await page.getByRole('button', { name: /Airplane \(3D\)/ }).first().click();
await page.locator('label:has-text("Grade Level") + select').selectOption({ label: GRADE });
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: 'Generate Content' }).click();
const data = (await (await resp).json().catch(() => null))?.data;
check('generated', !!data?.challenges?.length, data ? data.challenges.map(c => c.part).join(',') : 'no data');
await page.waitForTimeout(6000);
const scene = await page.locator('[data-airplane-scene]').getAttribute('data-airplane-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
await page.screenshot({ path: `${OUT}/1-start.png` });

// Frame rate over 2 s.
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
check('frame rate measured', fps > 0, `${fps.toFixed(0)} fps (headless SwiftShader, software GL)`);

const NEIGHBOR = { wings: 'tail', engines: 'wings', tail: 'wings', cockpit: 'nose', gear: 'engines', cabin: 'cockpit', nose: 'cockpit' };
const tap = async (part) => {
  const pt = await page.evaluate((p) => document.querySelector('[data-airplane-scene] canvas').__airplanePartPoint(p), part);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(900);
  const said = ((await page.locator('body').innerText()).match(/(Yes! That's [^.]+\.|That's (the|an) [^.]+\.)/) || [''])[0];
  console.log(`   tap ${part} -> ${said}`);
};
const text = () => page.locator('body').innerText();

const asks = data.challenges;
for (let i = 0; i < asks.length; i++) {
  const c = asks[i];
  const prompt = await page.getByText(c.instruction).count();
  check(`ask ${i + 1} on screen`, prompt > 0, c.instruction);
  // No part label anywhere on screen while asking (title/name words only in the ask itself).
  if (i === 0) {
    const wrongPart = NEIGHBOR[c.part];
    await tap(wrongPart);
    const t = await text();
    check('wrong tap names what was tapped', /That's (the|an) /.test(t), (t.match(/That's [^.]+\./) || [''])[0]);
    await page.screenshot({ path: `${OUT}/2-wrong.png` });
    // Offline bench: the learner's Try again.
    const tryAgain = page.getByRole('button', { name: /Try again/i });
    check('Try again shown after a miss', (await tryAgain.count()) > 0);
    if (await tryAgain.count()) { await tryAgain.first().click(); await page.waitForTimeout(800); }
    const bench = await text();
    check('bench logged the named miss and the retry', /miss close_part/.test(bench) && /Try again/.test(bench));
  }
  await tap(c.part);
  const t = await text();
  check(`ask ${i + 1} right tap credited`, /Yes! That's/.test(t), c.part);
  await page.waitForTimeout(1800); // let the part show itself and the camera move
  if (i < 3) await page.screenshot({ path: `${OUT}/3-found-${c.part}.png` });
  // Advance: the runtime moves on; the offline bench may need its Next.
  for (let k = 0; k < 6; k++) {
    if (i === asks.length - 1) break;
    if (await page.getByText(asks[i + 1].instruction).count()) break;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
}
await page.waitForTimeout(4000);
const end = await text();
check('finale summary', /Ready for takeoff!/.test(end));
await page.screenshot({ path: `${OUT}/4-takeoff.png` });

// Phone width.
await page.setViewportSize({ width: 390, height: 844 });
// The tester's two sidebars leave a phone no room; hide them to see the primitive at phone width.
await page.addStyleTag({ content: '.w-64, .w-80 { display: none !important; }' });
await page.waitForTimeout(1500);
const w = await page.evaluate(() => { const el = document.querySelector('[data-airplane-scene]'); const r = el?.getBoundingClientRect(); return r ? [r.width, r.height] : null; });
check('scene at phone width', !!w && w[0] > 200, JSON.stringify(w));
await page.screenshot({ path: `${OUT}/5-phone.png` });

const ours = errors.filter(e => /airplane|three|webgl|AirplaneScene|R3F|fiber/i.test(e));
check('no airplane/three errors in console', ours.length === 0, ours.slice(0, 3).join(' | '));
fs.writeFileSync(`${OUT}/drive.json`, JSON.stringify({ grade: GRADE, asks: asks.map(c => [c.part, c.instruction]), fps, log, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
