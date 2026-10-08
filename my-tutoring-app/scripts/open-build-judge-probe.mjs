// Feasibility probe: "child makes the model, the tutor reads it" on structured builders.
// The child's construction is scene data (stickers / blocks), so no vision: code computes
// facts, Gemini judges an OPEN goal against them and writes one nudge naming the child's pieces.
// Usage: node scripts/open-build-judge-probe.mjs [runs=3]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';
import { pathToFileURL } from 'node:url';

const key = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m)[1].trim();
const ai = new GoogleGenAI({ apiKey: key });
const RUNS = Number(process.argv[2] || 3);
const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

// ---------- facts: world (stickers on a 0-100 canvas, y grows downward) ----------
const where = (s) => `${s.y < 34 ? 'top' : s.y < 67 ? 'middle' : 'bottom'}-${s.x < 34 ? 'left' : s.x < 67 ? 'center' : 'right'}`;
export function worldFacts({ theme, stickers }) {
  const lines = [`Theme: ${theme}.`, 'Pieces:'];
  for (const s of stickers) lines.push(`- ${s.id}: ${s.kind} at ${where(s)}`);
  const rel = [];
  for (const a of stickers) for (const b of stickers) {
    if (a === b || Math.abs(a.x - b.x) > 20) continue;
    if (a.y > b.y + 10) rel.push(`${a.id} is under ${b.id}`);
  }
  if (rel.length) lines.push('Under relations (horizontally within reach):', ...rel.map(r => `- ${r}`));
  const counts = {};
  for (const s of stickers) counts[s.kind] = (counts[s.kind] || 0) + 1;
  lines.push(`Counts: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`);
  return lines.join('\n');
}

// ---------- facts: builder (8-column grid, row 0 = ground) ----------
export const SIZE = { small: [1, 1], long: [3, 1], big: [2, 2] };
export function builderFacts({ blocks }) {
  const cell = new Map();
  for (const b of blocks) { const [w, h] = SIZE[b.kind]; for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cell.set(`${b.col + dx},${b.row + dy}`, b.id); }
  const lines = ['Pieces (columns 1-8, row 1 = ground level):'];
  for (const b of blocks) {
    const [w, h] = SIZE[b.kind];
    const below = new Set(); const gaps = [];
    for (let dx = 0; dx < w; dx++) {
      if (b.row === 0) { below.add('ground'); continue; }
      const under = cell.get(`${b.col + dx},${b.row - 1}`);
      if (under) below.add(under); else gaps.push(b.col + dx + 1);
    }
    const cols = w === 1 ? `column ${b.col + 1}` : `columns ${b.col + 1}-${b.col + w}`;
    const rows = h === 1 ? `row ${b.row + 1}` : `rows ${b.row + 1}-${b.row + h}`;
    let line = `- ${b.id}: ${b.color} ${b.kind} block, ${cols}, ${rows}, rests on ${[...below].join(' and ')}`;
    if (gaps.length) line += `; open space under it at column ${gaps.join(', ')}`;
    lines.push(line);
  }
  const heights = [];
  for (let c = 0; c < 8; c++) { let h = 0; while (cell.has(`${c},${h}`)) h++; if (h) heights.push(`column ${c + 1}: ${h}`); }
  lines.push(`Solid stack height from the ground (in small-block units): ${heights.join(', ')}.`);
  const occ = [...cell.keys()].map(k => k.split(',').map(Number));
  const xs = occ.map(([x]) => x); const mid = Math.min(...xs) + Math.max(...xs);
  const sym = occ.every(([x, y]) => cell.has(`${mid - x},${y}`));
  lines.push(`Mirror check (left half vs right half of the building): ${sym ? 'the two sides match' : 'the two sides do not match'}.`);
  return lines.join('\n');
}

