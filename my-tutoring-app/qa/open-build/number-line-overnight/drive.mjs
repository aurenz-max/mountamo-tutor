// number-line build_hops (open build), driven headless in the Math tester: the line opens with only the start ->
// hops one past -> miss (one_past words) -> the build is kept -> tap the last landing to take that hop off -> a right
// hop -> the first way is kept and the line clears -> the same hops in the other order -> same_way_again -> Start over
// -> a different way -> pass. Item 2: the number in one hop when it is small enough (other_hop_count), else one short;
// then fix and pass. Watcher lines against the leak rules; a 360px card; page errors.
// Needs next dev on :3000. Run from a folder with playwright-core installed; `open.mjs` is in browser-drive-2026-10-07.
import { open } from '../browser-drive-2026-10-07/open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: '^\\W*Number Line', mode: 'Build Hops', grade: 'Grade 1' });
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const chs = data?.challenges ?? [];
console.log('asks', JSON.stringify(chs.map(c => c.instruction)));

// The judge's own rules, restated so the drive can pick builds: hop sets of 1..10, largest first.
const waysFor = (d, n, cap = 10) => n === 0 ? (d === 0 ? [[]] : []) : Array.from({ length: Math.min(cap, d) }, (_, i) => Math.min(cap, d) - i)
  .flatMap(h => waysFor(d - h, n - 1, h).map(rest => [h, ...rest]));
const lineMax = data?.range?.max ?? 20;
const hopArcs = () => page.locator('[data-build-hop]');
const hop = async n => { await page.getByRole('button', { name: `Hop ${n}`, exact: true }).click(); await page.waitForTimeout(150); };
const hops = async sizes => { for (const n of sizes) await hop(n); };
const press = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(250); };
const done = async () => { await press("I'm done!"); await page.waitForTimeout(800); };
const tryAgain = async () => { const b = page.getByRole('button', { name: /Try again/i }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1000); } };
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const watch = async label => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  if (line) watcherLines.push({ state: label, line });
};
const next = async () => { const b = page.getByRole('button', { name: /Next Challenge/i }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1500); } };

ok('routed: three build_hops items, code-written asks', chs.length === 3
  && chs.every(c => c.type === 'build_hops' && /^Start at \d+ and land on \d+ in (two|three) hops\.$/.test(c.instruction)), JSON.stringify(chs.map(c => c.instruction)));
ok('every target has two or more hop sets', chs.every(c => waysFor(c.targetValues[0] - c.startValue, c.hopCount ?? 2).length >= 2));
ok('item 1 opens with no hops and no Check button', await hopArcs().count() === 0 && await page.getByRole('button', { name: /^Check/ }).count() === 0);
await shot(page, 'nl-0-empty');

// Item 1: one past.
const c1 = chs[0], d1 = c1.targetValues[0] - c1.startValue, n1 = c1.hopCount ?? 2;
const ways1 = waysFor(d1, n1);
const first = ways1[ways1.length - 1], second = ways1[0];
const pastLast = first[first.length - 1] + 1;
const over = c1.targetValues[0] + 1 <= lineMax && pastLast <= 10
  ? [...first.slice(0, -1), pastLast] : [...first.slice(0, -1), first[first.length - 1] - 1];
await hops(over);
ok('hops drawn as arcs labelled with their sizes', await hopArcs().count() === n1
  && (await page.locator('[data-build-hop] > g > text').allTextContents()).join(' ') === over.map(h => `+${h}`).join(' '));
await watch('hops, one off');
await done();
ok('one off -> "do not land" words', /do not land on \d+ yet/.test(await text()));
ok('the verdict does not say where the hops landed', !new RegExp(`\\b${c1.startValue + over.reduce((a, b) => a + b, 0)}\\b`).test(
  (await page.locator('main').innerText()).match(/Your hops[^.]*\./)?.[0] ?? ''));
await shot(page, 'nl-1-miss');
await tryAgain();
ok('Try again keeps the build', await hopArcs().count() === n1);
// Tap the last landing (an svg target) to take that hop off.
await page.getByRole('button', { name: `Take off hop ${n1}` }).click(); await page.waitForTimeout(300);
ok('tapping a landing takes that hop off', await hopArcs().count() === n1 - 1);
await hop(first[first.length - 1]);
await done();
ok('a right first way is kept and the line clears', /a different way/.test(await text())
  && await page.locator('[data-first-way]').count() === 1 && await hopArcs().count() === 0);
await shot(page, 'nl-2-first-way');
// The same hops in the other order.
await hops([...first].reverse());
await done();
ok('the same hops again -> same_way_again words', /same hops as your first way/.test(await text()));
await shot(page, 'nl-3-same-way');
await tryAgain();
await press('Start over');
ok('Start over clears the line', await hopArcs().count() === 0);
await hops(second);
await watch('a different way');
await done();
ok('a different way passes', /Two ways to land on/.test(await text()));
await shot(page, 'nl-4-pass');
await next();

// Item 2: the number in fewer hops when one hop can make it, else one short; then a right build twice.
const c2 = chs[1], d2 = c2.targetValues[0] - c2.startValue, n2 = c2.hopCount ?? 2;
ok('item 2 opens empty', await hopArcs().count() === 0);
const ways2 = waysFor(d2, n2);
if (d2 <= 10) {
  await hop(d2); await done();
  ok('fewer hops -> other_hop_count words', /Make it in (two|three) hops/.test(await text()));
} else {
  await hops([ways2[0][0] - 1, ...ways2[0].slice(1)]); await done();
  ok('one short -> "do not land" words', /do not land on \d+ yet/.test(await text()));
}
await tryAgain();
await press('Start over');
await hops(ways2[0]); await done();
await hops(ways2[ways2.length - 1]);
await watch('item 2 second way');
await done();
ok('item 2 passes two ways', /Two ways to land on/.test(await text()));

// Leak rules on the watcher lines: no number or quantity word, no verdict.
const banned = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|few|many|both|several|done|ready|complete|correct|wrong)\b/i;
ok('watcher produced lines', watcherLines.length > 0, `${watcherLines.length} of 3 looks`);
ok('watcher lines pass the leak rules', watcherLines.every(w => !banned.test(w.line)), JSON.stringify(watcherLines));

// A phone column: squeeze the primitive's card to 360px (the tester page is not responsive).
await next();
const fit = await page.evaluate(() => {
  const scene = document.querySelector('[data-build-hops]'); if (!scene) return null;
  let card = scene; for (let i = 0; i < 12 && card.parentElement; i++) { card = card.parentElement; if (card.getBoundingClientRect().width > 480) break; }
  card.style.width = '360px'; card.style.maxWidth = '360px';
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = card.getBoundingClientRect();
    const over = [...card.querySelectorAll('button, svg')].filter(e => e.getBoundingClientRect().right > c.right + 1).length;
    const hopButton = scene.querySelector('button[aria-label="Hop 1"]')?.getBoundingClientRect();
    r({ card: Math.round(c.width), overflowing: over, hopButton: hopButton ? Math.round(Math.min(hopButton.width, hopButton.height)) : null });
  })));
});
await shot(page, 'nl-5-phone');
ok('fits a 360px card (no control or svg past the edge)', fit && fit.overflowing === 0, JSON.stringify(fit));
ok('hop buttons >= 44px at 360px', fit && fit.hopButton >= 44, JSON.stringify(fit));
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${dir}drive.json`, JSON.stringify({ asks: chs.map(c => c.instruction), checks, watcherLines, errors }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length}`);
await browser.close();
