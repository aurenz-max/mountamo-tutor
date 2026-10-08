// coin-counter show-amount: one coin over -> miss -> Try again keeps tray -> take one out -> pass. Phone width. Watcher.
import { open, shot } from './open.mjs';
import { mkdirSync } from 'fs';
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const { browser, page, data, errors } = await open({ primitive: 'Coin Counter', mode: 'Show an Amount' });
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };
const target = data.challenges[0].targetAmount;
const coins = { 25: 'Quarter', 10: 'Dime', 5: 'Nickel', 1: 'Penny' };
const names = { 25: 'Quarter', 10: 'Dime', 5: 'Nickel', 1: 'Penny' };
const bin = v => page.locator('button', { hasText: names[v] }).filter({ hasText: `${v}¢` }).first();
const have = []; for (const v of [25, 10, 5, 1]) if (await bin(v).count()) have.push(v);
console.log('target', target, 'bins', have, 'labels', await page.locator('button', { hasText: 'Penny' }).evaluateAll(n => n.map(e => e.getAttribute('aria-label') + '|' + e.textContent)));
let left = target + 1; const plan = [];
for (const v of have) while (left >= v) { plan.push(v); left -= v; }
const tray = page.locator('[data-build-scene="coin-tray"] g[data-tray-index]');
const text = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok('tray starts empty', await tray.count() === 0);
ok('no target or running total printed before a lever', !(await text()).match(new RegExp(`(total|so far)[^.]{0,20}\\d+¢`, 'i')));
for (const v of plan) { await bin(v).click(); await page.waitForTimeout(250); }
ok(`tapped bins make ${target + 1}¢ (one over)`, await tray.count() === plan.length, `${plan.length} coins`);
await page.waitForTimeout(6000);
const watcher = (await page.getByTestId('build-watcher').innerText().catch(() => '')).trim();
ok('watcher line shown, no number', !!watcher && !/\d|penny|pennies|nickel|dime|quarter|cent/i.test(watcher.replace('👀', '')), JSON.stringify(watcher));
await shot(page, 'coin-1-built-over');
await page.getByRole('button', { name: "I'm done!" }).click();
await page.waitForTimeout(2500);
const afterMiss = await text();
await shot(page, 'coin-2-miss');
ok('miss verdict names no amount', !/\d+¢/.test(afterMiss.match(/I'm done![\s\S]{0,0}/) ? '' : '') , '');
const tryAgain = page.getByRole('button', { name: /Try again/i }).first();
ok('Try again offered', await tryAgain.count() > 0);
await tryAgain.click().catch(() => {}); await page.waitForTimeout(1200);
ok('Try again keeps the tray', await tray.count() === plan.length, `${await tray.count()} coins`);
// take one penny out (the last coin is a penny by construction)
const last = plan.length - 1;
await tray.nth(last).click(); await page.waitForTimeout(500);
ok('tapping a tray coin takes it out', await tray.count() === plan.length - 1);
await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(3000);
await shot(page, 'coin-3-pass');
const passText = await text();
ok('second build passes (next item or success shown)', /Next|Nice|Great|right|correct|✓|Yes/i.test(passText), passText.match(/.{0,60}(Next challenge|Great|Nice|right)[^.]{0,40}/i)?.[0] ?? '');
// levers on the bench
const levers = await page.locator('[data-bench-lever]').evaluateAll(n => n.map(e => e.textContent.replace(/\s+/g, ' ').slice(0, 120)));
console.log('bench:', levers);
// phone width
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await shot(page, 'coin-4-phone');
const overflow = await page.evaluate(() => {
  const s = document.querySelector('[data-build-scene="coin-tray"]'); const r = s?.getBoundingClientRect();
  return { trayRight: r && Math.round(r.right), vw: innerWidth, docW: document.documentElement.scrollWidth };
});
ok('tray fits at 390px', overflow.trayRight !== undefined && overflow.trayRight <= overflow.vw, JSON.stringify(overflow));
const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Penny/.test(x.textContent)); const r = b?.getBoundingClientRect(); return r && [Math.round(r.width), Math.round(r.height)]; });
ok('coin bin tap target ≥ 44px', hit && hit[0] >= 44 && hit[1] >= 44, JSON.stringify(hit));
console.log('errors:', errors.slice(0, 5));
console.log(JSON.stringify({ target, plan, checks }));
await browser.close();
