// Real distiller + real shared planner + real ten-frame registry generator for the operate same-first-number
// contrast. Evidence is built by the shipped evidence module from fictional judged runs; no account, submission or
// store writes. Expected outcomes are fixed below BEFORE any model call. Every draw is saved. Run from
// my-tutoring-app against the existing Next listener on :3000.
//   RUN=run1 STAGES=R,P0,D,P,G node scripts/probe-ten-frame-applicability.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/learning-applicability/ten-frame', process.env.RUN ?? '');
const NEXT = 'http://127.0.0.1:3000';
await mkdir(OUT, { recursive: true });
const nextEnv = await import('@next/env');
(nextEnv.loadEnvConfig ?? nextEnv.default.loadEnvConfig)(ROOT);

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const MATH = '/src/components/lumina/primitives/visual-primitives/math';
const { tenFrameEvidenceSummary, tenFrameObservation } = await runner.import(`${MATH}/tenFrameEvidence.ts`);
const { judgedRunEvidence } = await runner.import('/src/components/lumina/hooks/judgedRunEvidence.ts');
const script = await runner.import(`${MATH}/tenFrameScript.ts`);
const remediation = await runner.import('/src/components/lumina/service/math/tenFrameRemediation.ts');
const { generateTenFrame } = await runner.import('/src/components/lumina/service/math/gemini-ten-frame.ts');
const { planLearningAdaptation } = await runner.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');
const { isDiagnosableFailure } = await runner.import('/src/components/lumina/evaluation/diagnosis/types.ts');
const { ai } = await runner.import('/src/components/lumina/service/geminiClient.ts');
// Importing the generation service registers every generator in the shared registry instance.
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

const STAGES = (process.env.STAGES ?? 'R,P0,D,P,G').split(',');
const report = { fictional: true, learningWrites: false, startedAt: new Date().toISOString(), rates: [], planner0: [], distill: [], planner: [], generation: [] };
const save = () => writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const MOVE = 'contrast_same_first_number_different_second';
// Lesson shapes: K subtraction (OPS001-02-D), K addition within 5 (OPS001-01-B), Grade 1 within 20.
const LESSON = {
  ksub: { grade: 'K', topic: 'Subtraction within 10', intent: 'Take away on the ten frame and say how many are left',
    objectiveText: 'Model and solve subtraction problems within 10 using ten frames and number lines', skillId: 'OPS001-02', subskillId: 'OPS001-02-D' },
  kadd: { grade: 'K', topic: 'Addition within 5', intent: 'Add on the ten frame and say how many altogether',
    objectiveText: 'Model addition within 5 using drawings, pictures, and number lines, connecting to concrete representations', skillId: 'OPS001-01', subskillId: 'OPS001-01-B' },
  g1: { grade: '1', topic: 'Add and subtract within 20', intent: 'Add and subtract on two ten frames and say the answer',
    objectiveText: 'Add and subtract within 20 using strategies such as making ten', skillId: 'fixture-g1-operate', subskillId: 'fixture-g1-operate' },
  g1ten: { grade: '1', topic: 'Making ten', intent: 'Find how many more make ten',
    objectiveText: 'Use the make-ten strategy: find the number that makes 10 when added to a given number', skillId: 'fixture-g1-make-ten', subskillId: 'fixture-g1-make-ten' },
};
const gradeContextOf = grade => (grade === 'K' ? 'Kindergarten' : 'Grade 1');

