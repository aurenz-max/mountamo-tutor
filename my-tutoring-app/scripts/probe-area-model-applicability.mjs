// Real distiller + real shared planner + real area-model generator for the grid
// same-fact contrast and the perimeter equal-area contrast. Fictional evidence built
// by the shipped evidence module; no account, submission or store writes.
// Expected outcomes are fixed below BEFORE any model call. Every draw is saved.
// Run from my-tutoring-app against the existing Next listener on :3000.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/learning-applicability/area-model', process.env.RUN ?? '');
const NEXT = 'http://127.0.0.1:3000';
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { areaModelDiagnosisEvidence } = await runner.import('/src/components/lumina/primitives/visual-primitives/math/areaModelEvidence.ts');
const remediation = await runner.import('/src/components/lumina/service/math/areaModelRemediation.ts');
const { areaModelOracle } = await runner.import('/src/components/lumina/service/qa/oracles/area-model.ts');
const { planLearningAdaptation } = await runner.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');
// Importing the generation service registers every generator in the shared registry instance.
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

// REPEAT=1: reuse the distilled texts saved in OUT, skip D and P, and draw the borderline generation cases REPEAT_DRAWS times.
const REPEAT = process.env.REPEAT === '1';
const report = { fictional: true, repeat: REPEAT, learningWrites: false, startedAt: new Date().toISOString(), distill: [], planner: [], generation: [] };
const save = () => writeFile(join(OUT, REPEAT ? 'report-repeat.json' : 'report.json'), JSON.stringify(report, null, 2));

// ── Response ledgers, as AreaModel.tsx records them. ─────────────────────────
// grid model: [factor1Parts, factor2Parts, { 'row,col': wrong first entry }, wrong first sum?]
function gridLedger(models) {
  return models.flatMap(([f1, f2, wrongCells = {}, wrongSum], m) => {
    const id = `area-model-${m + 1}`;
    const base = { challengeId: id, factor1Parts: f1, factor2Parts: f2, scaffoldShown: true, hintsBefore: 0 };
    const rows = [];
    f2.forEach((rowPart, row) => f1.forEach((colPart, col) => {
      const expected = String(colPart * rowPart);
      const wrong = wrongCells[`${row},${col}`];
      if (wrong) rows.push({ ...base, step: 'cell', attempt: 1, cell: [row, col], expected, entered: wrong, correct: false });
      rows.push({ ...base, step: 'cell', attempt: wrong ? 2 : 1, cell: [row, col], expected, entered: expected, correct: true });
    }));
    const total = String(f1.reduce((s, v) => s + v, 0) * f2.reduce((s, v) => s + v, 0));
    if (wrongSum) rows.push({ ...base, step: 'sum', attempt: 1, expected: total, entered: wrongSum, correct: false });
    rows.push({ ...base, step: 'sum', attempt: wrongSum ? 2 : 1, expected: total, entered: total, correct: true });
    return rows;
  });
}
function perimeterLedger(rects) {
  return rects.flatMap(([l, w, wrong], m) => {
    const base = { challengeId: `area-model-${m + 1}`, factor1Parts: [l], factor2Parts: [w], step: 'perimeter', scaffoldShown: true, hintsBefore: 0, expected: String(2 * (l + w)) };
    return wrong ? [{ ...base, attempt: 1, entered: String(wrong), correct: false }, { ...base, attempt: 2, entered: base.expected, correct: true }]
      : [{ ...base, attempt: 1, entered: base.expected, correct: true }];
  });
}
const FIVE = [[[30, 4], [40, 3]], [[20, 5], [30, 6]], [[40, 2], [10, 7]], [[10, 8], [20, 9]], [[20, 7], [40, 1]]];

