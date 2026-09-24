// Real distiller + real planner/generator for an observation that ORIGINATES in
// base-ten-blocks read_blocks. Fictional learner responses; no account, store,
// submission or calibration write. Item text and answer words come from the
// production items; the evidence packet mirrors the RETIRED scripted runner's
// assembly (base-ten-blocks runs only on the teaching workspace since 09-23,
// whose packet is teachingEvaluation.ts: re-derive before trusting this probe).
// Expected outcomes are declared below, before any call is made.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const out = resolve(root, '../artifacts/blocks-origin-observation');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const script = await runner.import('/src/components/lumina/primitives/visual-primitives/math/baseTenScript.ts');
const model = await runner.import('/src/components/lumina/primitives/visual-primitives/math/baseTenModel.ts');
const { compiledBlockWorthContrast } = await runner.import('/src/components/lumina/service/math/baseTenRemediation.ts');

const items = script.itemsFromChallenges([4305, 2640].map(targetNumber => ({ type: 'read_blocks', targetNumber })), 'read_blocks');
const byId = Object.fromEntries(items.map(i => [i.id, i]));
const task = i => ({ challenge: `${i.actionContract.instruction} Mat value ${i.problem.target}; asked block size: ${model.blockNounPlural(i.problem.place)}.`,
  expected: i.step === 'worth' ? model.readWorthWord(i.problem) : model.wordFor(model.readCount(i.problem)) });
/** corrections: [itemId, heard[] (null = no transcript), tutorCorrection]. Mirrors the runner ledger. */
function evidence(corrections) {
  const observations = [];
  for (const [id, heard, correction] of corrections) heard.forEach((said, k) => {
    observations.push({ ...task(byId[id]), observed: said ?? 'No intelligible answer.', itemId: id, phase: byId[id].action,
      support: `Correction observation; ${k} prior corrections on this item. Other assistance is not established.`,
      judgeFeedback: correction });
  });
  const source = [...observations].reverse().find(o => o.judgeFeedback) ?? observations.at(-1);
  return { challengeSummary: source.challenge, expected: source.expected, observed: source.observed, judgeFeedback: source.judgeFeedback,
    phases: observations.slice(-12).map(({ judgeFeedback, ...p }) => p),
    priorAttempts: observations.filter(o => o !== source).slice(-4).map(o => ({ challenge: o.challenge, observed: o.observed })) };
}
const thousandFix = 'My turn: one thousand-block is worth one thousand, so four of them are worth four thousand.';
const hundredFix = 'My turn: one hundred-flat is worth one hundred, so six of them are worth six hundred.';

