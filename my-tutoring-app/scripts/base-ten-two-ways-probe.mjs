// Real production generation for base-ten-blocks' open build, build_two_ways, with code checks over what came back:
// single-mode routing, every target a distinct whole number of at least ten inside the grade range, the instruction
// code-written and naming its own target, no hint the mat would hide, no aids switched on, every item offering levers.
// Writes qa/open-build/base-ten-blocks-<date>/generation.json. No student data, no Live session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_two_ways sessions (Grade 1 and Grade 2, untiered and hard).');
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
const out = resolve(root, `qa/open-build/base-ten-blocks-${new Date().toLocaleDateString('en-CA')}`);
mkdirSync(out, { recursive: true });
const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const runs = [];
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateBaseTenBlocks } = await loader.import('/src/components/lumina/service/math/gemini-base-ten-blocks.ts');
  const { twoWaysInstruction } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/baseTenWorkspace.ts');
  const { baseTenLevers, startLevers } = await loader.import('/src/components/lumina/primitives/visual-primitives/math/baseTenLevers.ts');
  const cases = [
    ['g1', '1', undefined, 'Show a teen number with tens and ones in more than one way', { min: 1, max: 20 }],
    ['g2', '2', undefined, 'A number can be made with tens and ones in different ways', { min: 1, max: 999 }],
    ['g2-hard', '2', 'hard', 'Show a two-digit number two different ways with blocks', { min: 1, max: 999 }],
  ];
  for (const [name, grade, difficulty, intent, range] of cases) {
    const raw = { targetEvalMode: 'build_two_ways', ...(difficulty ? { difficulty } : {}) };
    const data = await generateBaseTenBlocks({ componentId: 'base-ten-blocks', instanceId: `bt2-${name}`,
      topic: 'Place value with base-ten blocks', grade, gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent,
      objective: {}, scope: {}, targetEvalMode: 'build_two_ways', raw });
    const ch = data.challenges ?? [];
    const issues = [];
    const types = [...new Set(ch.map(c => c.type))];
    if (types.length !== 1 || types[0] !== 'build_two_ways') issues.push(`routing: got ${JSON.stringify(types)}`);
    const targets = ch.map(c => c.targetNumber);
    if (new Set(targets).size !== targets.length) issues.push(`repeated target in ${JSON.stringify(targets)}`);
    for (const c of ch) {
      if (!Number.isInteger(c.targetNumber) || c.targetNumber < 10 || c.targetNumber > range.max) issues.push(`target ${c.targetNumber} out of scope`);
      if (c.instruction !== twoWaysInstruction(c.targetNumber)) issues.push(`instruction not code-written: "${c.instruction}"`);
      if (/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(c.hint)) issues.push(`hint would be hidden: "${c.hint}"`);
      if (c.showBlocksTotal || c.showColumnCounts) issues.push(`aid on: ${JSON.stringify({ t: c.showBlocksTotal, c: c.showColumnCounts })}`);
      if (startLevers(c.type, c).length) issues.push('a lever starts pulled');
      if (!baseTenLevers(c, []).length) issues.push(`no levers on ${c.targetNumber}`);
    }
    if (data.decimalMode) issues.push('decimalMode on');
    runs.push({ name, grade, difficulty: difficulty ?? null, intent, issues,
      data: { title: data.title, description: data.description, gradeBand: data.gradeBand, maxPlace: data.maxPlace,
        decimalMode: data.decimalMode, interactionMode: data.interactionMode, challenges: ch } });
    print(`${name}: ${ch.length} items, targets ${JSON.stringify(targets)}, band ${data.gradeBand}, ${issues.length ? issues.join('; ') : 'clean'}`);
    print(`  title: ${data.title}`);
    print(`  first: ${ch[0]?.instruction} | hint: ${ch[0]?.hint}`);
  }
} finally {
  writeFileSync(resolve(out, 'generation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs, logs }, null, 2));
  await server.close();
}
