// Real generation of comparison-builder compare_groups at each tier and grade,
// checking that nothing on screen states the answer before the child answers:
// correspondenceMode is never 'live', and the instruction names no count and no
// winning side. Pass --run. Does not submit student data.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const quiet = console.log; for (const m of ['log', 'warn', 'info', 'debug']) console[m] = () => {};
const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
let failures = 0;
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComparisonBuilder } = await loader.import('/src/components/lumina/service/math/gemini-comparison-builder.ts');
  const cases = [['K', 'easy'], ['K', 'medium'], ['1', 'easy'], ['1', 'hard']];
  for (const [grade, difficulty] of cases) {
    const data = await generateComparisonBuilder({
      componentId: 'comparison-builder', instanceId: `cb-${grade}-${difficulty}`,
      topic: 'Comparing groups of objects', grade, gradeLevel: grade === 'K' ? 'Kindergarten' : 'Grade 1',
      gradeContext: grade === 'K' ? 'Kindergarten' : 'Grade 1', intent: 'Compare two groups: which has more, fewer, or the same',
      objective: {}, scope: {},
      raw: { targetEvalMode: 'compare_groups', difficulty },
    });
    const bad = [];
    if (data.correspondenceMode === 'live') bad.push('correspondenceMode live');
    for (const c of data.challenges) {
      const words = c.instruction.toLowerCase();
      const counts = [c.leftGroup.count, c.rightGroup.count].map(String);
      if (counts.some((n) => new RegExp(`\b${n}\b`).test(words))) bad.push(`count in "${c.instruction}"`);
      if (/\b(left|right) (group |side )?has (more|fewer|less)\b|\bthe same\b(?!.*\?)/.test(words)) bad.push(`side named in "${c.instruction}"`);
    }
    failures += bad.length;
    quiet(`${grade}/${difficulty}: tier=${data.supportTier} lines=${data.correspondenceMode} badges=${data.showCountBadges} `
      + `items=${data.challenges.map((c) => `${c.leftGroup.count}v${c.rightGroup.count}`).join(',')} ${bad.length ? 'FAIL ' + bad.join('; ') : 'ok'}`);
    for (const c of data.challenges) quiet(`   "${c.instruction}"`);
  }
} finally { await server.close(); }
quiet(failures ? `${failures} violation(s)` : 'all clean');
process.exit(failures ? 1 : 0);
