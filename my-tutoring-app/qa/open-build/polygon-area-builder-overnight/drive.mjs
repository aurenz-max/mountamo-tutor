// polygon-area-builder build_perimeter (open build, 3.MD.D.8), driven headless in the Math tester (scripted path, no
// tutor): empty grid, ask states the perimeter -> item 1 one column too wide -> "count the unit sides" miss, build kept
// -> take the column off -> pass; item 2 the area made instead (counted_squares) -> a ring (has_hole) -> a rectangle
// -> pass; item 3 (two-shape) first shape -> the same shape turned (same_as_first) -> a different shape -> pass;
// item 4 an L first, then a rectangle. Watcher lines against the leak rules; phone width (390 viewport, card at 360).
// Needs next dev on :3000 serving this tree. Run from a folder with playwright-core installed, with
// qa/open-build/browser-drive-2026-10-07/open.mjs copied beside this file:  node drive.mjs
import { open } from './open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/polygon-area-builder-overnight/';
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: 'Polygon Area Builder', mode: 'with a Perimeter (Open Build)', grade: 'Grade 3' });
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const chs = data?.challenges ?? [];
console.log('perimeters', JSON.stringify(chs.map(c => `${c.targetPerimeter}x${c.shapesAsked}`)));

const grid = page.locator('svg[data-build-scene="area-grid"]').first();
const cell = (c, r) => page.locator(`[data-pip-object="cell-${c}-${r}"]`).first();
// After a miss the workspace shell keeps the build closed until Try again (which keeps the squares).
const reopen = async () => { const b = page.getByRole('button', { name: 'Try again', exact: true }); if (await b.count() && await b.first().isEnabled()) { await b.first().click(); await page.waitForTimeout(400); } };
const tap = async cells => { await reopen(); for (const [c, r] of cells) await cell(c, r).click(); await page.waitForTimeout(150); };
const shaded = () => page.locator('[data-shaded="true"]').count();
const press = name => page.getByRole('button', { name, exact: true }).click();
const done = async () => { await press("I'm done!"); await page.waitForTimeout(700); };
const clear = async () => { await reopen(); if (await shaded()) { await press('Clear grid'); await page.waitForTimeout(200); } };
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const watch = async label => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  if (line) watcherLines.push({ state: label, line });
};
const next = async () => {
  const b = page.getByRole('button', { name: /Next Figure|Next challenge/i }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(1500); }
};
/** A rectangle `cols` wide, `rows` tall, at (c0, r0). */
const rect = (cols, rows, c0 = 0, r0 = 0) => Array.from({ length: cols * rows }, (_, i) => [c0 + (i % cols), r0 + Math.floor(i / cols)]);
/** A rectangle with perimeter p: `rows` tall (1, or 2 when 1 would not fit the 10-wide grid). */
const rowsFor = p => (p / 2 - 1 > 10 ? 2 : 1);
const rectP = (p, rows = rowsFor(p)) => rect(p / 2 - rows, rows);

ok('routed: every item build_perimeter, even, distinct, grade 3', chs.length >= 3
  && chs.every(c => c.type === 'build_perimeter' && c.targetPerimeter % 2 === 0)
  && new Set(chs.map(c => c.targetPerimeter)).size === chs.length && data?.gradeBand === '3', JSON.stringify(chs.map(c => c.targetPerimeter)));
ok('a two-shape item in the session', chs.some(c => c.shapesAsked === 2));
ok('item 1 opens empty, the ask states the perimeter', await shaded() === 0
  && (await text()).includes(`perimeter of ${chs[0]?.targetPerimeter} units`));
ok('the grid prints no number', !/\d/.test(await grid.textContent()));
await shot(page, 'pp-0-empty');

// Item 1: one column too wide (two over), then take that column off.
const p1 = chs[0].targetPerimeter, rows1 = rowsFor(p1), cols1 = p1 / 2 - rows1;
await tap(rect(cols1 + 1, rows1));
await watch('item 1, one column wide');
await done();
ok('one column over -> count-the-sides words, no number', /count the unit sides/.test(await text())
  && !/Not yet[^.]*\d/.test(await text()));
ok('the build is kept after the miss', await shaded() === (cols1 + 1) * rows1);
await shot(page, 'pp-1-over');
await tap(Array.from({ length: rows1 }, (_, r) => [cols1, r]));
await done();
ok('item 1 passes after the fix', (await text()).includes(`Yes! Your shape has a perimeter of ${p1} units.`));
await shot(page, 'pp-2-pass');
await next();