// ── R: chance and capacity-miss rates over the real generator (model call replaced by fixed items), no model. ──
if (STAGES.includes('R')) {
  let seed = 20260914;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const int = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const sub = (start, removed) => ({ type: 'subtract', startCount: start, targetCount: start - removed });
  const add = (a, b) => ({ type: 'add', addend1: a, addend2: b, targetCount: a + b });
  const anySub = max => { const s = int(2, max); return sub(s, int(1, s - 1)); };
  const anyAdd = max => { const a = int(1, max - 1); return add(a, int(1, max - a)); };
  const draws = {
    // What flash-lite returned for "Subtraction within 10": ascending starts, removed varying.
    'k-sub-ascending': () => { const s0 = int(4, 6); return [0, 1, 2, 3, 4].map(k => { const s = Math.min(10, s0 + k); return sub(s, int(1, s - 1)); }); },
    'k-sub-uniform': () => [0, 1, 2, 3, 4].map(() => anySub(10)),
    'k-sub-narrow': () => [0, 1, 2, 3, 4].map(() => { const s = int(5, 7); return sub(s, int(1, s - 1)); }),
    'k-add-within-5': () => [0, 1, 2, 3, 4].map(() => anyAdd(5)),
    'k-mixed': () => [0, 1, 2, 3, 4].map(() => (random() < 0.5 ? anyAdd(10) : anySub(10))),
    // What flash-lite returned for Grade 1: three additions crossing ten from different first numbers, then two
    // subtractions crossing ten from different starts.
    'g1-real': () => [7, 8, 9].sort(() => random() - 0.5).map(a => add(a, int(11, 15) - a))
      .concat([int(11, 13), int(14, 17)].map(s => sub(s, s - int(3, 9)))),
    // The same shape when the model repeats first numbers freely.
    'g1-repeating': () => [0, 1, 2].map(() => { const a = int(7, 9); return add(a, int(11, 15) - a); })
      .concat([0, 1].map(() => { const s = int(11, 17); return sub(s, s - int(3, 9)); })),
    'g1-uniform': () => [0, 1, 2, 3, 4].map(() => (random() < 0.5 ? anyAdd(20) : anySub(20))),
  };
  const SESSIONS = Number(process.env.SESSIONS ?? 20000);
  const realGenerate = ai.models.generateContent;
  const realRandom = Math.random;
  const realLog = console.log;
  console.log = () => {};
  Math.random = random;
  try {
    for (const [dist, lessonKey] of [['k-sub-ascending', 'ksub'], ['k-sub-uniform', 'ksub'], ['k-sub-narrow', 'ksub'], ['k-add-within-5', 'kadd'],
      ['k-mixed', 'ksub'], ['g1-real', 'g1'], ['g1-repeating', 'g1'], ['g1-uniform', 'g1']]) {
      const lesson = LESSON[lessonKey];
      const k = lesson.grade === 'K';
      const tally = { chance: 0, targeted: 0, 'already-targeted': 0, 'insufficient-capacity': 0, dropped: 0 };
      let items;
      ai.models.generateContent = async () => ({ text: JSON.stringify({ title: 't', description: 'd', mode: k ? 'single' : 'double', gradeBand: k ? 'K' : '1-2',
        counters: { count: 0, color: 'red', positions: [] }, showOptions: { showCount: false, showEquation: false, showEmptyCount: false, allowFlip: false },
        challenges: items.map((c, i) => ({ id: `c${i + 1}`, ...c, hint: 'h', narration: 'n' })) }) });
      for (let i = 0; i < SESSIONS; i++) {
        items = draws[dist]();
        const data = await generateTenFrame({ componentId: 'ten-frame', instanceId: 'r', topic: lesson.topic, grade: lesson.grade, gradeLevel: 'kindergarten',
          gradeContext: gradeContextOf(lesson.grade), intent: lesson.intent, objective: { text: lesson.objectiveText }, scope: {},
          raw: { targetEvalMode: 'operate', difficulty: 'medium' } });
        const capacity = data.mode === 'double' ? 20 : 10;
        if (remediation.compiledSameFirstContrast(data.challenges, capacity).count) tally.chance++;
        if (data.challenges.length < items.length) tally.dropped++;
        tally[remediation.selectSameFirstContrast(data.challenges, MOVE, capacity, random).status]++;
      }
      const pct = n => Math.round((n / SESSIONS) * 1000) / 10;
      report.rates.push({ modelItems: dist, grade: lesson.grade, sessions: SESSIONS, chancePct: pct(tally.chance), targetedPct: pct(tally.targeted),
        alreadyTargetedPct: pct(tally['already-targeted']), capacityMissPct: pct(tally['insufficient-capacity']), baselineDroppedItemSessionsPct: pct(tally.dropped) });
    }
  } finally {
    ai.models.generateContent = realGenerate;
    Math.random = realRandom;
    console.log = realLog;
  }
  for (const row of report.rates) console.log('rates', JSON.stringify(row));
  await save();
}

