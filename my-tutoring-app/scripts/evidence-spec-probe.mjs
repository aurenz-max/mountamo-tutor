// Can practice-studio and deep-dive teach and assess an objective when handed an evidence spec?
// One generation per (case, primitive, arm). Arms: `spec` = objective + evidence spec; `base` = objective only.
// Usage: node scripts/evidence-spec-probe.mjs [--cases=a,b] [--runs=studio:spec,studio:base,deep:spec] [--out=name]
// Image-model calls are stubbed. Writes qa/evidence-spec/<out>.json and prints a digest.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

// Objective text is the published subskill description (design reviews science-k-2026-10-17, math-g2-2026-10-28).
const CASES = {
  'cut-circle': {
    id: 'GEOM002-03-a', topic: 'Halves, Thirds and Fourths of a Circle', grade: '2', gradeContext: 'elementary',
    objective: 'Partition circles into equal-sized portions representing halves, thirds, and fourths by dragging radial lines. Focus: Visualizing equal division of circular areas. Constraints: require identifying the fractional name of each part.',
    evidence: { act: 'set', on: 'a whole, uncut circle', credit: "the child's cuts make 2, 3 or 4 equal shares, and the child names one share in words", notCredit: 'picking a pre-cut circle; typing 1/4', observed: false },
  },
  'cut-rect': {
    id: 'GEOM002-02-a', topic: "Cut the Rectangle into Squares", grade: '2', gradeContext: 'elementary',
    objective: "Divide a given rectangle into a specific grid of equal-sized squares to build an understanding of area as an array. Focus: Partitioning rectangles into rows and columns. Examples: 2 by 3 grid, 3 by 4 grid, 4 by 4 grid, 2 by 5 grid, 3 by 5 grid, 5 by 5 grid, 2 by 6 grid, 4 by 3 grid. Constraints: Use a grid-snapping feature to ensure all created squares are of uniform size.",
    evidence: { act: 'set', on: 'a whole rectangle with no lines in it', credit: "the child's cuts make the stated number of rows and columns, all the same size", notCredit: 'counting squares in a rectangle that is already cut; picking a finished rectangle', observed: false },
  },
  // Boards that have no code of their own: the author has to declare the controls and the goal.
  'set-clock': {
    id: 'MEAS002-04-b', topic: 'Setting the Clock', grade: '2', gradeContext: 'elementary',
    objective: 'Students distinguish between a.m. and p.m. while setting the analog clock to specific requested times. Focus: Connecting daily activities with a.m./p.m. and setting times. Examples: set clock to 8:00 a.m., set clock to 7:30 p.m., set clock to 12:15 p.m., set clock to 6:45 a.m.',
    evidence: { act: 'set', on: 'an analog clock whose hands the child moves', credit: "the child's hands show the requested time", notCredit: 'picking a clock that already shows the time; reading a time aloud', observed: false },
  },
  'add-blocks': {
    id: 'OPS002-01-a', topic: 'Adding Tens and Ones', grade: '2', gradeContext: 'elementary',
    objective: 'Add two two-digit numbers using place value blocks to build understanding without regrouping. Focus: Adding tens to tens and ones to ones without exceeding ten in any column. Examples: 24+12, 33+45, 51+26, 70+19.',
    evidence: { act: 'set', on: 'place value blocks the child adds to', credit: "the child's tens and ones blocks show the sum", notCredit: 'picking a ready-made set of blocks; typing the sum', observed: false },
  },
  'weather-graph': {
    id: 'SCI003-01-G', topic: 'Weather Graphs', grade: 'K', gradeContext: 'kindergarten',
    objective: 'Compare weather patterns between different locations and times using simple graphs and charts',
    evidence: { act: 'set', on: 'a graph of sunny, rainy and cloudy days that the child fills in', credit: "the child's graph shows what the weather record says, or a comparison the tutor asks for (more sunny than rainy days)", notCredit: 'picking a finished graph', observed: false },
  },
  'sun-test': {
    id: 'SCI001-03-G', topic: 'The Sun Warms Things Up', grade: 'K', gradeContext: 'kindergarten',
    objective: 'Conduct basic heat energy experiments using sunlight and different colored surfaces',
    evidence: { act: 'run-read', on: 'two surfaces that differ in one way (colour, material, or sun vs shade), in the same sun for the same time', credit: 'the child says which will be warmer, then reads which one did get warmer from a result shown on screen, and says what the sun did', notCredit: 'a correct prediction alone; recalling that dark things get hot without seeing a result', observed: true },
  },
  // A bare topic with no objective and no spec (run it as studio:base): the loop plans the evidence, and nothing but a
  // working model fits. The spec here is unused by the base arm.
  excavators: {
    id: 'none', topic: 'excavators', grade: '2', gradeContext: 'elementary', objective: '',
    evidence: { act: 'run-read', on: 'a model of an excavator arm', credit: 'the child sets the arm so it does the job when the model is run', notCredit: 'picking a picture of an excavator', observed: true },
  },
  'five-coins': {
    id: 'MEAS002-05-c', topic: 'Making Amounts with Coins', grade: '2', gradeContext: 'elementary',
    objective: 'Students solve word problems and create target amounts using combinations of coins to reach a specific goal. Examples: make 35 cents more than one way; make 35 cents using exactly 5 coins.',
    evidence: { act: 'build', on: 'an empty tray and bins of pennies, nickels, dimes and quarters', credit: "the child's own set of coins totals the target amount and uses the stated number of coins", notCredit: 'picking a ready-made set of coins; typing a total', observed: false },
  },
};

