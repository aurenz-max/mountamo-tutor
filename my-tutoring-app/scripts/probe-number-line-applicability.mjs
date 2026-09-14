// Real distiller + real shared planner + real number-line generator for the jump
// start-position contrast. Fictional evidence; no account, submission or store writes.
// Expected outcomes are fixed below BEFORE any model call. Every draw is saved.
// Run from my-tutoring-app against the existing Next listener on :3000.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
// RUN=<name> writes into a subfolder so a later run never overwrites saved draws.
const OUT = resolve(ROOT, '../artifacts/learning-applicability/number-line', process.env.RUN ?? '');
const NEXT = 'http://127.0.0.1:3000';
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const evidenceMod = await runner.import('/src/components/lumina/primitives/visual-primitives/math/numberLineEvidence.ts');
const remediation = await runner.import('/src/components/lumina/service/math/numberLineRemediation.ts');
const { numberLineOracle } = await runner.import('/src/components/lumina/service/qa/oracles/number-line.ts');
const { planLearningAdaptation } = await runner.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');

// REPEAT=1: skip D/P, run the borderline generation cases with a fixed draw count and no early stop.
const REPEAT = process.env.REPEAT === '1';
const report = { fictional: true, repeat: REPEAT, learningWrites: false, startedAt: new Date().toISOString(), distill: [], planner: [], generation: [] };
const save = () => writeFile(join(OUT, REPEAT ? 'report-repeat.json' : 'report.json'), JSON.stringify(report, null, 2));
const add = (startValue, changeValue) => ({ type: 'add', startValue, changeValue, showJumpArc: false });
const sub = (startValue, changeValue) => ({ type: 'subtract', startValue, changeValue, showJumpArc: false });
const tries = (rows) => rows.flatMap(([op, first]) => {
  const expected = op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue;
  const id = `show_jump-${rows.findIndex(r => r[0] === op)}`;
  return first === expected
    ? [evidenceMod.jumpResponseFor(id, 1, [op], [first], 1)]
    : [evidenceMod.jumpResponseFor(id, 1, [op], [first], 1), evidenceMod.jumpResponseFor(id, 2, [op], [expected], 1)];
});

// ── D: distiller. Expected outcomes decided before running. ──────────────────
const packets = {
  // Every wrong first try stops one hop short in the direction of travel.
  'start-counted': { expect: 'hypothesis about counting the start as a hop', rows: [[add(8, 3), 10], [sub(15, 4), 12], [add(6, 5), 10], [sub(18, 2), 16]] },
  // Wrong landings with no shared rule: two past, one on the start, one right.
  scattered: { expect: 'abstain (no consistent rule)', rows: [[add(8, 3), 14], [sub(15, 4), 13], [add(6, 5), 6], [sub(18, 2), 16]] },
  // Hops in the opposite direction; a nearby concept the start contrast cannot teach.
  direction: { expect: 'hypothesis about direction, not start counting', rows: [[add(8, 3), 5], [sub(15, 4), 19], [add(6, 5), 1], [sub(18, 2), 16]] },
  // One miss out of four: first-response score 75 stays below the gate.
  'single-slip': { expect: 'gate abstains without a model call', rows: [[add(8, 3), 10], [sub(15, 4), 11], [add(6, 5), 11], [sub(18, 2), 16]] },
};
const distilled = {};
for (const [name, packet] of Object.entries(REPEAT ? {} : packets)) {
  const responses = tries(packet.rows);
  const evidence = { ...evidenceMod.buildJumpDiagnosisEvidence(responses, { min: 0, max: 20 }),
    firstResponseScore: evidenceMod.jumpFirstResponseScore(responses) };
  const response = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120000), body: JSON.stringify({ action: 'distillMisconception', params: {
      evidence, score: 100, success: true, subskillId: 'OPS001-03-a', evalMode: 'jump', gradeLevel: '1' } }) });
  const result = await response.json();
  distilled[name] = { evidence, result };
  report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence.firstResponseScore, httpStatus: response.status, result });
  await writeFile(join(OUT, `distill-${name}.json`), JSON.stringify({ evidence, result }, null, 2));
  await save();
  console.log('distill', name, JSON.stringify(result));
}

// ── P: shared planner with structured evidence, as the delivery endpoint sends it. ──
const task = { grade: '1', mode: 'jump', tier: 'medium', topic: 'Add within 20 by counting on',
  intent: 'Count on to add on a number line', objectiveText: 'Add two numbers within 20 by counting on from the larger addend on a number line.' };
const asDelivered = (name) => ({ id: `observation-${name}`, summary: distilled[name].result.misconceptionText,
  evidence: JSON.stringify({ problem: distilled[name].evidence.challengeSummary, evalMode: 'jump', phases: distilled[name].evidence.phases }) });
const unrelated = { id: 'observation-fractions', summary: 'The learner reverses the numerator and denominator when ordering fractions.' };
const plannerCases = [];
if (!REPEAT && !distilled['start-counted'].result.abstain) {
  plannerCases.push(['saved-start-counted', [asDelivered('start-counted')], 'contrast_start_positions']);
  plannerCases.push(['saved-plus-unrelated', [unrelated, asDelivered('start-counted')], 'contrast_start_positions']);
}
if (!REPEAT && !distilled.direction.result.abstain) plannerCases.push(['saved-direction', [asDelivered('direction')], null]);
for (const [name, observations, expected] of plannerCases) {
  for (let draw = 0; draw < 2; draw++) {
    const move = await planLearningAdaptation(remediation.numberLineTeaching, task, observations);
    const pass = move === expected;
    report.planner.push({ name, draw, expected, move, pass });
    await save();
    console.log('planner', name, draw, move, pass ? 'PASS' : 'FAIL');
  }
}

