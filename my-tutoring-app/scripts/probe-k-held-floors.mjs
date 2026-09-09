// K probe for the two HELD band floors (2026-09-09) — atlas item
// `k-band-floor-reaudit`, the three rows still behind them.
//
// The re-audit held two Grade-1 floors as WRONG-BAND at PRE and left three
// published K rows with no home. This probe asks the question the queue item
// asks: does the K-allowed mode the review redirected each row to actually
// carry the objective?
//
//   OPS001-02-G / OPS001-03-F -> number-bond missing_part
//   TIME001-03-G              -> analog-clock read + time-sequencer sequence-5
//
// It drives the LIVE generators with the mode PINNED at Kindergarten and
// records what a K child would face, so the judgement is made against draws
// rather than against the catalog prose.
//
//   node scripts/probe-k-held-floors.mjs [out.json] [--draws=2]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const output = resolve(
  root,
  args.find((a) => a.endsWith('.json') && !a.startsWith('--'))
    || 'qa/eval-reports/k-held-floors-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=2').slice(8));

const CASES = [
  {
    row: 'OPS001-02-G',
    primitive: 'number-bond',
    mode: 'missing_part',
    topic: 'Connect addition and subtraction as inverse operations within 10 using related facts',
    objective: 'Connect addition and subtraction as inverse operations within 10 using related facts',
  },
  {
    row: 'OPS001-03-F',
    primitive: 'number-bond',
    mode: 'missing_part',
    topic: 'Complete fact families for numbers within 5, demonstrating the addition-subtraction relationship',
    objective: 'Complete fact families for numbers within 5, demonstrating addition-subtraction relationship',
  },
  {
    row: 'TIME001-03-G',
    primitive: 'analog-clock',
    mode: 'read',
    topic: 'Connect whole-hour times to daily activities in sequence',
    objective: 'Connect whole-hour times to daily activities in sequence',
  },
  {
    row: 'TIME001-03-G',
    primitive: 'time-sequencer',
    mode: 'sequence-5',
    topic: 'Connect whole-hour times to daily activities in sequence',
    objective: 'Connect whole-hour times to daily activities in sequence',
  },
];
const GRADE = 'Kindergarten';

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), grade: GRADE, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateNumberBond } = await runner.import(`${base}service/math/gemini-number-bond.ts`);
  const { generateAnalogClock } = await runner.import(`${base}service/math/gemini-analog-clock.ts`);
  const { generateTimeSequencer } = await runner.import(`${base}service/math/gemini-time-sequencer.ts`);
  const { buildBondItems, itemCue } = await runner.import(`${base}primitives/visual-primitives/math/numberBondScript.ts`);

  const GENERATORS = {
    'number-bond': generateNumberBond,
    'analog-clock': generateAnalogClock,
    'time-sequencer': generateTimeSequencer,
  };

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const label = `${kase.row} ${kase.primitive}/${kase.mode} draw ${i}`;
      let data;
      try {
        data = await GENERATORS[kase.primitive]({
          topic: kase.topic,
          gradeContext: GRADE,
          intent: kase.objective,
          scope: { topic: kase.topic, objectiveText: kase.objective, intent: kase.objective },
          raw: { targetEvalMode: kase.mode, gradeBand: 'K', objectiveText: kase.objective },
        });
      } catch (err) {
        evidence.draws.push({ label, row: kase.row, error: String(err) });
        console.log(`x ${label}: threw ${err}`);
        save();
        continue;
      }

      const challenges = data.challenges ?? [];
      const record = {
        label, row: kase.row, primitive: kase.primitive, mode: kase.mode,
        title: data.title,
        challengeCount: challenges.length,
        challenges: challenges.map((c) => ({
          id: c.id, type: c.type,
          instruction: c.instruction, hint: c.hint,
          // number-bond
          whole: c.whole, part1: c.part1, part2: c.part2, factFamily: c.factFamily,
          // analog-clock
          time: c.targetHour != null ? `${c.targetHour}:${String(c.targetMinute ?? 0).padStart(2, '0')}` : undefined,
          options: [c.option0, c.option1, c.option2, c.option3].filter((o) => o != null),
          // time-sequencer
          events: c.events ?? (c.event1 ? [c.event1, c.event2, c.event3, c.event4, c.event5].filter(Boolean) : undefined),
          times: c.event1Time ? [c.event1Time, c.event2Time, c.event3Time, c.event4Time, c.event5Time].filter(Boolean) : undefined,
          correctOrder: c.correctOrder,
        })),
      };

      // The judged loop is what a K child actually hears on number-bond, so
      // record the ASKS, not just the data: the objective is about what the
      // child is asked to connect.
      if (kase.primitive === 'number-bond') {
        const { items, droppedChallenges } = buildBondItems(challenges, { band: 'K', maxNumber: 5 });
        record.droppedChallenges = droppedChallenges;
        record.spokenTurns = items.map((it) => ({
          id: it.id, kind: it.kind, whole: it.whole,
          knownPart: it.knownPart, answer: it.answer,
          cue: itemCue(it),
        }));
      }

      evidence.draws.push(record);
      console.log(`- ${label}: ${challenges.length} challenges${record.spokenTurns ? `, ${record.spokenTurns.length} judged turns` : ''}`);
      save();
    }
  }
} finally {
  await server.close();
}

evidence.summary = { draws: evidence.draws.length, errors: evidence.draws.filter((d) => d.error).length };
save();
console.log(`\n${evidence.draws.length} draws -> ${output}`);
