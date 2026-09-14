// Real distiller + real shared planner + real number-tracer registry generator for the sequence
// gap-position contrast. Evidence is built by the shipped evidence module from fictional response
// ledgers; no account, submission or store writes. Expected outcomes are fixed below BEFORE any model
// call. Every draw is saved. Run from my-tutoring-app against the existing Next listener on :3000.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/learning-applicability/number-tracer', process.env.RUN ?? '');
const NEXT = 'http://127.0.0.1:3000';
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const { numberTracerDiagnosisEvidence } = await runner.import('/src/components/lumina/primitives/visual-primitives/math/numberTracerEvidence.ts');
const remediation = await runner.import('/src/components/lumina/service/math/numberTracerRemediation.ts');
const { buildSequenceChallenges } = await runner.import('/src/components/lumina/service/math/gemini-number-tracer.ts');
const { planLearningAdaptation } = await runner.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');
// Importing the generation service registers every generator in the shared registry instance.
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

const STAGES = (process.env.STAGES ?? 'R,P0,D,P,G').split(',');
const report = { fictional: true, learningWrites: false, startedAt: new Date().toISOString(), rates: [], planner0: [], distill: [], planner: [], generation: [] };
const save = () => writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const MOVE = 'contrast_gap_positions_in_one_run';

// ── R: chance and capacity-miss rates over the code-owned builder, no model. ──
if (STAGES.includes('R')) {
  let seed = 20260914;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [grade, lo, hi, max] of [['K', 0, 9, 9], ['K', 1, 9, 9], ['K', 5, 9, 9], ['K', 0, 5, 9], ['K', 1, 5, 9], ['1', 0, 20, 20], ['1', 10, 20, 20], ['1', 0, 10, 20]]) {
    const SESSIONS = 20000;
    const tally = { chance: 0, targeted: 0, 'already-targeted': 0, 'insufficient-capacity': 0, duplicateAnswers: 0 };
    for (let i = 0; i < SESSIONS; i++) {
      const baseline = buildSequenceChallenges(lo, hi, 5, max, random);
      if (remediation.compiledGapPositionContrast(baseline).count) tally.chance++;
      if (new Set(baseline.map(c => c.digit)).size < baseline.length) tally.duplicateAnswers++;
      tally[remediation.selectGapPositionContrast(baseline, MOVE, random).status]++;
    }
    const pct = n => Math.round((n / SESSIONS) * 1000) / 10;
    const row = { grade, window: [lo, hi], sessions: SESSIONS, chancePct: pct(tally.chance), targetedPct: pct(tally.targeted),
      alreadyTargetedPct: pct(tally['already-targeted']), capacityMissPct: pct(tally['insufficient-capacity']), duplicateAnswerSessionsPct: pct(tally.duplicateAnswers) };
    report.rates.push(row); console.log('rates', JSON.stringify(row));
  }
  await save();
}

// ── Fictional response ledgers, as NumberTracer.tsx records them. ────────────
// items: [start, missingIndex, wrong first reading | null]
function sequenceLedger(items, tier = 'medium') {
  return items.flatMap(([start, missingIndex, wrong], i) => {
    const seq = [0, 1, 2, 3].map(k => start + k);
    const base = { challengeId: `c${i + 1}`, type: 'sequence', target: seq[missingIndex], sequenceNumbers: seq, missingIndex,
      guideShown: false, modelShown: false, hintShown: false, supportTier: tier };
    const right = attempt => ({ ...base, attempt, writtenAs: String(seq[missingIndex]), score: 95, correct: true });
    return wrong === null ? [right(1)] : [{ ...base, attempt: 1, writtenAs: String(wrong), score: 10, correct: false }, right(2)];
  });
}
function copyLedger(items) {
  return items.flatMap(([target, wrong], i) => {
    const base = { challengeId: `c${i + 1}`, type: 'copy', target, guideShown: false, modelShown: true, hintShown: false, supportTier: 'hard' };
    const right = attempt => ({ ...base, attempt, writtenAs: String(target), score: 95, correct: true });
    return wrong === null ? [right(1)] : [{ ...base, attempt: 1, writtenAs: String(wrong), score: 15, correct: false }, right(2)];
  });
}
const ids = n => Array.from({ length: n }, (_, i) => `c${i + 1}`);

