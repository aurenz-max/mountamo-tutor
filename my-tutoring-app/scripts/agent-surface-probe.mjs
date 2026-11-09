// Probe: can an agent assemble pedagogically sound items from generic surfaces (choose / categorize / order) and
// displays (svg, bar graph, number line, table, text), given only a manifest-style objective?
// For each objective the author writes one easy, one medium and one hard item. Code renders each item as the child
// would see it (no key), screenshots it, and a blind solver answers from the picture alone and rates difficulty.
// Usage: node scripts/agent-surface-probe.mjs [--cases=a,b] [--out=name]
// Writes qa/agent-surfaces/<out>/results.json + PNGs. Every call goes through the metered client.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const PW = process.env.PLAYWRIGHT_CORE ?? 'C:/Users/xbox3/AppData/Local/Temp/claude/bd44a33f9b494d15/5fd5802b-8121-42f6-9a42-8dd4dee1a9b5/scratchpad/node_modules/playwright-core';
const CHROME = 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
const MODEL = 'gemini-flash-latest';

const CASES = {
  'g1-monarch-inherit': { topic: 'Monarch butterflies', grade: '1', intent: '1-LS3-1: young animals are like, but not exactly like, their parents.' },
  'k-compare-10': { topic: 'Comparing numbers', grade: 'K', intent: 'K.CC.C.6: tell whether the number of objects in one group is greater than, less than, or equal to another group (up to 10).' },
  'g2-bar-graph': { topic: 'Bar graphs', grade: '2', intent: '2.MD.D.10: read a bar graph with up to four categories and solve put-together, take-apart and compare problems using it.' },
  'g3-frac-line': { topic: 'Fractions on a number line', grade: '3', intent: '3.NF.A.2: place and recognize fractions like 1/4, 2/3, 3/4 on a number line from 0 to 1.' },
  'g2-materials': { topic: 'Properties of materials', grade: '2', intent: '2-PS1-1: sort materials by observable properties (hard or soft, bendy or stiff, see-through or not).' },
  'g1-story-order': { topic: 'Retelling a story', grade: '1', intent: 'RL.1.2: retell a short story in order, beginning, middle and end.' },
};
const selected = arg('cases', Object.keys(CASES).join(',')).split(',');
/** Revise rounds: the author sees each item's render and the check notes, then rewrites (0 = single shot, v1). */
const ROUNDS = Number(arg('rounds', '0'));
const REVISE = ROUNDS > 0;
const outDir = resolve('qa/agent-surfaces', arg('out', new Date().toISOString().slice(0, 10)));
mkdirSync(outDir, { recursive: true });

// ── Prompts ──────────────────────────────────────────────────────────────────

const CAPABILITIES = `You assemble learning items from generic parts. Pick, for each item, whatever parts teach the objective best.

ANSWER SURFACES (what the child does):
- choose: pick the one right option. options: 2-4.
- categorize: put each option into one of 2-3 categories.
- order: put the options in the right order (3-5 options).

DISPLAYS (what the child sees). A display is an object {kind, ...}:
- {kind:"svg", svg:"<svg viewBox='0 0 200 200' ...>...</svg>"}  a picture you draw. Self-contained SVG, no scripts, no external images, no text that gives the answer away.
- {kind:"bar_graph", title, y_label, labels:[...], values:[numbers]}  code draws it.
- {kind:"number_line", min, max, step, marks:[{value, label}]}  code draws it. A mark labeled "?" is the point asked about. Values may be fractions as decimals.
- {kind:"table", headers:[...], rows:[[...]]}
- {kind:"text", text}  short text (keep it minimal for K-1; the tutor reads it aloud).

An item: {
  tier: "easy"|"medium"|"hard",
  difficulty_reasons: "what makes it this hard, structurally",
  surface: "choose"|"categorize"|"order",
  prompt: "what the tutor asks the child (never the answer)",
  stimulus: [displays shown above the options, may be empty],
  options: [{id, label?, display?}]  each option is a card: a label, a display, or both,
  categories: [names]  (categorize only),
  key: choose: option id | order: [option ids in order] | categorize: {optionId: category name},
  misconceptions: {optionId: "the wrong idea that picks this"}  (for each wrong option),
  help: "what changes on screen to help (not words alone)",
  simplify: {remove_options:[ids], note}  the same task, simpler,
  why: "why this item teaches the objective"
}`;

