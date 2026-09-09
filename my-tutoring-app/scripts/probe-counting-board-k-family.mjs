// counting-board K counting-out family — runtime probe (2026-09-08).
// Run from my-tutoring-app.
//
// Slice 7 / `counting-extensions`: five published K rows ask the child to count
// out a named number from a pile, hold the number while the set moves, take
// some away, put more on, or count on from a group they cannot see. This drives
// the LIVE generator with each new eval mode PINNED and pushes every draw
// through the SHIPPED surfaces — the content oracle, the judged-script build
// gate, and the real cue text — so the probe fails wherever production would.
//
// What it asserts per draw:
//   1. every challenge carries the pinned mode (the schema enum did its job)
//   2. the shipped counting-board oracle reports no violations and no unchecked
//      type (a mode the oracle does not know is not a passing mode)
//   3. NO item is dropped by the script's build gate — a dropped item is never
//      backfilled, so a drop silently shortens a child's run
//   4. the pack passes the family's structural gates
//   5. no spoken ask contains the answer word (give_me_n excepted BY CONTRACT —
//      its ask IS the number, and its harness answers say so)
//   6. counts stay inside the K band, and the change never equals the answer
//
//   node scripts/probe-counting-board-k-family.mjs [out.json] [--draws=1] [--tiers=]
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
    || 'qa/eval-reports/counting-board-k-family-2026-09-08.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));
const tiers = (args.find((a) => a.startsWith('--tiers=')) || '--tiers=,hard').slice(8).split(',');

