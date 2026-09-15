// Drives the REAL counting-board evidence builder (countingBoardDiagnosisEvidence,
// countingObservation, countingTask) with synthetic wrong-rule student journeys,
// to produce genuine DiagnosisEvidence packets for /misconception-test Probe D.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const root = process.cwd();
const out = resolve(root, 'qa/misconception');

const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

try {
  const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const S = '/src/components/lumina/primitives/visual-primitives/math';
  const { countingBoardEvidenceSummary, countingObservation, countingTask } = await L.import(S + '/countingBoardEvidence.ts');
  const { judgedRunEvidence } = await L.import('/src/components/lumina/hooks/judgedRunEvidence.ts');
  // The runner owns first-response scoring and phase selection (slice 1); the pack supplies the per-mode statement.
  const countingBoardDiagnosisEvidence = (summary, items) => judgedRunEvidence({ outcomes: summary.outcomes, observations: summary.observations, items,
    pack: { activityLine: 'Counting board', evidenceSummary: countingBoardEvidenceSummary } });

  // Helper: build one CountingItem.
  const item = (kind, fields) => ({ id: fields.id, kind, objectWord: fields.objectWord ?? 'bears', ...fields });

  // ── Persona A (generative): take_away — states the number TAKEN AWAY, not what's left.
  // A stable rule: on every take_away board the child echoes changeBy instead of count-changeBy.
  {
    const items = [
      item('take_away', { id: 'ta1', count: 7, changeBy: 2, target: 5 }),
      item('take_away', { id: 'ta2', count: 9, changeBy: 3, target: 6 }),
      item('take_away', { id: 'ta3', count: 6, changeBy: 1, target: 5 }),
    ];
    const gradeBand = 'K';
    const observations = items.map((it) => countingObservation(it, gradeBand, { heard: String(it.changeBy) }));
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 6 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    writeFileSync(resolve(out, 'cb-scenario-take-away-states-change.json'), JSON.stringify(evidence, null, 2));
  }

  // ── Persona B (generative): count_on — ignores the started group, says only the EXTRA count.
  {
    const items = [
      item('count_on', { id: 'co1', count: 8, startFrom: 5, target: 8 }),
      item('count_on', { id: 'co2', count: 7, startFrom: 4, target: 7 }),
      item('count_on', { id: 'co3', count: 9, startFrom: 6, target: 9 }),
    ];
    const gradeBand = 'K';
    const observations = items.map((it) => countingObservation(it, gradeBand, { heard: String(it.count - (it.startFrom ?? 0)) }));
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 8 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    writeFileSync(resolve(out, 'cb-scenario-count-on-extras-only.json'), JSON.stringify(evidence, null, 2));
  }

  // ── Persona C (generative): recount_moved — believes rearranging changes the count (conservation gap).
  // Reliably gives a DIFFERENT number after the objects move — here, consistently one MORE than the true count.
  {
    const items = [
      item('recount_moved', { id: 'rm1', count: 5, target: 5 }),
      item('recount_moved', { id: 'rm2', count: 7, target: 7 }),
      item('recount_moved', { id: 'rm3', count: 4, target: 4 }),
    ];
    const gradeBand = 'K';
    const observations = items.map((it) => countingObservation(it, gradeBand, { heard: String(it.count + 1) }));
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 7 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    writeFileSync(resolve(out, 'cb-scenario-recount-moved-conservation.json'), JSON.stringify(evidence, null, 2));
  }

  // ── Persona D (abstain): add_more — inconsistent errors, no stable rule (once over, once under, one judge-backed slip).
  {
    const items = [
      item('add_more', { id: 'am1', count: 4, changeBy: 2, target: 6 }),
      item('add_more', { id: 'am2', count: 5, changeBy: 3, target: 8 }),
      item('add_more', { id: 'am3', count: 3, changeBy: 1, target: 4 }),
    ];
    const gradeBand = 'K';
    const observations = [
      countingObservation(items[0], gradeBand, { heard: '7' }), // one over
      countingObservation(items[1], gradeBand, { heard: '6' }), // several under, no consistent rule
      { ...countingObservation(items[2], gradeBand, { heard: null }), observed: 'No reliable transcript; the tutor judged the spoken answer wrong.' },
    ];
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 9 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    // Attach one judge-backed correction line, mirroring the DI sentinel script, to test a tier-A packet.
    evidence.judgeFeedback = 'My turn: I put two more bears on and counted them all — one, two, three, four, five, six. Your turn. How many altogether?';
    writeFileSync(resolve(out, 'cb-scenario-add-more-inconsistent.json'), JSON.stringify(evidence, null, 2));
  }

  // ── Persona E (generative): take_away — reports the STARTING count, ignoring the change (the move's actual target).
  {
    const items = [
      item('take_away', { id: 'ta1e', count: 7, changeBy: 2, target: 5 }),
      item('take_away', { id: 'ta2e', count: 9, changeBy: 3, target: 6 }),
      item('take_away', { id: 'ta3e', count: 6, changeBy: 1, target: 5 }),
    ];
    const gradeBand = 'K';
    const observations = items.map((it) => countingObservation(it, gradeBand, { heard: String(it.count) }));
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 6 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    writeFileSync(resolve(out, 'cb-scenario-take-away-states-start.json'), JSON.stringify(evidence, null, 2));
  }

  // ── Persona F (generative): count_on — says the START back instead of the total.
  {
    const items = [
      item('count_on', { id: 'co1f', count: 8, startFrom: 5, target: 8 }),
      item('count_on', { id: 'co2f', count: 7, startFrom: 4, target: 7 }),
      item('count_on', { id: 'co3f', count: 9, startFrom: 6, target: 9 }),
    ];
    const gradeBand = 'K';
    const observations = items.map((it) => countingObservation(it, gradeBand, { heard: String(it.startFrom) }));
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1, score: 67, seconds: 8 }));
    const summary = { outcomes, observations, solvedCount: 3, firstTryCount: 0, attemptsCount: 6, accuracy: 67, passed: true, hearTaps: 3 };
    const evidence = countingBoardDiagnosisEvidence(summary, items);
    writeFileSync(resolve(out, 'cb-scenario-count-on-says-start-back.json'), JSON.stringify(evidence, null, 2));
  }

  console.log('wrote 6 scenario evidence packets to qa/misconception/');
} finally {
  await server.close();
}
process.exit(0);
