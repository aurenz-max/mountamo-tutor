// Layout check for a Pip surface in the real Direct Instruction Lab (headless Chromium).
// Same log, actions and checks as pipdrive.mjs; only navigation differs: it opens the DI Lab,
// selects a primitive by its family-nav short label (e.g. "Facts", "Generic"), runs the preset
// for an eval mode id (e.g. "answer_fact"), and regenerates with "Reset this run".
//   node didrive.mjs "<Short label>" "<eval_mode_id>" [width] [seconds] [actions]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [label, modeLabel = '', widthArg = '1400', secondsArg = '30', actionsArg = ''] = process.argv.slice(2);
if (!label) { console.error('usage: node pipdrive.mjs "<Primitive label>" ["<Eval mode>"] [width] [seconds] [actions]'); process.exit(2); }
const width = Number(widthArg);
const slug = (x) => x.replace(/\W+/g, '-').toLowerCase();
const out = path.join(process.env.PIP_DRIVE_OUT ?? path.join(os.tmpdir(), 'pip-drives'), `${slug(label)}-${slug(modeLabel) || 'auto'}-${width}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const needsTutor = /speak:|(^|;)start(;|$)/.test(actionsArg);

// Chromium's default fake microphone plays a tone. On a voice pack it opens a turn
// the moment the mic arms and interrupts the tutor before a word is spoken, so capture
// is fed a silent WAV instead.
const silence = path.join(out, 'silence.wav');
{
  const n = 16000 * 30; const wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(silence, wav);
}
const browser = await chromium.launch({
  executablePath: process.env.PIP_CHROME ?? 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${silence}`, '--autoplay-policy=no-user-gesture-required'],
});
// The helper sidebar is not responsive: generate at 1400, then shrink.
const context = await browser.newContext({ viewport: { width: Math.max(width, 1400), height: 1000 }, permissions: ['microphone'] });
const page = await context.newPage();
const log = [];
const note = (entry) => { log.push({ t: Date.now(), ...entry }); };
let generations = 0;
page.on('console', (m) => { if (m.type() === 'error') note({ console: m.text().slice(0, 300) }); });
page.on('pageerror', (e) => note({ pageerror: String(e).slice(0, 300) }));
page.on('response', async (r) => {
  if (r.request().method() === 'POST' && r.url().endsWith('/api/lumina')) {
    try { fs.writeFileSync(path.join(out, `generated-${++generations}.json`), JSON.stringify(await r.json(), null, 2)); } catch {}
  }
});

const frames = {};
let tutorRoute = null;
await page.routeWebSocket(/lumina-tutor/, (ws) => {
  tutorRoute = ws;
  const server = ws.connectToServer();
  server.onMessage((m) => {
    let type = 'binary';
    try { type = JSON.parse(String(m)).type ?? 'json'; } catch {}
    frames[type] = (frames[type] ?? 0) + 1;
    ws.send(m);
  });
});
// Silent 24 kHz PCM through the page's real playback path, so `isAudioPlaying` is true for its duration.
const speak = (seconds) => {
  const pcm = Buffer.alloc(Math.round(24000 * seconds) * 2);
  tutorRoute?.send(JSON.stringify({ type: 'ai_audio', data: pcm.toString('base64'), sampleRate: 24000 }));
  return tutorRoute ? true : 'no tutor socket';
};

if (needsTutor) {
  const envFile = process.env.LUMINA_ENV_FILE ?? 'C:/Users/xbox3/claude web tutor/content-pipeline/.env';
  const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);
  await page.locator('input[type="email"]').fill(env.TEST_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(env.TEST_USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/lumina/, { timeout: 60000 }).catch(() => note({ error: 'login did not redirect' }));
} else {
  await page.goto('http://localhost:3000/lumina', { waitUntil: 'domcontentloaded', timeout: 180000 });
}
await page.waitForTimeout(6000); // a click before hydration is swallowed
await page.getByText('Developer Tools').first().click();
for (let i = 0; i < 10; i++) {
  await page.getByText('Direct Instruction Lab', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.getByRole('tab', { name: 'Example library' }).count()) break;
}
// label = the primitive's short label in the family nav; modeLabel = the preset's eval mode id.
await page.locator('nav[aria-label="Direct Instruction primitives"] button', { hasText: new RegExp(`^${label}`) }).first().click();
const generate = async () => {
  if (await page.locator('[data-pip-dock]').count()) {
    await page.getByRole('button', { name: 'Reset this run' }).click();
  } else {
    await page.locator('article', { has: page.locator(`p:text-is("${modeLabel}")`) }).getByRole('button', { name: /Run this example/ }).click();
  }
  await page.waitForTimeout(500);
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => /Generating/.test(b.textContent || ''))
    && document.querySelector('[data-pip-dock]'), null, { timeout: 180000 }).catch(() => note({ error: 'generation did not finish' }));
  await page.waitForTimeout(1500);
};
await generate();
if (width < 1400) { await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(1000); }

