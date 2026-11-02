// Drive buoyancy-harbor's find_the_rule in the Physics tester (offline workspace), pinned to "Find the Rule": tests
// dropped with a guess, the things to sort wait on yellow stands, item 1 is sorted right with a size rule -> named miss
// -> Try again keeps the work -> "what it is made of" passes and drops them in; item 2 is sorted by size -> named miss
// -> fixed; the rest sorted right; finale.
// Usage: node drive-rule.mjs <outDir> [grade label]  (PW_DIR = playwright-core)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PW_DIR + '/');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const OUT = process.argv[2];
const GRADE = process.argv[3] || 'Grade 1';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText(/^Physics/).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('button', { name: /Sink or Float Harbor/ }).count()) break;
}
await page.getByRole('button', { name: /Sink or Float Harbor/ }).first().click();
await page.locator('select').first().selectOption({ label: GRADE }).catch(e => console.log('grade select:', String(e).slice(0, 120)));
await page.getByRole('button', { name: /Find the Rule/ }).first().click();
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate with AI/ }).first().click();
const data = (await (await resp).json().catch(() => null))?.data;
const items = data?.challenges ?? [];
// The model, for the drive's own choices: these stuffs float in water.
const FLOATERS = new Set(['wood', 'cork', 'foam', 'wax', 'ice']);
const call = t => (FLOATERS.has(t.material) ? 'float' : 'sink');
const bySize = t => (t.size === 'big' ? 'sink' : t.size === 'small' ? 'float' : call(t));
check('generated 4 rule items', items.length === 4 && items.every(c => c.type === 'find_the_rule'),
  items.map(c => `${c.tested.map(t => t.key).join('+')} | ${c.toSort.map(t => t.key).join('+')}`).join('; '));
await page.waitForTimeout(8000);
const scene = await page.locator('[data-harbor-scene]').first().getAttribute('data-harbor-scene').catch(() => null);
check('3D scene mounted (WebGL)', scene === '3d', `scene=${scene}`);
if (scene !== '3d') { await page.screenshot({ path: `${OUT}/0-no-scene.png`, fullPage: true }); console.log('ERRORS', errors.slice(0, 6)); await browser.close(); process.exit(1); }
await page.locator('[data-harbor-scene]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const shot = (name) => page.locator('[data-harbor-scene]').first().screenshot({ path: `${OUT}/${name}.png` });
const full = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const btn = (name) => page.getByRole('button', { name, exact: true });
const body = () => page.locator('body').innerText();
async function advance(nextInstr) {
  for (let k = 0; k < 12; k++) {
    if (nextInstr && await page.getByText(nextInstr.slice(0, 40)).count()) return true;
    const next = page.getByRole('button', { name: /^(Next|Continue)/i });
    if (await next.count()) await next.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  return nextInstr ? !!(await page.getByText(nextInstr.slice(0, 40)).count()) : true;
}
const tryAgain = async () => {
  const b = page.getByRole('button', { name: /Try again/i });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(1000);
};
const sortAs = async (c, pick) => { for (const t of c.toSort) await btn(`The ${t.name} will ${pick(t)}`).click(); };
const ruleChip = (label) => btn(`What decides it: ${label}`);

for (let i = 0; i < items.length; i++) {
  const c = items[i];
  check(`rule ${i + 1}: instruction shown`, (await page.getByText(c.instruction.slice(0, 40)).count()) > 0, c.instruction);
  check(`rule ${i + 1}: no sort before the tests are in`, (await page.getByText('What decides float or sink?').count()) === 0);
  if (i === 0) await shot('r1-pier-row');
  for (const t of c.tested) await btn(`Guess the ${t.name} will float`).click();
  await page.waitForTimeout(3500);
  if (i === 0) await shot('r2-tests-in-water');
  check(`rule ${i + 1}: notebook has each test's result`, c.tested.every(t => true) && (await body()).split(/Floated|Sank/).length - 1 >= c.tested.length);
  check(`rule ${i + 1}: things to sort still a "?"`, (await body()).includes('?'));
  if (i === 0) {
    await sortAs(c, call);
    await ruleChip('how big it is').click();
    await btn('Check').click();
    await page.waitForTimeout(1200);
    check('a size rule with a right sort is a named miss', /Your sorting is right/.test(await body()));
    await tryAgain();
    check('Try again keeps the sort', await btn(`The ${c.toSort[0].name} will ${call(c.toSort[0])}`).getAttribute('aria-pressed').catch(() => null) !== 'false');
    await ruleChip('what it is made of').click();
  } else if (i === 1 && c.toSort.some(t => bySize(t) !== call(t))) {
    await sortAs(c, bySize);
    await ruleChip('what it is made of').click();
    await btn('Check').click();
    await page.waitForTimeout(1200);
    check('sorting by size is a named miss', /Big or small did not decide it/.test(await body()));
    await tryAgain();
    await sortAs(c, call);
  } else {
    await sortAs(c, call);
    await ruleChip('what it is made of').click();
  }
  await btn('Check').click();
  await page.waitForTimeout(3500);
  if (i === 0) await shot('r3-sorted-dropped-in');
  const b = await body();
  check(`rule ${i + 1}: credited`, /What a thing is made of decides it/.test(b) || (i === items.length - 1 && /Harbor tests done!/.test(b)),
    b.match(/What a thing is made of[^\n]*/)?.[0]?.slice(0, 160) ?? '');
  if (i < items.length - 1) check(`advance to rule ${i + 2}`, await advance(items[i + 1].instruction));
}
await advance(null);
await page.waitForTimeout(2000);
check('finale shows', /Harbor tests done!|like a scientist/.test(await body()));
await full('r9-finale-page');
const real = errors.filter(e => !/favicon|Download the React DevTools|WebSocket|auth|<ellipse>|<circle>|observe-(dialogue|learner)|status of 400/i.test(e));
check('no page errors (beyond the known SVG warnings and the offline observer 400s)', real.length === 0, real.slice(0, 4).join(' | '));
console.log('BAD RESPONSES', bad);
fs.writeFileSync(`${OUT}/drive-log.json`, JSON.stringify({ grade: GRADE, bad, items: items.map(c => ({ tested: c.tested.map(t => t.key), toSort: c.toSort.map(t => t.key) })), log, errors }, null, 1));
console.log(`${log.filter(l => l.ok).length}/${log.length} passed`);
await browser.close();