// Item 2: the area made instead of the perimeter, then a ring with a hole, then a rectangle.
const p2 = chs[1].targetPerimeter;
ok('item 2 opens empty', await shaded() === 0);
const areaRows = [2, 3, 4, 5, 6, 7, 8].find(r => p2 % r === 0 && p2 / r <= 10 && 2 * (r + p2 / r) !== p2);
if (areaRows) {
  await tap(rect(p2 / areaRows, areaRows));
  await done();
  ok(`${p2} squares (perimeter not ${p2}) -> counted_squares words`, /not the squares inside/.test(await text()));
  await shot(page, 'pp-3-counted');
  await clear();
}
await tap(rect(3, 3).filter(([c, r]) => !(c === 1 && r === 1)));
await watch('item 2, a ring');
await done();
ok('a ring -> has_hole words', /has a hole/.test(await text()));
await shot(page, 'pp-4-hole');
await clear();
await tap(rectP(p2));
await done();
ok('item 2 passes', (await text()).includes(`perimeter of ${p2} units`) && /Yes/.test(await text()));
if (chs[1].shapesAsked === 2) { await clear(); await tap(rectP(p2, rowsFor(p2) + 1)); await done(); }
await next();

// Item 3: a two-shape item if there is one at this place; the same shape turned is refused.
const p3 = chs[2].targetPerimeter, rows3 = rowsFor(p3), cols3 = p3 / 2 - rows3;
await tap(rectP(p3));
await done();
if (chs[2].shapesAsked === 2) {
  ok('a right first shape is kept and the second asked for', /different shape with the same perimeter/.test(await text()));
  ok('the first shape is drawn beside the grid', await page.locator('[data-first-shape]').count() > 0);
  if (cols3 <= 8) {
    await clear();
    await tap(rect(rows3, cols3, 4, 0)); // the same rectangle stood on end, moved
    await done();
    ok('the first shape turned -> same_as_first words', /first shape again/.test(await text()));
    await shot(page, 'pp-5-turned');
  }
  await clear();
  await tap(rectP(p3, rows3 + 1));
  await watch('item 3, second shape');
  await done();
  ok('a different shape with the same perimeter passes', (await text()).includes(`Two different shapes, each with a perimeter of ${p3} units!`));
  await shot(page, 'pp-6-two');
} else {
  ok('item 3 passes', (await text()).includes(`perimeter of ${p3} units`));
}
await next();

// Item 4: an L (no 2 by 2 block, so n squares make 2n + 2 sides) first, then a rectangle when two shapes are asked.
if (chs[3]) {
  const p4 = chs[3].targetPerimeter, n = p4 / 2 - 1, v = Math.min(7, n - 2); // always a foot: never a straight strip
  const L = [...Array.from({ length: v + 1 }, (_, r) => [0, r]), ...Array.from({ length: n - v - 1 }, (_, i) => [i + 1, v])];
  await tap(L);
  await watch('item 4, an L');
  await done();
  ok('an L with the perimeter passes', (await text()).includes(`perimeter of ${p4} units`) && /Yes/.test(await text()));
  if (chs[3].shapesAsked === 2) {
    await clear();
    await tap(rectP(p4));
    await done();
    ok('item 4 second shape (a rectangle) passes', /Two different shapes/.test(await text()));
  }
  await shot(page, 'pp-7-L');
}

// Leak rules on the watcher lines: no number or quantity word, no verdict.
const banned = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|few|many|both|several|done|ready|complete|correct|right|wrong)\b/i;
ok('watcher produced lines', watcherLines.length > 0, `${watcherLines.length} of 4-5 looks`);
ok('watcher lines pass the leak rules', watcherLines.every(w => !banned.test(w.line)), JSON.stringify(watcherLines));

// Phone width: the viewport at 390, then the card squeezed to 360 (the tester page is not responsive).
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('no horizontal scroll at 390', scroll <= 0, `${scroll}px`);
const cellPx = await grid.evaluate(svg => {
  svg.closest('[class*="shadow-2xl"]')?.setAttribute('style', 'max-width:360px');
  const r = svg.getBoundingClientRect(); return Math.round((r.width / 372) * 36);
});
ok('grid squares at a 360 card (44 px guideline, reported)', cellPx > 0, `${cellPx}px per square`);
await shot(page, 'pp-8-phone');
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${dir}drive.json`, JSON.stringify({ perimeters: chs.map(c => [c.targetPerimeter, c.shapesAsked]), checks, watcherLines, errors }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length}`);
await browser.close();
