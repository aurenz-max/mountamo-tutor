// counting-board themed objects — runtime probe (2026-09-16).
// Run from my-tutoring-app.
//
// Slice 2 of the student-interests work: a lesson themed on a child's interest
// reaches this generator only as an INTENT STRING, and until now the board threw
// it away — anything outside the six-emoji enum was forced to stars, and a
// `custom` board said "Touch the objects". This probe drives the LIVE generator
// with themed intents and pushes every draw through the SHIPPED surfaces, so it
// fails wherever production would.
//
// What it asserts per themed draw:
//   1. objects.type === 'custom' with a COMPLETE triple (emoji + word +
//      wordSingular) — a partial one draws trucks and says "objects"
//   2. the emoji is exactly one grapheme cluster and carries no ASCII
//   3. the tutor's spoken lines use the themed word, and never "objects"
//   4. the one-at-a-time line says the themed SINGULAR ("each dump truck"),
//      which is the line the SINGULAR map cannot cover for an open noun
//   5. the shipped oracle stays clean and the script build gate drops nothing —
//      theming must not cost a single existing requirement
//   6. an UNTHEMED intent still lands on the enum (the fallback is intact)
//
//   node scripts/probe-counting-board-themed-objects.mjs [out.json] [--draws=1]
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
    || 'qa/eval-reports/counting-board-themed-objects-2026-09-16.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));

const ENUM_TYPES = ['bears', 'apples', 'stars', 'blocks', 'fish', 'butterflies'];
const GRADE = 'Kindergarten';

// Themed cases mirror how the manifest actually stamps an interest: the child's
// interest reaches the component as a themed INTENT, never as a config field.
const CASES = [
  {
    label: 'dump trucks / give_me_n',
    mode: 'give_me_n',
    topic: 'Count out a requested number of objects from a larger group (up to 10)',
    objective: 'Count out the dump trucks the driver asks for from the pile',
    themed: true,
  },
  {
    label: 'dump trucks / count_all',
    mode: 'count_all',
    topic: 'Counting to 5',
    objective: 'Count the dump trucks on the site, up to five',
    themed: true,
  },
  {
    label: 'diggers / count_all',
    mode: 'count_all',
    topic: 'Counting to 5',
    objective: 'Count the diggers working in the sand, up to five',
    themed: true,
  },
  {
    label: 'unthemed / count_all (fallback intact)',
    mode: 'count_all',
    topic: 'Counting to 5',
    objective: 'Count a group of objects and say how many, up to five',
    themed: false,
  },
];

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), grade: GRADE, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

const graphemes = (value) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length;

