// length-lab K extensions probe (2026-09-09) — slice 7 / `length-lab-extensions`.
// Run from my-tutoring-app.
//
// Three published K rows: estimate before measuring, measure with hands or
// fingers, and measure the same object with two units. There is no length-lab
// content oracle yet, so the independent re-derivation lives here: the counts
// are recomputed from the object's own length rather than read off the key.
//
//   node scripts/probe-length-lab-k-estimate.mjs [out.json] [--draws=1]
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
    || 'qa/eval-reports/length-lab-k-extensions-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));

const CASES = [
  {
    mode: 'estimate_then_tile',
    topic: 'Estimate lengths using everyday references before measuring, then measure with non-standard units',
    objective: 'Estimate how many units long an object is, then measure to check',
  },
  {
    mode: 'two_unit_compare',
    topic: 'Compare measurements of the same object using different non-standard units',
    objective: 'Measure one object with two different units and compare the counts',
  },
  {
    mode: 'tile_and_count',
    topic: 'Use body parts such as hands and fingers to measure and describe how long objects are',
    objective: 'Measure objects using hands and fingers as units',
    wantBodyUnit: true,
  },
];
const GRADE = 'Kindergarten';
const BODY_UNITS = new Set(['hands', 'fingers', 'feet']);

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), grade: GRADE, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateLengthLab } = await runner.import('/src/components/lumina/service/math/gemini-length-lab.ts');

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };
      const label = `${kase.mode} draw ${i}`;

      let data;
      try {
        data = await generateLengthLab({
          topic: kase.topic,
          gradeContext: GRADE,
          intent: kase.objective,
          scope: { topic: kase.topic, objectiveText: kase.objective, intent: kase.objective },
          raw: { targetEvalMode: kase.mode, gradeBand: 'K', objectiveText: kase.objective },
        });
      } catch (err) {
        evidence.draws.push({ label, mode: kase.mode, error: String(err) });
        console.log(`✗ ${label}: threw ${err}`);
        save();
        continue;
      }

      const challenges = data.challenges ?? [];
      note(challenges.length >= 3, `only ${challenges.length} challenge(s) — mastery needs 3-6`);
      for (const c of challenges) note(c.type === kase.mode, `challenge ${c.id} is "${c.type}", not the pinned mode`);

      for (const c of challenges) {
        note(!!c.instruction && !!c.hint, `${c.id}: missing instruction or hint`);
        note(c.objectLength0 >= 1 && c.objectLength0 <= 12, `${c.id}: object length ${c.objectLength0} is outside 1-12`);

        if (kase.mode === 'estimate_then_tile') {
          // Independent: the count IS the object's length in units.
          note(c.correctUnitCount === c.objectLength0,
            `${c.id}: keyed count ${c.correctUnitCount} but the object is ${c.objectLength0} units long`);
          const opts = c.estimateOptions ?? [];
          note(opts.length >= 3, `${c.id}: only ${opts.length} guess(es) offered`);
          note(opts.includes(c.correctUnitCount), `${c.id}: the true count is not among the guesses ${JSON.stringify(opts)}`);
          note(new Set(opts).size === opts.length, `${c.id}: repeated guesses ${JSON.stringify(opts)}`);
          note(opts.every((o) => o >= 1), `${c.id}: a guess below one`);
          // The instruction must not state the count the child is about to find.
          note(!new RegExp(`\\b${c.correctUnitCount}\\b`).test(`${c.instruction} ${c.hint}`),
            `${c.id}: the wording states the count "${c.correctUnitCount}"`);
        }

        if (kase.mode === 'two_unit_compare') {
          const small = c.correctUnitCount ?? 0;
          const big = c.correctUnitCountB ?? 0;
          note(small > big, `${c.id}: the second unit needs ${big} and the first ${small} — the bigger unit must need fewer`);
          note(c.unitType !== c.unitTypeB, `${c.id}: both units are "${c.unitType}"`);
          // Independent: the object must be a whole number of BOTH units.
          note(c.objectLength0 === small, `${c.id}: the small-unit count ${small} does not span the object (${c.objectLength0})`);
          note(big > 0 && small % big === 0, `${c.id}: ${small} small units do not divide into ${big} big ones — one measurement ends mid-unit`);
          note(c.correctAnswer === c.unitType, `${c.id}: the key says "${c.correctAnswer}" but the smaller unit is "${c.unitType}"`);
        }

        if (kase.wantBodyUnit) {
          note(BODY_UNITS.has(c.unitType ?? data.unitType),
            `${c.id}: the objective asks for hands or fingers but the unit is "${c.unitType ?? data.unitType}"`);
        }
      }

      const cards = challenges.map((c) => `${c.objectName0}|${c.objectLength0}`);
      note(new Set(cards).size >= Math.min(3, cards.length), `only ${new Set(cards).size} distinct object(s) across ${cards.length} challenges`);

      evidence.draws.push({
        label, mode: kase.mode, failures,
        title: data.title, unitType: data.unitType,
        challenges: challenges.map((c) => ({
          id: c.id, type: c.type, instruction: c.instruction,
          object: `${c.objectName0}=${c.objectLength0}`,
          unitType: c.unitType, unitTypeB: c.unitTypeB,
          correctUnitCount: c.correctUnitCount, correctUnitCountB: c.correctUnitCountB,
          estimateOptions: c.estimateOptions, correctAnswer: c.correctAnswer,
        })),
      });
      console.log(`${failures.length === 0 ? '✓' : '✗'} ${label}: ${challenges.length} challenges, ${failures.length} failure(s)`);
      for (const f of failures.slice(0, 6)) console.log(`    - ${f}`);
      save();
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
