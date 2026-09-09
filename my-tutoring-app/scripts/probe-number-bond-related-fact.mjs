// number-bond `related_fact` probe (2026-09-09) — the SPOKEN fact family born
// for the two K rows the 2026-09-08 band-floor re-audit left homeless
// (OPS001-02-G, OPS001-03-F; qa/reader-fit/k-band-floor-2026-09-08.md).
//
// It drives the LIVE generator with the mode pinned, pushes each draw through
// the SHIPPED oracle, then builds the judged items with the SHIPPED script and
// checks what the child is actually asked — the mode's whole claim is about the
// SECOND turn, which no data-only check can see.
//
//   node scripts/probe-number-bond-related-fact.mjs [out.json] [--draws=2]
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
    || 'qa/eval-reports/number-bond-related-fact-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=2').slice(8));

const CASES = [
  {
    row: 'OPS001-02-G', grade: 'Kindergarten', band: 'K', maxNumber: 5,
    topic: 'Connect addition and subtraction as inverse operations within 10 using related facts',
  },
  {
    row: 'OPS001-03-F', grade: 'Kindergarten', band: 'K', maxNumber: 5,
    topic: 'Complete fact families for numbers within 5, demonstrating addition-subtraction relationship',
  },
  {
    row: 'G1-control', grade: 'Grade 1', band: '1', maxNumber: 10,
    topic: 'Use related addition and subtraction facts within 10',
  },
];

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), mode: 'related_fact', draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateNumberBond } = await runner.import(base + 'service/math/gemini-number-bond.ts');
  const { numberBondOracle } = await runner.import(base + 'service/qa/oracles/number-bond.ts');
  const script = await runner.import(base + 'primitives/visual-primitives/math/numberBondScript.ts');

  for (const kase of CASES) {
    for (const tier of ['', 'hard']) {
      for (let i = 1; i <= draws; i++) {
        const label = kase.row + ' ' + kase.band + (tier ? '/' + tier : '/none') + ' draw ' + i;
        const failures = [];
        const note = (ok, msg) => { if (!ok) failures.push(msg); };

        let data;
        try {
          data = await generateNumberBond({
            topic: kase.topic,
            gradeContext: kase.grade,
            intent: kase.topic,
            scope: { topic: kase.topic, objectiveText: kase.topic, intent: kase.topic },
            raw: {
              targetEvalMode: 'related_fact',
              gradeBand: kase.band,
              objectiveText: kase.topic,
              ...(tier ? { difficulty: tier } : {}),
            },
          });
        } catch (err) {
          evidence.draws.push({ label, error: String(err) });
          console.log('x ' + label + ': threw ' + err);
          save();
          continue;
        }

        const challenges = data.challenges ?? [];
        note(challenges.length >= 3, 'only ' + challenges.length + ' challenge(s) — mastery needs 3+');
        for (const c of challenges) note(c.type === 'related-fact', c.id + ' is ' + c.type + ', not the pinned type');
        note(data.gradeBand === kase.band, 'gradeBand is ' + data.gradeBand + ', expected ' + kase.band);

        const oracle = numberBondOracle.verify(data, {
          componentId: 'number-bond', evalMode: 'related_fact', topic: kase.topic,
          gradeLevel: kase.grade, grade: kase.band, intent: kase.topic,
        });
        for (const v of oracle.violations) note(false, 'oracle ' + v.check + ' @' + v.where + ': ' + v.detail);
        for (const t of oracle.uncheckedTypes) note(false, 'oracle has no checks for ' + t);

        // The judged loop: two turns per bond, and the SECOND turn is the mode.
        const built = script.buildBondItems(challenges, { band: kase.band, maxNumber: kase.maxNumber });
        const items = built.items;
        note(built.droppedChallenges === 0, built.droppedChallenges + ' challenge(s) dropped by the build gates');
        note(items.length === challenges.length * 2,
          items.length + ' judged turns from ' + challenges.length + ' challenges — expected two per bond');

        const turns = items.map((it) => {
          const cue = script.itemCue(it);
          const m = /Say exactly: "([^"]*)"/.exec(cue);
          return {
            id: it.id, pairIndex: it.pairIndex, whole: it.whole,
            knownPart: it.knownPart, answer: it.answer,
            answerKind: it.answerKind, responseClass: it.responseClass,
            ask: m ? m[1] : '',
            // The OPENING cue prefixes the how-to-play to the ask, so it is part
            // of what the child hears BEFORE answering — and part of the leak
            // surface. The first draft of that line read "the same three numbers
            // two ways" and put two answers in the childs ear.
            openingAsk: (() => {
              const om = /Say exactly: "([^"]*)"/.exec(script.itemCue(it, { opening: true }));
              return om ? om[1] : '';
            })(),
            harness: script.numberBondHarnessAnswers(it),
          };
        });

        for (let t = 0; t < turns.length; t += 2) {
          const a = turns[t];
          const b = turns[t + 1];
          if (!b) { note(false, a.id + ' has no second turn'); continue; }
          note(a.pairIndex === 0 && b.pairIndex === 1, a.id + ': turns are not ordered 0 then 1');
          // THE PEDAGOGY. Turn 2 must not be answerable by repeating turn 1.
          note(a.answer !== b.answer,
            a.id + ': both turns answer ' + a.answer + ' — a repeat scores the turn that measures the relationship');
          note(b.knownPart === a.answer,
            a.id + ': turn 2 known part is ' + b.knownPart + ', not the ' + a.answer + ' the child just produced');
          note(/take away/.test(b.ask), a.id + ': turn 2 never says take away — ' + JSON.stringify(b.ask));
          note(a.answerKind === 'voice' && b.answerKind === 'voice', a.id + ': a turn is not spoken');
        }
        // Answer leak: the ask must never contain the answer word.
        for (const t of turns) {
          for (const leak of (t.harness.leakTokens || [])) {
            const re = new RegExp('\\b' + leak + '\\b', 'i');
            note(!re.test(t.ask), t.id + ': the ask says ' + leak + ', which is the answer');
            note(!re.test(t.openingAsk), t.id + ': the opening how-to-play says ' + leak + ', which is the answer');
          }
        }
        // Content spread across the session.
        const bonds = challenges.map((c) => c.whole + '|' + c.part1);
        note(new Set(bonds).size >= Math.min(3, bonds.length),
          'only ' + new Set(bonds).size + ' distinct bond(s) across ' + bonds.length + ' challenges');

        evidence.draws.push({
          label, failures, title: data.title, maxNumber: data.maxNumber, gradeBand: data.gradeBand,
          challenges: challenges.map((c) => ({ id: c.id, type: c.type, whole: c.whole, part1: c.part1, part2: c.part2, instruction: c.instruction })),
          droppedChallenges: built.droppedChallenges,
          checkedChallenges: oracle.checkedChallenges,
          turns,
        });
        console.log((failures.length === 0 ? 'PASS ' : 'FAIL ') + label + ': ' + challenges.length + ' bonds -> ' + items.length + ' turns, ' + failures.length + ' failure(s)');
        for (const f of failures.slice(0, 6)) console.log('    - ' + f);
        save();
      }
    }
  }
} finally {
  await server.close();
}

const failed = evidence.draws.filter((d) => d.error || (d.failures || []).length > 0);
evidence.summary = { draws: evidence.draws.length, failedDraws: failed.length };
save();
console.log('\n' + (evidence.draws.length - failed.length) + '/' + evidence.draws.length + ' draws clean -> ' + output);
process.exit(failed.length === 0 ? 0 : 1);