const ACTS = {
  recognize: 'pick the right one from choices', arrange: 'sort or order given things', set: 'change a given picture or model until it is right',
  build: 'make it from nothing', 'run-read': 'run a test and read what happened', say: 'say or write the answer', explain: 'say why',
};
const specText = (e) => `EVIDENCE THIS LESSON MUST COLLECT (from the curriculum):
- What the child does: ${ACTS[e.act]}, on ${e.on}.
- Credit only when: ${e.credit}.
- Does not count: ${e.notCredit}.${e.observed ? '\n- The result must happen on the screen. Telling the child the result does not count.' : ''}`;

const selected = arg('cases', Object.keys(CASES).join(',')).split(',');
const runs = arg('runs', 'studio:spec,studio:base,deep:spec').split(',').map(r => r.split(':'));
const outName = arg('out', new Date().toISOString().slice(0, 10));

const logs = [];
const write = (s) => process.stdout.write(s + '\n');
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const root = process.cwd();
const out = resolve(root, 'qa/evidence-spec');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { ai } = await loader.import('/src/components/lumina/service/geminiClient.ts');
  const { priceCall, withSpendSource } = await loader.import('/src/components/lumina/service/spend/spendMeter.ts');
  const { generateDeepDiveEntry } = await loader.import('/src/components/lumina/service/core/deep-dive-agent/generate-deep-dive.ts');
  const { generatePracticeStudio } = await loader.import('/src/components/lumina/service/core/practice-studio/agent-practice-studio.ts');

  const { AsyncLocalStorage } = await import('node:async_hooks');
  const scope = new AsyncLocalStorage();
  const calls = [];
  const inner = ai.models.generateContent.bind(ai.models);
  ai.models.generateContent = async (params) => {
    if (/image/.test(params.model)) return { candidates: [{ content: { parts: [] } }] };
    const res = await inner(params);
    calls.push({ run: scope.getStore(), model: params.model, usd: priceCall(params.model, res?.usageMetadata) });
    return res;
  };

  const jobs = selected.flatMap(c => runs.map(([prim, arm]) => ({ key: `${c}/${prim}/${arm}`, c, prim, arm })));
  const results = await Promise.all(jobs.map(j => scope.run(j.key, () => withSpendSource('harness', `evidence-spec:${j.prim}`, async () => {
    const k = CASES[j.c];
    // practice-studio reads the spec as data (config.evidence); deep-dive has no evidence reader yet, so it gets the words.
    const intent = j.arm === 'spec' && j.prim === 'deep' ? specText(k.evidence) : undefined;
    const ctx = {
      componentId: j.prim === 'deep' ? 'deep-dive' : 'practice-studio', instanceId: `evspec-${j.c}-${j.prim}-${j.arm}`,
      topic: k.topic, gradeLevel: k.gradeContext, gradeContext: k.gradeContext, grade: k.grade,
      intent, ...(k.objective ? { objective: { text: k.objective } } : {}), scope: {}, raw: j.prim === 'deep' ? { pipeline: 'agent' } : j.arm === 'spec' ? { evidence: k.evidence } : {},
    };
    const started = Date.now();
    try {
      const data = await (j.prim === 'deep' ? generateDeepDiveEntry(ctx) : generatePracticeStudio(ctx));
      return { ...j, ok: true, seconds: (Date.now() - started) / 1000, data };
    } catch (error) {
      return { ...j, ok: false, seconds: (Date.now() - started) / 1000, error: String(error?.message ?? error) };
    }
  }))));

  const strip = (d) => d && JSON.parse(JSON.stringify(d, (key, v) => (key === 'imageBase64' || key === 'html' || key === 'png' ? undefined : v)));
  const usd = (key) => +calls.filter(c => c.run === key).reduce((s, c) => s + c.usd, 0).toFixed(4);
  writeFileSync(resolve(out, `${outName}.json`), JSON.stringify({ cases: CASES, results: results.map(r => ({ ...r, usd: usd(r.key), data: strip(r.data) })), calls, logs }, null, 2));

  const short = (s, n = 160) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
  const disp = (d) => (d ? `[${d.kind === 'coins' ? d.coins.join('+') : d.kind ?? 'display'}]` : '');
  for (const r of results) {
    write(`\n## ${r.key}  ${r.ok ? 'ok' : 'FAILED'}  ${r.seconds.toFixed(0)}s  $${usd(r.key)}`);
    if (!r.ok) { write('  ' + short(r.error, 400)); continue; }
    const d = strip(r.data);
    if (r.prim === 'studio') {
      write(`  idea: ${short(d.description, 240)}`);
      const ev = d.agentDebug?.evidence;
      if (ev) write(`  EVIDENCE: ${ev.met} of ${ev.items} items collect it${ev.unsupported ? ` | ${ev.unsupported}` : ''}`);
      const dbg = Object.fromEntries((d.agentDebug?.items ?? []).map(x => [x.id, x]));
      for (const ch of d.challenges ?? []) {
        write(`  - ${ch.surface} (${ch.difficulty?.band}) "${short(ch.prompt, 200)}"`);
        write(`      stimulus: ${(ch.stimulus ?? []).map(disp).join(' ') || 'none'} | options: ${(ch.options ?? []).map(o => `${o.label ?? ''}${disp(o.display)}`).join(' / ')}${ch.categories ? ` | categories: ${ch.categories.join(', ')}` : ''}`);
        write(`      ${ch.board ? `board: ${JSON.stringify(ch.board)}${ch.controls ? ` | controls: ${JSON.stringify(ch.controls)}` : ''}${ch.derive ? ` | derive: ${JSON.stringify(ch.derive)}` : ''} | goal: ${JSON.stringify(ch.setGoal)} | ` : ''}${ch.goal ? `goal: ${JSON.stringify(ch.goal)} | ` : ''}key: ${short(JSON.stringify(ch.key), 120)} | levers: ${(ch.levers ?? []).length} | rounds: ${dbg[ch.id]?.rounds}`);
        if (dbg[ch.id]?.evidenceGap) write(`      GAP: ${short(dbg[ch.id].evidenceGap, 260)}`);
      }
    } else {
      write(`  objective: ${short(d.agentDebug?.plan?.objective ?? d.objective, 240)}`);
      for (const b of d.blocks ?? []) {
        const kind = b.blockType === 'drawer' ? `drawer:${b.drawerId}` : b.blockType === 'display' ? `display:${b.displayId}` : b.blockType;
        const q = b.question ?? b.prompt ?? b.intent ?? b.heading ?? b.label ?? '';
        write(`  - ${kind}: ${short(q, 200)}`);
      }
      write(`  advisories: ${(d.agentDebug?.advisories ?? []).map(a => short(a, 140)).join(' | ') || 'none'}`);
    }
  }
  write(`\nTotal $${calls.reduce((s, c) => s + c.usd, 0).toFixed(2)} over ${calls.length} calls. Saved qa/evidence-spec/${outName}.json`);
} finally {
  await server.close();
}
