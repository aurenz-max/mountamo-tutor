// pattern-builder create (open build), driven headless in the Math tester (offline): the shape on screen, an empty
// row -> the other shape -> miss -> Try again keeps the row -> Start over -> the asked shape -> pass; then too short ->
// miss -> add one -> pass; watcher lines against the leak rules; phone width. Needs next dev on :3000.
// Run from a folder with playwright-core installed (see the headless drive recipe); `open.mjs` beside it.
import { open } from './open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/pattern-builder-2026-10-08/';
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: 'Pattern Builder', mode: 'Create (Tier 4)', grade: 'Kindergarten' });
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const chs = data?.challenges ?? [];
console.log('shapes', chs.map(c => c.createShape), 'tokens', chs[0]?.availableTokens);
const palette = chs[0]?.availableTokens ?? [];
const tapAll = async (tokens) => { for (const t of tokens) { await page.locator(`[data-pip-object="token-${palette.indexOf(t)}"]`).click(); await page.waitForTimeout(150); } };
const rowLen = () => page.locator('[data-created-token]').count();
const press = name => page.getByRole('button', { name, exact: true }).click();
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const watch = async (label) => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  if (line) watcherLines.push({ state: label, line });
};
const tryAgain = async () => { await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.waitForTimeout(1500); };
const next = async () => { const b = page.getByRole('button', { name: /Next challenge/i }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(2000); } };
const [a, b, c] = palette;

ok('routed: every item create with a shape', chs.length > 0 && chs.every(x => x.type === 'create' && x.createShape));
ok('row opens empty, shape shown', await rowLen() === 0
  && (await page.locator('[data-asked-shape]').getAttribute('aria-label')) === `Shape ${chs[0].createShape.split('').join(' ')}`);
await shot(page, 'pb-0-empty');

// Item 1 asks AB: make ABB twice (the other shape)
await tapAll([a, b, b]); await watch('a b b');
await tapAll([a, b, b]); await watch('a b b a b b');
await shot(page, 'pb-1-other-shape');
await press("I'm done!"); await page.waitForTimeout(2500);
ok('miss names the shape, never a row', /not A B yet/.test(await text()), (await text()).match(/That repeats[^.]*\./)?.[0] ?? '');
await shot(page, 'pb-2-miss');
await tryAgain();
ok('Try again keeps the row', await rowLen() === 6);
await press('Start over');
ok('Start over clears the row', await rowLen() === 0);
await tapAll([a, b, a, b]); await watch('a b a b');
await press("I'm done!"); await page.waitForTimeout(2500);
ok('AB made twice passes', /made your own pattern|Next challenge/i.test(await text()));
await shot(page, 'pb-3-pass');
await next();

// Item 2 asks ABB: too short, then add the last token
ok('item 2 opens empty with ABB', await rowLen() === 0 && (await page.locator('[data-asked-shape]').getAttribute('aria-label')) === 'Shape A B B');
// Each kept line must name only colours on the row (the watcher once called a red tile purple).
const named = l => ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink'].filter(k => new RegExp(`\\b${k}\\b`, 'i').test(l));
await tapAll([c, a, a, c, a]); await watch('c a a c a');
await press("I'm done!"); await page.waitForTimeout(2500);
ok('too short is named', /make it again/i.test(await text()));
await tryAgain();
await tapAll([a]);
await press("I'm done!"); await page.waitForTimeout(2500);
ok('ABB made twice passes', /made your own pattern|Next challenge/i.test(await text()));
await shot(page, 'pb-4-abb-pass');

const verdictish = /\b(done|ready|complete|correct|wrong|great|good job|try|should|need|add|remove|pattern|repeat)\b|\?/i;
const numberish = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
ok('5+ watcher lines', watcherLines.length >= 5, String(watcherLines.length));
for (const w of watcherLines) ok(`watcher "${w.line}" no verdict/number`, !verdictish.test(w.line) && !numberish.test(w.line), w.state);
// The state label's letters are the tokens placed (a, b, c = the palette's first three).
const placedColours = s => Array.from(new Set(s.split(' ').map(l => palette['abc'.indexOf(l)]).filter(Boolean)));
for (const w of watcherLines) ok(`watcher "${w.line}" names only placed colours`, named(w.line).every(k => placedColours(w.state).includes(k)),
  `${w.state} -> ${placedColours(w.state)}`);

await next(); // item 3, so the palette is on screen to measure
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await page.evaluate(() => { const card = document.querySelector('[data-pip-object="build"]')?.closest('[class*="rounded"][class*="border"]')?.parentElement?.closest('div'); });
await shot(page, 'pb-5-phone');
const fit = await page.evaluate(() => {
  const tok = document.querySelector('[data-pip-object="token-0"]')?.getBoundingClientRect();
  const done = [...document.querySelectorAll('button')].find(b => b.textContent === "I'm done!")?.getBoundingClientRect();
  return { token: tok && [Math.round(tok.width), Math.round(tok.height)], done: done && Math.round(done.height), docW: document.documentElement.scrollWidth, vw: innerWidth };
});
ok('palette tokens >= 44px', fit.token && fit.token[0] >= 44 && fit.token[1] >= 44, JSON.stringify(fit));
ok('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
writeFileSync(`${dir}drive.json`, JSON.stringify({ at: new Date().toISOString(), shapes: chs.map(x => x.createShape), checks, watcherLines, errors: errors.slice(0, 10) }, null, 2));
console.log(`${checks.filter(x => x.pass).length}/${checks.length} passed`);
await browser.close();
