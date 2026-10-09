// atom-builder make_atom (open build), driven headless in the Chemistry tester (scripted path, real generation, real
// watcher). Pinned to "Make Your Own Atom (Open)" at Middle School, so the session holds four asks: outer electrons,
// a full shell, a charge, isotopes. Per item: a miss build -> the named miss words -> the build is kept -> fix -> pass.
// Watcher lines are recorded and checked against the leak rules. The card is squeezed to 360 px at the end.
// Needs next dev on :3000 and playwright-core resolvable from this file or from the working directory
// (npm install playwright-core@1.52.0 in a scratch folder, then run this file from that folder).
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';

const { chromium } = await import('playwright-core').catch(() => createRequire(`${process.cwd()}/`)('playwright-core'));
const OUT = 'C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/atom-builder-overnight/';
mkdirSync(`${OUT}shots`, { recursive: true });
const EXE = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
// The watcher's neverSay list plus verdict words; any digit or number word fails too (numbers: 'never').
const NEVER = ['full', 'ion', 'ions', 'charge', 'charged', 'neutral', 'isotope', 'isotopes', 'noble', 'negative', 'positive',
  'stable', 'valence', 'outer', 'balanced', 'extra', 'correct', 'right', 'wrong', 'done', 'ready', 'complete'];
const NUMBER = /\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|many|few|several|both|pair|single|double|half)\b/i;
const MISS = {
  shell_not_full: /outer shell of your atom is not full/, valence_off: /outermost ring/, not_neutral: /so it is not neutral/,
  still_neutral: /has no charge yet/, charge_sign: /with the wrong sign/, charge_size: /not its size/,
  need_two: /make the second one/, same_neutrons: /same isotope/, different_element: /different elements/,
  nucleus_off: /would not hold together/,
};
const checks = [], watcherLines = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail); };

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
const shot = name => page.screenshot({ path: `${OUT}shots/${name}.png` });

await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(5000);
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Chemistry', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByText('Chemistry Primitives Tester').count()) break;
}
await page.getByRole('button', { name: /Atom Builder/ }).first().click();
await page.waitForTimeout(500);
await page.locator('select').filter({ has: page.locator('option', { hasText: 'Middle School' }) }).first().selectOption({ label: 'Middle School' });
await page.locator('#chem-eval-mode').selectOption('make_atom');
const resp = page.waitForResponse(r => r.url().includes('/api/lumina') && r.request().method() === 'POST', { timeout: 180000 });
await page.getByRole('button', { name: /Generate Content/ }).click();
const body = await (await resp).json().catch(() => null);
const data = body?.data ?? body;
await page.waitForTimeout(3000);
const chs = data?.challenges ?? [];
console.log('asks', JSON.stringify(chs.map(c => c.ask)));
ok('routed: four make_atom items with code asks', chs.length === 4 && chs.every(c => c.type === 'make_atom' && c.ask));
ok('asks in order: valence, full shell, charge, isotopes', chs.map(c => c.ask?.kind).join() === 'valence,full_shell,charge,isotopes');

const scene = page.locator('svg[data-build-scene="atom"]');
const tray = page.locator('p', { hasText: 'Particle Supply' }).locator('..');
const cur = { p: 0, n: 0, e: 0 };
const IDX = { p: 0, n: 1, e: 2 };
const set = async (p, n, e) => {
  for (const [k, want] of Object.entries({ p, n, e })) {
    while (cur[k] !== want) {
      const up = want > cur[k];
      await tray.getByRole('button', { name: up ? '+' : '-', exact: true }).nth(IDX[k]).click();
      cur[k] += up ? 1 : -1;
    }
  }
  await page.waitForTimeout(250);
};
const text = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const done = async () => { await page.getByRole('button', { name: "I'm done!" }).click(); await page.waitForTimeout(700); };
const protonsDrawn = () => scene.locator('[data-atom="now"] [data-particle="proton"]').count();
const watch = async label => {
  await page.waitForTimeout(6500);
  const line = (await page.getByTestId('build-watcher').innerText().catch(() => '')).replace('👀', '').trim();
  const leaks = line ? NEVER.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(line)).concat(NUMBER.test(line) ? ['number'] : []) : [];
  watcherLines.push({ build: label, line, leaks });
};
const expectMiss = async (miss, label) => {
  await done();
  ok(`${label} -> ${miss}`, MISS[miss].test(await text()));
  ok(`${label}: build kept after the miss`, (await protonsDrawn()) === cur.p, `${await protonsDrawn()} protons drawn, ${cur.p} placed`);
};
const expectPass = async (label, nextItem = true) => {
  await done();
  ok(`${label} passes`, /Yes!/.test(await text()));
  if (nextItem) { await page.waitForTimeout(2600); cur.p = 0; cur.n = 0; cur.e = 0; ok(`${label}: next item opens empty`, (await protonsDrawn()) === 0); }
};