const snapshot = () => page.evaluate(() => {
  const dock = document.querySelector('[data-pip-dock]');
  const bodies = document.querySelectorAll('[data-pip-surface-body]');
  const body = bodies[0];
  const anchor = document.querySelector('[data-primitive-instance-id]');
  const pointer = document.querySelector('[data-pip-pointing]');
  const dockRect = dock?.getBoundingClientRect();
  const objects = [...document.querySelectorAll('[data-pip-object]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute('data-pip-object'), r: [r.left, r.top, r.right, r.bottom] };
  });
  const overlaps = dockRect ? objects.filter(({ r }) => r[0] < dockRect.right && r[2] > dockRect.left
    && r[1] < dockRect.bottom && r[3] > dockRect.top).map((o) => o.id) : [];
  let pointedAt = null;
  if (pointer) {
    const cx = Number(pointer.getAttribute('data-pip-target-x')); const cy = Number(pointer.getAttribute('data-pip-target-y'));
    const id = pointer.getAttribute('data-pip-pointing');
    const hit = objects.find((o) => o.id === id);
    const inside = !!hit && cx >= hit.r[0] && cx <= hit.r[2] && cy >= hit.r[1] && cy <= hit.r[3];
    pointedAt = id + (inside ? '' : '!OFF-TARGET') + (pointer.querySelector('rect') ? '[region]' : '[ring]');
  }
  return {
    dock: dock?.getAttribute('data-pip-dock') ?? null,
    anchor: anchor?.getAttribute('data-primitive-instance-id') ?? null,
    bodies: bodies.length, inDock: !!(dock && body && dock.contains(body)),
    phase: body?.getAttribute('data-pip-phase') ?? null, gesture: body?.getAttribute('data-pip-gesture') ?? null,
    pointedAt, overlaps, objects: objects.length,
    speech: body?.querySelector('p')?.textContent?.slice(0, 120) ?? null,
    pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});

note({ beforeStart: await snapshot() });
await page.screenshot({ path: path.join(out, '00-generated.png'), fullPage: true });

const actions = actionsArg ? actionsArg.split(';') : [];
let last = '';
const deadline = Date.now() + Number(secondsArg) * 1000;
let shot = 1; let nextAction = 0;
while (Date.now() < deadline) {
  const s = await snapshot();
  const key = JSON.stringify(s);
  if (key !== last) {
    const prev = last ? JSON.parse(last) : {};
    note({ state: s }); last = key;
    if (shot < 16 && s.bodies && (prev.phase !== s.phase || prev.gesture !== s.gesture || prev.pointedAt !== s.pointedAt)) {
      const name = path.join(out, `${String(shot++).padStart(2, '0')}-${s.phase}-${s.gesture}.png`);
      if (width < 1400) await page.locator('[data-primitive-instance-id]').first().screenshot({ path: name }).catch(() => {});
      else await page.screenshot({ path: name });
    }
  }
  if (actions.length && s.bodies && Date.now() > nextAction) {
    const a = actions.shift();
    let ok;
    if (a === 'start') {
      const start = page.getByRole('button', { name: /Start lesson|Tap to start/ }).first();
      ok = await start.count() ? await start.click().then(() => true) : 'no start control';
    } else if (a.startsWith('speak:')) ok = speak(Number(a.slice(6)));
    else if (a.startsWith('wait:')) ok = true;
    else if (a.startsWith('draw:')) {
      const box = await page.locator(a.slice(5)).first().boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.2);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.4 + i * 0.015), box.y + box.height * (0.2 + i * 0.05));
        await page.mouse.up();
      }
      ok = box ? true : 'no box';
    } else {
      ok = await page.locator(a.replace(/^click:/, '')).first().click({ timeout: 2000 }).then(() => true).catch((e) => String(e).slice(0, 120));
    }
    note({ action: a, ok });
    nextAction = Date.now() + 4000;
  }
  await page.waitForTimeout(150);
}

// Regeneration must give the new board a new dock and leave exactly one body.
const before = await snapshot();
await page.setViewportSize({ width: 1400, height: 1000 });
await generate();
note({ afterRegenerate: await snapshot(), previousDock: before.dock });
await page.screenshot({ path: path.join(out, '99-after-regenerate.png') });
note({ frames });
fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log, null, 1));
await browser.close();
console.log(out);
