// /misconception-test positive/negative control matrix for the four math consumers.
//
// Diagonal  = POSITIVE control: the family's own validated misconception (the
//             sentence Probe D actually produced) must select the move AND the
//             compiled contrast must appear in the content.
// Off-diag  = NEGATIVE control: another primitive's REAL validated misconception.
//             Hardest case, because those sentences share vocabulary
//             ("denominator", "counting") with the target family.
// Generic   = NEGATIVE controls that are not misconceptions at all: unrelated
//             domain, self-declared unreliable evidence, and a strength.
//
// Enters at resolveGenerationContext -> generator. The client cannot supply
// observations through generateComponentContent (the delivery wrapper strips
// them), so this is the layer where planner + selector are observable.
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

  // The four validated sentences, exactly as the real distiller wrote them in Probe D.
  const prior = JSON.parse(readFileSync(resolve(out, 'probe-d-all.json'), 'utf8'));
  const VALIDATED = Object.fromEntries(
    Object.entries(prior.best).map(([k, v]) => [k, v.misconceptionText]));

  // Negative controls that are not misconceptions at all.
  const GENERIC = {
    'neg-unrelated': 'The student reliably names the days of the week in order and can say which day comes after Friday.',
    'neg-unreliable': 'The student may be confusing which number tells how many parts there are, but the recorded responses conflict with the judge verdict and the transcript was unreliable, so the evidence is insufficient.',
    'neg-strength': 'Without a recorded prior correction, the student counted a set of objects accurately and said the total without recounting.',
  };

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
      oracle: (d) => compiledSharedDigitRoleContrast(d.challenges ?? []).count,
      items: (d) => (d.challenges ?? []).map((c) => c.numerator + '/' + c.denominator),
      shape: (d) => ({ n: (d.challenges ?? []).length, mode: d.challengeType, tier: d.supportTier }),
    },
    'fraction-circles': {
      gen: generateFractionCircles, topic: 'comparing fractions with circle models', gradeLevel: 'elementary',
      config: { targetEvalMode: 'compare', difficulty: 'medium', objectiveGrade: '3', subskillId: 'NF001-02-e' },
      oracle: (d) => compiledSameNumeratorContrast(d.challenges ?? []).count,
      items: (d) => (d.challenges ?? []).map((c) => c.numerator + '/' + c.denominator + ' vs '
        + (c.compareFraction ? c.compareFraction.numerator + '/' + c.compareFraction.denominator : '-')),
      shape: (d) => ({ n: (d.challenges ?? []).length, types: [...new Set((d.challenges ?? []).map((c) => c.type))].join(',') }),
    },
    'bar-model': {
      gen: generateBarModel, topic: 'reading a picture graph with a key', gradeLevel: 'elementary',
      config: { targetEvalMode: 'picture_graph', difficulty: 'medium', objectiveGrade: '3' },
      oracle: (d) => compiledIconCountContrast(d.challenges ?? []).count,
      items: (d) => (d.challenges ?? []).map((c) => 'key' + (c.scale ? c.scale.iconValue : '?') + ':exp' + c.expectedValue),
      shape: (d) => ({ n: (d.challenges ?? []).length, modes: [...new Set((d.challenges ?? []).map((c) => c.evalMode))].join(',') }),
    },
    'number-line': {
      gen: generateNumberLine, topic: 'counting on and counting back on a number line', gradeLevel: 'elementary',
      config: { targetEvalMode: 'jump', difficulty: 'medium', objectiveGrade: '1' },
      oracle: (d) => compiledStartContrast(jumpTuples(d)).count,
      items: (d) => jumpTuples(d).map((t) => t.startValue + (t.opType === 'add' ? '+' : '-') + t.change + '=' + t.targetValue),
      shape: (d) => ({ n: (d.challenges ?? []).length, mode: d.interactionMode }),
    },
  };

  for (const [family, F] of Object.entries(FAMILIES)) {
    if (only && family !== only) continue;
    const arms = [{ arm: 'null', kind: 'baseline', obs: null }];
    for (const [src, text] of Object.entries(VALIDATED)) {
      arms.push({ arm: src === family ? 'POS-own' : 'NEG-' + src, kind: src === family ? 'positive' : 'negative-crossfamily',
        obs: [{ id: 'obs-1', summary: text }] });
    }
    for (const [arm, text] of Object.entries(GENERIC)) arms.push({ arm, kind: 'negative-generic', obs: [{ id: 'obs-1', summary: text }] });

    const runs = [];
    for (const a of arms) {
      for (let i = 0; i < draws; i++) {
        const item = {
          componentId: family, instanceId: 'ctl-' + family + '-' + a.arm + '-' + i + '-' + Date.now(),
          config: { ...F.config, ...(a.obs ? { learningObservations: a.obs } : {}) },
        };
        const ctx = resolveGenerationContext(item, F.topic, F.gradeLevel, F.config.objectiveGrade);
        const t = Date.now();
        try {
          const d = await F.gen(ctx);
          runs.push({ arm: a.arm, kind: a.kind, draw: i + 1, ms: Date.now() - t,
            move: d.learningAdaptation?.move ?? null, status: d.learningAdaptation?.status ?? null,
            oracle: F.oracle(d), items: F.items(d), shape: F.shape(d) });
        } catch (e) { runs.push({ arm: a.arm, kind: a.kind, draw: i + 1, error: clean(e && e.message ? e.message : e) }); }
        writeFileSync(resolve(out, 'controls-' + (only ?? 'all') + '.json'), JSON.stringify(results.concat([{ family, runs }]), null, 2));
      }
    }
    results.push({ family, runs });
    writeFileSync(resolve(out, 'controls-' + (only ?? 'all') + '.json'), JSON.stringify(results, null, 2));
  }
} finally {
  await server.close();
  writeFileSync(resolve(out, 'controls-logs-' + (only ?? 'all') + '.txt'), logs.join('\n'));
}
process.stdout.write('families=' + results.length + '\n');
process.exit(0);
