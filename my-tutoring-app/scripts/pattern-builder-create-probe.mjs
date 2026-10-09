// Real production generation for pattern-builder's open build, create, with code checks over what came back:
// single-mode routing, a code-owned shape per item (K-1 two-token shapes, grades 2-3 all five), the instruction
// code-written from the shape, enough different tokens to make it, no row named in prose, and the live adapter
// accepting the session. Writes qa/open-build/pattern-builder-<date>/generation.json. No student data, no Live.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate create sessions (K, Grade 2, Grade 3 hard).');
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
const out = resolve(root, `qa/open-build/pattern-builder-${new Date().toLocaleDateString('en-CA')}`);
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generatePatternBuilder } = await loader.import('/src/components/lumina/service/math/gemini-pattern-builder.ts');
  const { createInstruction, tokensNeeded } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/patternBuilderWorkspace.ts');
  const { validatePatternBuilderData } = await loader.import('/src/components/lumina/components/live-activity/adapters/patternBuilderLive.ts');
  const cases = [
    ['k', 'Kindergarten', undefined, 'Create your own AB and ABB color patterns', ['AB', 'ABB', 'AAB']],
    ['g2', 'Grade 2', undefined, 'Make repeating patterns of your own with shapes', ['AB', 'ABB', 'AAB', 'ABC', 'AABB']],
    ['g3-hard', 'Grade 3', 'hard', 'Invent repeating patterns and describe the part that repeats', ['AB', 'ABB', 'AAB', 'ABC', 'AABB']],
  ];
  for (const [name, grade, difficulty, intent, allowed] of cases) {
    const raw = { targetEvalMode: 'create', ...(difficulty ? { difficulty } : {}) };
    const topic = 'Repeating patterns';
    const data = await generatePatternBuilder({ componentId: 'pattern-builder', instanceId: `pb-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: grade, intent, objective: {}, scope: { topic, intent }, targetEvalMode: 'create', raw });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (types.length !== 1 || types[0] !== 'create') issues.push(`routing: got ${JSON.stringify(types)}`);
    for (const c of ch) {
      if (!allowed.includes(c.createShape)) issues.push(`shape ${c.createShape} not for ${grade}`);
      if (c.instruction !== createInstruction(c.createShape)) issues.push(`instruction not code-written: "${c.instruction}"`);
      const distinct = new Set((c.availableTokens ?? []).map(t => t.toLowerCase())).size;
      if (distinct < tokensNeeded(c.createShape ?? 'AB')) issues.push(`${c.id}: ${distinct} tokens for ${c.createShape}`);
      if (/\b(red|blue|green|yellow|circle|square|star)\b.*,.*\b(red|blue|green|yellow|circle|square|star)\b/i.test(`${c.hint} ${c.narration}`)) issues.push(`row in prose: ${c.hint}`);
    }
    try { validatePatternBuilderData(data); } catch (e) { issues.push(`adapter: ${e.message}`); }
    runs.push({ name, grade, difficulty: difficulty ?? null, intent, issues, shapes: ch.map(c => c.createShape),
      data: { title: data.title, description: data.description, gradeBand: data.gradeBand, patternType: data.patternType,
        sequence: data.sequence, tokens: data.tokens, showOptions: data.showOptions, challenges: ch } });
    print(`${name}: ${ch.length} items, band ${data.gradeBand}, shapes ${JSON.stringify(ch.map(c => c.createShape))}, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title} | tokens: ${JSON.stringify(ch[0]?.availableTokens)}`);
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