// ── Fictional judged runs, recorded as TenFrame.tsx records them. ────────────
// rows: [challenge fields, the wrong first answer said | null]. A wrong item is corrected once, then affirmed.
const correctionLine = item => (script.itemCue(item).match(/If it is wrong, say exactly: "(.*?)"/) ?? [])[1];
function judgedRun(rows, grade = 'K') {
  const band = grade === 'K' ? 'K' : '1-2';
  const capacity = rows.some(([c]) => (c.targetCount ?? 0) > 10 || (c.startCount ?? 0) > 10) ? 20 : 10;
  const items = rows.map(([ch], i) => script.itemFromChallenge({ id: `c${i + 1}`, ...ch }, { capacity, band }));
  if (items.some(item => !item)) throw new Error('fixture item is not askable');
  const observations = [];
  const outcomes = items.map((item, i) => {
    const wrong = rows[i][1];
    if (wrong !== null) observations.push({ ...tenFrameObservation(item, { heard: wrong }), itemId: item.id, phase: item.action,
      support: 'Correction observation; 0 prior corrections on this item. Other assistance is not established.', judgeFeedback: correctionLine(item) });
    return { id: item.id, solved: true, corrections: wrong === null ? 0 : 1, score: wrong === null ? 100 : 67, seconds: 6 };
  });
  const evidence = judgedRunEvidence({ outcomes, observations, items, pack: { activityLine: 'Ten frame', evidenceSummary: tenFrameEvidenceSummary } });
  const modes = { add: 'operate', subtract: 'operate', split: 'decompose' };
  return { evidence, score: Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length), success: true, mode: modes[items[0].kind] ?? items[0].kind };
}
const sub = (start, removed) => ({ type: 'subtract', startCount: start, targetCount: start - removed });
const add = (a, b) => ({ type: 'add', addend1: a, addend2: b, targetCount: a + b });
const ten = shown => ({ type: 'make_ten', targetCount: shown });

// ── P0: one positive planner case per eligible task shape, fixture objective matching the lesson. ──
const task = (lessonKey, tier = 'medium') => { const l = LESSON[lessonKey]; return { grade: l.grade, mode: 'operate', tier, topic: l.topic, intent: l.intent, objectiveText: l.objectiveText }; };
if (STAGES.includes('P0')) {
  const cases = [
    ['k-subtract', task('ksub'), { id: 'observation-fixed-ksub', summary: 'On ten-frame take-away items such as seven counters take away three, the student answers with the starting number (seven) instead of how many are left.' }],
    ['k-add', task('kadd'), { id: 'observation-fixed-kadd', summary: 'On ten-frame addition within five such as two plus three, the student answers with the first number said (two) instead of how many altogether.' }],
    ['g1-add', task('g1'), { id: 'observation-fixed-g1add', summary: 'On two-frame addition such as eight plus five, the student answers with the first number said (eight) instead of the total.' }],
    ['g1-subtract', task('g1'), { id: 'observation-fixed-g1sub', summary: 'On two-frame take-away items such as fifteen take away seven, the student answers with the starting number (fifteen).' }],
  ];
  for (const [name, t, obs] of cases) {
    const move = await planLearningAdaptation(remediation.tenFrameTeachingFor('operate'), t, [obs]);
    report.planner0.push({ name, expected: MOVE, move, pass: move === MOVE }); await save();
    console.log('planner0', name, move, move === MOVE ? 'PASS' : 'FAIL');
  }
}

