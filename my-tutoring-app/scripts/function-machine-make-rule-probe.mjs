// Real production generation for function-machine's open build, make_rule, checked by code: single-mode routing,
// code-owned pairs (whole numbers, distinct inputs and outputs, the stored machine makes each pair), at least two
// different machines per pair that the judge accepts, the oracle clean, and no machine named in the prose.
// Writes qa/open-build/function-machine-overnight/generation.json. No student data, no Live.
// Run from my-tutoring-app:  node scripts/function-machine-make-rule-probe.mjs --run
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate make_rule sessions (Grade 3, Grade 5, Grade 8).');
  process.exit(0);
}
for (const envPath of ['.env.local', 'C:/Users/xbox3/claude web tutor/my-tutoring-app/.env.local']) {
  if (process.env.GEMINI_API_KEY || !existsSync(envPath)) continue;
  const match = readFileSync(envPath, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const print = (...args) => process.stdout.write(`${format(...args)}\n`);

const root = process.cwd();
const out = resolve(root, 'qa/open-build/function-machine-overnight');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateFunctionMachine } = await loader.import('/src/components/lumina/service/math/gemini-function-machine.ts');
  const { judgeMakeRule, makeRuleAsk } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/functionMachineDomain.ts');
  const { functionMachineOracle } = await loader.import('/src/components/lumina/service/qa/oracles/function-machine.ts');
  const cases = [
    ['g3', 'Grade 3', undefined, 'Input-output tables: one rule, many ways'],
    ['g5', 'Grade 5', undefined, 'Write rules for input-output pairs'],
    ['g8-hard', 'Grade 8', 'hard', 'Functions: one input-output pair does not determine a function'],
  ];
  for (const [name, grade, difficulty, intent] of cases) {
    const raw = { targetEvalMode: 'make_rule', ...(difficulty ? { difficulty } : {}) };
    const topic = 'Function machines';
    const data = await generateFunctionMachine({ componentId: 'function-machine', instanceId: `fm-${name}`, topic, grade,
      gradeLevel: grade, gradeContext: grade, intent, objective: {}, scope: { topic, intent }, targetEvalMode: 'make_rule', raw });
    const ch = data.challenges ?? [];
    const issues = [];
    if (data.challengeType !== 'make_rule') issues.push(`routing: got ${data.challengeType}`);
    for (const c of ch) {
      const { makeInput: i, makeOutput: o } = c;
      // Two different machines the judge accepts: add/subtract, then the stored machine (or multiply/divide).
      const add = (o >= i ? `x + ${o - i}` : `x − ${i - o}`).split(' ').flatMap((t) => /^\d+$/.test(t) ? t.split('') : [t]);
      const first = judgeMakeRule(add, i, o);
      const mul = o % i === 0 ? [...String(o / i).split(''), 'x'] : i % o === 0 ? ['x', '÷', ...String(i / o).split('')] : null;
      const second = mul ? judgeMakeRule(mul, i, o, [first.rule]) : null;
      if (first.miss) issues.push(`${c.id}: judge refuses ${add.join('')} for ${i}->${o} (${first.miss})`);
      if (second && second.miss) issues.push(`${c.id}: judge refuses ${mul.join('')} after ${add.join('')} (${second.miss})`);
      if (c.showRule) issues.push(`${c.id}: showRule true`);
    }
    const oracle = functionMachineOracle.verify(data, { componentId: 'function-machine', evalMode: 'make_rule', topic, gradeLevel: grade });
    for (const v of oracle.violations) issues.push(`oracle ${v.check} ${v.where}: ${v.detail}`);
    if (/\bx\s*[+\-*/^×÷]|\d\s*x\b/i.test(`${data.title} ${data.description}`)) issues.push(`rule in prose: ${data.title} | ${data.description}`);
    runs.push({ name, grade, difficulty: difficulty ?? null, intent, issues,
      asks: ch.map((c) => makeRuleAsk(c.makeInput, c.makeOutput, 1)), data });
    print(`${name}: ${ch.length} items, band ${data.gradeBand}, ${data.ruleComplexity}, pairs ${JSON.stringify(ch.map((c) => [c.makeInput, c.makeOutput, c.rule]))}, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title} | ${data.description}`);
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