let failed = 0;
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateCountingBoard } = await runner.import(`${base}service/math/gemini-counting-board.ts`);
  const { countingBoardOracle } = await runner.import(`${base}service/qa/oracles/counting-board.ts`);
  const script = await runner.import(`${base}primitives/visual-primitives/math/countingBoardScript.ts`);
  const { checkPackGates } = await runner.import(`${base}hooks/judgedScriptContract.testkit.ts`);
  const { spokenSpanOf } = await runner.import(`${base}hooks/judgedScriptContract.ts`);

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };
      const label = `${kase.label} draw ${i}`;

      let data;
      try {
        data = await generateCountingBoard({
          topic: kase.topic,
          gradeContext: GRADE,
          intent: kase.objective,
          raw: { targetEvalMode: kase.mode, gradeBand: 'K', objectiveText: kase.objective },
        });
      } catch (err) {
        evidence.draws.push({ label, error: String(err) });
        console.log(`✗ ${label}: threw ${err}`);
        failed++; save(); continue;
      }

      const objects = data.objects ?? {};
      const themed = objects.type === 'custom';

      // 1 + 2 — a themed board is a COMPLETE, renderable triple.
      if (themed) {
        note(typeof objects.emoji === 'string' && objects.emoji.length > 0, 'custom board with no emoji — renders ⬤');
        note(typeof objects.word === 'string' && objects.word.length > 0, 'custom board with no word — tutor says "objects"');
        note(typeof objects.wordSingular === 'string' && objects.wordSingular.length > 0, 'custom board with no wordSingular');
        if (objects.emoji) {
          note(graphemes(objects.emoji) === 1, `emoji "${objects.emoji}" is ${graphemes(objects.emoji)} graphemes, not 1`);
          note(!/[A-Za-z0-9]/.test(objects.emoji), `emoji "${objects.emoji}" contains ASCII`);
        }
        if (objects.word) note(/^[a-z]+(?:[- ][a-z]+)?$/.test(objects.word), `word "${objects.word}" is not 1-2 lowercase words`);
        if (objects.wordSingular) note(/^[a-z]+(?:[- ][a-z]+)?$/.test(objects.wordSingular), `wordSingular "${objects.wordSingular}" is not 1-2 lowercase words`);
      } else {
        note(ENUM_TYPES.includes(objects.type), `non-custom board has type "${objects.type}", outside the enum`);
        note(objects.emoji === undefined && objects.word === undefined,
          `enum board is carrying themed fields (${JSON.stringify(objects)}) — they would never be drawn`);
      }

      // 6 — the unthemed case must still reach the enum.
      if (!kase.themed) note(!themed, `unthemed intent produced a custom board (${JSON.stringify(objects)}) — the fallback is not intact`);

      // 3 + 4 — the words the TUTOR SAYS, from the real cue surface.
      const challenges = data.challenges ?? [];
      const objectWord = objects.word || script.objectWordFor(objects.type ?? 'stars');
      const items = script.itemsFromChallenges(challenges, { objectWord, objectSingular: objects.wordSingular });
      note(items.length === challenges.length,
        `${challenges.length - items.length} item(s) dropped by the script build gate`);

      for (const item of items) {
        const spoken = [
          spokenSpanOf(script.itemCue(item, { opening: true, howToPlay: true })),
          spokenSpanOf(script.itemCue(item)),
        ].join(' ').toLowerCase();
        if (themed) {
          note(spoken.includes(objectWord) || spoken.includes(objects.wordSingular),
            `item ${item.id} never says the themed noun "${objectWord}": ${spoken}`);
          note(!/\bobjects\b/.test(spoken),
            `item ${item.id} says the generic "objects" on a themed board: ${spoken}`);
        }
      }

      // The one-at-a-time line is the singular's only consumer.
      if (themed && objects.wordSingular) {
        const countAll = items.find((it) => it.kind === 'count_all' || it.kind === 'recount_moved');
        if (countAll) {
          const how = script.howToPlayFor(countAll);
          note(how.includes(objects.wordSingular),
            `the one-at-a-time line does not say the themed singular "${objects.wordSingular}": ${how}`);
        }
      }

      // 5 — nothing else regressed.
      //
      // `clustering` is RECORDED, not gated. It keys on
      // type:count:arrangement:groupSize:startFrom:changeBy and names no object
      // field, so theming cannot reach it — and on a bound-5 topic with seven
      // challenges it fires on the UNTHEMED control at the same rate (2026-09-16
      // run: themed 1/9, unthemed 1/3). Gating on it would make this probe fail
      // for a reason it does not test; it is queued as its own finding.
      const oracle = countingBoardOracle.verify(data, {
        componentId: 'counting-board', evalMode: kase.mode, topic: kase.topic,
        gradeLevel: GRADE, grade: 'K', intent: kase.objective,
      });
      const baseline = [];
      for (const v of oracle.violations) {
        const msg = `oracle ${v.check} @${v.where}: ${v.detail}`;
        if (v.check === 'clustering') baseline.push(msg);
        else note(false, msg);
      }
      const gateFailures = checkPackGates(script.countingBoardPackBase(items));
      note(gateFailures.length === 0, `pack gates: ${JSON.stringify(gateFailures)}`);

      evidence.draws.push({
        label, objects, challengeCount: challenges.length, baselineViolations: baseline,
        sampleAsk: items[0] ? spokenSpanOf(script.itemCue(items[0], { opening: true, howToPlay: true })) : null,
        failures,
      });
      if (failures.length) { failed++; console.log(`✗ ${label}\n   ${failures.join('\n   ')}`); }
      else console.log(`✓ ${label} → ${objects.emoji ?? ''} ${objectWord}${objects.wordSingular ? ` / ${objects.wordSingular}` : ''}`);
      save();
    }
  }
} finally {
  await server.close();
}
save();
console.log(`\n${failed === 0 ? 'ALL CLEAN' : `${failed} draw(s) FAILED`} — ${output}`);
process.exit(failed === 0 ? 0 : 1);
