// ten-frame `split` / `decompose` runtime probe (2026-09-06).
// Run from my-tutoring-app.
//
// The pilot for qa/HANDOFF-decompose-to-5-counter-split-2026-09-06.md: drive the
// LIVE generator (real Gemini) on the exact topic that produced the handoff,
// three fresh draws, with the new eval mode PINNED — then push every generated
// challenge through the SHIPPED item builder and cue surface, not a parallel
// construction, so the probe fails wherever production would.
//
// What it asserts per draw:
//   1. every challenge is a `split` (the schema enum is doing its job)
//   2. the group sizes stay inside the objective's scope (2..5 for "pairs to 5")
//   3. totals REPEAT, so "a different way" is actually asked for, and no total
//      is asked more times than it has ways
//   4. items survive `itemsFromChallenges` and are stamped gesture/manipulation
//      with per-total ordinals
//   5. the pack passes the family's structural gates
//   6. NO ASK, how-to-play, re-ask or context push names a PART of the total
//
//   node scripts/probe-ten-frame-split.mjs [out.json] [--draws=3]
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
    || 'qa/eval-reports/ten-frame-split-2026-09-06.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=3').slice(8));

// The topic and objective the handoff was opened on, verbatim.
const TOPIC = 'Decompose numbers up to 5 into pairs in multiple ways, using objects and drawings';
const OBJECTIVE = 'Model how to split a group of up to 5 objects into two smaller groups using counters.';
const GRADE = 'Kindergarten';

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), topic: TOPIC, objective: OBJECTIVE, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

const PART_WORD = /\b(one|two|three|four|five|six|seven|eight|nine)\b/i;
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "two groups" / "two colour groups" says how many GROUPS — the shape of the
 *  task, not a part of the total. Same exemption the unit test makes. */
const stripGroupCount = (t) => t.replace(/\btwo (?:colour )?groups\b/gi, 'GROUPS');

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateTenFrame } = await runner.import(`${base}service/math/gemini-ten-frame.ts`);
  const script = await runner.import(`${base}primitives/visual-primitives/math/tenFrameScript.ts`);
  const { checkPackGates } = await runner.import(`${base}hooks/judgedScriptContract.testkit.ts`);
  const { spokenSpanOf } = await runner.import(`${base}hooks/judgedScriptContract.ts`);

  for (let i = 1; i <= draws; i++) {
    const failures = [];
    const note = (ok, msg) => { if (!ok) failures.push(msg); };

    const data = await generateTenFrame({
      topic: TOPIC,
      gradeContext: GRADE,
      intent: OBJECTIVE,
      raw: { targetEvalMode: 'decompose', gradeBand: 'K', objectiveText: OBJECTIVE },
    });

    const challenges = data.challenges ?? [];
    // 1 — the schema enum did its job.
    note(challenges.length > 0, 'no challenges generated');
    for (const ch of challenges) note(ch.type === 'split', `non-split challenge type "${ch.type}"`);
    note(data.mode === 'single', `expected a single frame, got "${data.mode}"`);

    // 2 — scope: "pairs up to 5" caps the group size.
    for (const ch of challenges) {
      note(ch.targetCount >= 2, `group of ${ch.targetCount} cannot be split`);
      note(ch.targetCount <= 5, `group of ${ch.targetCount} exceeds the objective's "up to 5"`);
    }

    // 3 — totals repeat, and never beyond the ways they have.
    const perTotal = {};
    for (const ch of challenges) perTotal[ch.targetCount] = (perTotal[ch.targetCount] ?? 0) + 1;
    note(
      Object.values(perTotal).some((n) => n >= 2),
      `every total asked once — "in more than one way" is never asked (${JSON.stringify(perTotal)})`,
    );
    for (const [total, asked] of Object.entries(perTotal)) {
      const ways = script.waysToSplit(Number(total));
      note(asked <= ways, `total ${total} asked ${asked}x but has only ${ways} way(s)`);
    }

    // 4 — the SHIPPED build path.
    const items = script.itemsFromChallenges(challenges, { capacity: 10, band: 'K' });
    note(items.length === challenges.length, `${challenges.length - items.length} item(s) dropped by the build gate`);
    for (const item of items) {
      note(item.answerKind === 'gesture', `item ${item.id} is not a gesture item`);
      note(item.responseClass === 'manipulation', `item ${item.id} has response class ${item.responseClass}`);
      note(item.shown === item.answer, `item ${item.id} does not seed the whole group`);
      note(item.splitOrdinal >= 1, `item ${item.id} has no split ordinal`);
    }

    // 5 — the family's structural gates, on the real cue surface.
    const pack = script.tenFramePackBase(items);
    const gateFailures = checkPackGates(pack);
    note(gateFailures.length === 0, `pack gates: ${JSON.stringify(gateFailures)}`);

    // 6 — the leak here is a PAIR. The total is public; nothing smaller is.
    for (const item of items) {
      const totalWord = WORDS[item.answer];
      const surfaces = [
        spokenSpanOf(script.itemCue(item, { opening: true, howToPlay: true })),
        spokenSpanOf(script.itemCue(item)),
        spokenSpanOf(script.pronounceCue(item)),
        script.stimulusFor(item),
      ];
      for (const text of surfaces) {
        const scrubbed = stripGroupCount(text).replace(new RegExp(`\\b${totalWord}\\b`, 'gi'), 'TOTAL');
        const leak = scrubbed.match(PART_WORD);
        note(!leak, `item ${item.id} names a part ("${leak?.[0]}") in: ${text}`);
      }
    }

    const draw = {
      n: i,
      title: data.title,
      mode: data.mode,
      gradeBand: data.gradeBand,
      challenges: challenges.map((c) => ({ id: c.id, type: c.type, targetCount: c.targetCount, instruction: c.instruction })),
      totals: perTotal,
      ordinals: items.map((it) => ({ id: it.id, total: it.answer, nth: it.splitOrdinal })),
      firstAsk: items[0] ? spokenSpanOf(script.itemCue(items[0], { opening: true, howToPlay: true })) : null,
      secondAsk: items[1] ? spokenSpanOf(script.itemCue(items[1])) : null,
      sampleCorrectVerdict: items[0]
        ? spokenSpanOf(script.splitVerdictCue(items[0], { a: items[0].answer - 1, b: 1 }))
        : null,
      sampleEmptyVerdict: items[0]
        ? spokenSpanOf(script.splitVerdictCue(items[0], { a: items[0].answer, b: 0 }))
        : null,
      failures,
      pass: failures.length === 0,
    };
    evidence.draws.push(draw);
    save();

    console.log(`\n── draw ${i}/${draws} — ${draw.pass ? 'PASS' : `FAIL (${failures.length})`} ──`);
    console.log(`   title: ${data.title}`);
    console.log(`   totals asked: ${JSON.stringify(perTotal)}`);
    console.log(`   ask 1: ${draw.firstAsk}`);
    console.log(`   ask 2: ${draw.secondAsk}`);
    for (const f of failures) console.log(`   ✗ ${f}`);
  }

  const passed = evidence.draws.filter((d) => d.pass).length;
  evidence.summary = { draws: evidence.draws.length, passed };
  save();
  console.log(`\n${passed}/${evidence.draws.length} draws passed → ${output}`);
  process.exitCode = passed === evidence.draws.length ? 0 : 1;
} finally {
  await server.close();
}