// ── P0: one positive planner case per eligible task shape, fixture objective matching the mode. ──
const kTask = { grade: 'K', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 10',
  intent: 'Find the missing number in a counting sequence', objectiveText: 'Demonstrate sequential understanding through 20 (before/after, missing numbers, backward counting).' };
const g1Task = { grade: '1', mode: 'sequence', tier: 'medium', topic: 'Missing numbers to 20',
  intent: 'Find the missing number in a counting sequence', objectiveText: 'Identify missing numbers in a sequence when counting forward from a specific starting point.' };
if (STAGES.includes('P0')) {
  const fixed = { id: 'observation-fixed', summary: 'In counting runs such as 3, 4, ?, 6 the student writes the number that comes after the last number shown (7) instead of the hidden number.' };
  for (const [name, task] of [['k-sequence', kTask], ['g1-sequence', g1Task]]) {
    const move = await planLearningAdaptation(remediation.numberTracerSequenceTeaching, task, [fixed]);
    report.planner0.push({ name, expected: MOVE, move, pass: move === MOVE }); await save();
    console.log('planner0', name, move, move === MOVE ? 'PASS' : 'FAIL');
  }
}

// ── D: distiller. Expected outcomes decided before running. ──────────────────
const packets = {
  // Four of five runs: wrote the number after the last shown number, then corrected.
  'after-run': { expect: 'hypothesis: writes the number after the run instead of the gap', mode: 'sequence', score: 95,
    ids: ids(5), responses: sequenceLedger([[3, 2, 7], [0, 1, 4], [5, 1, 9], [2, 2, 6], [6, 1, null]]) },
  // Four of five runs: wrote the shown number just before the gap.
  neighbour: { expect: 'hypothesis: repeats the number before the gap', mode: 'sequence', score: 95,
    ids: ids(5), responses: sequenceLedger([[3, 2, 4], [0, 1, 0], [5, 1, 5], [2, 2, 3], [6, 1, null]]) },
  // Unrelated wrong numbers with no shared relation to the runs.
  scattered: { expect: 'abstain (no consistent rule)', mode: 'sequence', score: 95,
    ids: ids(5), responses: sequenceLedger([[3, 2, 9], [0, 1, 6], [5, 1, 3], [2, 2, null], [6, 1, 1]]) },
  // One wrong run of five: first-response score 80, above the gate.
  'single-slip': { expect: 'gate abstains without a model call', mode: 'sequence', score: 95,
    ids: ids(5), responses: sequenceLedger([[3, 2, 7], [0, 1, null], [5, 1, null], [2, 2, null], [6, 1, null]]) },
  // Copy mode: 6 and 9 exchanged, and 2 read as 5 (numeral orientation, not counting).
  orientation: { expect: 'hypothesis about confusing numerals of similar shape (6/9)', mode: 'copy', score: 95,
    ids: ids(5), responses: copyLedger([[6, 9], [9, 6], [2, 5], [6, 9], [4, null]]) },
};
const distilled = {};
if (STAGES.includes('D')) {
  for (const [name, packet] of Object.entries(packets)) {
    const evidence = numberTracerDiagnosisEvidence(packet.ids, packet.responses);
    const response = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ action: 'distillMisconception', params: { evidence, score: packet.score, success: true,
        subskillId: packet.mode === 'copy' ? 'COUNT001-01-B' : 'COUNT001-01-D', evalMode: packet.mode, gradeLevel: 'K' } }) });
    const result = await response.json();
    distilled[name] = { evidence, result };
    report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence?.firstResponseScore, httpStatus: response.status, result });
    await writeFile(join(OUT, `distill-${name}.json`), JSON.stringify({ evidence, result }, null, 2));
    await save();
    console.log('distill', name, JSON.stringify(result));
  }
}
const text = name => (distilled[name] && !distilled[name].result.abstain ? distilled[name].result.misconceptionText : null);
const asDelivered = name => ({ id: `observation-${name}`, summary: distilled[name].result.misconceptionText,
  evidence: JSON.stringify({ problem: distilled[name].evidence.challengeSummary, evalMode: packets[name].mode, phases: distilled[name].evidence.phases }) });
const unrelated = { id: 'observation-fractions', summary: 'The learner reverses the numerator and denominator when naming a fraction.' };