ok('item 1 opens empty', await scene.count() === 1 && (await protonsDrawn()) === 0);
const card = await text();
ok('no charge, mass, valence or configuration readout', !/Valence e-|Mass #|Electron Configuration/i.test(card) && !/\bCHARGE\b/.test(card));
await shot('ab-0-empty');

// Item 1: N outer electrons. The first element with k outer electrons is 2+k (k>=1 in period 2: Li..F = 3..9).
const k = chs[0]?.ask?.outer ?? 1;
const pz = 2 + k;
await set(pz + 1, pz + 1, pz + 1);
await watch('valence: one past');
await expectMiss('valence_off', 'one element past');
await shot('ab-1-valence-miss');
await set(pz, pz + 1, pz);
await expectPass('valence fixed');

// Item 2: full shell. Fluorine misses; one more proton and electron (neon) passes.
await set(9, 10, 9);
await watch('fluorine');
await expectMiss('shell_not_full', 'fluorine');
await shot('ab-2-shell-miss');
await set(10, 10, 10);
await expectPass('neon');

// Item 3: charge q, on chlorine (17 protons, 18 neutrons). Neutral, then the wrong sign, then q.
const q = chs[2]?.ask?.charge ?? -1;
await set(17, 18, 17);
await expectMiss('still_neutral', 'neutral chlorine');
await set(17, 18, 17 + Math.sign(q));
await watch('wrong sign');
await expectMiss('charge_sign', 'wrong sign');
await shot('ab-3-charge-miss');
await set(17, 18, 17 - q);
await expectPass(`charge ${q}`);

// Item 4: isotopes. Carbon without Keep, then kept twice the same, then a neutron more.
await set(6, 6, 6);
await expectMiss('need_two', 'one atom');
await page.getByRole('button', { name: 'Keep this atom' }).click();
await page.waitForTimeout(300);
ok('the kept atom is drawn in the corner', (await scene.locator('[data-kept-atom] [data-particle="proton"]').count()) === 6);
await expectMiss('same_neutrons', 'same nucleus twice');
await set(6, 7, 6);
await watch('carbon pair');
await shot('ab-4-isotopes');
await expectPass('carbon-12 and carbon-13', false);
await page.waitForTimeout(2600);
ok('session completes', /All challenges complete/.test(await text()));

ok('watcher produced lines', watcherLines.some(w => w.line), `${watcherLines.filter(w => w.line).length} of ${watcherLines.length} looks`);
ok('watcher lines pass the leak rules', watcherLines.every(w => !w.leaks.length), JSON.stringify(watcherLines));

// Phone width: the tester page is not responsive, so squeeze the primitive's card to 360 px.
await page.setViewportSize({ width: 390, height: 1000 });
const squeezed = await page.evaluate(() => {
  const svg = document.querySelector('svg[data-build-scene="atom"]') ?? document.querySelector('[data-pip-workspace]');
  let el = svg; while (el && !(el.className && String(el.className).includes('backdrop-blur-xl'))) el = el.parentElement;
  if (!el) return null;
  el.style.width = '360px'; el.style.maxWidth = '360px';
  return { scroll: el.scrollWidth - el.clientWidth };
});
await page.waitForTimeout(500);
await shot('ab-5-phone');
ok('card fits 360 px with no sideways scroll', squeezed !== null && squeezed.scroll <= 0, JSON.stringify(squeezed));
ok('no page errors', errors.filter(e => !/WebSocket|tutor|Firebase|auth|Live/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));

writeFileSync(`${OUT}drive.json`, JSON.stringify({ asks: chs.map(c => c.ask), checks, watcherLines, errors }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length}`);
await browser.close();