// ── D: distiller. Expected outcomes decided before running. ──────────────────
const packets = {
  // Four of five take-away items: said the start, then corrected.
  'start-back': { expect: 'hypothesis: answers with the starting number', lesson: 'ksub',
    run: () => judgedRun([[sub(5, 1), null], [sub(7, 3), 'seven'], [sub(6, 2), 'six'], [sub(9, 2), 'nine'], [sub(8, 1), 'eight']]) },
  // Four of five additions within five: said the first addend.
  'first-addend-back': { expect: 'hypothesis: answers with the first number said', lesson: 'kadd',
    run: () => judgedRun([[add(2, 1), 'two'], [add(1, 1), null], [add(3, 2), 'three'], [add(1, 3), 'one'], [add(4, 1), 'four']]) },
  // Grade 1 on two frames: the first number back on additions and take-aways that cross ten.
  'g1-first-back': { expect: 'hypothesis: answers with the first or starting number', lesson: 'g1', grade: '1',
    run: () => judgedRun([[add(8, 3), 'eight'], [add(7, 6), 'seven'], [add(9, 6), null], [sub(12, 6), 'twelve'], [sub(15, 8), 'fifteen']], '1') },
  // Four of five take-away items: said the number taken away (a nearby concept the move does not address).
  'removed-back': { expect: 'hypothesis: answers with the number taken away', lesson: 'ksub',
    run: () => judgedRun([[sub(7, 3), 'three'], [sub(6, 2), 'two'], [sub(5, 1), null], [sub(9, 4), 'four'], [sub(8, 3), 'three']]) },
  // Four of five take-away items: one less than the right answer, never a said number.
  'one-less': { expect: 'hypothesis: counting slip, one less than the answer', lesson: 'ksub',
    run: () => judgedRun([[sub(7, 2), 'four'], [sub(9, 3), 'five'], [sub(8, 1), 'six'], [sub(6, 4), 'one'], [sub(10, 2), null]]) },
  // Three of five take-away items: wrong numbers with no shared relation to the items.
  scattered: { expect: 'abstain (no consistent rule)', lesson: 'ksub',
    run: () => judgedRun([[sub(5, 1), 'two'], [sub(7, 3), null], [sub(6, 2), 'nine'], [sub(9, 2), 'three'], [sub(8, 1), null]]) },
  // One wrong item of five: first-response score 80, above the gate.
  'single-slip': { expect: 'gate abstains without a model call', lesson: 'ksub',
    run: () => judgedRun([[sub(5, 1), null], [sub(7, 3), 'seven'], [sub(6, 2), null], [sub(9, 2), null], [sub(8, 1), null]]) },
  // Grade 1 make-ten: the counters shown said back (another mode; used only as a cross-mode exploratory observation).
  'make-ten-shown-back': { expect: 'hypothesis: answers with the counters shown', lesson: 'g1ten', grade: '1',
    run: () => judgedRun([[ten(8), 'eight'], [ten(7), 'seven'], [ten(5), null], [ten(9), 'nine'], [ten(6), 'six']], '1') },
};
const distilled = {};
if (STAGES.includes('D')) {
  for (const [name, packet] of Object.entries(packets)) {
    const { evidence, score, success, mode } = packet.run();
    if (!isDiagnosableFailure({ success, score }, evidence)) {
      report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence?.firstResponseScore, gate: 'not diagnosable', result: { abstain: true, reason: 'gate' } });
      console.log('distill', name, 'gate: not diagnosable', evidence?.firstResponseScore); await save(); continue;
    }
    const lesson = LESSON[packet.lesson];
    const response = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ action: 'distillMisconception', params: { evidence, score, success, subskillId: lesson.subskillId, evalMode: mode, gradeLevel: lesson.grade } }) });
    const result = await response.json();
    distilled[name] = { evidence, result, mode, lesson };
    report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence?.firstResponseScore, httpStatus: response.status, result });
    await writeFile(join(OUT, `distill-${name}.json`), JSON.stringify({ evidence, result }, null, 2));
    await save();
    console.log('distill', name, JSON.stringify(result));
  }
  // The replay case: the capture POST body TenFrame's capture would send for the start-back hypothesis.
  if (distilled['start-back'] && !distilled['start-back'].result.abstain) {
    const { evidence, result } = distilled['start-back'];
    const l = LESSON.ksub;
    await mkdir(join(OUT, 'replay'), { recursive: true });
    await writeFile(join(OUT, 'replay', 'capture.json'), JSON.stringify({ primitive_type: 'ten-frame', skill_id: l.skillId, misconception_text: result.misconceptionText,
      learning_observation: { subject: 'MATHEMATICS', grade: 'K', evalMode: 'operate', problem: evidence.challengeSummary, phases: evidence.phases,
        teachingImplication: result.teachingImplication || 'No teaching adjustment was distilled.', checkNext: result.checkNext || 'Collect fresh independent evidence.' } }, null, 2));
    await writeFile(join(OUT, 'replay', 'scope.json'), JSON.stringify({ subject: 'MATHEMATICS', grade: 'K', skill_id: l.skillId, subskill_id: l.subskillId }, null, 2));
  }
}
const text = name => (distilled[name] && !distilled[name].result.abstain ? distilled[name].result.misconceptionText : null);
const asDelivered = name => ({ id: `observation-${name}`, summary: distilled[name].result.misconceptionText,
  evidence: JSON.stringify({ problem: distilled[name].evidence.challengeSummary, evalMode: distilled[name].mode, phases: distilled[name].evidence.phases }) });
