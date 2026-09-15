// Real distiller + real shared planner + real counting-board registry generator for the take_away / add_more
// same-start contrast and the count_on one-more item. Evidence is built by the shipped evidence module from
// fictional judged runs; no account, submission or store writes. Expected outcomes are fixed below BEFORE any
// model call. Every draw is saved. Run from my-tutoring-app against the existing Next listener on :3000.
//   RUN=run1 STAGES=R,P0,D,P,G node scripts/probe-counting-board-applicability.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve(ROOT, '../artifacts/learning-applicability/counting-board', process.env.RUN ?? '');
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
const { countingBoardDiagnosisEvidence, countingObservation } = await runner.import(`${MATH}/countingBoardEvidence.ts`);
const script = await runner.import(`${MATH}/countingBoardScript.ts`);
const remediation = await runner.import('/src/components/lumina/service/math/countingBoardRemediation.ts');
const { generateCountingBoard } = await runner.import('/src/components/lumina/service/math/gemini-counting-board.ts');
const { planLearningAdaptation } = await runner.import('/src/components/lumina/service/generation/planLearningAdaptation.ts');
const { isDiagnosableFailure } = await runner.import('/src/components/lumina/evaluation/diagnosis/types.ts');
const { countingBoardOracle } = await runner.import('/src/components/lumina/service/qa/oracles/counting-board.ts');
const { ai } = await runner.import('/src/components/lumina/service/geminiClient.ts');
// Importing the generation service registers every generator in the shared registry instance.
const { normalizeGradeLevel } = await runner.import('/src/components/lumina/service/geminiService.ts');
const { getGenerator } = await runner.import('/src/components/lumina/service/registry/contentRegistry.ts');

const STAGES = (process.env.STAGES ?? 'R,P0,D,P,G').split(',');
const report = { fictional: true, learningWrites: false, startedAt: new Date().toISOString(), rates: [], planner0: [], distill: [], planner: [], generation: [] };
const save = () => writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const CHANGE = 'contrast_same_start_different_change';
const ONE = 'count_on_exactly_one_more';
const TOPICS = { take_away: 'Take away within 10', add_more: 'Add more within 10', count_on: 'Counting on within 10', count: 'Counting to 10', give_me_n: 'Counting out within 10' };
const OBJECTIVES = {
  take_away: 'Compare quantities between groups and count backwards from 10 using concrete objects',
  add_more: 'Count objects in groups of 2 up to 20 (skip counting) and track running totals as objects change',
  count_on: 'Count combined visible and hidden objects up to 10, including briefly shown then hidden sets',
  count_on_1: 'Add within 20 by counting on from the larger number',
  count: 'Count up to 10 objects in various arrangements (linear, scattered, circular) with consistent accuracy',
  give_me_n: 'Count up to 20 objects in structured arrangements (lines, arrays) and count out requested quantities',
};
const INTENTS = { take_away: 'Take some away and say how many are left', add_more: 'Put more on and say how many altogether',
  count_on: 'Count on from a known group', count: 'Count the objects', give_me_n: 'Count out a number of objects' };

