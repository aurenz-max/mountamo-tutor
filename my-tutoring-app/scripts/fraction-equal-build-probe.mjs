// Real production generation of fraction-circles build_equal (open build), then the circle's own judge over every
// item: each generated target must have another equal cut that passes, and its own cut must not.
// Usage (from my-tutoring-app): node scripts/fraction-equal-build-probe.mjs --run [--env <path to .env.local>]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate build_equal sessions (K-2 and 3-5, pinned and by intent).');
  process.exit(0);
}
const envArg = process.argv.indexOf('--env');
const envFile = envArg > 0 ? process.argv[envArg + 1] : '.env.local';
if (!process.env.GEMINI_API_KEY && existsSync(envFile)) {
  const match = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/fraction-circles-2026-10-07');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateFractionCircles } = await loader.import('/src/components/lumina/service/math/gemini-fraction-circles.ts');
  const eq = await loader.import('/src/components/lumina/primitives/visual-primitives/math/fractionEqualBuild.ts');
  const { validateFractionCirclesData } = await loader.import('/src/components/lumina/components/live-activity/adapters/fractionCirclesLive.ts');
  const { fractionCirclesOracle } = await loader.import('/src/components/lumina/service/qa/oracles/fraction-circles.ts').catch(() => ({}));
  const cases = [
    ['pinned-3-5', 'build_equal', '4', 'Equivalent fractions', 'Make equivalent fractions with circle models', 'medium'],
    ['pinned-K-2', 'build_equal', '2', 'Halves and fourths', 'Show the same amount with different pieces', 'easy'],
    ['intent-3-5', undefined, '3', 'Equivalent fractions with visual models',
      'Make your own fraction that is equal to a given fraction by choosing how to cut the circle', undefined],
    // Contract R4: the mixed session keeps its five modes; the open build is reached by a pin or by intent only.
    ['mixed-3-5', 'mixed', '4', 'Fractions with circles', 'Explore all fraction circle activities', undefined],
  ];
  const summary = [];
  for (const [name, targetEvalMode, grade, topic, intent, difficulty] of cases) {
    const data = await generateFractionCircles({ componentId: 'fraction-circles', instanceId: `equal-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent, objective: { text: intent }, scope: {}, targetEvalMode,
      raw: { targetEvalMode, difficulty } });
    const issues = [];
    try { validateFractionCirclesData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    const items = data.challenges.map(c => {
      const ways = eq.equalWays(c.numerator, c.denominator, data.gradeBand);
      const own = eq.readBuild(eq.cutInto(c.denominator).map((p, i) => ({ ...p, shaded: i < c.numerator })));
      const first = ways[0];
      const passes = first ? eq.makesEqual(c, eq.readBuild(eq.cutInto(first.pieces).map((p, i) => ({ ...p, shaded: i < first.shaded })))) : false;
      if (c.type === 'build_equal') {
        if (!passes) issues.push(`${c.id} ${c.numerator}/${c.denominator}: no other way passes`);
        if (eq.makesEqual(c, own)) issues.push(`${c.id}: the target's own cut passes`);
        if (!c.instruction.includes(`${c.numerator}/${c.denominator}`)) issues.push(`${c.id}: instruction does not state the target`);
        if (data.gradeBand === 'K-2' && c.denominator > 4) issues.push(`${c.id}: K-2 denominator ${c.denominator}`);
      }
      return { id: c.id, type: c.type, target: `${c.numerator}/${c.denominator}`, instruction: c.instruction, ways: ways.map(w => `${w.shaded}/${w.pieces}`),
        ownCutMiss: eq.equalBuildMiss(c, own) };
    });
    const types = [...new Set(data.challenges.map(c => c.type))];
    if (name.startsWith('mixed')) {
      if (types.includes('build_equal') || types.length !== 5) issues.push(`mixed routing: types ${types.join(',')}`);
    } else if (types.length !== 1 || types[0] !== 'build_equal') issues.push(`routing: types ${types.join(',')}`);
    const values = data.challenges.filter(c => c.type === 'build_equal').map(c => c.numerator / c.denominator);
    if (new Set(values.map(v => v.toFixed(4))).size !== values.length) issues.push('two builds ask for the same value');
    const oracle = fractionCirclesOracle?.verify ? fractionCirclesOracle.verify(data, { componentId: 'fraction-circles', topic, gradeLevel: `Grade ${grade}`, grade, intent, evalMode: targetEvalMode ?? 'build_equal' }) : null;
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(), case: { targetEvalMode, grade, topic, intent, difficulty },
      data, items, oracle, issues, logs: logs.splice(0).filter(l => /FractionCircles|EvalMode|eval mode/i.test(l)) }, null, 2)) + '\n');
    const line = { name, gradeBand: data.gradeBand, count: data.challenges.length, types, targets: items.map(i => i.target), issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
} finally {
  await server.close();
}
