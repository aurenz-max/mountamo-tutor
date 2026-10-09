// function-machine make_rule (open build), driven headless in the Math tester. Item 1: the ask states the pair, the
// row opens empty -> a machine one over -> wrong_output words name what it gave, the row is kept -> fix the number ->
// first machine kept, the ask turns to "a different machine" -> the same machine the other way round -> same_machine
// -> Start over -> a multiply/divide machine -> pass, both machines fed one more number. Item 2: a bare number ->
// no_input; a dangling sign -> not_a_rule; then two machines -> pass. Then the card squeezed to 360 px.
// Needs next dev on :3000 with this slice merged. Run from a folder with playwright-core installed, with this file
// and open.mjs (beside it here) copied in: node drive.mjs
import { open } from './open.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const dir = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/function-machine-overnight/';
mkdirSync(`${dir}shots`, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${dir}shots/${name}.png` });

const { browser, page, data, errors } = await open({ primitive: 'Function Machine', mode: 'Make a Machine', grade: 'Elementary' });
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const chs = data?.challenges ?? [];
console.log('pairs', JSON.stringify(chs.map(c => [c.makeInput, c.makeOutput])));

const sel = s => page.locator(s).first();
const txt = async s => ((await sel(s).innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
const row = async () => (await page.locator('[data-make-row] button').allInnerTexts()).map(s => s.trim());
const verdictKind = () => sel('[data-make-verdict]').getAttribute('data-make-verdict').catch(() => null);
const tap = async (...keys) => { for (const k of keys) { await page.getByRole('button', { name: `Add ${k}`, exact: true }).click(); await page.waitForTimeout(80); } };
const digits = n => String(n).split('');
const verdicts = [];
const done = async () => {
  await page.getByRole('button', { name: "I'm done!", exact: true }).click(); await page.waitForTimeout(500);
  const kind = await verdictKind();
  if (kind) verdicts.push({ kind, text: await txt('[data-make-verdict]') });
};
const startOver = async () => { await page.getByRole('button', { name: 'Start over', exact: true }).click(); await page.waitForTimeout(200); };
const takeLast = async n => { for (let k = 0; k < n; k++) { await page.locator('[data-make-row] button').last().click(); await page.waitForTimeout(80); } };
/** x + d, or x − d, as tiles: the add/subtract machine for a pair (off by `off`). */
const addTiles = (i, o, off = 0) => { const d = o + off - i; return d >= 0 ? ['x', '+', ...digits(d)] : ['x', '−', ...digits(-d)]; };
/** The item's stored machine as tiles ("4*x + 3" -> 4 × x + 3): a second machine that differs from x + d. */
const ruleTiles = rule => rule.replace(/\s+/g, '').split('').map(ch => ({ '*': '×', '/': '÷', '-': '−' }[ch] ?? ch));
const next = async () => { const b = page.getByRole('button', { name: /Next Function/ }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1000); } };

ok('routed: make_rule, every item a whole-number pair', data?.challengeType === 'make_rule' && chs.length >= 3
  && chs.every(c => Number.isInteger(c.makeInput) && Number.isInteger(c.makeOutput) && c.showRule === false));
const [c1, c2] = chs;
ok('item 1 ask states the pair', await txt('[data-make-ask]') === `Make a machine that turns ${c1.makeInput} into ${c1.makeOutput}.`, await txt('[data-make-ask]'));
ok('item 1 opens empty, nothing to check', (await row()).length === 0
  && await page.getByRole('button', { name: "I'm done!", exact: true }).isDisabled());
const body = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, '');
ok('the stored machine is not on screen', !body.includes(`f(x)=${String(c1.rule).replace(/\s|\*/g, '')}`));
await shot(page, 'fm-0-empty');

// One over.
const over = addTiles(c1.makeInput, c1.makeOutput, 1);
await tap(...over);
ok('the machine body shows the row as built', (await txt('[data-make-machine]')).startsWith('f(x) = x'), await txt('[data-make-machine]'));
await done();
ok('one over -> wrong_output naming what it gave', await verdictKind() === 'wrong_output'
  && (await txt('[data-make-verdict]')).includes(`turns ${c1.makeInput} into ${c1.makeOutput + 1}, not ${c1.makeOutput}`), await txt('[data-make-verdict]'));
ok('the output chute shows what the machine gave', await txt('[data-make-output]') === String(c1.makeOutput + 1));
ok('Try again keeps the build', JSON.stringify(await row()) === JSON.stringify(over));
await shot(page, 'fm-1-over');

// Fix the number.
const right = addTiles(c1.makeInput, c1.makeOutput);
await takeLast(over.length - 2);
await tap(...right.slice(2));
await done();
ok('fixed machine accepted as the first way', await verdictKind() === 'way', await txt('[data-make-verdict]'));
ok('first machine kept, ask turns to a different machine', (await txt('[data-made-machines]')).includes('Machine 1')
  && await txt('[data-make-ask]') === `Now make a different machine that also turns ${c1.makeInput} into ${c1.makeOutput}.`);
ok('row opens empty for the second machine', (await row()).length === 0);
await shot(page, 'fm-2-way');

// The same machine, the other way round (d + x), when it is an add machine.
if (right[1] === '+') {
  await tap(...right.slice(2), '+', 'x');
  await done();
  ok('the same machine written another way -> same_machine', await verdictKind() === 'same_machine', await txt('[data-make-verdict]'));
  await shot(page, 'fm-3-same');
  await startOver();
  ok('Start over clears the row', (await row()).length === 0);
}

// A different machine.
await tap(...ruleTiles(c1.rule));
await done();
ok('a different machine passes; both fed one more number', (await txt('[data-make-compare]')).includes('Both your machines'), await txt('[data-make-compare]'));
await shot(page, 'fm-4-pass');
await next();

// Item 2: misses that are not about the number.
ok('item 2 opens empty with its own ask', (await row()).length === 0
  && await txt('[data-make-ask]') === `Make a machine that turns ${c2.makeInput} into ${c2.makeOutput}.`);
await tap(...digits(c2.makeOutput));
await done();
ok('a bare number -> no_input', await verdictKind() === 'no_input', await txt('[data-make-verdict]'));
await startOver();
await tap('x', '+');
await done();
ok('a dangling sign -> not_a_rule', await verdictKind() === 'not_a_rule', await txt('[data-make-verdict]'));
await shot(page, 'fm-5-not-a-rule');
await startOver();
await tap(...ruleTiles(c2.rule)); await done();
await tap(...addTiles(c2.makeInput, c2.makeOutput)); await done();
ok('item 2: two machines pass', (await txt('[data-make-compare]')).includes('Both your machines'));

// Leak rule: a miss's words never write a rule (no x beside a sign or a number); only an accepted machine is named.
const misses = verdicts.filter(v => v.kind !== 'way' && v.kind !== 'pass');
ok('miss words never write a rule', misses.length >= 4 && misses.every(v => !/x\s*[+−×÷^]|\d\s*x|[+−×÷]\s*x/.test(v.text)), JSON.stringify(misses));

// Phone width: squeeze the card to 360 px (the tester page itself is not responsive).
await next();
const fits = await page.evaluate(() => {
  const keys = document.querySelector('[data-make-keys]');
  if (!keys) return { ok: false, why: 'no keypad' };
  // The build card only: the machine picture above it is the family's older layout (fixed md: widths).
  const card = keys.closest('[data-make-card]') ?? keys.parentElement;
  card.style.maxWidth = '360px'; card.style.width = '360px';
  const over = [...card.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > card.getBoundingClientRect().right + 1).length;
  const small = [...keys.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44).length;
  return { ok: over === 0 && small === 0, over, small };
});
await shot(page, 'fm-6-phone');
ok('keypad fits a 360 px card, every key >= 44 px', fits.ok, JSON.stringify(fits));
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${dir}drive.json`, JSON.stringify({ pairs: chs.map(c => [c.makeInput, c.makeOutput, c.rule]), checks, verdicts, errors }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length}`);
await browser.close();
