// Live Gemini verification of K graph explanations and related-survey comparisons.
// node scripts/probe-bar-model-explanations.mjs [out.json] [--tiers=easy,medium,hard]
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
    || 'qa/eval-reports/bar-model-explanations-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=1').slice(8));
const tiers = (args.find((a) => a.startsWith('--tiers=')) || '--tiers=,easy,hard').slice(8).split(',');

// A published K row per mode, verbatim from the live curriculum.
const CASES = [
  { mode: 'say_what_it_shows', topic: 'Explain data representations to others using simple comparative language', objective: 'Explain what a graph shows in your own words' },
  { mode: 'compare_two_graphs', topic: 'Compare two related data sets to identify similarities and differences', objective: 'Compare morning and afternoon surveys, explaining what is the same or different' },
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
        note(challenges.length >= 3, 'Need at least three challenges');
        note(challenges.every((c) => c.evalMode === kase.mode), 'Pinned mode escaped');
        const result = barModelOracle.verify(data, { componentId: 'bar-model', evalMode: kase.mode, topic: kase.topic, gradeLevel: GRADE });
        failures.push(...result.violations.map((v) => v.detail));
        for (const ch of challenges) {
          note(ch.showBarValues === false, 'Numeric graph labels must be hidden');
          note(ch.supportTier === (tier || undefined), 'Support tier was dropped');
        }
        evidence.draws.push({ label, mode: kase.mode, tier, failures, uncheckedTypes: result.uncheckedTypes, data });
        save();
        console.log(`${failures.length ? 'FAIL' : 'PASS'} ${label}: ${challenges.length} challenges; ${failures.join('; ')}`);
      }
    }
  }
  if (evidence.draws.some((d) => d.error || d.failures?.length)) process.exitCode = 1;

} finally {
  await server.close();
}

const failed = evidence.draws.filter((d) => d.error || (d.failures ?? []).length > 0);
evidence.summary = { draws: evidence.draws.length, failedDraws: failed.length };
save();
console.log(`\n${evidence.draws.length - failed.length}/${evidence.draws.length} draws clean → ${output}`);
process.exit(failed.length === 0 ? 0 : 1);