// ── P: shared planner with structured evidence, as the delivery endpoint sends it. ──
if (STAGES.includes('P')) {
  const cases = [];
  if (text('after-run')) cases.push(['after-run', kTask, [asDelivered('after-run')], MOVE], ['after-run-plus-unrelated', kTask, [unrelated, asDelivered('after-run')], MOVE],
    ['after-run-grade-1', g1Task, [asDelivered('after-run')], MOVE]);
  if (text('neighbour')) cases.push(['neighbour', kTask, [asDelivered('neighbour')], MOVE]);
  if (text('orientation')) cases.push(['orientation-on-sequence', kTask, [asDelivered('orientation')], null]);
  if (text('scattered')) cases.push(['scattered', kTask, [asDelivered('scattered')], null]);
  cases.push(['unrelated-only', kTask, [unrelated], null]);
  for (const [name, task, observations, expected] of cases) {
    for (let draw = 0; draw < 2; draw++) {
      const move = await planLearningAdaptation(remediation.numberTracerSequenceTeaching, task, observations);
      report.planner.push({ name, draw, expected, move, pass: move === expected }); await save();
      console.log('planner', name, draw, move, move === expected ? 'PASS' : 'FAIL');
    }
  }
}

// ── G: real registry generator, called as the catalog consumer branch calls it after signed
// delivery (config.learningObservations set by the server). The eval-test ?remediationFocus= tap
// cannot be used: generateWithLearningObservations strips it from every declared consumer.
// [name, focus, mode, grade, tier, expected (move | null | undefined = exploratory), draws]
const AFTER = text('after-run') ?? 'In counting runs the student writes the number that follows the last number shown instead of the hidden number.';
const ORIENT = text('orientation') ?? 'The student confuses numerals of similar shape, writing 9 for 6 and 6 for 9.';
const generationCases = [
  ['baseline', '', 'sequence', 'K', 'medium', null, 1],
  ['distilled', AFTER, 'sequence', 'K', 'medium', MOVE, 2],
  ['paraphrase-a', 'Instead of filling the blank inside a counting run, the child writes the next number after the end of the run.', 'sequence', 'K', 'medium', MOVE, 2],
  ['paraphrase-b', 'Counts on past the last number shown rather than working out the number that belongs in the gap.', 'sequence', 'K', 'medium', MOVE, 2],
  ['neighbour', text('neighbour') ?? 'Writes the number just before the gap again instead of the next number.', 'sequence', 'K', 'medium', MOVE, 2],
  ['hard-tier', AFTER, 'sequence', 'K', 'hard', MOVE, 1],
  ['easy-tier', AFTER, 'sequence', 'K', 'easy', MOVE, 1],
  ['grade-1', AFTER, 'sequence', '1', 'medium', MOVE, 2],
  ['unrelated', unrelated.summary, 'sequence', 'K', 'medium', null, 2],
  ['nearby-orientation', ORIENT, 'sequence', 'K', 'medium', null, 2],
  ['nearby-teen-order', 'Writes teen numbers with the digits in the wrong order, 41 for 14, because the ones are said first.', 'sequence', '1', 'medium', null, 2],
  ['nearby-counting-back', 'Asked for the number that comes before a given number, the child gives the number after it; they cannot count back.', 'sequence', 'K', 'medium', null, 2],
  ['contradictory', 'The missing-number answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', 'sequence', 'K', 'medium', null, 2],
  ['ineligible-trace', AFTER, 'trace', 'K', 'medium', null, 1],
  // Exploratory, no pass criterion (decided before running): a number-line counting error is a nearby
  // relationship in another representation; the planner may judge it either way.
  ['exploratory-number-line', 'On a number line the student lands one hop past the target because they count the starting tick as a hop.', 'sequence', 'K', 'medium', undefined, 3],
];
const topics = { K: 'Missing numbers to 10', 1: 'Missing numbers to 20' };
const intent = 'Find the missing number in a counting sequence';
// Independent of the remediation module: neighbouring items show the same four numbers with the gap in two places.
const contrastPairs = cs => cs.slice(1).map((c, i) => [cs[i], c]).filter(([a, b]) => JSON.stringify(a.sequenceNumbers) === JSON.stringify(b.sequenceNumbers)
  && a.missingIndex !== b.missingIndex).map(([a, b]) => `${a.sequenceNumbers.map((n, k) => (k === a.missingIndex ? '?' : n)).join(',')} | ${b.sequenceNumbers.map((n, k) => (k === b.missingIndex ? '?' : n)).join(',')}`);