const unrelated = { id: 'observation-fractions', summary: 'The learner reverses the numerator and denominator when naming a fraction.' };

// ── P: shared planner with structured evidence, as the delivery packet carries it. ──
if (STAGES.includes('P')) {
  const cases = [];
  if (text('start-back')) cases.push(['start-back', task('ksub'), [asDelivered('start-back')], MOVE],
    ['start-back-plus-unrelated', task('ksub'), [unrelated, asDelivered('start-back')], MOVE], ['start-back-on-g1', task('g1'), [asDelivered('start-back')], MOVE]);
  if (text('first-addend-back')) cases.push(['first-addend-back', task('kadd'), [asDelivered('first-addend-back')], MOVE]);
  if (text('g1-first-back')) cases.push(['g1-first-back', task('g1'), [asDelivered('g1-first-back')], MOVE]);
  if (text('removed-back')) cases.push(['removed-back', task('ksub'), [asDelivered('removed-back')], null]);
  if (text('one-less')) cases.push(['one-less', task('ksub'), [asDelivered('one-less')], null]);
  if (text('scattered')) cases.push(['scattered', task('ksub'), [asDelivered('scattered')], null]);
  cases.push(['unrelated-only', task('ksub'), [unrelated], null]);
  // Exploratory, no pass criterion: make-ten's shown count said back, delivered to operate.
  if (text('make-ten-shown-back')) cases.push(['exploratory-make-ten-on-operate', task('g1'), [asDelivered('make-ten-shown-back')], undefined]);
  for (const [name, t, observations, expected] of cases) {
    for (let draw = 0; draw < 2; draw++) {
      const move = await planLearningAdaptation(remediation.tenFrameTeachingFor('operate'), t, observations);
      const pass = expected === undefined ? null : move === expected;
      report.planner.push({ name, draw, expected, move, pass }); await save();
      console.log('planner', name, draw, move, pass === null ? 'RECORDED' : pass ? 'PASS' : 'FAIL');
    }
  }
}