// A published K row per mode, verbatim from the live curriculum.
const CASES = [
  {
    mode: 'give_me_n',
    topic: 'Count out a requested number of objects from a larger group (up to 10)',
    objective: 'Count out a requested number of objects from a larger group',
  },
  {
    mode: 'recount_moved',
    topic: 'Recognize that the number of objects stays the same when they are rearranged, up to 10',
    objective: 'Re-count a set after it is rearranged and say the number is the same',
  },
  {
    mode: 'take_away',
    topic: 'Count back by removing objects from a group of up to 10',
    objective: 'Take objects away from a group and say how many are left',
  },
  {
    mode: 'add_more',
    topic: 'Add one or two more objects to a group of up to 10 and say the new total',
    objective: 'Add more objects to a group and say the new total',
  },
  {
    mode: 'count_on',
    topic: 'Combine a hidden group with visible objects and say how many altogether, within 10',
    objective: 'Count on from a hidden group of objects to find the total',
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
  const { generateCountingBoard } = await runner.import(`${base}service/math/gemini-counting-board.ts`);
  const { countingBoardOracle } = await runner.import(`${base}service/qa/oracles/counting-board.ts`);
  const script = await runner.import(`${base}primitives/visual-primitives/math/countingBoardScript.ts`);
  const { checkPackGates } = await runner.import(`${base}hooks/judgedScriptContract.testkit.ts`);
  const { spokenSpanOf } = await runner.import(`${base}hooks/judgedScriptContract.ts`);

  for (const kase of CASES) {
    for (const tier of tiers) {
      for (let i = 1; i <= draws; i++) {
        const failures = [];
        const note = (ok, msg) => { if (!ok) failures.push(msg); };
        const label = `${kase.mode}${tier ? `/${tier}` : '/none'} draw ${i}`;

        let data;
        try {
          data = await generateCountingBoard({
            topic: kase.topic,
            gradeContext: GRADE,
            intent: kase.objective,
            raw: {
              targetEvalMode: kase.mode,
              gradeBand: 'K',
              objectiveText: kase.objective,
              ...(tier ? { difficulty: tier } : {}),
            },
          });
        } catch (err) {
          evidence.draws.push({ label, mode: kase.mode, tier, error: String(err) });
          console.log(`✗ ${label}: threw ${err}`);
          save();
          continue;
        }

        const challenges = data.challenges ?? [];
        note(challenges.length >= 3, `only ${challenges.length} challenge(s) — mastery needs 3-6`);
        for (const c of challenges) note(c.type === kase.mode, `challenge ${c.id} is "${c.type}", not the pinned mode`);

        // 2 — the shipped oracle.
        const oracle = countingBoardOracle.verify(data, {
          componentId: 'counting-board', evalMode: kase.mode, topic: kase.topic,
          gradeLevel: GRADE, grade: 'K', intent: kase.objective,
        });
        for (const v of oracle.violations) note(false, `oracle ${v.check} @${v.where}: ${v.detail}`);
        for (const t of oracle.uncheckedTypes) note(false, `oracle has no checks for "${t}"`);

        // 3 — the build gate keeps every item.
        const objectWord = script.objectWordFor(data.objects?.type ?? 'stars');
        const items = script.itemsFromChallenges(challenges, { objectWord });
        note(items.length === challenges.length,
          `${challenges.length - items.length} item(s) dropped by the script build gate — a dropped item is never backfilled`);

        // 4 — the family's structural gates on the real cue surface.
        const gateFailures = checkPackGates(script.countingBoardPackBase(items));
        note(gateFailures.length === 0, `pack gates: ${JSON.stringify(gateFailures)}`);

        // 5 — the ask never contains the answer word (give_me_n's ask IS it).
        for (const item of items) {
          const answers = script.countingBoardHarnessAnswers(item);
          const spoken = [
            spokenSpanOf(script.itemCue(item, { opening: true, howToPlay: true })),
            spokenSpanOf(script.itemCue(item)),
          ].join(' ').toLowerCase();
          for (const token of answers.leakTokens) {
            note(!new RegExp(`\\b${token}\\b`).test(spoken), `item ${item.id} says the answer "${token}" in its ask: ${spoken}`);
          }
        }

        // 6 — K band, and the spoken change is never the answer.
        for (const c of challenges) {
          const shown = c.type === 'add_more' ? c.count + (c.changeBy ?? 0) : c.count;
          note(shown <= 10, `${c.id} puts ${shown} objects in play — above what this objective names`);
          note(c.targetAnswer >= 1, `${c.id} has an answer below one`);
          if (c.changeBy != null) note(c.changeBy !== c.targetAnswer, `${c.id}: the change (${c.changeBy}) is also the answer`);
          if (c.type === 'give_me_n') {
            note(c.count > c.targetAnswer, `${c.id}: the pile (${c.count}) does not exceed the ask (${c.targetAnswer})`);
            // A pile a K child cannot count out of at a glance is a different task.
            note(c.count <= 12, `${c.id}: a pile of ${c.count} is more than a five-year-old counts from`);
          }
          if (c.type === 'count_on') note((c.startFrom ?? 0) >= 1 && (c.startFrom ?? 0) < c.targetAnswer, `${c.id}: unusable startFrom ${c.startFrom}`);
        }

        // give_me_n: the NUMBER asked for is the problem, so it has to vary.
        if (kase.mode === 'give_me_n') {
          const asks = challenges.map((c) => c.targetAnswer);
          note(new Set(asks).size >= Math.min(4, asks.length),
            `only ${new Set(asks).size} distinct request(s) across ${asks.length} challenges (${asks.join(', ')})`);
        }

        // N challenges = N problems.
        const cards = challenges.map((c) => `${c.count}|${c.targetAnswer}|${c.changeBy ?? ''}|${c.startFrom ?? ''}`);
        note(new Set(cards).size >= Math.min(3, cards.length),
          `only ${new Set(cards).size} distinct problem(s) across ${cards.length} challenges`);

        evidence.draws.push({
          label, mode: kase.mode, tier, failures,
          title: data.title,
          objectType: data.objects?.type,
          checkedChallenges: oracle.checkedChallenges,
          challenges: challenges.map((c) => ({
            id: c.id, type: c.type, instruction: c.instruction,
            count: c.count, changeBy: c.changeBy, startFrom: c.startFrom,
            targetAnswer: c.targetAnswer, arrangement: c.arrangement,
          })),
          asks: items.map((it) => spokenSpanOf(script.itemCue(it))),
        });
        console.log(`${failures.length === 0 ? '✓' : '✗'} ${label}: ${challenges.length} challenges, ${failures.length} failure(s)`);
        for (const f of failures.slice(0, 6)) console.log(`    - ${f}`);
        save();
      }
    }
  }
} finally {
  await server.close();
}

const failed = evidence.draws.filter((d) => d.error || (d.failures ?? []).length > 0);
evidence.summary = { draws: evidence.draws.length, failedDraws: failed.length };
save();
console.log(`\n${evidence.draws.length - failed.length}/${evidence.draws.length} draws clean → ${output}`);
process.exit(failed.length === 0 ? 0 : 1);
