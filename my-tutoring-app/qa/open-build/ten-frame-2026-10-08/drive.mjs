// ten-frame build_pair, driven headless in the Math tester (offline levers): empty frame -> one over -> miss ->
// Try again keeps the build -> take one off -> pass; one colour -> miss; the repeated total -> same pair -> miss;
// levers from the bench; watcher lines collected against the leak rules; phone width. Needs next dev on :3000.
import { open } from '../browser-drive-2026-10-07/open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: 'Ten Frame', mode: 'Make It Two Colours', grade: 'Kindergarten' });
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const totals = (data?.challenges ?? []).map(c => c.targetCount);
console.log('totals', totals, 'types', [...new Set((data?.challenges ?? []).map(c => c.type))]);
const frame = page.locator('[data-pip-object="frame"]');
const counters = () => frame.locator('circle').count();
// A filled box is under its counter, which a child taps; the click lands there (same handler).
const cell = i => page.locator(`[data-pip-object="cell-${i}"]`).click({ force: true });
const colour = c => page.getByRole('button', { name: `${c} counters`, exact: true }).click();
const done = () => page.getByRole('button', { name: "I'm done!", exact: true }).click();
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const watch = async (label) => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  if (line) watcherLines.push({ state: label, line });
  return line;
};
const tryAgain = async () => { await page.getByRole('button', { name: /Try again/i }).first().click(); await page.waitForTimeout(1500); };

ok('mode routed: every item build_pair', (data?.challenges ?? []).every(c => c.type === 'build_pair'));
ok('frame opens empty', await counters() === 0);
await shot(page, 'tf-0-empty');

// Item 1: one over (t+1 counters, two colours)
const t1 = totals[0];
await colour('Red'); for (let i = 0; i < t1 - 1; i++) await cell(i);
await watch(`${t1 - 1} red`);
await colour('Yellow'); for (let i = t1 - 1; i < t1 + 1; i++) await cell(i);
await watch(`${t1 - 1} red, 2 yellow (one over)`);
ok('placed one over in two colours', await counters() === t1 + 1);
const bench = await page.locator('[data-bench-lever]').evaluateAll(n => n.map(e => e.getAttribute('data-bench-lever') + ': ' + (/Pulled|✓/.test(e.textContent) ? 'pulled' : 'bare')));
ok('levers bare at start', bench.length > 0 && bench.every(b => b.endsWith('bare')), JSON.stringify(bench));
ok('no count on screen before a lever', !/Counters:\s*\d/.test(await text()));
await shot(page, 'tf-1-one-over');
await done(); await page.waitForTimeout(2500);
await shot(page, 'tf-2-miss');
ok('miss: Try again offered', await page.getByRole('button', { name: /Try again/i }).count() > 0);
await tryAgain();
ok('Try again keeps the build', await counters() === t1 + 1, `${await counters()} counters`);
await cell(t1); // take the last yellow off
await watch(`${t1 - 1} red, 1 yellow (fixed)`);
ok('tap a counter takes it off', await counters() === t1);
await done(); await page.waitForTimeout(3000);
await shot(page, 'tf-3-pass');
const passText = await text();
ok('right pair passes', /Next challenge|Yes|right|correct|✓/i.test(passText), passText.match(/.{0,50}(Next challenge|Yes|correct)[^.]{0,40}/i)?.[0] ?? '');
const next = page.getByRole('button', { name: /Next challenge/i }).first();
if (await next.count()) { await next.click(); await page.waitForTimeout(2000); }

// Item 2 (same total, a different way asked): first the same pair -> same_way_again, then one colour -> miss
ok('item 2 opens empty', await counters() === 0);
await colour('Red'); for (let i = 0; i < t1 - 1; i++) await cell(i);
await colour('Yellow'); await cell(t1 - 1);
await watch('same pair again');
await done(); await page.waitForTimeout(2500);
await shot(page, 'tf-4-same-way');
const bench2 = await page.locator('[data-bench-lever]').evaluateAll(n => n.map(e => e.getAttribute('data-bench-lever')));
ok('ways_shown offered after a repeat', bench2.includes('ways_shown'), JSON.stringify(bench2));
await page.locator('[data-bench-lever="ways_shown"] button').first().click().catch(() => {});
await page.waitForTimeout(1500);
ok('ways_shown draws the learner\'s own way beside the frame', await page.locator('[data-lever="ways-shown"]').count() === 1);
await page.locator('[data-bench-lever="running_count"] button').first().click().catch(() => {});
await page.waitForTimeout(1500);
const countText = await page.locator('[data-lever="running-count"]').innerText().catch(() => '');
ok('running_count shows the whole only', /Counters:\s*\d+/.test(countText) && !/red|yellow/i.test(countText), JSON.stringify(countText));
await shot(page, 'tf-5-levers');
await tryAgain();
// change it to a different pair: one red off, one yellow on
await cell(0); await colour('Yellow'); await cell(0);
await watch('different pair');
await done(); await page.waitForTimeout(3000);
ok('a different pair passes', /Next challenge|Yes|right|correct|✓/i.test(await text()));
await shot(page, 'tf-6-different-pass');

// Leak rules on the watcher lines
const numberish = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|few|many|both|several|pair|half)\b/i;
const verdictish = /\b(done|ready|complete|correct|right|wrong|great|good job|try|should|need|add|remove)\b|\?/i;
ok('5+ watcher lines', watcherLines.length >= 5, String(watcherLines.length));
for (const w of watcherLines) ok(`watcher "${w.line}" has no number/verdict`, !numberish.test(w.line) && !verdictish.test(w.line), w.state);

// Phone width: the frame and the palette fit, tap targets >= 44px
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await page.evaluate(() => { const c = document.querySelector('[data-pip-object="frame"]')?.closest('[class*="shadow-2xl"]'); if (c) c.style.maxWidth = '360px'; });
await page.waitForTimeout(600);
await shot(page, 'tf-7-phone');
const fit = await page.evaluate(() => {
  const f = document.querySelector('[data-pip-object="frame"]').getBoundingClientRect();
  const card = document.querySelector('[data-pip-object="frame"]').closest('[class*="shadow-2xl"]').getBoundingClientRect();
  const cellR = document.querySelector('[data-pip-object="cell-0"]').getBoundingClientRect();
  const pal = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Yellow counters').getBoundingClientRect();
  return { frameRight: Math.round(f.right), cardRight: Math.round(card.right), cell: Math.round(cellR.width), palette: [Math.round(pal.width), Math.round(pal.height)] };
});
ok('frame fits a 360px card', fit.frameRight <= fit.cardRight, JSON.stringify(fit));
ok('palette buttons >= 44px', fit.palette[0] >= 44 && fit.palette[1] >= 44, JSON.stringify(fit.palette));
ok('frame cells >= 40px at 360px', fit.cell >= 40, String(fit.cell));
ok('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
writeFileSync(`${dir}drive.json`, JSON.stringify({ at: new Date().toISOString(), totals, checks, watcherLines, errors: errors.slice(0, 10) }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length} passed`);
await browser.close();