function authorPrompt(c) {
  return `${CAPABILITIES}

Lesson objective (from the curriculum and the lesson plan):
- Topic: ${c.topic}
- Grade: ${c.grade}
- Objective: ${c.intent}

Write THREE items for this objective: one easy, one medium, one hard. Use the surface and displays that fit each item best; they need not be the same across items. Pedagogy rules: the child must use the skill to succeed (no answer in the prompt or labels, no option drawn differently or more carefully than the others, no odd-one-out), wrong options come from real misconceptions, facts are true, and words suit the grade. Pictures you draw must be clear enough for a child to tell the options apart by the feature that matters.${REVISE ? `
When the content is data (counts, values, positions on a line, a table), use a code-drawn display (bar_graph, number_line, table), including inside option cards, rather than drawing it yourself.
Difficulty comes from structure (closer wrong options, a misconception trap, more steps, a less familiar case), never from more reading.` : ''}

Return JSON: {"objective_read": "what the child must understand or do", "items": [item, item, item]}`;
}

function solverPrompt(c, item, letters) {
  const how = item.surface === 'choose' ? 'answer: one card number'
    : item.surface === 'order' ? 'answer: the card numbers in order, as an array'
    : `answer: an object mapping each card number to one of these categories: ${JSON.stringify(item.categories)}`;
  return `You are checking a learning item for a grade ${c.grade} child. The image shows exactly what the child sees. The tutor says: "${item.prompt}"
The option cards are tagged ${letters.map(l => `Card ${l}`).join(', ')}.
Solve it from the image. Then judge it.
Return JSON: {"${how.split(':')[0]}": ..., "confidence": 0-1, "difficulty_for_grade": "easy"|"medium"|"hard", "shortcut": "how a child could get it right WITHOUT the skill (position, odd one out, one picture more detailed, the prompt gives it away), or null", "issues": "anything wrong: false facts, ambiguous pictures, two right answers, unreadable drawing, or null"}
(${how})`;
}

// ── Render (what the child sees; never the key) ──────────────────────────────

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const cleanSvg = s => String(s ?? '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');

function barGraph(d) {
  const labels = d.labels ?? [], values = (d.values ?? []).map(Number);
  const max = Math.max(1, ...values), top = Math.ceil(max / (max > 10 ? 5 : 1)) * (max > 10 ? 5 : 1);
  const W = 360, H = 220, L = 40, B = 40, T = 24, step = top > 10 ? 5 : 1;
  const bw = (W - L - 10) / Math.max(1, labels.length);
  let g = `<svg viewBox="0 0 ${W} ${H}" width="360"><text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="600">${esc(d.title)}</text>`;
  for (let v = 0; v <= top; v += step) {
    const y = H - B - (v / top) * (H - B - T);
    g += `<line x1="${L}" x2="${W - 10}" y1="${y}" y2="${y}" stroke="#ddd"/><text x="${L - 6}" y="${y + 4}" font-size="10" text-anchor="end">${v}</text>`;
  }
  labels.forEach((l, i) => {
    const h = (values[i] / top) * (H - B - T), x = L + i * bw + bw * 0.2;
    g += `<rect x="${x}" y="${H - B - h}" width="${bw * 0.6}" height="${h}" fill="#5b8def"/><text x="${x + bw * 0.3}" y="${H - B + 14}" font-size="11" text-anchor="middle">${esc(l)}</text>`;
  });
  return `${g}<text x="12" y="${H / 2}" font-size="10" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">${esc(d.y_label)}</text></svg>`;
}

