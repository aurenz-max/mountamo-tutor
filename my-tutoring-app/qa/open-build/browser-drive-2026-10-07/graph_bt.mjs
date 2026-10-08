// bar-model make_graph and base-ten build_two_ways: a miss, Try again keeps the build, fix, pass; watcher; fit in a 360px column.
import { open, shot } from './open.mjs';
import { mkdirSync } from 'fs';
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const which = process.argv[2];
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const text = async page => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const verdict = async page => (await text(page)).match(/(Not yet[^.!]*[.!]|Yes[^.!]*[.!]|That[^.!]*[.!])[^]{0,80}/)?.[0] ?? '';
const done = async page => { await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(2500); };
const tryAgain = async page => { const b = page.getByRole('button', { name: /Try again/i }).first(); const n = await b.count(); if (n) { await b.click(); await page.waitForTimeout(1200); } return n > 0; };
async function narrow(page, sel, tag) {
  // The tester page is not responsive; squeeze the primitive's own card to a phone column instead.
  const fit = await page.evaluate(s => {
    const scene = document.querySelector(s); if (!scene) return null;
    let card = scene; for (let i = 0; i < 12 && card.parentElement; i++) { card = card.parentElement; if (card.getBoundingClientRect().width > 480) break; }
    card.style.width = '360px'; card.style.maxWidth = '360px';
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = card.getBoundingClientRect(), sc = scene.getBoundingClientRect();
      const over = [...card.querySelectorAll('button, svg')].filter(e => e.getBoundingClientRect().right > c.right + 1).length;
      r({ card: Math.round(c.width), scene: Math.round(sc.width), overflowing: over });
    })));
  }, sel);
  await shot(page, `${tag}-phone-column`);
  ok('fits a 360px column (no control or svg past the edge)', fit && fit.overflowing === 0, JSON.stringify(fit));
}

if (which === 'graph') {
  const { browser, page, data, errors } = await open({ primitive: 'Bar Model', mode: 'Make a Graph That Fits' });
  const c = data.challenges[0], labels = c.values.map(v => v.label), r = c.graphRule;
  console.log('ask:', c.prompt, JSON.stringify(r));
  const add = async (i, n = 1) => { for (let k = 0; k < n; k++) { await page.getByRole('button', { name: `Put one more in ${labels[i]}` }).first().click(); await page.waitForTimeout(200); } };
  const take = async i => { await page.locator(`[role=button][aria-label="Take one out of ${labels[i]}"]`).first().click(); await page.waitForTimeout(300); };
  const other = r.b ?? (r.a === 0 ? 1 : 0);
  let fix;
  if (r.kind === 'most') { await add(r.a, 2); await add(other, 2); fix = () => add(r.a); }
  else if (r.kind === 'fewest') { for (let i = 0; i < labels.length; i++) await add(i, 2); fix = () => take(r.a); }
  else if (r.kind === 'same') { await add(r.a, 2); await add(other, 3); fix = () => take(other); }
  else { await add(other, 1); await add(r.a, r.by); fix = () => add(r.a); } // more_than: one short
  await page.waitForTimeout(6000);
  const watcher = (await page.getByTestId('build-watcher').innerText().catch(() => '')).trim();
  ok('watcher line shown, no number or comparison word', !!watcher && !/\d|one|two|three|four|five|more|most|fewer|fewest|same|taller|tower|higher|bigger/i.test(watcher.replace('👀', '')), JSON.stringify(watcher));
  await shot(page, 'graph-1-wrong-build');
  await done(page);
  const v1 = await verdict(page); await shot(page, 'graph-2-miss');
  ok('wrong graph is a miss, verdict names no number', /Not yet/i.test(v1) && !/\d/.test(v1), JSON.stringify(v1));
  const before = await page.locator('[data-build-scene="graph"] [role=button][aria-label^="Take one out"]').count();
  ok('Try again offered', await tryAgain(page));
  ok('Try again keeps the graph', await page.locator('[data-build-scene="graph"] [role=button][aria-label^="Take one out"]').count() === before);
  await fix(); await done(page);
  const v2 = await text(page); await shot(page, 'graph-3-pass');
  ok('fixed graph passes', /Yes|Next challenge/i.test(v2), (v2.match(/Yes[^.!]*[.!]/) ?? [''])[0]);
  await narrow(page, '[data-build-scene="graph"]', 'graph');
  console.log('errors:', errors.slice(0, 5)); await browser.close();
}

if (which === 'bt') {
  const { browser, page, data, errors } = await open({ primitive: 'Base Ten Blocks', mode: 'Show It Two Ways' });
  const c = data.challenges[0];
  const n = c.targetNumber ?? c.target ?? c.number ?? Object.values(c).find(v => typeof v === 'number' && v >= 10);
  console.log('ask:', c.instruction ?? c.prompt, 'N =', n, 'keys', Object.keys(c).join(','));
  const btn = (verb, place) => page.getByRole('button', { name: `${verb} one ${verb === 'Add' ? 'to' : 'from'} ${place}` });
  const add = async (place, k) => { for (let i = 0; i < k; i++) { await btn('Add', place).click(); await page.waitForTimeout(120); } };
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  await add('Hundreds', h); await add('Tens', t); await add('Ones', o);
  await page.waitForTimeout(6000);
  const watcher = (await page.getByTestId('build-watcher').innerText().catch(() => '')).trim();
  ok('watcher line shown, no number', !!watcher && !/\d|ten|one|hundred/i.test(watcher.replace('👀', '')), JSON.stringify(watcher));
  await done(page); await shot(page, 'bt-1-first-way');
  ok('first right way kept, drawn small, not a verdict yet', await page.locator('[data-build-scene="first-way"]').count() > 0, (await verdict(page)));
  await done(page); const v1 = await verdict(page); await shot(page, 'bt-2-same-way');
  ok('same blocks again is a miss naming no total', /Not yet|different|same/i.test(v1) && !new RegExp(`\\b${n}\\b`).test(v1), JSON.stringify(v1));
  ok('Try again offered', await tryAgain(page));
  ok('Try again keeps the build', (await page.getByRole('button', { name: 'Take one from Tens' }).isEnabled()) || t === 0);
  if (t > 0) { await btn('Take', 'Tens').click(); await add('Ones', 10); } else { await btn('Take', 'Hundreds').click(); await add('Tens', 10); }
  await done(page); const v2 = await text(page); await shot(page, 'bt-3-pass');
  ok('a different way passes', /Yes|Next challenge/i.test(v2), (v2.match(/Yes[^.!]*[.!]/) ?? [''])[0]);
  await narrow(page, '[data-build-scene="base-ten"]', 'bt');
  console.log('errors:', errors.slice(0, 5)); await browser.close();
}
console.log(`${checks.filter(c => c.pass).length}/${checks.length} passed`);