// ── D: distiller. Expected outcomes decided before running. ──────────────────
const packets = {
  // Tens × tens cells entered with one zero missing in four of five models; every other cell right first time.
  zeros: { expect: 'hypothesis about place value of tens × tens products', mode: 'find_area', score: 100,
    responses: gridLedger(FIVE.map(([f1, f2], i) => [f1, f2, i < 4 ? { '0,0': String((f1[0] / 10) * (f2[0] / 10) * 10) } : {}])) },
  // Four of five perimeters entered as length × width.
  area: { expect: 'hypothesis about multiplying the sides for perimeter', mode: 'perimeter', score: 84,
    responses: perimeterLedger([[6, 8, 48], [12, 5, 60], [9, 14, 126], [7, 20, 140], [11, 10]]) },
  // Four unrelated errors: an added cell, a sum slip, a fact slip in a tens cell, a fact slip in a ones cell.
  scattered: { expect: 'abstain (no consistent rule)', mode: 'find_area', score: 92,
    responses: gridLedger([[[30, 4], [40, 3], { '1,1': '7' }], [[20, 5], [30, 6], {}, '870'], [[40, 2], [10, 7], { '1,0': '270' }], [[10, 8], [20, 9], { '1,1': '63' }], [[20, 7], [40, 1]]]) },
  // One wrong cell in five models: first-response score 80, above the gate.
  'single-slip': { expect: 'gate abstains without a model call', mode: 'find_area', score: 100,
    responses: gridLedger(FIVE.map(([f1, f2], i) => [f1, f2, i === 2 ? { '0,0': '40' } : {}])) },
};
const distilled = {};
for (const [name, packet] of Object.entries(packets)) {
  if (REPEAT) { distilled[name] = JSON.parse(await readFile(join(OUT, `distill-${name}.json`), 'utf8')); continue; }
  const evidence = areaModelDiagnosisEvidence(FIVE.map((_, i) => `area-model-${i + 1}`), packet.responses, packet.mode, 'medium');
  const response = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ action: 'distillMisconception', params: { evidence, score: packet.score, success: true,
      subskillId: packet.mode === 'perimeter' ? 'MEAS004-04-b' : 'NBT004-06-d', evalMode: packet.mode, gradeLevel: '4' } }) });
  const result = await response.json();
  distilled[name] = { evidence, result };
  report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence.firstResponseScore, httpStatus: response.status, result });
  await writeFile(join(OUT, `distill-${name}.json`), JSON.stringify({ evidence, result }, null, 2));
  await save();
  console.log('distill', name, JSON.stringify(result));
}
const text = (name, fallback) => distilled[name].result.abstain ? fallback : distilled[name].result.misconceptionText;
const ZEROS = text('zeros', null);
const AREA = text('area', null);

// ── P: shared planner with structured evidence, as the delivery endpoint sends it. ──
const gridTask = { grade: '4', mode: 'find_area', tier: 'medium', topic: 'Multiply two-digit numbers with an area model',
  intent: 'Use partial products to multiply', objectiveText: 'Multiply two-digit by two-digit numbers using an area model grid.' };
const buildTask = { grade: '4', mode: 'build_model', tier: 'medium', topic: 'Multiply a two-digit number by a one-digit number with an area model',
  intent: 'Use partial products to multiply', objectiveText: 'Multiply two-digit numbers by one-digit numbers using visual models.' };
const multiplyTask = { grade: '5', mode: 'multiply', tier: 'medium', topic: 'Multiply multi-digit numbers with an area model',
  intent: 'Use partial products to multiply', objectiveText: 'Multiply multi-digit whole numbers using partial products in an area model.' };
const perimeterTask = { grade: '4', mode: 'perimeter', tier: 'medium', topic: 'Perimeter of rectangles',
  intent: 'Find the perimeter of rectangles', objectiveText: 'Compute the perimeter of rectangles using 2 × (length + width).' };
const asDelivered = (name) => ({ id: `observation-${name}`, summary: distilled[name].result.misconceptionText,
  evidence: JSON.stringify({ problem: distilled[name].evidence.challengeSummary, evalMode: packets[name].mode, phases: distilled[name].evidence.phases }) });
