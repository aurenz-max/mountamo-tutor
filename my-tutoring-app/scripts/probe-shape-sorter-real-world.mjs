// shape-sorter real-world stimulus probe (2026-09-09) — slice 7 /
// `shapes-in-the-world`. Run from my-tutoring-app.
//
// Two published K rows ask the child to recognize 2D shapes in real objects.
// The pool for those lessons is code-owned, so this drives the LIVE generator on
// a real-object objective and re-derives the pairing independently: a clock face
// is a circle here because this file says so, not because the generator does.
//
//   node scripts/probe-shape-sorter-real-world.mjs [out.json] [--draws=2]
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
    || 'qa/eval-reports/shape-sorter-real-world-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=2').slice(8));

// The truth, held here independently of the generator's own table.
const TRUTH = {
  'clock face': 'circle', plate: 'circle', door: 'rectangle', book: 'rectangle',
  window: 'square', dice: 'square', 'pizza slice': 'triangle', 'party hat': 'triangle',
  kite: 'diamond', egg: 'oval',
};
const SHAPE_WORDS = ['circle', 'oval', 'triangle', 'square', 'rectangle', 'diamond', 'rhombus', 'pentagon', 'hexagon'];

const CASES = [
  {
    label: 'real-world objective',
    topic: 'Recognize and describe 2D shapes in real-world objects around the classroom',
    objective: 'Find and name the 2D shapes in everyday objects',
    wantReal: true,
  },
  {
    label: 'plain objective (regression)',
    topic: 'Name flat shapes: circles, squares, triangles and rectangles',
    objective: 'Name 2D shapes',
    wantReal: false,
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
  const { generateShapeSorter } = await runner.import(`${base}service/math/gemini-shape-sorter.ts`);
  const script = await runner.import(`${base}primitives/visual-primitives/math/shapeSorterScript.ts`);
  const { checkPackGates } = await runner.import(`${base}hooks/judgedScriptContract.testkit.ts`);
  const { spokenSpanOf } = await runner.import(`${base}hooks/judgedScriptContract.ts`);

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };
      const label = `${kase.label} draw ${i}`;

      let data;
      try {
        data = await generateShapeSorter({
          topic: kase.topic,
          gradeContext: GRADE,
          intent: kase.objective,
          scope: { topic: kase.topic, objectiveText: kase.objective, intent: kase.objective },
          raw: { targetEvalMode: 'identify', gradeBand: 'K', objectiveText: kase.objective },
        });
      } catch (err) {
        evidence.draws.push({ label, error: String(err) });
        console.log(`✗ ${label}: threw ${err}`);
        save();
        continue;
      }

      const challenges = data.challenges ?? [];
      note(challenges.length >= 1, 'no challenges generated');
      for (const c of challenges) note(c.type === 'identify', `challenge ${c.id} is "${c.type}"`);

      for (const c of challenges) {
        const shapes = c.shapes ?? [];
        if (kase.wantReal) {
          note(shapes.every((s) => !!s.realObject && !!s.emoji),
            `${c.id}: a pool shape has no real object to look at`);
          for (const s of shapes) {
            // Independent: this file's table, not the generator's.
            note(TRUTH[s.realObject] === s.shape,
              `${c.id}: "${s.realObject}" is keyed as ${s.shape} but reads as ${TRUTH[s.realObject] ?? 'nothing this probe knows'}`);
            note(!SHAPE_WORDS.some((w) => (s.realObject ?? '').includes(w)),
              `${c.id}: the object name "${s.realObject}" contains the shape word — the picture answers itself`);
          }
          const kinds = shapes.map((s) => s.shape);
          note(new Set(kinds).size === kinds.length, `${c.id}: two objects share a shape — one of them is never asked about`);
          note(!SHAPE_WORDS.some((w) => (c.instruction ?? '').toLowerCase().includes(w)),
            `${c.id}: the instruction names a shape: "${c.instruction}"`);
        } else {
          note(shapes.every((s) => !s.realObject),
            `${c.id}: a plain objective got real-object stimuli — the trigger is too loose`);
        }
      }

      // The judged items must survive the build gate and carry the object.
      const items = script.itemsFromChallenges(challenges, { isPreReader: true });
      note(items.length > 0, 'every item was dropped by the script build gate');
      if (kase.wantReal) {
        note(items.every((it) => !!it.realObject), 'an item lost its object on the way to the tutor');
        for (const it of items) {
          const spoken = spokenSpanOf(script.itemCue(it, { opening: true, howToPlay: true })).toLowerCase();
          note(!new RegExp(`\\b${it.answer}\\b`).test(spoken),
            `item ${it.id} says the answer "${it.answer}" in its ask`);
        }
      }
      const gateFailures = checkPackGates(script.shapeSorterPackBase(items));
      note(gateFailures.length === 0, `pack gates: ${JSON.stringify(gateFailures)}`);

      evidence.draws.push({
        label, failures,
        title: data.title,
        challenges: challenges.map((c) => ({
          id: c.id, instruction: c.instruction,
          shapes: (c.shapes ?? []).map((s) => `${s.emoji ?? ''}${s.realObject ?? s.shape}=${s.shape}`),
        })),
        asks: items.slice(0, 4).map((it) => spokenSpanOf(script.itemCue(it))),
      });
      console.log(`${failures.length === 0 ? '✓' : '✗'} ${label}: ${challenges.length} challenge(s), ${failures.length} failure(s)`);
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