if (STAGES.includes('G')) {
  for (const [name, focus, mode, grade, tier, expected, draws] of generationCases) {
    for (let draw = 0; draw < draws; draw++) {
      const observation = focus ? { id: `observation-${name}`, summary: focus, ...(focus === AFTER && text('after-run') ? { evidence: asDelivered('after-run').evidence } : {}) } : null;
      const config = { targetEvalMode: mode, difficulty: tier, objectiveGrade: grade, objectiveSubject: 'MATHEMATICS', intent,
        objectiveText: grade === 'K' ? kTask.objectiveText : g1Task.objectiveText, ...(observation ? { learningObservations: [observation] } : {}) };
      const gradeContext = grade === 'K' ? 'Kindergarten' : 'Grade 1';
      let payload, error = null;
      try {
        payload = await getGenerator('number-tracer')({ componentId: 'number-tracer', instanceId: `probe-${name}-${draw}`, config }, topics[grade], gradeContext, normalizeGradeLevel(gradeContext));
      } catch (e) { error = String(e); }
      await writeFile(join(OUT, `generation-${name}-${draw}.json`), JSON.stringify({ config, error, payload }, null, 2));
      const d = payload?.data;
      const cs = d?.challenges ?? [];
      const max = grade === 'K' ? 9 : 20;
      const structural = !!d && cs.length === 5 && cs.every(c => c.type === mode) && (mode !== 'sequence' || cs.every(c => c.sequenceNumbers?.length === 4
        && c.sequenceNumbers.every((n, k, s) => n >= 0 && n <= max && (k === 0 || n === s[k - 1] + 1))
        && c.missingIndex > 0 && c.missingIndex < 3 && c.digit === c.sequenceNumbers[c.missingIndex]
        && !c.showGhostDigit && !c.showStartDot && !c.showStrokeArrows && c.supportTier === tier));
      const distinct = mode !== 'sequence' || new Set(cs.map(c => c.digit)).size === cs.length;
      const adaptation = d?.learningAdaptation;
      const pairs = contrastPairs(cs);
      const semantic = expected === undefined ? true : expected ? adaptation?.move === expected : !adaptation;
      const executed = !expected ? true : adaptation?.status === 'insufficient-capacity' ? 'capacity'
        : ['targeted', 'already-targeted'].includes(adaptation?.status) && pairs.length > 0 && adaptation.comparisonCount === 2 * pairs.length;
      const leak = !!focus && JSON.stringify(payload ?? {}).includes(focus);
      const outcome = error ? 'service-error' : !semantic ? (expected ? 'unexpected-abstain' : 'wrong-move') : executed === 'capacity' ? 'insufficient-capacity'
        : !structural || !distinct || leak || !executed ? 'content-drift' : expected === undefined ? 'recorded' : 'pass';
      const row = { name, draw, mode, grade, tier, expected, error, adaptation, runs: cs.map(c => (c.sequenceNumbers ?? []).map((n, k) => (k === c.missingIndex ? '?' : n)).join(',')),
        answers: cs.map(c => c.digit), pairs, structural, distinct, semantic, executed, leak, outcome };
      report.generation.push(row); await save();
      console.log('generation', name, draw, JSON.stringify(adaptation ?? null), outcome);
    }
  }
}
const scored = report.generation.filter(r => r.expected !== undefined);
report.summary = {
  rates: report.rates.map(r => `${r.grade} ${r.window.join('-')}: chance ${r.chancePct}%, capacity miss ${r.capacityMissPct}%, already ${r.alreadyTargetedPct}%, duplicate-answer sessions ${r.duplicateAnswerSessionsPct}%`),
  planner0: `${report.planner0.filter(r => r.pass).length}/${report.planner0.length}`,
  distill: report.distill.map(r => `${r.name}: ${r.result.abstain ? `abstain (${r.result.reason})` : 'hypothesis'} (expected ${r.expect})`),
  planner: `${report.planner.filter(r => r.pass).length}/${report.planner.length}`,
  generation: scored.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] ?? 0) + 1 }), {}),
  exploratory: report.generation.filter(r => r.expected === undefined).map(r => r.adaptation?.move ?? 'abstain'),
};
report.finishedAt = new Date().toISOString();
await save();
await server.close();
console.log(JSON.stringify(report.summary, null, 2));
