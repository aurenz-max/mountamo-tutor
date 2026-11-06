// Benchmarks di-spoken-practice explain_concept generation: the production pipeline ("rails")
// against an agent harness (one model, code gates and the semantic review as tools, loops until
// its items pass). Same objectives, same independent judge, per-run wall time and spend.
//   node scripts/di-explain-harness-bench.mjs --run --harness rails|agent [--reps 2] [--tag name]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
if (!process.argv.includes('--run')) { console.log('Pass --run --harness rails|agent'); process.exit(0); }
const HARNESS = arg('harness', 'rails');
const REPS = Number(arg('reps', '2'));
const TAG = arg('tag', HARNESS);
const ONLY = arg('only', '');
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
const print = console.log.bind(console);
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(clean(format(...a)));

const CASES = [
  { id: 'skid', topic: 'Skid Steers', gradeLevel: 'elementary',
    objectiveText: 'Explain how skid steers turn in tight spaces by locking their wheels',
    intent: 'Have students answer guided questions with the spoken tutor, explaining in their own words what happens when the left wheels roll forward while the right wheels lock or spin backward in place.' },
  { id: 'equal', topic: 'The equal sign', gradeLevel: 'grade 1',
    objectiveText: 'Explain what the equal sign means', intent: 'The child says in their own words what = tells us in a number sentence.' },
  { id: 'pattern', topic: 'Growing patterns', gradeLevel: 'grade 1',
    objectiveText: 'Describe the rule of a growing number pattern', intent: 'The child looks at a number pattern and says its rule.' },
  { id: 'choice', topic: 'Needs, wants and choices', gradeLevel: 'grade 1',
    objectiveText: 'Explain why a choice is wise when you only have enough money for one thing', intent: 'The child picks between two things and says why.' },
  { id: 'plants', topic: 'What plants need', gradeLevel: 'kindergarten',
    objectiveText: 'Explain why plants need sunlight and water to grow', intent: 'The child sees a plant in a situation and says why it is growing well or poorly.' },
].filter((c) => !ONLY || ONLY.split(',').includes(c.id));
const COUNT = 4;
const AGENT_MODEL = arg('model', 'gemini-flash-latest');
const JUDGE_MODEL = 'gemini-flash-latest';
const MAX_TURNS = 8;

