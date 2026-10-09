// Real production generation for ten-frame's open build, build_pair, with code checks over what came back: single-mode
// routing on a single frame, every total code-owned inside the bound the lesson names (3..10), each total asked twice,
// the instruction code-written, no pair in the hint or narration, every item askable and offering bare levers, and
// the ten-frame oracle clean. Writes qa/open-build/ten-frame-<date>/generation.json. No student data, no Live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_pair sessions (K to 5, K to 10, Grade 1 hard).');
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
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const out = resolve(root, `qa/open-build/ten-frame-${new Date().toLocaleDateString('en-CA')}`);
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateTenFrame } = await loader.import('/src/components/lumina/service/math/gemini-ten-frame.ts');
  const { itemsFromChallenges } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/tenFrameScript.ts');
  const { tenFrameLevers } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/tenFrameLevers.ts');
  const { tenFrameOracle } = await loader.import('/src/components/lumina/service/qa/oracles/ten-frame.ts');
  const cases = [
    ['k-to-5', 'Kindergarten', undefined, 'Decompose numbers up to 5 into pairs in more than one way', 5],
    ['k-to-10', 'Kindergarten', undefined, 'Decompose numbers within 10 into two parts using counters', 10],
    ['g1-hard', 'Grade 1', 'hard', 'Make a number two different ways with red and yellow counters', 10],
  ];
  for (const [name, grade, difficulty, intent, bound] of cases) {
    const raw = { targetEvalMode: 'build_pair', ...(difficulty ? { difficulty } : {}) };
    const topic = 'Decomposing numbers with two-colour counters';
    const data = await generateTenFrame({ componentId: 'ten-frame', instanceId: `tf-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: grade, intent, objective: {}, scope: { topic, intent }, targetEvalMode: 'build_pair', raw });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (types.length !== 1 || types[0] !== 'build_pair') issues.push(`routing: got ${JSON.stringify(types)}`);
    if (data.mode !== 'single') issues.push(`frame ${data.mode}`);
    const totals = ch.map(c => c.targetCount);
    totals.forEach((t, i) => { if (i % 2 === 1 && t !== totals[i - 1]) issues.push(`total ${totals[i - 1]} not asked twice`); });
    for (const c of ch) {
      if (!Number.isInteger(c.targetCount) || c.targetCount < 3 || c.targetCount > bound) issues.push(`total ${c.targetCount} outside 3..${bound}`);
      if (c.instruction !== `Make ${c.targetCount} with red and yellow counters!`) issues.push(`instruction not code-written: "${c.instruction}"`);
      // "two colours" names the task, not a part; any other number word or digit could be a part.
      if (/\d|\b(one|three|four|five|six|seven|eight|nine)\b|\btwo\b(?! colours)/i.test(`${c.hint} ${c.narration}`)) issues.push(`number in prose: "${c.hint}" / "${c.narration}"`);
    }
    const items = itemsFromChallenges(ch, { capacity: 10, band: data.gradeBand });
    if (items.length !== ch.length) issues.push(`${ch.length - items.length} item(s) dropped`);
    for (const item of items) {
      const lv = tenFrameLevers(item, [], data.gradeBand, { session: items });
      if (!lv.length || lv.some(l => l.pulled)) issues.push(`levers on ${item.id}: ${JSON.stringify(lv.map(l => [l.id, l.pulled]))}`);
    }
    const oracle = tenFrameOracle.verify(data, { topic: `${topic} ${intent}` });
    if (oracle.violations.length) issues.push(`oracle: ${JSON.stringify(oracle.violations)}`);
    runs.push({ name, grade, difficulty: difficulty ?? null, intent, issues, ordinals: items.map(i => i.splitOrdinal),
      data: { title: data.title, description: data.description, gradeBand: data.gradeBand, mode: data.mode,
        showOptions: data.showOptions, challenges: ch } });
    print(`${name}: ${ch.length} items, totals ${JSON.stringify(totals)}, ordinals ${JSON.stringify(items.map(i => i.splitOrdinal))}, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title}`);
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
