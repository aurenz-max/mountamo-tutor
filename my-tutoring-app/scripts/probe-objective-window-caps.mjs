// Objective-window cap probe — /eval-fix ordinal-line + addition-subtraction-scene
// (2026-09-08), extended to strategy-picker (2026-09-09, OPS001-01-F).
// Run from my-tutoring-app.
//
// Both P1s are the same defect: a Kindergarten cap silently rewrote the lesson the
// objective asked for. This drives the LIVE generators (real Gemini) on the exact
// objective wording that produced each finding, plus a no-window control, and
// asserts the raise happens AND the no-window path is unchanged.
//
//   node scripts/probe-objective-window-caps.mjs [out.json] [--draws=2]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const output = resolve(root, args.find((a) => a.endsWith('.json') && !a.startsWith('--'))
  || 'qa/eval-reports/objective-window-caps-2026-09-08.json');
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=2').slice(8));

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), cases: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

/** Every position an ordinal challenge actually QUESTIONS the child about. */
const askedPositions = (ch) => {
  const out = [];
  if (typeof ch.targetPosition === 'number') out.push(ch.targetPosition);
  for (const p of ch.matchPairs ?? []) {
    const n = Number(String(p.symbol).replace(/\D/g, ''));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
};

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateOrdinalLine } = await runner.import(`${base}service/math/gemini-ordinal-line.ts`);
  const { generateAdditionSubtractionScene } = await runner.import(`${base}service/math/gemini-addition-subtraction-scene.ts`);
  const { generateStrategyPicker } = await runner.import(`${base}service/math/gemini-strategy-picker.ts`);

  const CASES = [
    {
      id: 'ordinal-K-window-6-to-10',
      what: 'K objective naming 6th-10th raises the 5-long line',
      run: () => generateOrdinalLine({
        topic: 'Meeting the Tenth Place: ordinal positions sixth through tenth',
        gradeContext: 'Kindergarten',
        intent: 'Name the ordinal position of an object in a line for positions 6th through 10th.',
        raw: { targetEvalMode: 'identify' },
      }),
      check: (d, note) => {
        note(d.maxPosition >= 10, `line is ${d.maxPosition} long — no 10th character to point at`);
        // The lineup lives on each challenge, not on the data root.
        const cast = d.challenges[0]?.characters?.length ?? 0;
        note(cast >= 10, `only ${cast} characters on the line`);
        const asked = d.challenges.flatMap(askedPositions);
        note(asked.length > 0, 'no positions questioned');
        note(asked.every((p) => p >= 6 && p <= 10), `questions fall outside 6..10: ${asked.join(',')}`);
        note(new Set(asked).size >= 3, `only ${new Set(asked).size} distinct position(s) asked — a session cannot be filled`);
        return { maxPosition: d.maxPosition, cast, asked };
      },
    },
    {
      id: 'ordinal-K-no-window-control',
      what: 'K general ordinal practice keeps the 5-long line (no regression)',
      run: () => generateOrdinalLine({
        topic: 'Ordinal positions in a line',
        gradeContext: 'Kindergarten',
        intent: 'Name the ordinal position of an object in a line.',
        raw: { targetEvalMode: 'identify' },
      }),
      check: (d, note) => {
        note(d.maxPosition === 5, `K default line changed: ${d.maxPosition} (expected 5)`);
        const asked = d.challenges.flatMap(askedPositions);
        note(asked.every((p) => p >= 1 && p <= 5), `questions outside the K line: ${asked.join(',')}`);
        return { maxPosition: d.maxPosition, asked };
      },
    },
    {
      id: 'scene-K-window-make-10',
      what: 'K "making 10" objective raises maxNumber past the band default of 5',
      run: () => generateAdditionSubtractionScene({
        topic: 'Making 10: adding two numbers that total ten',
        gradeContext: 'Kindergarten',
        intent: 'Add two groups of objects to make a total of 10.',
        raw: { targetEvalMode: 'act_out' },
      }),
      check: (d, note) => {
        note(d.maxNumber >= 10, `maxNumber ${d.maxNumber} cannot reach the ten the lesson names`);
        const results = d.challenges.map((c) => c.resultCount);
        note(results.some((r) => r > 5), `no challenge reaches past 5: ${results.join(',')}`);
        note(d.challenges.every((c) => c.resultCount <= d.maxNumber), 'a count escapes maxNumber');
        note(d.maxNumber <= 10 || d.showTenFrame === false, 'ten frame kept above a 10 ceiling it cannot mirror');
        return { maxNumber: d.maxNumber, showTenFrame: d.showTenFrame, results };
      },
    },
    {
      id: 'scene-K-no-window-control',
      what: 'K within-5 practice keeps maxNumber 5 (no regression)',
      run: () => generateAdditionSubtractionScene({
        topic: 'Adding and subtracting within 5',
        gradeContext: 'Kindergarten',
        intent: 'Add and subtract with numbers within 5.',
        raw: { targetEvalMode: 'act_out' },
      }),
      check: (d, note) => {
        note(d.maxNumber === 5, `K default maxNumber changed: ${d.maxNumber} (expected 5)`);
        note(d.challenges.every((c) => c.resultCount <= 5), 'a count escapes the within-5 scope');
        note(d.showTenFrame === true, 'K lost its ten frame inside the default band');
        return { maxNumber: d.maxNumber, showTenFrame: d.showTenFrame, results: d.challenges.map((c) => c.resultCount) };
      },
    },
    {
      id: 'strategy-K-within-10-OPS001-01-F',
      what: 'K "within 10" objective raises strategy-picker past the band default of 5',
      run: () => generateStrategyPicker({
        topic: 'Adding with strategies: ten frames, tally marks and doubles',
        gradeContext: 'Kindergarten',
        intent: 'Solve addition problems using more than one strategy.',
        scope: {
          topic: 'Adding with strategies: ten frames, tally marks and doubles',
          objectiveText: 'Use multiple strategies (ten frames, tally marks, doubles) to solve addition problems within 10',
          objectiveVerb: 'apply',
          intent: 'Solve addition problems using more than one strategy.',
        },
        raw: { targetEvalMode: 'guided' },
      }),
      check: (d, note) => {
        const results = d.challenges.map((c) => c.problem?.result);
        note(d.maxNumber >= 10, `maxNumber ${d.maxNumber} cannot reach the ten the objective names`);
        note(results.some((r) => r > 5), `no guided problem reaches past 5: ${results.join(',')}`);
        note(results.every((r) => r >= 1 && r <= d.maxNumber), `a sum escapes maxNumber: ${results.join(',')}`);
        note(d.challenges.length >= 3, `only ${d.challenges.length} challenge(s) — a session cannot be filled`);
        return {
          maxNumber: d.maxNumber,
          equations: d.challenges.map((c) => c.problem?.equation),
          results,
          strategies: d.challenges.map((c) => c.assignedStrategy),
          introduced: d.strategiesIntroduced,
        };
      },
    },
    {
      id: 'strategy-K-no-window-control',
      what: 'K general strategy practice keeps maxNumber 5 (no regression)',
      run: () => generateStrategyPicker({
        topic: 'Many ways to add',
        gradeContext: 'Kindergarten',
        intent: 'Solve addition problems using more than one strategy.',
        scope: {
          topic: 'Many ways to add',
          objectiveText: 'Solve addition problems using different strategies',
          objectiveVerb: 'apply',
          intent: 'Solve addition problems using more than one strategy.',
        },
        raw: { targetEvalMode: 'guided' },
      }),
      check: (d, note) => {
        const results = d.challenges.map((c) => c.problem?.result);
        note(d.maxNumber === 5, `K default maxNumber changed: ${d.maxNumber} (expected 5)`);
        note(results.every((r) => r >= 1 && r <= 5), `a sum escapes the K default band: ${results.join(',')}`);
        return { maxNumber: d.maxNumber, equations: d.challenges.map((c) => c.problem?.equation), results };
      },
    },
  ];

  for (const c of CASES) {
    for (let i = 1; i <= draws; i++) {
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };
      let summary = null, error = null;
      try {
        summary = c.check(await c.run(), note);
      } catch (e) { error = String(e?.message ?? e); failures.push(`threw: ${error}`); }
      evidence.cases.push({ id: c.id, what: c.what, draw: i, pass: failures.length === 0, failures, summary });
      console.log(`${failures.length === 0 ? 'PASS' : 'FAIL'}  ${c.id} draw ${i}  ${JSON.stringify(summary)}`);
      for (const f of failures) console.log(`      - ${f}`);
      save();
    }
  }
  const failed = evidence.cases.filter((c) => !c.pass).length;
  console.log(`\n${evidence.cases.length - failed}/${evidence.cases.length} draws pass  →  ${output}`);
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  await server.close();
}
