// Same open-build cases, three ways to show the child's work to Gemini:
//   facts  - code-computed relations (the probe's approach)
//   raw    - the scene JSON with a coordinate legend, no computed facts ("just ask flash")
//   vision - a rendered PNG of the scene, no ids or facts
// Usage: node scripts/open-build-judge-compare.mjs [runs=3] [model=gemini-flash-latest] [playwright-core dir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GoogleGenAI, Type } from '@google/genai';
import { cases as baseCases, worldFacts, builderFacts, SIZE, SYSTEM, LEAK } from './open-build-judge-probe.mjs';
const cases = process.argv[5] ? (await import(process.argv[5])).cases : baseCases;
const TAG = process.argv[5] ? 'hard' : 'compare';

const key = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m)[1].trim();
const ai = new GoogleGenAI({ apiKey: key });
const RUNS = Number(process.argv[2] || 3);
const MODEL = process.argv[3] || 'gemini-flash-latest';
const { chromium } = createRequire(`${process.argv[4]}/`)('playwright-core');

// ---------- renderer (stickers as emoji on a themed canvas; blocks on an 8-column grid) ----------
const EMOJI = { fish: '🐟', seaweed: '🌿', rocket: '🚀', heart: '❤️', daisy: '🌼', bunny: '🐰', cat: '🐱', tree: '🌳', 'sunshine sticker': '☀️' };
const BG = { undersea: '#8ccbd0', space: '#2d2a4a', garden: '#cfe8c0' };
const COLOR = { yellow: '#eac56f', blue: '#84b2cc', coral: '#e78a7c' };
function html(c) {
  if (c.world) {
    const s = c.world.stickers.map(p => `<div style="position:absolute;left:${p.x * 6}px;top:${p.y * 4.5}px;transform:translate(-50%,-50%);font-size:52px">${EMOJI[p.kind]}</div>`).join('');
    return `<div style="position:relative;width:600px;height:450px;background:${BG[c.world.theme]};overflow:hidden">${s}</div>`;
  }
  const cell = 60, rows = 6; let s = '';
  for (const b of c.build.blocks) { const [w, h] = SIZE[b.kind];
    s += `<div style="position:absolute;left:${b.col * cell + 2}px;top:${(rows - b.row - h) * cell + 2}px;width:${w * cell - 4}px;height:${h * cell - 4}px;background:${COLOR[b.color]};border-radius:8px"></div>`; }
  const grid = 'background-image:linear-gradient(#cfdde0 1px,transparent 1px),linear-gradient(90deg,#cfdde0 1px,transparent 1px);background-size:60px 60px;';
  return `<div style="position:relative;width:${8 * cell}px;height:${rows * cell}px;background:#e6eff1;${grid}border-bottom:16px solid #a9bf94">${s}</div>`;
}

const schema = { type: Type.OBJECT, properties: {
  verdict: { type: Type.STRING, enum: ['met', 'not_yet'] },
  offPieces: { type: Type.ARRAY, items: { type: Type.STRING } },
  noticed: { type: Type.STRING }, nudge: { type: Type.STRING } },
  required: ['verdict', 'offPieces', 'noticed', 'nudge'] };
const RAW_LEGEND = { world: 'Scene JSON. x and y run 0-100; y grows DOWNWARD (y=0 is the top).',
  build: 'Scene JSON. 8 columns, col 0 = leftmost. row 0 = ground. col,row is the bottom-left cell of a block. small = 1 wide 1 tall, long = 3 wide 1 tall, big = 2 wide 2 tall. Blocks sit on what is directly below them.' };
const VISION_NOTE = 'The FACTS are a picture of what the child built. offPieces: list the KIND of each piece that works against the goal (e.g. "rocket", "yellow small block").';

async function judge(cond, c, png) {
  const t0 = Date.now();
  let parts;
  if (cond === 'facts') parts = [{ text: `GOAL: ${c.goal}\n\nFACTS:\n${c.world ? worldFacts(c.world) : builderFacts(c.build)}` }];
  if (cond === 'raw') parts = [{ text: `GOAL: ${c.goal}\n\nFACTS (${c.world ? RAW_LEGEND.world : RAW_LEGEND.build}):\n${JSON.stringify(c.world || c.build)}` }];
  if (cond === 'vision') parts = [{ text: `GOAL: ${c.goal}\n\n${VISION_NOTE}` }, { inlineData: { mimeType: 'image/png', data: png } }];
  const res = await ai.models.generateContent({ model: MODEL, contents: [{ role: 'user', parts }],
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 } });
  const ms = Date.now() - t0; const out = JSON.parse(res.text);
  // vision has no ids: a piece counts as flagged when its kind is named (skip kinds that are both must and must-not)
  const pieces = c.world ? c.world.stickers : c.build.blocks;
  const kindOf = id => { const p = pieces.find(q => q.id === id); return c.world ? p.kind : p.kind; };
  const flaggedText = out.offPieces.join(' ').toLowerCase();
  const isFlagged = id => cond === 'vision' ? flaggedText.includes(kindOf(id).split(' ')[0]) : out.offPieces.includes(id);
  const mustKinds = new Set(c.mustFlag.map(kindOf));
  const checks = {
    verdict: out.verdict === c.expect,
    mustFlag: c.mustFlag.every(isFlagged),
    mustNotFlag: c.mustNotFlag.filter(id => cond !== 'vision' || !mustKinds.has(kindOf(id))).every(id => !isFlagged(id)),
    noFixCommand: !LEAK.test(out.nudge.split('?')[0] + ' '),
  };
  return { ms, out, checks };
}

const browser = await chromium.launch({ executablePath: 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe' });
const page = await browser.newPage();
const pngs = {};
mkdirSync(new URL('../qa/open-build/renders/', import.meta.url), { recursive: true });
for (const c of cases) {
  await page.setContent(`<body style="margin:0">${html(c)}</body>`);
  const buf = await page.locator('body > div').screenshot();
  writeFileSync(new URL(`../qa/open-build/renders/${c.name}.png`, import.meta.url), buf);
  pngs[c.name] = buf.toString('base64');
}
await browser.close();

const report = { date: new Date().toISOString(), model: MODEL, runs: RUNS, conditions: {} };
for (const cond of ['facts', 'raw', 'vision']) {
  const rows = [];
  for (const c of cases) {
    const runs = await Promise.all(Array.from({ length: RUNS }, () => judge(cond, c, pngs[c.name]).catch(e => ({ error: String(e), checks: {}, ms: 0 }))));
    rows.push({ name: c.name, runs });
    console.log(`${cond.padEnd(7)} ${c.name.padEnd(28)} ${runs.map(r => r.checks.verdict ? 'ok' : 'XX').join(' ')}  ${runs.map(r => r.ms).join('/')}ms`);
  }
  const all = rows.flatMap(r => r.runs);
  const rate = k => `${all.filter(r => r.checks[k]).length}/${all.length}`;
  const ms = all.map(r => r.ms).sort((a, b) => a - b);
  report.conditions[cond] = { verdict: rate('verdict'), mustFlag: rate('mustFlag'), mustNotFlag: rate('mustNotFlag'),
    noFixCommand: rate('noFixCommand'), medianMs: ms[ms.length >> 1], rows };
  console.log(cond, JSON.stringify(Object.fromEntries(Object.entries(report.conditions[cond]).filter(([k]) => k !== 'rows'))));
}
writeFileSync(new URL(`../qa/open-build/judge-${TAG}-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url), JSON.stringify(report, null, 2));