// ── R: chance and capacity-miss rates over the real generator (model call replaced by fixed counts), no model. ──
if (STAGES.includes('R')) {
  let seed = 20260914;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const realGenerate = ai.models.generateContent;
  const realRandom = Math.random;
  const realLog = console.log;
  const draws = {
    ascending: () => { const s = 3 + Math.floor(random() * 4); return [0, 1, 2, 3, 4].map(k => Math.min(10, s + k)); },
    uniform: () => [0, 1, 2, 3, 4].map(() => 3 + Math.floor(random() * 8)),
    narrow: () => [0, 1, 2, 3, 4].map(() => 5 + Math.floor(random() * 3)),
  };
  const SESSIONS = Number(process.env.SESSIONS ?? 20000);
  console.log = () => {};
  Math.random = random;
  try {
    for (const [mode, grade, dist] of [['take_away', 'K', 'ascending'], ['take_away', 'K', 'uniform'], ['take_away', 'K', 'narrow'],
      ['add_more', 'K', 'ascending'], ['add_more', 'K', 'uniform'], ['add_more', 'K', 'narrow'], ['count_on', 'K', 'uniform'], ['count_on', '1', 'uniform']]) {
      const tally = { chance: 0, targeted: 0, 'already-targeted': 0, 'insufficient-capacity': 0, dropped: 0 };
      let counts;
      ai.models.generateContent = async () => ({ text: JSON.stringify({ title: 't', description: 'd', objects: { type: 'bears' }, gradeBand: grade,
        showOptions: { showRunningCount: false, showGroupCircles: false, highlightOnTap: true, showLastNumber: true },
        challenges: counts.map((count, i) => ({ id: `c${i + 1}`, type: mode, instruction: 'x', targetAnswer: count, count, arrangement: 'line', hint: 'h', narration: 'n' })) }) });
      const topic = mode === 'count_on' && grade === '1' ? 'Counting on within 20' : TOPICS[mode];
      const ceiling = mode === 'count_on' && grade === '1' ? 20 : 10;
      for (let i = 0; i < SESSIONS; i++) {
        counts = draws[dist]();
        const data = await generateCountingBoard({ componentId: 'counting-board', instanceId: 'r', topic, grade, gradeLevel: 'kindergarten',
          gradeContext: grade === 'K' ? 'Kindergarten' : 'Grade 1', intent: INTENTS[mode], objective: { text: OBJECTIVES[mode] }, scope: {},
          raw: { targetEvalMode: mode, difficulty: 'medium' } });
        const compiled = mode === 'count_on' ? remediation.compiledOneMoreCountOn : remediation.compiledSameStartContrast;
        if (compiled(data.challenges).count) tally.chance++;
        if (script.itemsFromChallenges(data.challenges, { objectWord: 'bears' }).length < data.challenges.length) tally.dropped++;
        const selected = mode === 'count_on' ? remediation.selectOneMoreCountOn(data.challenges, ONE, random)
          : remediation.selectSameStartContrast(data.challenges, CHANGE, ceiling, random);
        tally[selected.status]++;
      }
      const pct = n => Math.round((n / SESSIONS) * 1000) / 10;
      report.rates.push({ mode, grade, modelCounts: dist, sessions: SESSIONS, chancePct: pct(tally.chance), targetedPct: pct(tally.targeted),
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

// ── Fictional judged runs, recorded as CountingBoard.tsx records them. ───────────────
// boards: [challenge fields, the wrong first answer said | null]. A wrong board is corrected once, then affirmed.
const correctionLine = item => (script.itemCue(item).match(/If it is wrong, say exactly: "(.*?)"/) ?? [])[1];
function judgedRun(boards, band = 'K') {
  const items = boards.map(([ch], i) => script.itemFromChallenge({ id: `c${i + 1}`, ...ch }, { objectWord: 'bears' }));
  if (items.some(item => !item)) throw new Error('fixture board is not askable');
  const observations = [];
  const outcomes = items.map((item, i) => {
    const wrong = boards[i][1];
    if (wrong !== null) observations.push({ ...countingObservation(item, band, { heard: wrong }), itemId: item.id, phase: item.action,
      support: 'Correction observation; 0 prior corrections on this item. Other assistance is not established.', judgeFeedback: correctionLine(item) });
    return { id: item.id, solved: true, corrections: wrong === null ? 0 : 1, score: wrong === null ? 100 : 67, seconds: 6 };
  });
  const evidence = countingBoardDiagnosisEvidence({ outcomes, observations }, items.map(item => item.kind));
  return { evidence, score: Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length), success: true, mode: items[0].kind };
}
const away = (count, changeBy) => ({ type: 'take_away', count, changeBy, targetAnswer: count - changeBy });
const more = (count, changeBy) => ({ type: 'add_more', count, changeBy, targetAnswer: count + changeBy });
const on = (startFrom, total) => ({ type: 'count_on', count: total, startFrom, targetAnswer: total });
const all = count => ({ type: 'count_all', count, targetAnswer: count });
const moved = count => ({ type: 'recount_moved', count, targetAnswer: count });

// ── P0: one positive planner case per eligible task shape, fixture objective matching the mode. ──
const task = (mode, grade = 'K', tier = 'medium') => ({ grade, mode, tier, topic: mode === 'count_on' && grade === '1' ? 'Counting on within 20' : TOPICS[mode],
  intent: INTENTS[mode], objectiveText: mode === 'count_on' && grade === '1' ? OBJECTIVES.count_on_1 : OBJECTIVES[mode] });
if (STAGES.includes('P0')) {
  const fixed = {
    take_away: { id: 'observation-fixed-take', summary: 'On take-away boards such as 7 take away 3, the student answers with how many were on the board before any were taken away (seven).' },
    add_more: { id: 'observation-fixed-add', summary: 'On add-more boards such as 4 and put 2 more on, the student answers with how many were on the board before any were added (four).' },
    count_on: { id: 'observation-fixed-on', summary: 'Told that five are already in the group, the student says the starting number back or says five while touching the first extra object, ending one short.' },
  };
  for (const [name, t, obs, expected] of [['k-take_away', task('take_away'), fixed.take_away, CHANGE], ['k-add_more', task('add_more'), fixed.add_more, CHANGE],
    ['k-count_on', task('count_on'), fixed.count_on, ONE], ['g1-count_on', task('count_on', '1'), fixed.count_on, ONE]]) {
    const move = await planLearningAdaptation(remediation.countingBoardTeachingFor(t.mode), t, [obs]);
    report.planner0.push({ name, expected, move, pass: move === expected }); await save();
    console.log('planner0', name, move, move === expected ? 'PASS' : 'FAIL');
  }
}

// ── D: distiller. Expected outcomes decided before running. ──────────────────
const packets = {
  // Four of five take-away boards: said the start count first, then corrected.
  'before-change': { expect: 'hypothesis: reports the count before the take-away', subskill: 'COUNT001-02-E',
    run: () => judgedRun([[away(5, 1), null], [away(7, 3), 'seven'], [away(6, 2), 'six'], [away(9, 2), 'nine'], [away(8, 1), 'eight']]) },
  // Four of five add-more boards: said the start count before adding.
  'add-start': { expect: 'hypothesis: reports the count before adding', subskill: 'COUNT001-02-F',
    run: () => judgedRun([[more(4, 2), 'four'], [more(3, 1), null], [more(5, 2), 'five'], [more(2, 3), 'two'], [more(6, 1), 'six']]) },
  // Four of five count-on boards: said the start back.
  'on-start-back': { expect: 'hypothesis: says the starting number instead of counting on', subskill: 'COUNT001-02-G',
    run: () => judgedRun([[on(5, 8), 'five'], [on(3, 6), 'three'], [on(6, 9), null], [on(4, 7), 'four'], [on(7, 10), 'seven']]) },
  // Four of five count-on boards: one less than the total (the start said on the first extra object).
  'on-start-twice': { expect: 'hypothesis: counts on one short (start counted again)', subskill: 'COUNT001-02-G',
    run: () => judgedRun([[on(5, 8), 'seven'], [on(3, 6), 'five'], [on(6, 9), null], [on(4, 7), 'six'], [on(7, 10), 'nine']]) },
  // Three of five take-away boards: wrong numbers with no shared relation to the boards.
  scattered: { expect: 'abstain (no consistent rule)', subskill: 'COUNT001-02-E',
    run: () => judgedRun([[away(5, 1), 'two'], [away(7, 3), null], [away(6, 2), 'nine'], [away(9, 2), 'three'], [away(8, 1), null]]) },
  // One wrong board of five: first-response score 80, above the gate.
  'single-slip': { expect: 'gate abstains without a model call', subskill: 'COUNT001-02-E',
    run: () => judgedRun([[away(5, 1), null], [away(7, 3), 'seven'], [away(6, 2), null], [away(9, 2), null], [away(8, 1), null]]) },
  // Count-all: one less than the board on four of five scattered boards (tracking, a nearby concept).
  'off-by-one': { expect: 'hypothesis about skipping an object while counting', subskill: 'COUNT001-02-B',
    run: () => judgedRun([[all(8), 'seven'], [all(9), null], [all(7), 'six'], [all(10), 'nine'], [all(6), 'five']]) },
  // Recount-moved: a bigger number after the set moved on four of five boards (conservation, a nearby concept).
  conservation: { expect: 'hypothesis: thinks moving changes how many', subskill: 'COUNT001-02-C',
    run: () => judgedRun([[moved(6), 'eight'], [moved(5), 'seven'], [moved(7), null], [moved(4), 'six'], [moved(8), 'ten']]) },
};
const distilled = {};
if (STAGES.includes('D')) {
  for (const [name, packet] of Object.entries(packets)) {
    const { evidence, score, success, mode } = packet.run();
    if (!isDiagnosableFailure({ success, score }, evidence)) {
      report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence?.firstResponseScore, gate: 'not diagnosable', result: { abstain: true, reason: 'gate' } });
      console.log('distill', name, 'gate: not diagnosable', evidence?.firstResponseScore); await save(); continue;
    }
    const response = await fetch(`${NEXT}/api/lumina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ action: 'distillMisconception', params: { evidence, score, success, subskillId: packet.subskill, evalMode: mode, gradeLevel: 'K' } }) });
    const result = await response.json();
    distilled[name] = { evidence, result, mode, subskill: packet.subskill };
    report.distill.push({ name, expect: packet.expect, firstResponseScore: evidence?.firstResponseScore, httpStatus: response.status, result });
    await writeFile(join(OUT, `distill-${name}.json`), JSON.stringify({ evidence, result }, null, 2));
    await save();
    console.log('distill', name, JSON.stringify(result));
  }
  // The replay case: the capture POST body CountingBoard's capture would send for the take-away hypothesis.
  if (distilled['before-change'] && !distilled['before-change'].result.abstain) {
    const { evidence, result } = distilled['before-change'];
    await mkdir(join(OUT, 'replay'), { recursive: true });
    await writeFile(join(OUT, 'replay', 'capture.json'), JSON.stringify({ primitive_type: 'counting-board', skill_id: 'COUNT001-02', misconception_text: result.misconceptionText,
      learning_observation: { subject: 'MATHEMATICS', grade: 'K', evalMode: 'take_away', problem: evidence.challengeSummary, phases: evidence.phases,
        teachingImplication: result.teachingImplication || 'No teaching adjustment was distilled.', checkNext: result.checkNext || 'Collect fresh independent evidence.' } }, null, 2));
    await writeFile(join(OUT, 'replay', 'scope.json'), JSON.stringify({ subject: 'MATHEMATICS', grade: 'K', skill_id: 'COUNT001-02', subskill_id: 'COUNT001-02-E' }, null, 2));
  }
}
const text = name => (distilled[name] && !distilled[name].result.abstain ? distilled[name].result.misconceptionText : null);
const asDelivered = name => ({ id: `observation-${name}`, summary: distilled[name].result.misconceptionText,
  evidence: JSON.stringify({ problem: distilled[name].evidence.challengeSummary, evalMode: distilled[name].mode, phases: distilled[name].evidence.phases }) });
const unrelated = { id: 'observation-fractions', summary: 'The learner reverses the numerator and denominator when naming a fraction.' };

// ── P: shared planner with structured evidence, as the delivery packet carries it. ──
if (STAGES.includes('P')) {
  const cases = [];
  if (text('before-change')) cases.push(['before-change', task('take_away'), [asDelivered('before-change')], CHANGE],
    ['before-change-plus-unrelated', task('take_away'), [unrelated, asDelivered('before-change')], CHANGE]);
  if (text('add-start')) cases.push(['add-start', task('add_more'), [asDelivered('add-start')], CHANGE]);
  if (text('on-start-back')) cases.push(['on-start-back', task('count_on'), [asDelivered('on-start-back')], ONE], ['on-start-back-grade-1', task('count_on', '1'), [asDelivered('on-start-back')], ONE]);
  if (text('on-start-twice')) cases.push(['on-start-twice', task('count_on'), [asDelivered('on-start-twice')], ONE]);
  if (text('off-by-one')) cases.push(['off-by-one-on-take_away', task('take_away'), [asDelivered('off-by-one')], null], ['off-by-one-on-count_on', task('count_on'), [asDelivered('off-by-one')], null]);
  if (text('conservation')) cases.push(['conservation-on-take_away', task('take_away'), [asDelivered('conservation')], null]);
  if (text('scattered')) cases.push(['scattered', task('take_away'), [asDelivered('scattered')], null]);
  cases.push(['unrelated-only', task('take_away'), [unrelated], null]);
  for (const [name, t, observations, expected] of cases) {
    for (let draw = 0; draw < 2; draw++) {
      const move = await planLearningAdaptation(remediation.countingBoardTeachingFor(t.mode), t, observations);
      report.planner.push({ name, draw, expected, move, pass: move === expected }); await save();
      console.log('planner', name, draw, move, move === expected ? 'PASS' : 'FAIL');
    }
  }
}

// ── G: real registry generator, called as the catalog consumer branch calls it after signed delivery
// (config.learningObservations set by the server). The eval-test ?remediationFocus= tap cannot be used:
// generateWithLearningObservations strips it from every declared consumer.
// [name, focus, mode, grade, tier, expected (move | null | undefined = exploratory), draws]
const BEFORE = text('before-change') ?? 'On take-away boards the student answers with how many objects were on the board before any were taken away.';
const ADD = text('add-start') ?? 'On add-more boards the student answers with how many objects were on the board before more were put on.';
const ONBACK = text('on-start-back') ?? 'Told how many are already in the group, the student says that starting number back instead of counting on.';
const ONTWICE = text('on-start-twice') ?? 'When counting on, the student says the starting number while touching the first extra object and ends one short.';
const OFFBYONE = text('off-by-one') ?? 'When counting a set of objects the student skips one and says one less than there are.';
const CONSERVE = text('conservation') ?? 'After a counted set is spread out, the student thinks there are more objects than before.';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const generationCases = [
  ['baseline-take', '', 'take_away', 'K', 'medium', null, 6],
  ['baseline-add', '', 'add_more', 'K', 'medium', null, 6],
  ['baseline-on', '', 'count_on', 'K', 'medium', null, 2],
  ['take-distilled', BEFORE, 'take_away', 'K', 'medium', CHANGE, 2],
  ['take-paraphrase-a', 'After some counters are removed, the child still gives the size of the whole starting group instead of what remains.', 'take_away', 'K', 'medium', CHANGE, 2],
  ['take-paraphrase-b', 'Answers "how many are left" with the number that was there at the start, as if nothing had been taken off.', 'take_away', 'K', 'medium', CHANGE, 2],
  ['take-hard', BEFORE, 'take_away', 'K', 'hard', CHANGE, 1],
  ['take-easy', BEFORE, 'take_away', 'K', 'easy', CHANGE, 1],
  ['take-grade-1', BEFORE, 'take_away', '1', 'medium', CHANGE, 1],
  ['add-distilled', ADD, 'add_more', 'K', 'medium', CHANGE, 2],
  ['on-start-back', ONBACK, 'count_on', 'K', 'medium', ONE, 2],
  ['on-start-twice', ONTWICE, 'count_on', 'K', 'medium', ONE, 2],
  ['on-grade-1', ONBACK, 'count_on', '1', 'medium', ONE, 2],
  ['on-hard', ONBACK, 'count_on', 'K', 'hard', ONE, 1],
  ['unrelated', unrelated.summary, 'take_away', 'K', 'medium', null, 2],
  ['nearby-tracking', OFFBYONE, 'take_away', 'K', 'medium', null, 2],
  ['nearby-tracking-on', OFFBYONE, 'count_on', 'K', 'medium', null, 2],
  ['nearby-conservation', CONSERVE, 'take_away', 'K', 'medium', null, 2],
  ['contradictory', 'The take-away answers contradict each other and the record is unreliable; no consistent pattern can be inferred.', 'take_away', 'K', 'medium', null, 2],
  ['ineligible-count', BEFORE, 'count', 'K', 'medium', null, 1],
  ['ineligible-give', ONBACK, 'give_me_n', 'K', 'medium', null, 1],
  // Exploratory, no pass criterion (decided before running): the same "answer from before the change" pattern
  // from one mode delivered to the other mode of the same capability, and to count_on.
  ['exploratory-take-on-add', BEFORE, 'add_more', 'K', 'medium', undefined, 2],
  ['exploratory-take-on-count-on', BEFORE, 'count_on', 'K', 'medium', undefined, 2],
];
// Independent of the remediation module: read the boards the component renders.
const sameStartPairs = cs => cs.slice(1).map((c, i) => [cs[i], c]).filter(([a, b]) => ['take_away', 'add_more'].includes(a.type) && a.type === b.type
  && a.count === b.count && a.changeBy !== b.changeBy).map(([a, b]) => `${a.count}${a.type === 'take_away' ? '-' : '+'}${a.changeBy} | ${b.count}${b.type === 'take_away' ? '-' : '+'}${b.changeBy}`);
const oneMore = cs => cs.filter(c => c.type === 'count_on' && c.count - c.startFrom === 1).map(c => `${c.startFrom}+1`);
const closes = c => c.type === 'take_away' ? c.targetAnswer === c.count - c.changeBy && c.changeBy >= 1 && c.changeBy <= 3 && c.changeBy !== c.targetAnswer
  : c.type === 'add_more' ? c.targetAnswer === c.count + c.changeBy && c.changeBy >= 1 && c.changeBy <= 3
    : c.type === 'count_on' ? c.targetAnswer === c.count && c.startFrom >= 1 && c.startFrom < c.count : c.targetAnswer >= 1;
if (STAGES.includes('G')) {
  for (const [name, focus, mode, grade, tier, expected, draws] of generationCases.filter(c => !ONLY || ONLY.test(c[0]))) {
    for (let draw = 0; draw < draws; draw++) {
      const observation = focus ? { id: `observation-${name}`, summary: focus,
        ...(focus === BEFORE && text('before-change') ? { evidence: asDelivered('before-change').evidence } : {}) } : null;
      const objectiveKey = mode === 'count_on' && grade === '1' ? 'count_on_1' : mode;
      const topic = mode === 'count_on' && grade === '1' ? 'Counting on within 20' : TOPICS[mode];
      const config = { targetEvalMode: mode, difficulty: tier, objectiveGrade: grade, objectiveSubject: 'MATHEMATICS', intent: INTENTS[mode],
        objectiveText: OBJECTIVES[objectiveKey], ...(observation ? { learningObservations: [observation] } : {}) };
      const gradeContext = grade === 'K' ? 'Kindergarten' : 'Grade 1';
      let payload, error = null;
      try {
        payload = await getGenerator('counting-board')({ componentId: 'counting-board', instanceId: `probe-${name}-${draw}`, config }, topic, gradeContext, normalizeGradeLevel(gradeContext));
      } catch (e) { error = String(e); }
      await writeFile(join(OUT, `generation-${name}-${draw}.json`), JSON.stringify({ config, error, payload }, null, 2));
      const d = payload?.data;
      const cs = d?.challenges ?? [];
      const ceiling = grade === 'K' || mode !== 'count_on' ? 10 : 20;
      const types = { count: 'count_all' };
      const askable = script.itemsFromChallenges(cs, { objectWord: 'bears' }).length === cs.length;
      const violations = d ? countingBoardOracle.verify(d, { componentId: 'counting-board', evalMode: mode, topic, gradeLevel: gradeContext.toLowerCase() }).violations : [];
      const structural = !!d && cs.length >= 5 && cs.every(c => c.type === (types[mode] ?? mode) && closes(c)) && askable && violations.length === 0
        && Math.max(...cs.map(c => Math.max(c.targetAnswer, c.type === 'add_more' ? 0 : c.count))) <= ceiling;
      const adaptation = d?.learningAdaptation;
      const found = mode === 'count_on' ? oneMore(cs) : sameStartPairs(cs);
      const semantic = expected === undefined ? true : expected ? adaptation?.move === expected : !adaptation;
      const executed = !expected ? true : adaptation?.status === 'insufficient-capacity' ? 'capacity'
        : ['targeted', 'already-targeted'].includes(adaptation?.status) && found.length > 0;
      const leak = !!focus && JSON.stringify(payload ?? {}).includes(focus);
      const outcome = error ? 'service-error' : !semantic ? (expected ? 'unexpected-abstain' : 'wrong-move') : executed === 'capacity' ? 'insufficient-capacity'
        : !structural || leak || !executed ? 'content-drift' : expected === undefined ? 'recorded' : 'pass';
      const boards = cs.map(c => c.type === 'take_away' ? `${c.count}-${c.changeBy}=${c.targetAnswer}` : c.type === 'add_more' ? `${c.count}+${c.changeBy}=${c.targetAnswer}`
        : c.type === 'count_on' ? `${c.startFrom}..${c.count}` : `${c.count}`);
      const row = { name, draw, mode, grade, tier, expected, error, adaptation, boards, contrast: found, chance: !focus && found.length > 0, violations, structural, semantic, executed, leak, outcome };
      report.generation.push(row); await save();
      console.log('generation', name, draw, JSON.stringify(adaptation ?? null), boards.join(' '), outcome);
    }
  }
}
const scored = report.generation.filter(r => r.expected !== undefined);
report.summary = {
  rates: report.rates.map(r => `${r.mode} ${r.grade} (${r.modelCounts}): chance ${r.chancePct}%, capacity miss ${r.capacityMissPct}%, already ${r.alreadyTargetedPct}%`),
  planner0: `${report.planner0.filter(r => r.pass).length}/${report.planner0.length}`,
  distill: report.distill.map(r => `${r.name}: ${r.result.abstain ? `abstain (${r.result.reason})` : 'hypothesis'} (expected ${r.expect})`),
  planner: `${report.planner.filter(r => r.pass).length}/${report.planner.length}`,
  generation: scored.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] ?? 0) + 1 }), {}),
  baselineChance: report.generation.filter(r => r.name.startsWith('baseline')).map(r => `${r.name}-${r.draw}: ${r.contrast.length ? r.contrast.join(', ') : 'none'}`),
  exploratory: report.generation.filter(r => r.expected === undefined).map(r => `${r.name}: ${r.adaptation?.move ?? 'abstain'}`),
};
report.finishedAt = new Date().toISOString();
await save();
await server.close();
console.log(JSON.stringify(report.summary, null, 2));
