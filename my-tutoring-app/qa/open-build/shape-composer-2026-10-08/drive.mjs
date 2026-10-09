// shape-composer free-create (open build), driven headless in the Math tester: recipe shown, empty board ->
// an extra shape -> extra_piece -> remove it -> pieces apart -> not_touching (build kept) -> drag into a row -> pass;
// then item 2: one piece on top of another -> overlapping -> row -> pass. Watcher lines against the leak rules;
// phone width. Needs next dev on :3000. Run from a folder with playwright-core installed; `open.mjs` beside it.
import { open } from './open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/shape-composer-2026-10-08/';
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: 'Shape Composer', mode: 'Free Create', grade: 'Kindergarten' });
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const chs = data?.challenges ?? [];
console.log('recipes', JSON.stringify(chs.map(c => c.recipe)));

const canvas = page.locator('[data-pip-object="canvas"] svg').first();
const pieces = () => page.locator('[data-pip-object="canvas"] svg g[data-shape]');
const palette = page.locator('[data-pip-object="palette"]');
const add = async shape => { await palette.getByRole('button', { name: shape, exact: true }).click(); await page.waitForTimeout(200); };
const press = name => page.getByRole('button', { name, exact: true }).click();
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const watch = async label => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  if (line) watcherLines.push({ state: label, line });
};
// Canvas units -> screen pixels, and each piece's top-left from its transform.
const toScreen = (x, y) => canvas.evaluate((svg, [x, y]) => {
  svg.scrollIntoView({ block: 'center' });
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [p.x, p.y];
}, [x, y]);
const pos = async i => {
  const t = await pieces().nth(i).getAttribute('transform');
  const [, x, y] = t.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
  return [Number(x), Number(y)];
};
const drag = async (i, toX, toY) => {
  const [x, y] = await pos(i);
  const [sx, sy] = await toScreen(x + 25, y + 30);
  const [tx, ty] = await toScreen(toX + 25, toY + 30);
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300);
};
const row = async () => { const n = await pieces().count(); for (let i = n - 1; i >= 0; i--) await drag(i, 60 + i * 50, 290); };
const recipeShapes = c => c.recipe.flatMap(r => Array(r.count).fill(r.shape));
const next = async () => { const b = page.getByRole('button', { name: /Next Challenge/i }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1500); } };

ok('routed: every item free-create with a recipe', chs.length === 4 && chs.every(c => c.type === 'free-create' && c.recipe?.length));
ok('recipes distinct', new Set(chs.map(c => JSON.stringify(c.recipe))).size === chs.length);
ok('item 1 opens empty, recipe drawn', await pieces().count() === 0
  && (await page.locator('[data-recipe] svg').count()) === recipeShapes(chs[0]).length);
await shot(page, 'sc-0-empty');

// Item 1: the asked shapes plus one that is not on the list.
const r1 = recipeShapes(chs[0]);
const notAsked = ['triangle', 'square', 'rectangle', 'circle'].find(s => !r1.includes(s));
for (const s of r1) await add(s);
await add(notAsked);
await watch('recipe + extra, apart');
await press("I'm done!"); await page.waitForTimeout(800);
ok('extra shape -> extra_piece words', /not on the list/.test(await text()));
await shot(page, 'sc-1-extra');
// Select the extra piece (the last one) and take it off.
const last = (await pieces().count()) - 1;
const [lx, ly] = await pos(last);
const [px, py] = await toScreen(lx + 25, ly + 30);
await page.mouse.click(px, py); await page.waitForTimeout(200);
await press('✕'); await page.waitForTimeout(200);
ok('removed the extra piece', await pieces().count() === r1.length);
await press("I'm done!"); await page.waitForTimeout(800);
ok('pieces apart -> not_touching words', /on their own/.test(await text()));
ok('the build is kept after a miss', await pieces().count() === r1.length);
await shot(page, 'sc-2-apart');
await row();
await watch('row');
await shot(page, 'sc-3-row');
await press("I'm done!"); await page.waitForTimeout(800);
ok('joined row passes', /one big shape/.test(await text()));
await shot(page, 'sc-4-pass');
await next();

// Item 2: stack the second piece on the first, then fix.
const r2 = recipeShapes(chs[1]);
ok('item 2 opens empty', await pieces().count() === 0);
for (const s of r2) await add(s);
await drag(0, 150, 150);
await drag(1, 160, 155);
await press("I'm done!"); await page.waitForTimeout(800);
ok('stacked -> overlapping words', /on top of each other/.test(await text()));
await shot(page, 'sc-5-stacked');
await row();
await watch('row 2');
await press("I'm done!"); await page.waitForTimeout(800);
ok('item 2 row passes', /one big shape/.test(await text()));

// Leak rules on the watcher lines: no number or quantity word, no verdict.
const banned = /\b(\d+|one|two|three|four|five|six|few|many|both|several|done|ready|complete|correct|right|wrong|touch\w*|list)\b/i;
ok('watcher produced lines', watcherLines.length > 0, `${watcherLines.length} of 3 looks`);
ok('watcher lines pass the leak rules', watcherLines.every(w => !banned.test(w.line)), JSON.stringify(watcherLines));

await next();
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
await shot(page, 'sc-6-phone');
const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('no horizontal scroll at 390', scroll <= 0, `${scroll}px`);
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${dir}drive.json`, JSON.stringify({ recipes: chs.map(c => c.recipe), checks, watcherLines, errors }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length}`);
await browser.close();
