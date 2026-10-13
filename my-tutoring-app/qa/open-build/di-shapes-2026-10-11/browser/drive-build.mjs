// di-shapes build_shape in the real app: DI tester, Custom run, offline levers. Wrong shape -> miss -> Try again keeps
// it -> clear -> right shape -> pass. Screenshots + checks to OUT.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'fs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const P = (...xy) => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));
const WIT = {
  triangle: P(1, 4, 5, 4, 3, 1), square: P(1, 1, 4, 1, 4, 4, 1, 4), rectangle: P(1, 2, 5, 2, 5, 4, 1, 4),
  hexagon: P(2, 1, 4, 1, 5, 3, 4, 5, 2, 5, 1, 3), pentagon: P(3, 0, 6, 2, 5, 5, 1, 5, 0, 2),
  rhombus: P(3, 1, 5, 2, 3, 3, 1, 2), trapezoid: P(0, 4, 6, 4, 4, 1, 2, 1),
};
const WRONG = { triangle: P(1, 1, 5, 1, 5, 5, 1, 5), other: P(1, 4, 5, 4, 3, 1) };
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
const shot = name => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
try {
  await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(6000);
  await page.getByText('Developer Tools').first().click();
  for (let i = 0; i < 10; i++) {
    await page.getByText('Direct Instruction Lab', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    if (await page.getByRole('tab', { name: 'Custom run' }).count()) break;
  }
  await page.getByRole('tab', { name: 'Custom run' }).click();
  await page.locator('label:has-text("Primitive") select').first().selectOption('di-shapes');
  await page.waitForTimeout(300);
  await page.locator('label:has-text("Eval mode") select').first().selectOption('build_shape').catch(async () => {
    const sel = page.locator('select').nth(1); await sel.selectOption('build_shape');
  });
  const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
  await page.getByRole('button', { name: /Generate run/ }).click();
  const body = await (await resp).json().catch(() => null);
  const data = body?.fullData ?? body?.data ?? body;
  await page.waitForTimeout(3000);
  await page.getByRole('radio', { name: 'Offline levers (free)' }).click();
  await page.waitForTimeout(2500);
  const shapes = (data?.challenges ?? []).map(c => `${c.challengeType}:${c.shape}`);
  ok('generated a build_shape session', shapes.length > 0 && shapes.every(s => s.startsWith('build_shape:')), shapes.join(', '));
  const first = data.challenges[0];
  const ask = (await page.locator('[data-build-ask]').first().innerText().catch(() => '')).trim();
  ok('ask states the shape name', ask === `Make ${first.article} ${first.shapeWord}.`, ask);
  ok('grid starts empty', await page.locator('[data-corner]').count() === 0);
  await page.locator('[data-build-scene="shape-dots"]').scrollIntoViewIfNeeded();
  await shot('1-empty');

  const build = async pts => { for (const p of [...pts, pts[0]]) { await page.locator(`[data-pip-object="dot-${p.x}-${p.y}"]`).click(); await page.waitForTimeout(150); } };
  const wrong = first.shape === 'triangle' ? WRONG.triangle : WRONG.other;
  await build(wrong);
  ok('wrong shape closed', await page.locator('[data-learner-shape="closed"]').count() === 1);
  await page.waitForTimeout(6000);
  const watcher = (await page.getByTestId('build-watcher').innerText().catch(() => '')).trim();
  ok('watcher line has no number or shape word', !/\d|\b(one|two|three|four|five|six)\b|triangle|square|rectangle|hexagon|pentagon|rhombus|trapezoid|side|corner/i.test(watcher.replace('👀', '')), JSON.stringify(watcher));
  await shot('2-wrong-built');
  await page.getByRole('button', { name: "I'm done!" }).click();
  await page.waitForTimeout(2500);
  ok('miss verdict on screen', await page.locator('[data-build-verdict="not-right"]').count() === 1);
  await shot('3-miss');
  const tryAgain = page.getByRole('button', { name: /Try again/i }).first();
  ok('Try again offered', await tryAgain.count() > 0);
  await tryAgain.click().catch(() => {});
  await page.waitForTimeout(1500);
  ok('Try again keeps the shape', await page.locator('[data-corner]').count() === wrong.length, `${await page.locator('[data-corner]').count()} corners`);
  const bench = await page.locator('[data-bench-lever]').evaluateAll(n => n.map(e => e.textContent.replace(/\s+/g, ' ').slice(0, 80)));
  console.log('bench:', bench);
  const tick = page.locator('[data-bench-lever]', { hasText: 'side_ticks' }).getByRole('button').first();
  if (await tick.count()) { await tick.click(); await page.waitForTimeout(800); }
  ok('side_ticks lever marks the child\'s sides', await page.locator('[data-lever="side_ticks"]').count() === wrong.length, `${await page.locator('[data-lever="side_ticks"]').count()} ticks`);
  await shot('4-ticks');
  await page.getByRole('button', { name: 'Clear Shape' }).click();
  await page.waitForTimeout(400);
  await build(WIT[first.shape]);
  await page.getByRole('button', { name: "I'm done!" }).click();
  await page.waitForTimeout(2500);
  ok('right shape passes', await page.locator('[data-build-verdict="right"]').count() === 1
    || (await page.locator('[data-build-ask]').first().innerText().catch(() => '')).trim() !== ask);
  await shot('5-pass');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => { const r = document.querySelector('[data-build-scene="shape-dots"]')?.getBoundingClientRect();
    return r && { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), vw: innerWidth }; });
  ok('grid fits at 390px', !!fit && fit.right <= fit.vw && fit.left >= 0, JSON.stringify(fit));
  const dot = await page.evaluate(() => { const r = document.querySelector('[data-pip-object="dot-3-3"]')?.getBoundingClientRect(); return r && Math.round(r.width); });
  ok('dot tap target at 390px', !!dot, `${dot}px`);
  await page.locator('[data-build-scene="shape-dots"]').scrollIntoViewIfNeeded();
  await shot('6-phone');
} catch (e) {
  ok('drive ran to the end', false, String(e).slice(0, 400));
  await shot('error').catch(() => {});
} finally {
  console.log('errors:', errors.slice(0, 8));
  writeFileSync(`${OUT}/checks.json`, JSON.stringify({ checks, errors }, null, 1));
  await browser.close();
}
