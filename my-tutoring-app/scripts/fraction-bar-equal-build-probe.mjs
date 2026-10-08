// Real production generation of fraction-bar, every catalog mode pinned plus an unpinned session, checked by the
// live adapter, the fraction-bar oracle and (build_equal) the bar's own judge. Writes the run under
// qa/open-build/fraction-bar-2026-10-07/ and, with --payloads, one W1 payload per mode for the dry journey.
// Usage (from my-tutoring-app): node scripts/fraction-bar-equal-build-probe.mjs --run [--payloads] [--env <.env.local>]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate fraction-bar sessions (every mode pinned, and unpinned).');
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
const out = resolve(root, 'qa/open-build/fraction-bar-2026-10-07');
const payloads = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateFractionBar } = await loader.import('/src/components/lumina/service/math/gemini-fraction-bar.ts');
  const eq = await loader.import('/src/components/lumina/primitives/visual-primitives/math/fractionEqualBuild.ts');
  const { validateFractionBarData } = await loader.import('/src/components/lumina/components/live-activity/adapters/fractionBarLive.ts');
  const { fractionBarOracle } = await loader.import('/src/components/lumina/service/qa/oracles/fraction-bar.ts');
  const cases = [
    ['identify', 'identify', '3', 'Unit fractions', 'Name the parts of a unit fraction'],
    ['build', 'build', '3', 'Building fractions on a bar', 'Shade non-unit fractions on a bar'],
    ['compare', 'compare', '4', 'Fractions with larger denominators', 'Work with eighths, tenths and twelfths'],
    ['add_subtract', 'add_subtract', '5', 'Adding fractions', 'Fractions in addition and subtraction context'],
    ['build_equal', 'build_equal', '4', 'Equivalent fractions', 'Make an equivalent fraction on a fraction bar'],
    ['build_equal-K-2', 'build_equal', '2', 'Halves and fourths', 'Show the same amount with different parts'],
    // The open build is reached by a pin only; an unpinned session keeps the four modes it always had.
    ['unpinned', undefined, '3', 'Fractions on a bar', 'Explore fractions with a bar model'],
  ];
  const summary = [];
  for (const [name, targetEvalMode, grade, topic, intent] of cases) {
    const data = await generateFractionBar({ componentId: 'fraction-bar', instanceId: `bar-${name}`, topic, grade,
      gradeLevel: 'elementary', gradeContext: `Grade ${grade}`, intent, objective: { text: intent }, scope: {}, targetEvalMode,
      raw: { targetEvalMode } });
    const issues = [];
    try { validateFractionBarData(data); } catch (e) { issues.push(`live adapter rejects the data: ${e.message}`); }
    if (targetEvalMode && data.challengeType !== targetEvalMode) issues.push(`routing: pinned ${targetEvalMode}, got ${data.challengeType}`);
    if (!targetEvalMode && data.challengeType === 'build_equal') issues.push('routing: the unpinned session chose the open build');
    const items = data.challenges.map(c => {
      if (data.challengeType !== 'build_equal') return { id: c.id, target: `${c.numerator}/${c.denominator}` };
      const own = eq.readBuild(eq.cutInto(c.denominator).map((p, i) => ({ ...p, shaded: i < c.numerator })));
      const ways = eq.equalWays(c.numerator, c.denominator, data.gradeBand);
      return { id: c.id, target: `${c.numerator}/${c.denominator}`, instruction: c.instruction,
        ways: ways.map(w => `${w.shaded}/${w.pieces}`), ownSplitMiss: eq.equalBuildMiss(c, own) };
    });
    const oracle = fractionBarOracle.verify(data, { componentId: 'fraction-bar', topic, gradeLevel: `Grade ${grade}`, grade, intent,
      evalMode: targetEvalMode ?? data.challengeType });
    if (oracle.violations.length) issues.push(...oracle.violations.map(v => `oracle ${v.check} ${v.where}: ${v.detail}`));
    writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(),
      case: { targetEvalMode, grade, topic, intent }, data, items, oracle, issues,
      logs: logs.splice(0).filter(l => /FractionBar|Fraction Bar|EvalMode|eval mode/i.test(l)) }, null, 2)) + '\n');
    if (process.argv.includes('--payloads') && targetEvalMode && name === targetEvalMode && !issues.length)
      writeFileSync(resolve(payloads, `fraction-bar.${name}.json`), JSON.stringify({ source: `qa/open-build/fraction-bar-2026-10-07/${name}.json`,
        primitiveId: 'fraction-bar', evalMode: targetEvalMode, data }, null, 1) + '\n');
    const line = { name, challengeType: data.challengeType, gradeBand: data.gradeBand ?? null, count: data.challenges.length,
      targets: items.map(i => i.target), oracleViolations: oracle.violations.length, issues };
    summary.push(line);
    process.stdout.write(JSON.stringify(line) + '\n');
    if (issues.length) process.exitCode = 1;
  }
  writeFileSync(resolve(out, 'generator-run.json'), JSON.stringify(summary, null, 2) + '\n');
} finally {
  await server.close();
}
