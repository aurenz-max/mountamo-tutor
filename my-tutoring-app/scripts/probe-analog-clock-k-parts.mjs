// analog-clock K clock-parts probe (2026-09-09) — slice 7 / `analog-clock-k-parts`.
// Run from my-tutoring-app.
//
// Three published K rows ask the child to name the hands, count the numbers
// round the face, or hear a whole-hour time and pick the face. This drives the
// LIVE generator with each new mode PINNED and pushes every draw through the
// SHIPPED oracle, which re-derives the hand geometry and the keyed face rather
// than trusting the stored key.
//
//   node scripts/probe-analog-clock-k-parts.mjs [out.json] [--draws=1]
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
    || 'qa/eval-reports/analog-clock-k-parts-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));

const CASES = [
  {
    mode: 'hand_name',
    topic: 'Recognize and name the hour hand and the minute hand on an analog clock',
    objective: 'Point to the hour hand and the minute hand',
  },
  {
    mode: 'count_face',
    topic: 'Count the numbers 1 to 12 around a clock face in order',
    objective: 'Count the numbers around the clock face in order',
  },
  {
    mode: 'hear_time',
    topic: 'Hear a whole-hour time and choose the clock face that shows it',
    objective: 'Match a spoken whole-hour time to the clock face that shows it',
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
  const { generateAnalogClock } = await runner.import(`${base}service/math/gemini-analog-clock.ts`);
  const { analogClockOracle } = await runner.import(`${base}service/qa/oracles/analog-clock.ts`);

  for (const kase of CASES) {
    for (const tier of ['', 'hard']) {
      for (let i = 1; i <= draws; i++) {
        const failures = [];
        const note = (ok, msg) => { if (!ok) failures.push(msg); };
        const label = `${kase.mode}${tier ? `/${tier}` : '/none'} draw ${i}`;

        let data;
        try {
          data = await generateAnalogClock({
            topic: kase.topic,
            gradeContext: GRADE,
            intent: kase.objective,
            // This generator reads ctx.scope directly (buildScopePromptSection).
            scope: { topic: kase.topic, objectiveText: kase.objective, intent: kase.objective },
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

        const oracle = analogClockOracle.verify(data, {
          componentId: 'analog-clock', evalMode: kase.mode, topic: kase.topic,
          gradeLevel: GRADE, grade: 'K', intent: kase.objective,
        });
        for (const v of oracle.violations) note(false, `oracle ${v.check} @${v.where}: ${v.detail}`);
        for (const t of oracle.uncheckedTypes) note(false, `oracle has no checks for "${t}"`);

        for (const c of challenges) {
          note(!!c.instruction && !!c.hint, `${c.id}: missing instruction or hint`);
          if (kase.mode === 'hand_name') {
            note(c.targetHand === 'hour' || c.targetHand === 'minute', `${c.id}: no targetHand`);
            // The legend names the hands, so it must be off whatever the tier says.
            note(c.showHandLegend !== true, `${c.id}: the hand legend is on — it names the answer`);
          }
          if (kase.mode === 'hear_time') {
            note(c.targetMinute === 0, `${c.id}: ${c.targetHour}:${c.targetMinute} is not a whole hour`);
            note([c.option0, c.option1, c.option2, c.option3].every(Boolean), `${c.id}: fewer than four faces`);
          }
        }

        if (kase.mode === 'hand_name') {
          const hands = challenges.map((c) => c.targetHand);
          note(new Set(hands).size > 1, `every challenge asks for the ${hands[0]} hand — tapping the same one always scores`);
        }
        const cards = challenges.map((c) => `${c.targetHour}:${c.targetMinute}|${c.targetHand ?? ''}`);
        note(new Set(cards).size >= Math.min(3, cards.length), `only ${new Set(cards).size} distinct card(s) across ${cards.length} challenges`);

        evidence.draws.push({
          label, mode: kase.mode, tier, failures,
          title: data.title,
          checkedChallenges: oracle.checkedChallenges,
          challenges: challenges.map((c) => ({
            id: c.id, type: c.type, instruction: c.instruction, hint: c.hint,
            time: `${c.targetHour}:${String(c.targetMinute).padStart(2, '0')}`,
            targetHand: c.targetHand,
            options: [c.option0, c.option1, c.option2, c.option3].filter(Boolean),
            correctOptionIndex: c.correctOptionIndex,
            showHandLegend: c.showHandLegend, supportTier: c.supportTier,
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