// Probe D: the shared distiller on blocks-origin correction evidence (all submissions failed, as the capture gate requires).
const distillCases = [
  { name: 'bare-count-two-sizes', expect: 'diagnose', draws: 2, score: 34,
    evidence: evidence([['base-ten-1-worth', ['four', 'four', 'four'], thousandFix], ['base-ten-2-worth', ['six'], hundredFix]]) },
  { name: 'inconsistent-errors', expect: 'abstain', draws: 2, score: 50,
    evidence: evidence([['base-ten-1-worth', ['seven', 'thirty', 'nine hundred'], thousandFix]]) },
  { name: 'no-transcript', expect: 'abstain', draws: 1, score: 50,
    evidence: evidence([['base-ten-1-worth', [null, null, null], thousandFix]]) },
];
// First-response gate (passing average, every item eventually right). Expected outcomes declared here.
const firstResponseCases = [
  { name: 'corrected-once-every-worth', expect: 'diagnose', draws: 2, score: 67, firstResponseScore: 50,
    evidence: evidence([['base-ten-1-worth', ['four'], thousandFix], ['base-ten-2-worth', ['six'], hundredFix]]) },
  { name: 'corrected-once-inconsistent', expect: 'abstain', draws: 2, score: 67, firstResponseScore: 50,
    evidence: evidence([['base-ten-1-worth', ['seven hundred'], thousandFix], ['base-ten-2-worth', ['sixty-two'], hundredFix]]) },
];
const post = async body => {
  const response = await fetch('http://127.0.0.1:3000/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
const report = { fictional: true, learningWrites: false, distill: [], apply: [], crossRepresentation: [] };
const save = () => writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
let distilled = null;
if (process.argv.includes('--first-response')) {
  const rows = [];
  try {
    for (const c of firstResponseCases) for (let draw = 0; draw < c.draws; draw++) {
      const packet = { ...c.evidence, firstResponseScore: c.firstResponseScore };
      const result = await post({ action: 'distillMisconception', params: { evidence: packet, score: c.score, success: true,
        subskillId: 'NBT004-01-b', evalMode: 'read_blocks', gradeLevel: '4' } });
      const pass = c.expect === 'diagnose' ? result.abstain === false : result.abstain === true;
      rows.push({ name: c.name, draw, expected: c.expect, evidence: packet, result,
        answerLeaks: ['four thousand', 'six hundred'].filter(w => JSON.stringify(result).toLowerCase().includes(w)), pass });
      writeFileSync(resolve(out, 'first-response-report.json'), JSON.stringify(rows, null, 2));
    }
  } finally {
    await server.close();
    console.log(JSON.stringify(rows.map(r => [r.name, r.draw, r.result.abstain, r.pass, (r.result.misconceptionText || r.result.reason).slice(0, 140)]), null, 1));
  }
  process.exit(0);
}
try {
  for (const c of distillCases) for (let draw = 0; draw < c.draws; draw++) {
    const result = await post({ action: 'distillMisconception', params: { evidence: c.evidence, score: c.score, success: false,
      subskillId: 'NBT004-01-b', evalMode: 'read_blocks', gradeLevel: '4' } });
    const pass = c.expect === 'diagnose' ? result.abstain === false : result.abstain === true;
    if (c.name === 'bare-count-two-sizes' && result.abstain === false && !distilled) distilled = result.misconceptionText;
    const leaks = ['four thousand', 'six hundred'].filter(w => JSON.stringify(result).toLowerCase().includes(w));
    report.distill.push({ name: c.name, draw, expected: c.expect, evidence: c.evidence, result, answerLeaks: leaks, pass });
    save();
  }

  // Probe G: blocks consumer applicability. Expected: move = contrast_block_count_and_worth, or null = abstain.
  const move = 'contrast_block_count_and_worth';
  const applyCases = [
    ['distilled', distilled, move, 1],
    ['paraphrase-a', 'Asked what a group of same-size blocks is worth altogether, the learner answers with how many blocks there are.', move, 1],
    ['paraphrase-b', 'The learner treats every flat or cube as a single unit, so six hundred-flats are reported as six.', move, 1],
    ['paraphrase-c', 'Asked what six hundred-flats are worth altogether, the learner says six, treating each flat as worth one.', move, 1],
    ['unrelated', 'The learner reverses the numerator and denominator when comparing fractions.', null, 1],
    ['uncertain', 'The audio was unreliable and the responses contradict each other; no consistent pattern about block counts or their worth can be inferred.', null, 1],
    // Nearby but not teachable here: regrouping is outside this capability. Borderline, so three draws.
    ['nearby-regroup', 'When one rod is traded for ten ones, the learner predicts only the ten new ones and forgets the ones already on the mat.', null, 3],
    // Mirror error on the count step. The move asks count and worth for equal counts, so it is expected to apply; three draws to see variability.
    ['mirror-count-as-worth', 'Asked how many rods are on the mat, the learner gives their total worth, such as forty, instead of the count.', move, 3],
  ];
  const generate = async (componentId, evalMode, focus, file) => {
    const query = new URLSearchParams({ componentId, evalMode, gradeLevel: '4', grade: '4', difficulty: 'medium',
      topic: 'Place value in four-digit whole numbers', ...(focus ? { remediationFocus: focus } : {}) });
    const response = await fetch(`http://127.0.0.1:3000/api/lumina/eval-test?${query}`, { signal: AbortSignal.timeout(180000) });
    const payload = await response.json();
    writeFileSync(resolve(out, file), JSON.stringify(payload, null, 2));
    return { ok: response.ok, payload };
  };
  if (!distilled) throw new Error('No distilled blocks-origin hypothesis to apply; distill results preserved');
  for (const [name, focus, expected, draws] of applyCases) {
    for (let draw = 0, attempts = 0; draw < draws && attempts < draws + 3; attempts++) {
      const { ok, payload } = await generate('base-ten-blocks', 'read_blocks', focus, `blocks-${name}-${attempts}.json`);
      const d = payload.fullData ?? {};
      const adaptation = d.learningAdaptation;
      const shape = ok && payload.status === 'pass' && d.supportTier === 'medium'
        && d.challenges?.every(c => c.type === 'read_blocks' && !c.showColumnCounts && !c.showBlocksTotal) && !JSON.stringify(d).includes(focus);
      const compiled = d.challenges ? compiledBlockWorthContrast(d.challenges).count : null;
      const saturated = expected && adaptation?.move === expected && adaptation.status === 'insufficient-capacity';
      const pass = !!shape && (expected ? adaptation?.move === expected && adaptation.comparisonCount === 2 && compiled === 2 : !adaptation);
      report.apply.push({ name, attempt: attempts, focus, expected, adaptation, compiledContrasts: compiled, saturated, shape: !!shape, pass });
      save();
      if (saturated) continue; // bounded capacity retry; the saturated draw stays in the report
      draw++;
    }
  }

  // Planner-only cross-representation read: the same blocks-origin text against the chart capability.
  // Production chart delivery does NOT receive blocks-origin observations; this shows the planner's judgment only.
  const { ok, payload } = await generate('place-value-chart', 'compare', distilled, 'chart-distilled-planner-only.json');
  report.crossRepresentation.push({ focus: distilled, expected: 'contrast_digit_worth', adaptation: payload.fullData?.learningAdaptation,
    receipt: !!payload.fullData?.misconceptionOpportunity, ok, productionDelivery: false });
} finally {
  const rows = [...report.distill, ...report.apply];
  report.summary = { distillPass: report.distill.filter(r => r.pass).length + '/' + report.distill.length,
    applyPass: report.apply.filter(r => r.pass).length + '/' + report.apply.length,
    saturatedDraws: report.apply.filter(r => r.saturated).length, allPass: rows.length > 0 && rows.every(r => r.pass || r.saturated) };
  save();
  await server.close();
  console.log(JSON.stringify({ summary: report.summary, distill: report.distill.map(r => [r.name, r.draw, r.result.abstain, r.pass]),
    apply: report.apply.map(r => [r.name, r.attempt, r.adaptation?.move ?? 'abstain', r.adaptation?.status, r.compiledContrasts, r.pass]),
    cross: report.crossRepresentation.map(r => [r.adaptation?.move ?? 'abstain', r.receipt]) }, null, 1));
}
