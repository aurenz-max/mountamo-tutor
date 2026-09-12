// Real production generation plus deterministic model/cue verification.
// Does not submit student data or simulate a live microphone session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate split-and-say sessions for both split modes at all support tiers.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/number-bond-split-and-say');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateNumberBond } = await loader.import('/src/components/lumina/service/math/gemini-number-bond.ts');
  const original = await loader.import('/src/components/lumina/primitives/visual-primitives/math/numberBondScript.ts');
  const split = await loader.import('/src/components/lumina/primitives/visual-primitives/math/numberBondSplit.ts');
  const { validateJudgedScriptPack } = await loader.import('/src/components/lumina/hooks/judgedScriptContract.ts');
  for (const mode of ['decompose', 'ten_and_ones']) for (const difficulty of ['easy', 'medium', 'hard']) {
    const data = await generateNumberBond({ componentId: 'number-bond', instanceId: `split-${mode}-${difficulty}`,
      topic: mode === 'decompose' ? 'Split a whole into parts and say one part' : 'Split teen numbers into a ten and some ones',
      grade: 'K', gradeLevel: 'Kindergarten', gradeContext: 'Kindergarten', objective: {}, scope: {},
      raw: { targetEvalMode: mode, difficulty, challengeCount: 3, gradeBand: 'K', maxNumber: 5 } });
    const built = original.buildBondItems(data.challenges, { band: data.gradeBand, maxNumber: data.maxNumber });
    const items = split.expandSplitAndSay(built.items);
    if (!items.length) throw new Error('No askable items');
    const traces = [];
    const found = new Map();
    let board = [];
    let source = null;
    for (const item of items) {
      if (source !== item.sourceId) { source = item.sourceId; board = split.wholeCounters(item.whole); found.set(source, []); }
      if (item.splitPhase === 'build') board = split.prepareSplit(item, split.wholeCounters(item.whole), found.get(source)).counters;
      if (!split.validSplit(item, board, found.get(source))) throw new Error('Invalid reference split');
      const question = split.splitQuestion(item, board);
      if (question.answer < 1 || question.answer > 20) throw new Error('Unsupported spoken answer');
      traces.push({ id: item.id, phase: item.splitPhase, counters: board, question,
        cue: split.splitAndSayCue(item, {}, board, found.get(source)) });
      if (item.splitPhase === 'say') found.get(source).push(split.sortedPair(board));
    }
    const issues = validateJudgedScriptPack({ ...original.numberBondPackBase(items),
      itemCue: (item, opts) => split.splitAndSayCue(item, opts, split.wholeCounters(item.whole), []) });
    if (issues.length) throw new Error(issues.join('; '));
    writeFileSync(resolve(out, `${mode}-${difficulty}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, traces, issues }, null, 2)) + '\n');
    process.stdout.write(JSON.stringify({ mode, difficulty, challenges: data.challenges.length, turns: items.length, issues }) + '\n');
  }
} catch (error) {
  process.stderr.write(clean(error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