// ── G: real registry generator, called as the catalog consumer branch calls it after signed delivery
// (config.learningObservations set by the server). The eval-test ?remediationFocus= tap cannot be used:
// generateWithLearningObservations strips it from every declared consumer.
// [name, focus, lesson, mode, tier, expected (move | null | undefined = exploratory), draws]
const START = text('start-back') ?? 'On take-away items the student answers with the starting number instead of how many are left.';
const ADDEND = text('first-addend-back') ?? 'On addition items the student answers with the first number said instead of how many altogether.';
const G1FIRST = text('g1-first-back') ?? 'On additions and take-aways within 20 the student answers with the first or starting number.';
const REMOVED = text('removed-back') ?? 'On take-away items the student answers with the number taken away instead of how many are left.';
const ONELESS = text('one-less') ?? 'On take-away items the student ends one short, answering one less than how many are left.';
const SHOWN = text('make-ten-shown-back') ?? 'Asked how many more make ten, the student says how many counters are already on the frame.';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const generationCases = [
  ['baseline-ksub', '', 'ksub', 'operate', 'medium', null, 4],
  ['baseline-kadd', '', 'kadd', 'operate', 'medium', null, 3],
  ['baseline-g1', '', 'g1', 'operate', 'medium', null, 3],
  ['ksub-distilled', START, 'ksub', 'operate', 'medium', MOVE, 2],
  ['ksub-paraphrase-a', 'After counters are taken off the frame, the child still reports the size of the group before anything was removed.', 'ksub', 'operate', 'medium', MOVE, 2],
  ['ksub-paraphrase-b', 'Asked how many are left, says the number the frame started with, as if nothing had been taken away.', 'ksub', 'operate', 'medium', MOVE, 2],
  ['ksub-hard', START, 'ksub', 'operate', 'hard', MOVE, 1],
  ['ksub-easy', START, 'ksub', 'operate', 'easy', MOVE, 1],
  ['kadd-distilled', ADDEND, 'kadd', 'operate', 'medium', MOVE, 2],
  ['g1-distilled', G1FIRST, 'g1', 'operate', 'medium', MOVE, 2],
  ['g1-hard', G1FIRST, 'g1', 'operate', 'hard', MOVE, 1],
  ['unrelated', unrelated.summary, 'ksub', 'operate', 'medium', null, 2],
  ['nearby-removed', REMOVED, 'ksub', 'operate', 'medium', null, 2],
  ['nearby-one-less', ONELESS, 'ksub', 'operate', 'medium', null, 2],
  ['contradictory', 'The take-away answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', 'ksub', 'operate', 'medium', null, 2],
  ['ineligible-make-ten', START, 'g1ten', 'make_ten', 'medium', null, 1],
  ['ineligible-subitize', START, 'ksub', 'subitize', 'medium', null, 1],
  // Exploratory, no pass criterion (decided before running): make-ten's shown count said back, delivered to operate.
  ['exploratory-make-ten-on-operate', SHOWN, 'g1', 'operate', 'medium', undefined, 2],
];
// Independent of the remediation module: read the items the component renders.
const firstOf = c => (c.type === 'add' ? c.addend1 : c.startCount);
const secondOf = c => (c.type === 'add' ? c.addend2 : c.startCount - c.targetCount);
const said = c => `${firstOf(c)}${c.type === 'add' ? '+' : '-'}${secondOf(c)}=${c.targetCount}`;
const sameFirstPairs = cs => cs.slice(1).map((c, i) => [cs[i], c]).filter(([a, b]) => ['add', 'subtract'].includes(a.type) && a.type === b.type
  && firstOf(a) === firstOf(b) && secondOf(a) !== secondOf(b)).map(([a, b]) => `${said(a)} | ${said(b)}`);
const closes = (c, capacity) => (c.type === 'add'
  ? c.addend1 >= 1 && c.addend2 >= 1 && c.targetCount === c.addend1 + c.addend2 && c.targetCount <= capacity
    && c.instruction === `Show ${c.addend1} + ${c.addend2} on the frame!`
  : c.type === 'subtract' && c.startCount <= capacity && c.targetCount >= 1 && c.targetCount < c.startCount
    && c.instruction === `The frame starts with ${c.startCount} counters. Take away ${c.startCount - c.targetCount}. How many are left?`);