const unrelated = { id: 'observation-fractions', summary: 'The learner reverses the numerator and denominator when naming a fraction.' };
const plannerCases = [];
if (ZEROS) plannerCases.push(['zeros-on-grid', remediation.areaModelGridTeaching, gridTask, [asDelivered('zeros')], 'contrast_same_fact_across_places'],
  ['zeros-plus-unrelated-on-grid', remediation.areaModelGridTeaching, gridTask, [unrelated, asDelivered('zeros')], 'contrast_same_fact_across_places'],
  ['zeros-on-perimeter', remediation.areaModelPerimeterTeaching, perimeterTask, [asDelivered('zeros')], null]);
if (AREA) plannerCases.push(['area-on-perimeter', remediation.areaModelPerimeterTeaching, perimeterTask, [asDelivered('area')], 'contrast_equal_area_perimeters'],
  ['area-on-grid', remediation.areaModelGridTeaching, gridTask, [asDelivered('area')], null]);
for (const [name, capability, task, observations, expected] of REPEAT ? [] : plannerCases) {
  for (let draw = 0; draw < 2; draw++) {
    const move = await planLearningAdaptation(capability, task, observations);
    report.planner.push({ name, draw, expected, move, pass: move === expected });
    await save();
    console.log('planner', name, draw, move, move === expected ? 'PASS' : 'FAIL');
  }
}