// ── G: real registry generator through the eval-test route. ──────────────────
const generationCases = [
  ['baseline', '', null],
  ['distilled', REPEAT ? 'The student counts the starting tick mark as the first count rather than counting the jumps between numbers, causing them to advance one fewer space than requested.'
    : distilled['start-counted'].result.abstain ? null : distilled['start-counted'].result.misconceptionText, 'contrast_start_positions'],
  ['paraphrase-a', 'The learner treats the tick mark they begin on as the first step of the jump, so each landing falls one step short.', 'contrast_start_positions'],
  ['paraphrase-b', 'Counts the tick they start on when hopping along the line.', 'contrast_start_positions'],
  ['unrelated', unrelated.summary, null],
  ['nearby-far', 'When plotting a number, the learner places the point far from its target, apparently guessing the location.', null],
  ['direction', 'The learner hops right when asked to subtract and left when asked to add.', null],
  ['contradictory', 'The recorded landings conflict with one another and the transcription is unreliable; no counting pattern can be inferred.', null],
];
// Exploratory (no pass criterion, decided before running): one past is a different count error the move may or may not address.
const exploratory = ['overshoot', 'The learner lands one space past the correct number on every jump.', undefined];
const REPEAT_CASES = ['distilled', 'paraphrase-b', 'nearby-far', 'direction', 'contradictory'];
for (const [name, focus, expected] of REPEAT ? [...generationCases.filter(([n]) => REPEAT_CASES.includes(n)), exploratory] : generationCases) {
  if (focus === null) { report.generation.push({ name, skipped: 'distiller abstained; no saved text' }); continue; }
  let capacityDraws = 0;
  for (let draw = 0; draw < (REPEAT ? 3 : expected ? 4 : 2); draw++) {
    const query = new URLSearchParams({ componentId: 'number-line', evalMode: 'jump', gradeLevel: 'elementary', grade: '1',
      difficulty: 'medium', topic: task.topic, intent: task.intent, ...(focus ? { remediationFocus: focus } : {}) });
    const response = await fetch(`${NEXT}/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(180000) });
    const payload = await response.json();
    await writeFile(join(OUT, `${REPEAT ? 'repeat' : 'generation'}-${name}-${draw}.json`), JSON.stringify(payload, null, 2));
    const d = payload.fullData;
    const ops = (d?.challenges ?? []).map(c => ({ c, op: c.operations?.[0] }));
    const tuples = ops.map(({ c, op }) => ({ startValue: op?.startValue, opType: op?.type, change: op?.changeValue, targetValue: c.targetValues?.[0] }));
    const oracle = d ? numberLineOracle.verify(d, { componentId: 'number-line', evalMode: 'jump', topic: task.topic, gradeLevel: '1' }) : null;
    const structural = !!d && d.supportTier === 'medium' && d.challenges.length === 4
      && ops.every(({ c, op }) => c.type === 'show_jump' && c.operations.length === 1 && !op.showJumpArc
        && (op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue) === c.targetValues[0]
        && [1, 2, 3, 4, 5].includes(op.changeValue) && c.targetValues[0] >= d.range.min && c.targetValues[0] <= d.range.max)
      && new Set(tuples.map(t => `${t.startValue}|${t.opType}|${t.change}`)).size === tuples.length
      && !(oracle?.violations ?? []).some(v => v.check === 'answer-key-desync');
    const contrast = remediation.compiledStartContrast(tuples);
    const adaptation = d?.learningAdaptation;
    const semantic = expected === undefined ? true : expected ? adaptation?.move === expected : !adaptation;
    const executed = expected ? ['targeted', 'already-targeted'].includes(adaptation?.status) && adaptation.comparisonCount === 2 && contrast.count === 2 : true;
    const leak = !!focus && JSON.stringify(d ?? {}).includes(focus);
    const pairInstructions = contrast.targets.map(i => ({ start: tuples[i].startValue, instruction: d.challenges[i].instruction,
      namesStart: new RegExp(`\\b${tuples[i].startValue}\\b|\\bzero\\b`, 'i').test(d.challenges[i].instruction) }));
    const row = { name, draw, focus, expected, httpStatus: response.status, status: payload.status, range: d?.range, adaptation,
      tuples, contrastTargets: contrast.targets, pairInstructions, structural, semantic, executed, leak,
      oracleViolations: oracle?.violations ?? null, pass: response.ok && payload.status === 'pass' && structural && semantic && executed && !leak };
    report.generation.push(row);
    await save();
    console.log('generation', name, draw, JSON.stringify(adaptation ?? null), row.pass ? 'PASS' : 'FAIL');
    if (REPEAT) continue;
    if (row.pass) break;
    // Legal bounded outcome: the right move with no zero in the lesson range. Retry, and count it.
    if (semantic && structural && !leak && adaptation?.status === 'insufficient-capacity') { capacityDraws++; continue; }
    report.generation.at(-1).stopReason = 'semantic or structural failure; not retried';
    break;
  }
  if (capacityDraws) report.generation.push({ name, capacityDraws });
}
report.finishedAt = new Date().toISOString();
report.pass = REPEAT
  ? report.generation.filter(r => r.draw !== undefined && r.expected !== undefined).every(r => r.pass)
  : report.planner.every(r => r.pass) && generationCases.every(([name]) =>
    report.generation.some(r => r.name === name && (r.pass || r.skipped)));
await save();
await server.close();
console.log('overall', report.pass ? 'PASS' : 'FAIL');