function numberLine(d) {
  const min = Number(d.min ?? 0), max = Number(d.max ?? 1), step = Number(d.step) || (max - min) / 4;
  const W = 380, L = 20, R = W - 20, y = 50, x = v => L + ((v - min) / (max - min)) * (R - L);
  let g = `<svg viewBox="0 0 ${W} 90" width="380"><line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#333" stroke-width="2"/>`;
  for (let v = min, i = 0; v <= max + 1e-9 && i < 60; v += step, i++) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${y - 7}" y2="${y + 7}" stroke="#333"/>`;
  for (const m of d.marks ?? []) {
    const q = String(m.label) === '?';
    g += `<circle cx="${x(Number(m.value))}" cy="${y}" r="5" fill="${q ? '#e4572e' : '#333'}"/><text x="${x(Number(m.value))}" y="${y + 26}" font-size="13" text-anchor="middle">${esc(m.label)}</text>`;
  }
  return `${g}</svg>`;
}

function display(d) {
  if (!d || typeof d !== 'object') return '';
  switch (d.kind) {
    case 'svg': return `<div class="svg">${cleanSvg(d.svg)}</div>`;
    case 'bar_graph': return barGraph(d);
    case 'number_line': return numberLine(d);
    case 'table': return `<table><tr>${(d.headers ?? []).map(h => `<th>${esc(h)}</th>`).join('')}</tr>${(d.rows ?? []).map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`;
    case 'text': return `<p class="text">${esc(d.text)}</p>`;
    default: return `<p class="text">[unknown display ${esc(d.kind)}]</p>`;
  }
}

/** Options in a seeded shuffle, so the author's order (often the key for order items) is not what the child sees. */
function shuffled(item, seed) {
  // The order the answer is in (an order key, or categorize options in category order) is never the order shown.
  const keyOrder = item.surface === 'order' ? item.key
    : item.surface === 'categorize' ? [...(item.options ?? [])].sort((x, y) => (item.categories ?? []).indexOf(item.key?.[x.id]) - (item.categories ?? []).indexOf(item.key?.[y.id])).map(o => o.id)
    : null;
  let s = seed, a;
  for (let tries = 0; tries < 20; tries++) {
    a = [...(item.options ?? [])];
    for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    if (!keyOrder || a.length < 2 || JSON.stringify(a.map(o => o.id)) !== JSON.stringify(keyOrder)) break;
  }
  return a;
}

export const CHILD_CSS = `body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#222;width:760px}
.prompt{font-size:18px;font-weight:600;margin:0 0 12px}.stim{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;align-items:flex-start}
.opts{display:flex;flex-wrap:wrap;gap:12px}.card{border:2px solid #ccc;border-radius:12px;padding:8px;width:170px;text-align:center}
.card .tag{font-weight:700;color:#555}.svg svg{width:150px;height:150px}.stim .svg svg{width:200px;height:200px}
table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 10px}.text{max-width:700px;font-size:15px;margin:0}
.cats{display:flex;gap:12px;margin-top:14px}.cat{border:2px dashed #999;border-radius:12px;padding:10px 18px;min-width:120px;text-align:center}`;

export function childHtml(item, seed) {
  const opts = shuffled(item, seed), letters = opts.map((_, i) => String(i + 1));
  const body = `<p class="prompt">${esc(item.prompt)}</p>
<div class="stim">${(item.stimulus ?? []).map(display).join('')}</div>
<div class="opts">${opts.map((o, i) => `<div class="card"><div class="tag">Card ${letters[i]}</div>${o.display ? display(o.display) : ''}${o.label ? `<div>${esc(o.label)}</div>` : ''}</div>`).join('')}</div>
${item.surface === 'categorize' ? `<div class="cats">${(item.categories ?? []).map(c => `<div class="cat">${esc(c)}</div>`).join('')}</div>` : ''}`;
  return { body, opts, letters };
}

// ── Grade the blind solve against the author's key ───────────────────────────

function agrees(item, opts, letters, ans) {
  const tag = l => String(l).replace(/card/i, '').trim();
  const idOf = l => opts[letters.indexOf(tag(l))]?.id;
  if (item.surface === 'choose') return idOf(ans) === item.key;
  if (item.surface === 'order') return Array.isArray(ans) && JSON.stringify(ans.map(idOf)) === JSON.stringify(item.key);
  if (item.surface === 'categorize') {
    if (!ans || typeof ans !== 'object') return false;
    const byTag = Object.fromEntries(Object.entries(ans).map(([k, v]) => [tag(k), v]));
    return opts.every((o, i) => String(byTag[letters[i]] ?? '').toLowerCase() === String(item.key?.[o.id] ?? '').toLowerCase());
  }
  return false;
}