const root = process.cwd();
const out = resolve(root, 'qa/di-bench/harness-bench-2026-11-04');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const L = '/src/components/lumina';
let results = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import(`${L}/service/geminiClient.ts`);
  const { withSpendSource } = await loader.import(`${L}/service/spend/spendMeter.ts`);
  const gen = await loader.import(`${L}/service/direct-instruction/gemini-di-spoken-practice.ts`);
  const script = await loader.import(`${L}/primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts`);
  const { Type } = await import('@google/genai');

  // ── The agent harness ────────────────────────────────────────────────────
  const build = (raws) => raws.map((r, i) => script.buildSpokenItem(r, i, 'explain_concept'));
  const check = (raws) => {
    const built = build(raws);
    const real = built.filter(Boolean);
    const gate = script.gateSpokenItems(real);
    const perItem = raws.map((_, i) => {
      const item = built[i];
      if (!item) return { index: i, ok: false, problems: ['unusable: needs stimulusText, ask, and an expectedAnswer anchor of 1-4 words that is not a word of the ask'] };
      const why = gate.reasons[item.id];
      return why ? { index: i, ok: false, problems: why } : { index: i, ok: true };
    });
    const instances = new Set(gate.kept.map((k) => k.stimulusText.trim().toLowerCase()));
    return { perItem, passing: gate.kept.length, distinctInstances: instances.size, kept: gate.kept };
  };
  const itemProps = {
    stimulusText: { type: Type.STRING, description: 'The instance on screen: an equation, a pattern, or a 4-14 word everyday scene.' },
    stimulusEmoji: { type: Type.STRING, description: 'One emoji when a picture IS the instance, else empty.' },
    ask: { type: Type.STRING, description: 'Says the instance aloud, then asks a bare what/why question. Never states the idea or any anchor.' },
    conceptStatement: { type: Type.STRING, description: 'The idea for this instance, ONE true sentence, 4-12 words.' },
    expectedAnswer: { type: Type.STRING, description: 'Shortest correct wording of the idea, 1-4 words. Not a word of the ask, not the instance read back.' },
    alsoAccept: { type: Type.STRING, description: '1-2 more short wordings, comma-separated.' },
    acceptRule: { type: Type.STRING, description: 'Wordings that count without the anchor words.' },
    signatureError: { type: Type.STRING, description: 'True-but-not-an-explanation answers and the common misconception.' },
    correctionBody: { type: Type.STRING, description: 'Re-teach in 1-2 sentences. Not starting with Yes or My turn; no question.' },
  };
  const itemsParam = { type: Type.OBJECT, properties: {
    title: { type: Type.STRING },
    items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: itemProps,
      required: ['stimulusText', 'ask', 'conceptStatement', 'expectedAnswer', 'alsoAccept', 'correctionBody'] } },
  }, required: ['items'] };
  const tools = [{ functionDeclarations: [
    { name: 'check_items', description: 'Run the code contract over draft items. Returns per-item problems. Free and instant.', parameters: itemsParam },
    { name: 'review_items', description: 'Independent reviewer: is each idea true and what the objective asks, does each anchor mean it, does the ask give it away. Slow; call once on items that pass check_items.', parameters: itemsParam },
    { name: 'submit', description: `Ship the session. Accepted only when at least ${COUNT} items pass check_items with distinct instances.`, parameters: itemsParam },
  ] }];
  const system = `You write spoken Direct Instruction EXPLAIN practice for young children. A live voice tutor says your "ask", the child answers ALOUD in their own words (up to ten words), and a judge who holds conceptStatement decides by meaning.
Write ${COUNT} items. Each shows ONE different instance and asks the child what it means, what rule it follows, or why. Rules:
- The ask says the instance aloud, then asks the bare question. It never states, hints or half-states the idea, and contains no anchor wording.
- When the objective names one idea (how a machine turns, what = means, why plants need light), every item is a different instance of that SAME idea; keep conceptStatement and the anchors identical across items. When the idea varies per instance (the rule of each pattern, the reason for each choice), each item has its own.
- conceptStatement must be TRUE. If the objective's wording is factually off, teach the true idea closest to it.
- Anchors are short examples for the judge, not required wording; never the instance read back, never a word of the ask.
- For a choice, the scene names both options neutrally and the ask asks which AND why; the anchor is the reason only.
Work fast: draft all items, call check_items, fix what it reports, call review_items once, fix or replace what it rejects, then submit. Spare items are fine: submit can carry more than ${COUNT}.`;

  async function runAgent(c) {
    const contents = [{ role: 'user', parts: [{ text: `TOPIC: ${c.topic}\nGRADE: ${c.gradeLevel}\nOBJECTIVE: ${c.objectiveText}\nSLOT INTENT: ${c.intent}` }] }];
    const trace = [];
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await ai.models.generateContent({ model: AGENT_MODEL, contents,
        config: { systemInstruction: system, tools, toolConfig: { functionCallingConfig: { mode: 'ANY' } }, httpOptions: { timeout: 90000 } } });
      const content = res.candidates?.[0]?.content;
      const calls = res.functionCalls ?? [];
      if (!content || !calls.length) { trace.push({ turn, error: 'no tool call' }); break; }
      contents.push(content);
      const responses = [];
      for (const call of calls) {
        const raws = Array.isArray(call.args?.items) ? call.args.items : [];
        const checked = check(raws);
        if (call.name === 'submit') {
          trace.push({ turn, tool: 'submit', drafted: raws.length, passing: checked.passing });
          if (checked.passing >= COUNT && checked.distinctInstances === checked.passing) {
            const items = checked.kept.slice(0, COUNT).map((it, i) => ({ ...it, id: `dsp-${i + 1}` }));
            return { data: { title: call.args.title || 'Say Why', items }, trace, turns: turn + 1 };
          }
          responses.push({ name: call.name, response: { accepted: false, ...strip(checked) } });
        } else if (call.name === 'review_items') {
          const verdict = await gen.reviewConceptItems(checked.kept, { topic: c.topic, gradeLevel: c.gradeLevel, objectiveText: c.objectiveText, intent: c.intent });
          const idToIndex = Object.fromEntries(build(raws).map((b, i) => [b?.id, i]).filter(([k]) => k));
          trace.push({ turn, tool: 'review', passing: checked.passing, rejected: verdict.rejected.length });
          responses.push({ name: call.name, response: { rejectedIndexes: verdict.rejected.map((id) => idToIndex[id]), reason: verdict.reason, ...strip(checked) } });
        } else {
          trace.push({ turn, tool: 'check', drafted: raws.length, passing: checked.passing });
          responses.push({ name: call.name, response: strip(checked) });
        }
      }
      contents.push({ role: 'user', parts: responses.map((r) => ({ functionResponse: r })) });
    }
    return { data: { title: '', items: [] }, trace, turns: MAX_TURNS };
  }
  const strip = (checked) => ({ perItem: checked.perItem, passing: checked.passing, distinctInstances: checked.distinctInstances });

  // ── The independent judge (same for every harness) ───────────────────────
  async function judge(c, items, tries = 3) {
    if (!items.length) return { accepted: 0, notes: 'empty' };
    try { return await judgeOnce(c, items); } catch (e) {
      if (tries > 1) return judge(c, items, tries - 1);
      return { accepted: -1, notes: `judge failed: ${clean(e?.message ?? e)}` };
    }
  }
  async function judgeOnce(c, items) {
    const res = await ai.models.generateContent({ model: JUDGE_MODEL,
      contents: `You audit spoken explain-practice items for a ${c.gradeLevel} child. OBJECTIVE: "${c.objectiveText}".
ITEMS: ${JSON.stringify(items.map((i) => ({ id: i.id, instance: i.stimulusText, ask: i.ask, idea: i.conceptStatement, anchors: [i.expectedAnswer, ...(i.alternates ?? [])] })))}
For each item answer pass=true only if ALL hold: (1) the idea is factually true and is what the objective wants explained (a correction of a wrong premise in the objective is fine); (2) the ask does not state or give away the idea; (3) a child who says an anchor has shown that understanding; (4) a child of this age could answer aloud in a few words. Also say whether the instances are all different. Be strict but fair.`,
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: {
        items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, pass: { type: Type.BOOLEAN }, why: { type: Type.STRING } }, required: ['id', 'pass', 'why'] } },
        instancesDistinct: { type: Type.BOOLEAN },
      }, required: ['items', 'instancesDistinct'] }, httpOptions: { timeout: 60000 } } });
    const v = JSON.parse(res.text || '{}');
    return { accepted: (v.items ?? []).filter((x) => x.pass).length, distinct: v.instancesDistinct, notes: v.items };
  }

  const ledger = () => {
    const d = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
    const f = join(root, '..', '.gemini-spend', `${d}.jsonl`);
    const alt = join(root, '.gemini-spend', `${d}.jsonl`);
    const file = existsSync(f) ? f : alt;
    return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  };

  const runOne = async (c, rep) => {
    const label = `bench:${TAG}:${c.id}:${rep}`;
    const t0 = Date.now();
    let data, extra = {};
    try {
      if (HARNESS === 'agent') { const r = await withSpendSource('harness', label, () => runAgent(c)); data = r.data; extra = { turns: r.turns, trace: r.trace }; }
      else data = await withSpendSource('harness', label, () => gen.generateDiSpokenPractice(c.topic, c.gradeLevel,
        { objectiveText: c.objectiveText, intent: c.intent, targetEvalMode: 'explain_concept', challengeCount: COUNT }));
    } catch (e) { data = { items: [] }; extra.error = clean(e?.message ?? e); }
    const ms = Date.now() - t0;
    const verdict = await withSpendSource('harness', `bench:judge:${TAG}`, () => judge(c, data.items ?? []));
    const usd = ledger().filter((r) => r.label === label).reduce((s, r) => s + r.usd, 0);
    const row = { case: c.id, rep, harness: TAG, seconds: Math.round(ms / 100) / 10, shipped: data.items?.length ?? 0,
      judged: verdict.accepted, distinct: verdict.distinct, usd: Number(usd.toFixed(4)), ...extra,
      items: (data.items ?? []).map((i) => ({ instance: i.stimulusText, ask: i.ask, idea: i.conceptStatement, anchors: [i.expectedAnswer, ...(i.alternates ?? [])] })),
      judgeNotes: verdict.notes };
    print(`${TAG} ${c.id}#${rep}: ${row.seconds}s shipped ${row.shipped} judged ${row.judged} $${row.usd}${extra.turns ? ` turns ${extra.turns}` : ''}${extra.error ? ` ERROR ${extra.error}` : ''}`);
    return row;
  };
  const jobs = [];
  for (let rep = 1; rep <= REPS; rep++) for (const c of CASES) jobs.push(runOne(c, rep));
  results = await Promise.all(jobs);
} finally {
  await server.close();
  writeFileSync(join(out, `${TAG}.json`), JSON.stringify({ results, logs }, null, 2));
}
const ok = results.filter((r) => r.shipped >= 3);
const sum = (k, rs = results) => rs.reduce((s, r) => s + r[k], 0);
const sec = results.map((r) => r.seconds).sort((a, b) => a - b);
print(`\n${TAG}: ${ok.length}/${results.length} sessions shipped; judged ${sum('judged')}/${sum('shipped')} items; median ${sec[Math.floor(sec.length / 2)]}s, max ${sec.at(-1)}s; $${sum('usd').toFixed(3)} total`);