if (STAGES.includes('G')) {
  for (const [name, focus, lessonKey, mode, tier, expected, draws] of generationCases.filter(c => !ONLY || ONLY.test(c[0]))) {
    const lesson = LESSON[lessonKey];
    for (let draw = 0; draw < draws; draw++) {
      const observation = focus ? { id: `observation-${name}`, summary: focus,
        ...(focus === START && text('start-back') ? { evidence: asDelivered('start-back').evidence } : {}) } : null;
      const config = { targetEvalMode: mode, difficulty: tier, objectiveGrade: lesson.grade, objectiveSubject: 'MATHEMATICS', intent: lesson.intent,
        objectiveText: lesson.objectiveText, ...(observation ? { learningObservations: [observation] } : {}) };
      const gradeContext = gradeContextOf(lesson.grade);
      let payload, error = null;
      try {
        payload = await getGenerator('ten-frame')({ componentId: 'ten-frame', instanceId: `probe-${name}-${draw}`, config }, lesson.topic, gradeContext, normalizeGradeLevel(gradeContext));
      } catch (e) { error = String(e); }
      await writeFile(join(OUT, `generation-${name}-${draw}.json`), JSON.stringify({ config, error, payload }, null, 2));
      const d = payload?.data;
      const cs = d?.challenges ?? [];
      const capacity = d?.mode === 'double' ? 20 : 10;
      const band = d?.gradeBand ?? 'K';
      const askable = script.itemsFromChallenges(cs, { capacity, band }).length === cs.length;
      const operate = mode === 'operate';
      const structural = !!d && cs.length >= 3 && askable && (!operate || cs.every(c => closes(c, capacity)))
        && (lesson.grade !== 'K' || d.mode === 'single');
      const adaptation = d?.learningAdaptation;
      const found = operate ? sameFirstPairs(cs) : [];
      const semantic = expected === undefined ? true : expected ? adaptation?.move === expected : !adaptation;
      const executed = !expected ? true : adaptation?.status === 'insufficient-capacity' ? 'capacity'
        : ['targeted', 'already-targeted'].includes(adaptation?.status) && found.length > 0;
      const leak = !!focus && JSON.stringify(payload ?? {}).includes(focus);
      const outcome = error ? 'service-error' : !semantic ? (expected ? 'unexpected-abstain' : 'wrong-move') : executed === 'capacity' ? 'insufficient-capacity'
        : !structural || leak || !executed ? 'content-drift' : expected === undefined ? 'recorded' : 'pass';
      const items = cs.map(c => (['add', 'subtract'].includes(c.type) ? said(c) : `${c.type}:${c.targetCount}`));
      const row = { name, draw, mode, grade: lesson.grade, tier, expected, error, adaptation, items, contrast: found, chance: !focus && found.length > 0, structural, semantic, executed, leak, outcome };
      report.generation.push(row); await save();
      console.log('generation', name, draw, JSON.stringify(adaptation ?? null), items.join(' '), outcome);
    }
  }
}
const scored = report.generation.filter(r => r.expected !== undefined);
report.summary = {
  rates: report.rates.map(r => `${r.modelItems} (${r.grade}): chance ${r.chancePct}%, capacity miss ${r.capacityMissPct}%, already ${r.alreadyTargetedPct}%`),
  planner0: `${report.planner0.filter(r => r.pass).length}/${report.planner0.length}`,
  distill: report.distill.map(r => `${r.name}: ${r.result.abstain ? `abstain (${r.result.reason})` : 'hypothesis'} (expected ${r.expect})`),
  planner: `${report.planner.filter(r => r.pass).length}/${report.planner.filter(r => r.pass !== null).length}`,
  plannerExploratory: report.planner.filter(r => r.pass === null).map(r => `${r.name}-${r.draw}: ${r.move ?? 'abstain'}`),
  generation: scored.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] ?? 0) + 1 }), {}),
  baselineChance: report.generation.filter(r => r.name.startsWith('baseline')).map(r => `${r.name}-${r.draw}: ${r.contrast.length ? r.contrast.join(', ') : 'none'}`),
  exploratory: report.generation.filter(r => r.expected === undefined).map(r => `${r.name}: ${r.adaptation?.move ?? 'abstain'}`),
};
report.finishedAt = new Date().toISOString();
await save();
await server.close();
console.log(JSON.stringify(report.summary, null, 2));