/** The solver's answer in the author's option ids, for feedback. */
function answerIds(item, opts, letters, ans) {
  const tag = l => String(l).replace(/card/i, '').trim();
  const idOf = l => opts[letters.indexOf(tag(l))]?.id ?? String(l);
  if (Array.isArray(ans)) return ans.map(idOf);
  if (ans && typeof ans === 'object') return Object.fromEntries(Object.entries(ans).map(([k, v]) => [idOf(k), v]));
  return idOf(ans);
}

// ── Code checks: shortcuts code can see without a model ──────────────────────

const SEQ = /\b(first|next|then|after that|finally|at last|last|in the end|at the end)\b/gi;
function codeChecks(item) {
  const flags = [];
  const opts = item.options ?? [];
  const texts = (item.stimulus ?? []).filter(d => d.kind === 'text').map(d => String(d.text)).join(' ') + ' ' + String(item.prompt ?? '');
  if (item.surface === 'order' && (texts.match(SEQ) ?? []).length >= 2)
    flags.push('the text the child hears uses sequence words (first, next, then...), so it gives the order without the child retelling or reasoning');
  const kinds = opts.map(o => o.display?.kind ?? 'none');
  const lone = [...new Set(kinds)].filter(k => kinds.filter(x => x === k).length === 1);
  if (opts.length >= 3 && lone.length === 1) flags.push(`one option is drawn as "${lone[0]}" and the rest are not: an odd one out`);
  if (item.surface === 'choose') {
    const size = o => (o.display?.kind === 'svg' ? String(o.display.svg).length : 0) + String(o.label ?? '').length * 8;
    const right = opts.find(o => o.id === item.key), others = opts.filter(o => o !== right);
    const mean = others.reduce((s, o) => s + size(o), 0) / Math.max(1, others.length);
    if (right && mean > 0 && size(right) > 1.6 * mean) flags.push('the right option is drawn or written in much more detail than the others');
    if (right && mean > 0 && size(right) < 0.5 * mean) flags.push('the right option is drawn or written much more simply than the others (odd one out)');
  }
  const words = s => new Set(String(s ?? '').toLowerCase().match(/[a-z]{4,}/g) ?? []);
  if (item.surface === 'categorize') for (const o of opts) {
    const cat = item.key?.[o.id], lw = words(o.label);
    if (cat && [...words(cat)].some(w => lw.has(w))) flags.push(`option "${o.label}" shares a word with its category "${cat}"`);
  }
  return flags;
}

// ── Run ──────────────────────────────────────────────────────────────────────

