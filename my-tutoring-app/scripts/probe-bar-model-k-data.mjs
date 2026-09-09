// bar-model K one-to-one data family — runtime probe (2026-09-08).
// Run from my-tutoring-app.
//
// Slice 7 / `k-data-recording`: nine published K Mathematics rows ask a child to
// record data with stickers, read a one-icon-per-object graph, match a group of
// objects to the row that shows that many, or say which row has the most. This
// drives the LIVE generator (real Gemini) with each new eval mode PINNED, then
// pushes every draw through the SHIPPED oracle — not a parallel re-derivation —
// so the probe fails wherever production would.
//
// What it asserts per draw:
//   1. every challenge carries the pinned eval mode (the schema enum did its job)
//   2. the shipped bar-model oracle reports no violations
//   3. no prompt or hint states a quantity (the answer-leak rule; "one" exempt)
//   4. counts stay inside the K band (1-10) on every row and in every group
//   5. the structural tier landed: row count and the gap to the nearest rival
//   6. build_one_to_one starts from an empty chart whose rows are all wider than
//      their own answer, so row capacity never says when to stop
//
//   node scripts/probe-bar-model-k-data.mjs [out.json] [--draws=1] [--tiers=easy,hard]
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
    || 'qa/eval-reports/bar-model-k-data-2026-09-08.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));
const tiers = (args.find((a) => a.startsWith('--tiers=')) || '--tiers=,easy,hard').slice(8).split(',');

// A published K row per mode, verbatim from the live curriculum.
const CASES = [
  {
    mode: 'build_one_to_one',
    topic: 'Record and represent category data using tally marks and simple pictographs',
    objective: 'Record and represent category data using tally marks and simple pictographs',
  },
  {
    mode: 'read_one_to_one',
    topic: 'Read and interpret simple graphs to answer "how many" and "which has more/less" questions',
    objective: 'Read and interpret simple graphs to answer "how many" questions',
  },
  {
    mode: 'most_least',
    topic: 'Identify most and least popular items in class data displays and explain basic reasoning',
    objective: 'Identify most and least popular items in class data displays',
  },
  {
    mode: 'match_to_bar',
    topic: 'Match physical objects to their corresponding quantities shown in pictographs and simple bar graphs',
    objective: 'Match physical objects to their corresponding quantities shown in pictographs',
  },
];
const GRADE = 'Kindergarten';

// "one" is exempt — every sticker prompt says "one sticker for each".
const COUNT_WORD = /(\d|\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)/i;
const MORE_RE = /\b(more|most|greater|greatest|tallest|largest|highest|biggest)\b/i;
const LESS_RE = /\b(less|least|fewer|fewest|smallest|shortest|lowest)\b/i;