// ── G: real registry generator, called as the catalog consumer branch calls it after signed
// delivery (config.learningObservations set by the server). The eval-test ?remediationFocus= tap
// cannot be used: generateWithLearningObservations strips it from every declared consumer.
const GRID = 'contrast_same_fact_across_places';
const PERIM = 'contrast_equal_area_perimeters';
const COUNT = { build_model: 4, find_area: 5, perimeter: 5, multiply: 4, factor: 5 };
// [name, focus, mode, grade, tier, expected (move | null | undefined = exploratory), draws]
const generationCases = [
  ['grid-baseline', '', 'find_area', '4', 'medium', null, 1],
  ['grid-distilled', ZEROS, 'find_area', '4', 'medium', GRID, 2],
  ['grid-paraphrase-a', 'Treats 30 × 40 as if it were 3 × 4 and writes 12, forgetting that tens times tens makes hundreds.', 'find_area', '4', 'medium', GRID, 2],
  ['grid-paraphrase-b', 'Leaves a zero off a partial product when both of its parts are multiples of ten.', 'find_area', '4', 'medium', GRID, 2],
  ['grid-hard-tier', ZEROS, 'find_area', '4', 'hard', GRID, 1],
  ['grid-multiply', ZEROS, 'multiply', '5', 'medium', GRID, 1],
  // Run 'final' used grade 3 with the two-digit × two-digit objective text for this case; corrected to a one-digit objective afterwards.
  ['grid-build-model', 'When multiplying a one-digit number by a multiple of ten, the student ignores the zero, writing 7 × 20 as 14.', 'build_model', '4', 'medium', GRID, 1],
  ['grid-unrelated', unrelated.summary, 'find_area', '4', 'medium', null, 2],
  ['grid-nearby-sum', 'After finding every partial product correctly, the student leaves one partial product out when adding them for the total.', 'find_area', '4', 'medium', null, 2],
  ['grid-nearby-facts', 'The student does not yet recall single-digit multiplication facts such as 7 × 8; the errors appear in ones-by-ones cells as often as in tens cells.', 'find_area', '4', 'medium', null, 2],
  ['grid-contradictory', 'The cell entries contradict each other and the record is unreliable; no consistent pattern in how place value is handled can be inferred.', 'find_area', '4', 'medium', null, 2],
  ['grid-perimeter-observation', AREA, 'find_area', '4', 'medium', null, 2],
  ['grid-factor-ineligible', ZEROS, 'factor', '5', 'medium', null, 1],
  ['perimeter-distilled', AREA, 'perimeter', '4', 'medium', PERIM, 2],
  ['perimeter-paraphrase', 'Asked for the distance around a rectangle, the student works out how much space it covers instead.', 'perimeter', '4', 'medium', PERIM, 2],
  ['perimeter-hard-tier', AREA, 'perimeter', '4', 'hard', PERIM, 1],
  ['perimeter-nearby-half', 'The student adds the length and the width once, giving half of the distance around the rectangle.', 'perimeter', '4', 'medium', null, 2],
  ['perimeter-zeros-observation', ZEROS, 'perimeter', '4', 'medium', null, 2],
  ['perimeter-contradictory', 'The perimeter entries contradict each other; no consistent way of combining the sides can be inferred.', 'perimeter', '4', 'medium', null, 1],
  // Exploratory, no pass criterion (decided before running): digit worth in a place-value chart is the
  // same relationship in another representation; applicability is a judgement the planner may make either way.
  ['grid-exploratory-face-value', 'The student gives the bare digit for its worth regardless of its position in a whole number.', 'find_area', '4', 'medium', undefined, 3],
];
const sum = (a) => a.reduce((s, v) => s + v, 0);
const key = (c) => [sum(c.factor1Parts), sum(c.factor2Parts)].sort((a, b) => a - b).join('x');
const placeOk = (p) => /^[1-9]0*$/.test(String(p));
const digit = (p) => Number(String(p)[0]);
const place = (p) => String(p).length - 1;
// Independent of the remediation module: largest and smallest cells share a fact (digits ≥ 2) at different places.
const corner = (c) => {
  const [f1, f2] = [c.factor1Parts, c.factor2Parts];
  if (f1.length * f2.length < 2) return false;
  const big = [f1[0], f2[0]], small = [f1.at(-1), f2.at(-1)];
  if ([...big, ...small].some(p => !placeOk(p) || digit(p) < 2)) return false;
  return big.map(digit).sort().join() === small.map(digit).sort().join() && place(big[0]) + place(big[1]) !== place(small[0]) + place(small[1]);
};
const shapeOk = (mode, c) => {
  const [a, b] = [sum(c.factor1Parts), sum(c.factor2Parts)];
  if (mode === 'perimeter') return c.factor1Parts.length === 1 && c.factor2Parts.length === 1 && a !== b && [a, b].every(s => s >= 5 && s <= 30);
  if (mode === 'find_area' || mode === 'factor') return c.factor1Parts.length === 2 && c.factor2Parts.length === 2 && a >= 11 && a <= 49 && b >= 11 && b <= 49;
  if (mode === 'multiply') return c.factor1Parts.length === 3 && c.factor2Parts.length === 2 && a >= 110 && a <= 499 && b >= 12 && b <= 49;
  return c.factor1Parts.length === 1 && a >= 3 && a <= 9 && b >= 11 && b <= 25;
};
const REPEAT_CASES = ['grid-distilled', 'grid-hard-tier', 'grid-build-model', 'perimeter-distilled', 'perimeter-hard-tier'];
const REPEAT_DRAWS = Number(process.env.REPEAT_DRAWS ?? 4);
for (const [name, focus, mode, grade, tier, expected, baseDraws] of REPEAT ? generationCases.filter(([n]) => REPEAT_CASES.includes(n)) : generationCases) {
  if (focus === null) { report.generation.push({ name, skipped: 'distiller abstained; no saved text' }); continue; }
  const draws = REPEAT ? REPEAT_DRAWS : baseDraws;
  for (let draw = 0; draw < draws; draw++) {
    const task = { perimeter: perimeterTask, build_model: buildTask, multiply: multiplyTask }[mode] ?? gridTask;
    const fromDistiller = focus === ZEROS ? 'zeros' : focus === AREA ? 'area' : null;
    const observation = focus ? { ...(fromDistiller ? asDelivered(fromDistiller) : { summary: focus }), id: `observation-${name}` } : null;
    const config = { targetEvalMode: mode, difficulty: tier, objectiveGrade: grade, objectiveSubject: 'MATHEMATICS', intent: task.intent,
      objectiveText: task.objectiveText, ...(observation ? { learningObservations: [observation] } : {}) };
    const gradeLevel = normalizeGradeLevel(`Grade ${grade}`);
    let payload, error = null;
    try {
      payload = await getGenerator('area-model')({ componentId: 'area-model', instanceId: `probe-${name}-${draw}`, config }, task.topic, `Grade ${grade}`, gradeLevel);
    } catch (e) { error = String(e); }
    const response = { ok: !error, status: error ? 'error' : 200 };
    await writeFile(join(OUT, `generation-${name}-${draw}.json`), JSON.stringify({ config, error, payload }, null, 2));
    const d = payload?.data;
    const cs = d?.challenges ?? [];
    const oracle = d ? areaModelOracle.verify(d, { componentId: 'area-model', evalMode: mode, topic: task.topic, gradeLevel: grade }) : null;
    const structural = !!d && d.challengeType === mode && d.supportTier === tier && cs.length === COUNT[mode]
      && cs.every(c => shapeOk(mode, c)) && new Set(cs.map(key)).size === cs.length
      && !(oracle?.violations ?? []).some(v => v.check === 'answer-key-desync' || v.check === 'schema');
    const adaptation = d?.learningAdaptation;
    const gridTargets = cs.filter(corner).map(c => `${c.factor1Parts.join('+')} × ${c.factor2Parts.join('+')}`);
    const pairIndex = cs.findIndex((c, i) => i + 1 < cs.length && sum(c.factor1Parts) * sum(c.factor2Parts) === sum(cs[i + 1].factor1Parts) * sum(cs[i + 1].factor2Parts) && key(c) !== key(cs[i + 1]));
    const perimeterPair = pairIndex < 0 ? null : [cs[pairIndex], cs[pairIndex + 1]].map(c => ({ sides: [sum(c.factor1Parts), sum(c.factor2Parts)],
      area: sum(c.factor1Parts) * sum(c.factor2Parts), perimeter: 2 * (sum(c.factor1Parts) + sum(c.factor2Parts)) }));
    const semantic = expected === undefined ? true : expected ? adaptation?.move === expected : !adaptation;
    const executed = !expected ? true : ['targeted', 'already-targeted'].includes(adaptation?.status)
      && (expected === GRID ? gridTargets.length > 0 && adaptation.comparisonCount === gridTargets.length : perimeterPair !== null && adaptation.comparisonCount === 2);
    const leak = !!focus && JSON.stringify(payload ?? {}).includes(focus);
    const row = { name, draw, mode, grade, tier, focus, expected, error, adaptation,
      models: cs.map(c => `${c.factor1Parts.join('+')} × ${c.factor2Parts.join('+')}`), gridTargets, perimeterPair,
      structural, semantic, executed, leak, oracleViolations: oracle?.violations ?? null,
      pass: response.ok && structural && semantic && executed && !leak };
    report.generation.push(row);
    await save();
    console.log('generation', name, draw, JSON.stringify(adaptation ?? null), expected === undefined ? 'RECORDED' : row.pass ? 'PASS' : 'FAIL');
  }
}
const scored = report.generation.filter(r => r.draw !== undefined && r.expected !== undefined);
report.summary = {
  distill: report.distill.map(r => `${r.name}: ${r.result.abstain ? 'abstain' : 'hypothesis'} (expected ${r.expect})`),
  planner: `${report.planner.filter(r => r.pass).length}/${report.planner.length}`,
  generation: `${scored.filter(r => r.pass).length}/${scored.length}`,
  statuses: scored.filter(r => r.adaptation).reduce((acc, r) => ({ ...acc, [r.adaptation.status]: (acc[r.adaptation.status] ?? 0) + 1 }), {}),
  exploratory: report.generation.filter(r => r.expected === undefined && r.draw !== undefined).map(r => r.adaptation?.move ?? 'abstain'),
  skipped: report.generation.filter(r => r.skipped).map(r => r.name),
};
report.finishedAt = new Date().toISOString();
report.pass = report.planner.every(r => r.pass) && scored.every(r => r.pass) && !report.summary.skipped.length;
await save();
await server.close();
console.log(JSON.stringify(report.summary, null, 2));
console.log('overall', report.pass ? 'PASS' : 'FAIL');