const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const require = createRequire(import.meta.url);
const { chromium } = require(PW);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await loader.import('/src/components/lumina/service/spend/spendMeter.ts');
  let usd = 0;
  const gen = async (contents) => {
    const res = await ai.models.generateContent({ model: MODEL, contents, config: { responseMimeType: 'application/json' } });
    usd += priceCall(MODEL, res?.usageMetadata);
    return { json: JSON.parse(res.text), content: res.candidates?.[0]?.content };
  };
  const nil = v => (v == null || /^(null|none|n\/a)?$/i.test(String(v).trim()) ? null : v);

  /** Run one item the way a child meets it: render, screenshot, blind solve, code checks. */
  async function evaluate(id, c, item, n, round) {
    const seed = 7 + n * 31 + id.length + round * 101;
    const { body, opts, letters } = childHtml(item, seed);
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><html><head><style>${CHILD_CSS}</style></head><body>${body}</body></html>`);
    const png = await page.screenshot({ fullPage: true });
    await page.close();
    writeFileSync(resolve(outDir, `${id}-r${round}-${n}.png`), png);
    let solved;
    try {
      solved = (await gen([{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }, { text: solverPrompt(c, item, letters) }] }])).json;
    } catch (e) { solved = { error: e.message }; }
    solved.shortcut = nil(solved.shortcut); solved.issues = nil(solved.issues);
    const agree = agrees(item, opts, letters, solved.answer);
    const flags = codeChecks(item);
    const tierOk = solved.difficulty_for_grade === item.tier;
    const problems = [
      ...flags.map(f => `code check: ${f}`),
      ...(agree ? [] : [`a careful solver who saw only the screen answered ${JSON.stringify(answerIds(item, opts, letters, solved.answer))}, but your key is ${JSON.stringify(item.key)}. The screen may not show the feature that decides it, or two answers fit.`]),
      ...(solved.shortcut ? [`shortcut: ${solved.shortcut}`] : []),
      ...(solved.issues ? [`issue: ${solved.issues}`] : []),
      ...(tierOk ? [] : [`you marked it ${item.tier}; a solver rated it ${solved.difficulty_for_grade} for grade ${c.grade}. Reach ${item.tier} through structure, not more reading.`]),
    ];
    return { item, seed, letters, shownOrder: opts.map(o => o.id), solved, agree, flags, tierOk, problems, png };
  }

  const results = await Promise.all(selected.map(id => withSpendSource('harness', 'agent-surface-probe', async () => {
    const c = CASES[id];
    const t0 = Date.now();
    const history = [{ role: 'user', parts: [{ text: authorPrompt(c) }] }];
    const rounds = [];
    let authored;
    try {
      const first = await gen(history);
      authored = first.json; history.push(first.content ?? { role: 'model', parts: [{ text: JSON.stringify(authored) }] });
    } catch (e) { return { id, case: c, error: `author: ${e.message}` }; }
    for (let round = 0; ; round++) {
      const evals = await Promise.all((authored.items ?? []).map((item, n) => evaluate(id, c, item, n, round)));
      rounds.push(evals);
      if (round >= ROUNDS || evals.every(e => !e.problems.length)) break;
      const parts = [{ text: 'Here is each item as the child sees it, with what the checks found. Revise every item that has problems; keep the items that pass unchanged. Keep each item\'s tier. Return the same JSON shape with all three items.' }];
      evals.forEach((e, n) => {
        parts.push({ text: `\nItem ${n} (${e.item.tier}, ${e.item.surface}): ${e.problems.length ? e.problems.map(p => `\n- ${p}`).join('') : 'passes; keep it.'}` });
        parts.push({ inlineData: { mimeType: 'image/png', data: e.png.toString('base64') } });
      });
      history.push({ role: 'user', parts });
      try {
        const next = await gen(history);
        authored = next.json; history.push(next.content ?? { role: 'model', parts: [{ text: JSON.stringify(authored) }] });
      } catch (e) { break; }
    }
    const strip = evals => evals.map(({ png: _png, ...e }) => e);
    return { id, case: c, objective_read: authored.objective_read, ms: Date.now() - t0, rounds: rounds.map(strip), items: strip(rounds.at(-1)) };
  })));
  writeFileSync(resolve(outDir, 'results.json'), JSON.stringify({ model: MODEL, rounds: ROUNDS, usd, results }, null, 2));
  for (const r of results) {
    if (r.error) { process.stdout.write(`${r.id}: ${r.error}\n`); continue; }
    r.rounds.forEach((evals, round) => evals.forEach((x, n) => process.stdout.write(`${r.id} r${round}#${n} ${x.item.tier}->${x.solved.difficulty_for_grade} ${x.item.surface} [${(x.item.stimulus ?? []).map(d => d.kind).concat((x.item.options ?? []).filter(o => o.display).map(o => `opt:${o.display.kind}`)).join(',')}] agree=${x.agree}${x.solved.shortcut ? ' SHORTCUT' : ''}${x.solved.issues ? ' ISSUE' : ''}${x.flags.length ? ' CODEFLAG' : ''}\n`)));
  }
  process.stdout.write(`spend $${usd.toFixed(3)} -> ${outDir}\n`);
} finally {
  await browser.close();
  await server.close();
}