// Row count per tier, mirroring resolveProblemShape in gemini-bar-model.ts.
const EXPECTED_ROWS = {
  build_one_to_one: { '': 3, easy: 2, medium: 3, hard: 4 },
  read_one_to_one: { '': 4, easy: 3, medium: 4, hard: 5 },
  most_least: { '': 3, easy: 3, medium: 3, hard: 4 },
  match_to_bar: { '': 4, easy: 3, medium: 4, hard: 4 },
};
const EXPECTED_GAP = { easy: 3, medium: 2, hard: 1 };

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
  const { generateBarModel } = await runner.import(`${base}service/math/gemini-bar-model.ts`);
  const { barModelOracle } = await runner.import(`${base}service/qa/oracles/bar-model.ts`);

  for (const kase of CASES) {
    for (const tier of tiers) {
      for (let i = 1; i <= draws; i++) {
        const failures = [];
        const note = (ok, msg) => { if (!ok) failures.push(msg); };
        const label = `${kase.mode}${tier ? `/${tier}` : '/none'} draw ${i}`;

        let data;
        try {
          data = await generateBarModel({
            topic: kase.topic,
            gradeContext: GRADE,
            intent: kase.objective,
            raw: {
              targetEvalMode: kase.mode,
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

        // 1 — the pin held.
        for (const c of challenges) note(c.evalMode === kase.mode, `challenge ${c.id} is "${c.evalMode}", not the pinned mode`);

        // 2 — the shipped oracle.
        const oracle = barModelOracle.verify(data, {
          componentId: 'bar-model', evalMode: kase.mode, topic: kase.topic,
          gradeLevel: GRADE, grade: 'K', intent: kase.objective,
        });
        for (const v of oracle.violations) note(false, `oracle ${v.check} @${v.where}: ${v.detail}`);
        for (const t of oracle.uncheckedTypes) note(false, `oracle has no checks for "${t}"`);

        for (const c of challenges) {
          // 3 — answer leak.
          note(!COUNT_WORD.test(c.prompt ?? ''), `prompt states a quantity: "${c.prompt}"`);
          note(!COUNT_WORD.test(c.hint ?? ''), `hint states a quantity: "${c.hint}"`);

          // 4 — K band.
          for (const v of c.values ?? []) {
            note(v.value <= 10, `row "${v.label}" shows ${v.value} — above the K band`);
            note(!!v.emoji, `row "${v.label}" has no icon, so a pre-reader cannot tell the rows apart`);
          }
          for (const n of c.expectedCounts ?? []) note(n >= 1 && n <= 10, `expectedCounts entry ${n} is outside the K band`);
          if (c.stimulusCount != null) note(c.stimulusCount >= 1 && c.stimulusCount <= 10, `group of ${c.stimulusCount} is outside the K band`);
          note(c.graphStyle === 'picture', `graphStyle "${c.graphStyle}" — K rows must be one-to-one pictures`);
          note((c.scale?.iconValue ?? 1) === 1, `iconValue ${c.scale?.iconValue} — K rows are one icon per object`);

          // 5 — the structural tier landed.
          const wantRows = EXPECTED_ROWS[kase.mode][tier];
          note((c.values ?? []).length === wantRows, `${(c.values ?? []).length} rows, expected ${wantRows} at tier "${tier || 'none'}"`);
          if (tier && (kase.mode === 'most_least' || kase.mode === 'match_to_bar')) {
            const counts = (c.values ?? []).map((v) => v.value);
            const key = counts[c.targetBarIndex];
            const gap = Math.min(...counts.filter((_, idx) => idx !== c.targetBarIndex).map((v) => Math.abs(v - key)));
            note(gap === EXPECTED_GAP[tier], `nearest rival is ${gap} away, expected ${EXPECTED_GAP[tier]} at tier "${tier}"`);
          }

          if (kase.mode === 'most_least') {
            const wantsMore = MORE_RE.test(c.prompt ?? '');
            const wantsLess = LESS_RE.test(c.prompt ?? '');
            note(wantsMore !== wantsLess, `prompt has no single superlative: "${c.prompt}"`);
          }

          // 6 — the sticker chart starts empty and every row outruns its answer.
          if (kase.mode === 'build_one_to_one') {
            note((c.values ?? []).every((v) => v.value === 0), 'the chart is pre-filled — the recording is done for the child');
            const key = c.expectedCounts ?? [];
            note(key.length === (c.values ?? []).length, 'expectedCounts does not cover every row');
            note((c.scale?.max ?? 0) > Math.max(...key), 'a row is exactly as long as its answer — capacity tells the child when to stop');
            note((c.sourceItems ?? []).length === key.reduce((a, b) => a + b, 0), 'the pile does not hold what the key expects');
          }
        }

        // Distinctness across the session — N challenges, N problems.
        const cards = challenges.map((c) => JSON.stringify((c.values ?? []).map((v) => `${v.label}=${v.value}`)));
        note(new Set(cards).size === cards.length, `repeated card within the session: ${cards.length - new Set(cards).size} duplicate(s)`);

        evidence.draws.push({
          label, mode: kase.mode, tier, failures,
          title: data.title,
          checkedChallenges: oracle.checkedChallenges,
          challenges: challenges.map((c) => ({
            id: c.id, prompt: c.prompt, hint: c.hint,
            rows: (c.values ?? []).map((v) => `${v.emoji ?? ''}${v.label}=${v.value}`),
            targetBarIndex: c.targetBarIndex, expectedValue: c.expectedValue, options: c.options,
            expectedCounts: c.expectedCounts, stimulusCount: c.stimulusCount,
            pile: (c.sourceItems ?? []).map((s) => s.emoji).join(''),
            rowCapacity: c.scale?.max, showPlacedCount: c.showPlacedCount,
            showTargetHighlight: c.showTargetHighlight, supportTier: c.supportTier,
          })),
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