// ---------- cases: open goals, several correct shapes, expected verdict + pieces that must/mustn't be flagged ----------
const W = (id, kind, x, y) => ({ id, kind, x, y });
const B = (id, kind, col, row, color = 'yellow') => ({ id, kind, col, row, color });
export const cases = [
  // W1 semantic: habitat fit
  { name: 'undersea-all-belong', goal: 'Make an undersea world where everything belongs under the sea.', world: { theme: 'undersea', stickers: [W('fish1', 'fish', 30, 40), W('fish2', 'fish', 70, 55), W('weed1', 'seaweed', 20, 85), W('weed2', 'seaweed', 80, 85)] }, expect: 'met', mustFlag: [], mustNotFlag: ['fish1', 'fish2', 'weed1', 'weed2'] },
  { name: 'undersea-user-screenshot', goal: 'Make an undersea world where everything belongs under the sea.', world: { theme: 'undersea', stickers: [W('sun1', 'sunshine sticker', 8, 12), W('fish1', 'fish', 33, 28), W('rocket1', 'rocket', 75, 15), W('heart1', 'heart', 47, 60), W('fish2', 'fish', 65, 50), W('daisy1', 'daisy', 47, 82), W('weed1', 'seaweed', 20, 85), W('weed2', 'seaweed', 85, 85)] }, expect: 'not_yet', mustFlag: ['rocket1', 'daisy1'], mustNotFlag: ['fish1', 'fish2', 'weed1', 'weed2'] },
  { name: 'undersea-land-animals', goal: 'Make an undersea world where everything belongs under the sea.', world: { theme: 'undersea', stickers: [W('bunny1', 'bunny', 30, 80), W('cat1', 'cat', 60, 80), W('tree1', 'tree', 85, 75), W('fish1', 'fish', 50, 30)] }, expect: 'not_yet', mustFlag: ['bunny1', 'cat1', 'tree1'], mustNotFlag: ['fish1'] },
  { name: 'undersea-one-fish', goal: 'Make an undersea world where everything belongs under the sea.', world: { theme: 'undersea', stickers: [W('fish1', 'fish', 50, 50)] }, expect: 'met', mustFlag: [], mustNotFlag: ['fish1'] },
  // W2 spatial + count
  { name: 'fish-under-rocket-yes', goal: 'Put 3 fish under the rocket.', world: { theme: 'space', stickers: [W('rocket1', 'rocket', 50, 10), W('fish1', 'fish', 40, 50), W('fish2', 'fish', 55, 65), W('fish3', 'fish', 48, 85)] }, expect: 'met', mustFlag: [], mustNotFlag: ['fish1', 'fish2', 'fish3', 'rocket1'] },
  { name: 'fish-one-above', goal: 'Put 3 fish under the rocket.', world: { theme: 'space', stickers: [W('fish1', 'fish', 50, 8), W('rocket1', 'rocket', 50, 35), W('fish2', 'fish', 45, 65), W('fish3', 'fish', 58, 85)] }, expect: 'not_yet', mustFlag: ['fish1'], mustNotFlag: ['fish2', 'fish3'] },
  { name: 'fish-only-two', goal: 'Put 3 fish under the rocket.', world: { theme: 'space', stickers: [W('rocket1', 'rocket', 50, 10), W('fish1', 'fish', 45, 55), W('fish2', 'fish', 55, 80)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  { name: 'fish-low-but-off-side', goal: 'Put 3 fish under the rocket.', world: { theme: 'space', stickers: [W('rocket1', 'rocket', 85, 10), W('fish1', 'fish', 10, 50), W('fish2', 'fish', 20, 70), W('fish3', 'fish', 15, 88)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  // W3 count comparison
  { name: 'more-flowers-yes', goal: 'Make a garden with more flowers than trees.', world: { theme: 'garden', stickers: [W('daisy1', 'daisy', 20, 80), W('daisy2', 'daisy', 40, 82), W('daisy3', 'daisy', 60, 80), W('tree1', 'tree', 85, 60)] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'more-flowers-equal', goal: 'Make a garden with more flowers than trees.', world: { theme: 'garden', stickers: [W('daisy1', 'daisy', 20, 80), W('daisy2', 'daisy', 40, 82), W('tree1', 'tree', 65, 60), W('tree2', 'tree', 85, 60)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  // B1 tower height, two different correct shapes
  { name: 'tower4-smalls', goal: 'Build a tower that is 4 blocks tall.', build: { blocks: [B('a', 'small', 2, 0), B('b', 'small', 2, 1), B('c', 'small', 2, 2), B('d', 'small', 2, 3)] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'tower4-big-plus-smalls', goal: 'Build a tower that is 4 blocks tall.', build: { blocks: [B('big1', 'big', 3, 0, 'blue'), B('a', 'small', 3, 2), B('b', 'small', 3, 3)] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'tower-two-short', goal: 'Build a tower that is 4 blocks tall.', build: { blocks: [B('a', 'small', 1, 0), B('b', 'small', 1, 1), B('c', 'small', 5, 0), B('d', 'small', 5, 1)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: [] },
  // B2 bridge (structural, semantic word)
  { name: 'bridge-yes', goal: 'Build a bridge that a little car could drive under.', build: { blocks: [B('p1', 'small', 1, 0, 'blue'), B('p2', 'small', 3, 0, 'blue'), B('deck', 'long', 1, 1, 'coral')] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'bridge-tall-yes', goal: 'Build a bridge that a little car could drive under.', build: { blocks: [B('p1', 'small', 1, 0), B('p2', 'small', 1, 1), B('p3', 'small', 3, 0), B('p4', 'small', 3, 1), B('deck', 'long', 1, 2, 'coral')] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'bridge-flat-on-ground', goal: 'Build a bridge that a little car could drive under.', build: { blocks: [B('deck', 'long', 2, 0, 'coral'), B('a', 'small', 2, 1)] }, expect: 'not_yet', mustFlag: ['deck'], mustNotFlag: [] },
  // B3 symmetry
  { name: 'symmetry-pyramid', goal: 'Build something that looks the same on both sides.', build: { blocks: [B('a', 'small', 2, 0), B('b', 'small', 3, 0), B('c', 'small', 4, 0), B('d', 'small', 3, 1, 'coral')] }, expect: 'met', mustFlag: [], mustNotFlag: [] },
  { name: 'symmetry-user-screenshot', goal: 'Build something that looks the same on both sides.', build: { blocks: [B('blue1', 'big', 2, 0, 'blue'), B('blue2', 'big', 4, 0, 'blue'), B('s1', 'small', 2, 2), B('s2', 'small', 4, 2), B('s3', 'small', 5, 2)] }, expect: 'not_yet', mustFlag: [], mustNotFlag: ['blue1', 'blue2'] },
];

export const SYSTEM = `You are the tutor for a 5-7 year old who BUILT something freely to meet a goal. There are many right ways; judge only the goal, never how pretty or how big it is.
You get the goal and FACTS computed from the child's building (piece ids, kinds, positions, relations). Trust the facts; do not invent pieces.
Return:
- verdict: "met" if the building meets the goal, else "not_yet".
- offPieces: ids of pieces that work against the goal (empty if none). Decorations that are neutral to the goal are NOT off.
- noticed: one short sentence naming something specific the child actually built (use the kind and where it is, e.g. "your two fish near the top").
- nudge: if not_yet, ONE short question a 5-year-old can hear that points their attention at the right piece or place WITHOUT telling them the fix. If met, an empty string.`;
export const schema = { type: Type.OBJECT, properties: {
  verdict: { type: Type.STRING, enum: ['met', 'not_yet'] },
  offPieces: { type: Type.ARRAY, items: { type: Type.STRING } },
  noticed: { type: Type.STRING }, nudge: { type: Type.STRING } },
  required: ['verdict', 'offPieces', 'noticed', 'nudge'] };

// Leak heuristic: a nudge that issues the fix as a command ("remove the rocket", "add one more fish").
export const LEAK = /\b(remove|take (away|off|out)|delete|move|add|put|replace|swap|change)\b[^?]*$/i;

async function judge(model, c) {
  const facts = c.world ? worldFacts(c.world) : builderFacts(c.build);
  const res = await ai.models.generateContent({ model, contents: `GOAL: ${c.goal}\n\nFACTS:\n${facts}`,
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 } });
  const out = JSON.parse(res.text);
  const flagged = new Set(out.offPieces);
  const checks = {
    verdict: out.verdict === c.expect,
    mustFlag: c.mustFlag.every(id => flagged.has(id)),
    mustNotFlag: c.mustNotFlag.every(id => !flagged.has(id)),
    nudgeIsQuestion: c.expect === 'met' || out.nudge.trim().endsWith('?'),
    noFixCommand: !LEAK.test(out.nudge.split('?')[0] + ' '),
  };
  return { facts, out, checks, pass: Object.values(checks).every(Boolean) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
const report = { date: new Date().toISOString(), runs: RUNS, models: {} };
for (const model of MODELS) {
  const rows = [];
  for (const c of cases) {
    const runs = await Promise.all(Array.from({ length: RUNS }, () => judge(model, c).catch(e => ({ error: String(e), pass: false, checks: {} }))));
    rows.push({ name: c.name, goal: c.goal, expect: c.expect, runs });
    console.log(`${model.padEnd(26)} ${c.name.padEnd(28)} ${runs.map(r => r.pass ? 'PASS' : 'FAIL').join(' ')}`);
  }
  const all = rows.flatMap(r => r.runs);
  const rate = (k) => `${all.filter(r => r.checks[k]).length}/${all.length}`;
  report.models[model] = { pass: `${all.filter(r => r.pass).length}/${all.length}`,
    verdict: rate('verdict'), mustFlag: rate('mustFlag'), mustNotFlag: rate('mustNotFlag'),
    nudgeIsQuestion: rate('nudgeIsQuestion'), noFixCommand: rate('noFixCommand'), rows };
  console.log(model, JSON.stringify(Object.fromEntries(Object.entries(report.models[model]).filter(([k]) => k !== 'rows'))));
}
mkdirSync(new URL('../qa/open-build/', import.meta.url), { recursive: true });
const out = new URL(`../qa/open-build/judge-probe-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log('saved', out.pathname);
}
