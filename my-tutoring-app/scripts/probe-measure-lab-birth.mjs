// measure-lab birth probe (2026-09-08) — slice 7 / `measure-sim-weight-capacity`.
// Run from my-tutoring-app.
//
// Drives the LIVE generator for all four K measuring tasks and pushes every draw
// through the SHIPPED oracle, which re-derives the physics rather than trusting
// the stored key: the heavier object from the weights, the bigger container from
// the capacities, the order from the water levels.
//
//   node scripts/probe-measure-lab-birth.mjs [out.json] [--draws=1]
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
    || 'qa/eval-reports/measure-lab-birth-2026-09-08.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));

const CASES = [
  {
    mode: 'balance_predict',
    topic: 'Compare weights of various objects using a balance scale and predict outcomes',
    objective: 'Predict which object is heavier, then check it on a balance scale',
  },
  {
    mode: 'capacity_predict',
    topic: 'Predict and test which of two different-shaped containers holds more liquid',
    objective: 'Predict which container holds more, then test it',
  },
  {
    mode: 'pour_count',
    topic: 'Compare capacities of different containers using non-standard units (cups of rice or sand)',
    objective: 'Measure how many cups a container holds',
  },
  {
    mode: 'order_capacity',
    topic: 'Sort three or more identical containers by amount (least to most)',
    objective: 'Order identical containers from least to most',
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
  const { generateMeasureLab } = await runner.import(`${base}service/math/gemini-measure-lab.ts`);
  const { measureLabOracle } = await runner.import(`${base}service/qa/oracles/measure-lab.ts`);

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };
      const label = `${kase.mode} draw ${i}`;

      let data;
      try {
        data = await generateMeasureLab({
          topic: kase.topic,
          gradeContext: GRADE,
          intent: kase.objective,
          raw: { targetEvalMode: kase.mode, objectiveText: kase.objective },
        });
      } catch (err) {
        evidence.draws.push({ label, mode: kase.mode, error: String(err) });
        console.log(`✗ ${label}: threw ${err}`);
        save();
        continue;
      }

      const challenges = data.challenges ?? [];
      note(challenges.length >= 3, `only ${challenges.length} challenge(s) — mastery needs 3-6`);
      note(data.challengeType === kase.mode, `session challengeType is "${data.challengeType}"`);
      for (const c of challenges) note(c.type === kase.mode, `challenge ${c.id} is "${c.type}", not the pinned mode`);

      const oracle = measureLabOracle.verify(data, {
        componentId: 'measure-lab', evalMode: kase.mode, topic: kase.topic,
        gradeLevel: GRADE, grade: 'K', intent: kase.objective,
      });
      for (const v of oracle.violations) note(false, `oracle ${v.check} @${v.where}: ${v.detail}`);
      for (const t of oracle.uncheckedTypes) note(false, `oracle has no checks for "${t}"`);

      // Every render path the component takes must find its fields.
      for (const c of challenges) {
        if (c.type === 'balance_predict') {
          note(!!c.left?.emoji && !!c.right?.emoji, `${c.id}: an object has no emoji to render`);
          note(c.left?.name !== c.right?.name, `${c.id}: both objects are called "${c.left?.name}"`);
        }
        if (c.type === 'capacity_predict') {
          note(!!c.containerA && !!c.containerB, `${c.id}: a container is missing`);
          note(c.containerA?.name !== c.containerB?.name, `${c.id}: both containers are called "${c.containerA?.name}"`);
        }
        if (c.type === 'pour_count') note(!!c.unitEmoji, `${c.id}: no unit emoji to pour with`);
        if (c.type === 'order_capacity') note((c.containers ?? []).length === 3, `${c.id}: ${(c.containers ?? []).length} jars`);
        note(!!c.prompt && !!c.hint, `${c.id}: missing prompt or hint`);
      }

      // The tell that would make a mode fake: the same side always wins.
      if (kase.mode === 'balance_predict') {
        const sides = challenges.map((c) => (c.expectedChoice === c.left?.id ? 'L' : 'R'));
        note(new Set(sides).size > 1, `the heavier object is always on the ${sides[0]} side`);
      }
      if (kase.mode === 'capacity_predict') {
        const tallWins = challenges.map((c) => {
          const big = (c.containerA?.capacity ?? 0) > (c.containerB?.capacity ?? 0) ? c.containerA : c.containerB;
          return big?.shape === 'tall' ? 'tall' : 'not-tall';
        });
        note(new Set(tallWins).size > 1 || challenges.length < 3,
          `the winner is always ${tallWins[0]} — "taller means more" would always work`);
      }

      evidence.draws.push({
        label, mode: kase.mode, failures,
        title: data.title,
        checkedChallenges: oracle.checkedChallenges,
        challenges: challenges.map((c) => ({
          id: c.id, prompt: c.prompt, hint: c.hint,
          objects: c.left ? [`${c.left.emoji}${c.left.name}=${c.left.weight}`, `${c.right.emoji}${c.right.name}=${c.right.weight}`] : undefined,
          containers: [c.containerA, c.containerB, ...(c.containers ?? [])].filter(Boolean)
            .map((x) => `${x.name}(${x.shape}) cap=${x.capacity}${x.filled != null ? ` filled=${x.filled}` : ''}`),
          container: c.container ? `${c.container.name}(${c.container.shape}) cap=${c.container.capacity}` : undefined,
          expectedChoice: c.expectedChoice, expectedCount: c.expectedCount,
          options: c.options, expectedOrder: c.expectedOrder,
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
