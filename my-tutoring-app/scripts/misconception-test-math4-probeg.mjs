// /misconception-test Probe G for the four math families.
//
// The documented tap (eval-test ?remediationFocus=) cannot reach these
// generators: generateWithLearningObservations strips both learningObservations
// and remediationFocus from the config, so only the signed backend may supply
// them. That strip is verified separately (probe-g-all.json, all ABSENT). This
// probe enters one layer in, at resolveGenerationContext -> generator, which is
// the planner + selector + telemetry segment Probe G is meant to cover.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(clean(format(...a)));

const root = process.cwd();
const out = resolve(root, 'qa/misconception');
mkdirSync(out, { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const draws = Number(process.argv.find((a) => a.startsWith('--draws='))?.slice(8) ?? 2);

const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const results = [];
try {
  const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const S = '/src/components/lumina/service';
  const { resolveGenerationContext } = await L.import(S + '/generation/resolveGenerationContext.ts');
  const { generateFractionBar } = await L.import(S + '/math/gemini-fraction-bar.ts');
  const { generateFractionCircles } = await L.import(S + '/math/gemini-fraction-circles.ts');
  const { generateBarModel } = await L.import(S + '/math/gemini-bar-model.ts');
  const { generateNumberLine } = await L.import(S + '/math/gemini-number-line.ts');
  const { compiledSharedDigitRoleContrast } = await L.import(S + '/math/fractionBarRemediation.ts');
  const { compiledSameNumeratorContrast } = await L.import(S + '/math/fractionCirclesRemediation.ts');
  const { compiledIconCountContrast } = await L.import(S + '/math/barModelRemediation.ts');
  const { compiledStartContrast } = await L.import(S + '/math/numberLineRemediation.ts');

  const prior = JSON.parse(readFileSync(resolve(out, 'probe-d-all.json'), 'utf8'));
  const focusOf = (f) => prior.best?.[f]?.misconceptionText;

  // Oracles: read the shipped compiled check off the generator's own output.
  const jumpTuples = (d) => (d.challenges ?? []).flatMap((c) => {
    const ops = c.operations ?? [];
    return ops.length === 1
      ? [{ startValue: ops[0].startValue, opType: ops[0].type, change: ops[0].changeValue, targetValue: (c.targetValues ?? [])[0] }]
      : [];
  });

  const FAMILIES = {
    'fraction-bar': {
      gen: generateFractionBar, topic: 'naming and shading fractions of a whole', gradeLevel: 'elementary',
      config: { targetEvalMode: 'build', difficulty: 'medium', objectiveGrade: '3' },
      oracle: (d) => compiledSharedDigitRoleContrast(d.challenges ?? []),
      shape: (d) => ({ n: (d.challenges ?? []).length, mode: d.challengeType, tier: d.supportTier,
        items: (d.challenges ?? []).map((c) => c.numerator + '/' + c.denominator) }),
    },
    'fraction-circles': {
      gen: generateFractionCircles, topic: 'comparing fractions with circle models', gradeLevel: 'elementary',
      config: { targetEvalMode: 'compare', difficulty: 'medium', objectiveGrade: '3', subskillId: 'NF001-02-e' },
      oracle: (d) => compiledSameNumeratorContrast(d.challenges ?? []),
      shape: (d) => ({ n: (d.challenges ?? []).length, types: [...new Set((d.challenges ?? []).map((c) => c.type))],
        items: (d.challenges ?? []).map((c) => c.numerator + '/' + c.denominator + ' vs ' + (c.compareFraction ? c.compareFraction.numerator + '/' + c.compareFraction.denominator : '-')) }),
    },
    'bar-model': {
      gen: generateBarModel, topic: 'reading a picture graph with a key', gradeLevel: 'elementary',
      config: { targetEvalMode: 'picture_graph', difficulty: 'medium', objectiveGrade: '3' },
      oracle: (d) => compiledIconCountContrast(d.challenges ?? []),
      shape: (d) => ({ n: (d.challenges ?? []).length, modes: [...new Set((d.challenges ?? []).map((c) => c.evalMode))],
        items: (d.challenges ?? []).map((c) => (c.scale ? 'key=' + c.scale.iconValue : 'key=?') + ' exp=' + c.expectedValue) }),
    },
    'number-line': {
      gen: generateNumberLine, topic: 'counting on and counting back on a number line', gradeLevel: 'elementary',
      config: { targetEvalMode: 'jump', difficulty: 'medium', objectiveGrade: '1' },
      oracle: (d) => compiledStartContrast(jumpTuples(d)),
      shape: (d) => ({ n: (d.challenges ?? []).length, range: [d.rangeMin, d.rangeMax], mode: d.interactionMode,
        items: jumpTuples(d).map((t) => t.startValue + (t.opType === 'add' ? '+' : '-') + t.change + '=' + t.targetValue) }),
    },
  };

  for (const [family, F] of Object.entries(FAMILIES)) {
    if (only && family !== only) continue;
    const focus = focusOf(family);
    const run = async (label, observations) => {
      const item = {
        componentId: family, instanceId: 'pg-' + family + '-' + label + '-' + Date.now(),
        config: { ...F.config, ...(observations ? { learningObservations: observations } : {}) },
      };
      const ctx = resolveGenerationContext(item, F.topic, F.gradeLevel, F.config.objectiveGrade);
      const t = Date.now();
      try {
        const d = await F.gen(ctx);
        return { label, ms: Date.now() - t, learningAdaptation: d.learningAdaptation ?? null,
          oracle: F.oracle(d), shape: F.shape(d), data: d };
      } catch (e) { return { label, ms: Date.now() - t, error: clean(e && e.message ? e.message : e) }; }
    };
    const runs = [];
    for (let i = 0; i < draws; i++) runs.push(await run('null' + (i + 1), null));
    if (focus) for (let i = 0; i < draws; i++) runs.push(await run('rem' + (i + 1), [{ id: 'obs-1', summary: focus }]));
    // Negative control: an unrelated observation must NOT select a move.
    if (focus) runs.push(await run('unrelated', [{ id: 'obs-x', summary: 'The student reliably names the days of the week in order.' }]));
    results.push({ family, focus: focus ?? null, runs });
    writeFileSync(resolve(out, 'probe-g-direct-' + (only ?? 'all') + '.json'), JSON.stringify(results, null, 2));
  }
} finally {
  await server.close();
  writeFileSync(resolve(out, 'probe-g-direct-logs-' + (only ?? 'all') + '.txt'), logs.join('\n'));
}
process.stdout.write('families=' + results.length + '\n');
process.exit(0);
