// Run from my-tutoring-app. Real Gemini calls, no student writes. Saves every
// generated session and routing result so the bounded matrix is independently reviewable.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const output = resolve(root, process.argv[2] || 'qa/eval-reports/di-spoken-practice-2026-09-05-retest.json');
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const evidence = { startedAt: new Date().toISOString(), results: [] };
const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));
const result = (name, details) => { evidence.results.push({ name, ...details }); save(); console.log('PROBE', name, JSON.stringify(details.checks ?? details.error ?? 'recorded')); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateDiSpokenPractice } = await runner.import(`${base}service/direct-instruction/gemini-di-spoken-practice.ts`);
  const gates = await runner.import(`${base}primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts`);
  const { resolveLessonEvalModes } = await runner.import(`${base}service/manifest/resolveLessonEvalModes.ts`);
  const original = 'Identify the plus sign (+) and equal sign (=) as math symbols';
  const matrix = [
    ...Array.from({ length: 3 }, (_, i) => ({ name: `symbols-${i + 1}`, objective: original, mode: 'say_answer', targets: ['+', '='] })),
    { name: 'punctuation', objective: 'Name the question mark (?) and exclamation mark (!) shown on screen.', mode: 'say_answer', targets: ['?', '!'] },
    { name: 'rephrased-symbols', objective: 'When shown = or +, say its name: equal sign and plus sign.', mode: 'say_answer', targets: ['=', '+'] },
    { name: 'word-reading', objective: 'Read the printed words cat and dog aloud.', mode: 'read_aloud', targets: ['cat', 'dog'] },
    { name: 'numeral-reading', objective: 'Read the printed numerals 2 and 5 aloud.', mode: 'read_aloud', targets: ['2', '5'] },
    { name: 'listening-arithmetic', objective: 'Listen to addition facts within five and say the sum.', mode: 'say_answer' },
    { name: 'counting', objective: 'Count displayed groups of bears within five and say how many.', mode: 'count_and_say' },
    { name: 'wrong-pin-refused', objective: original, mode: 'read_aloud', empty: true },
  ];
  const inspect = (data, test) => ({
    mode: data.challengeType === test.mode,
    count: test.empty ? data.items.length === 0 : data.items.length >= 3,
    coverage: !test.targets || test.targets.every(t => data.items.some(i => i.stimulusText === t)),
    noLeaks: gates.findAnswerLeaks(data.items).length === 0,
    suppliedProblem: gates.findUnspokenStimulus(data.items).length === 0,
    arithmetic: gates.findArithmeticMismatches(data.items).length === 0,
    noPrintedCounts: gates.findPrintedNumerals(data.items).length === 0,
    visualNamingNoPronunciation: data.items.filter(i => i.stimulusRole === 'visual_target').every(i => gates.pronounceCue(i) === ''),
  });

  // One actual lesson-level selector call covers three distinct naming objectives
  // and their reading/listening/counting neighbors before generator probes.
  const routingCases = matrix.filter(t => !['symbols-2', 'symbols-3', 'wrong-pin-refused'].includes(t.name));
  const manifest = { objectiveBlocks: routingCases.map((t, i) => ({
    objectiveId: `probe-${i}`, objectiveText: t.objective, objectiveVerb: 'apply',
    components: [{ componentId: 'di-spoken-practice', instanceId: t.name, intent: t.objective, config: {} }],
  })) };
  const routing = await resolveLessonEvalModes(manifest, 'early spoken practice', 'kindergarten');
  result('automatic-lesson-routing', { routing, manifest, checks: Object.fromEntries(routingCases.map((t, i) =>
    [t.name, manifest.objectiveBlocks[i].components[0].config.targetEvalMode === t.mode])) });

  for (const test of matrix) {
    const started = Date.now();
    const data = await generateDiSpokenPractice(test.objective, 'kindergarten', {
      objectiveText: test.objective, intent: test.objective, targetEvalMode: test.mode,
    });
    result(test.name, { input: test, elapsedMs: Date.now() - started, checks: inspect(data, test), data });
  }

  const pkg = JSON.parse(readFileSync(resolve(root, 'qa/lesson-bench/packages/kindergarten-addition-20260905190456-xr70.json'), 'utf8'));
  const savedManifest = pkg.manifest;
  if (!savedManifest) throw new Error('Saved package has no manifest');
  const summary = await resolveLessonEvalModes(savedManifest, 'addition', 'kindergarten', pkg.provenance.generationRequest.objectives);
  const block = savedManifest.objectiveBlocks.find(b => b.components.some(c => c.instanceId === 'obj2-symbol-spotter'));
  const slot = block.components.find(c => c.instanceId === 'obj2-symbol-spotter');
  // Same config enrichment and context-native registry dispatch as hydration.
  await runner.import(`${base}service/registry/generators/diGenerators.ts`);
  const { getGenerator } = await runner.import(`${base}service/registry/contentRegistry.ts`);
  const enriched = { ...slot, config: { ...slot.config, objectiveText: block.objectiveText } };
  const hydrated = await getGenerator('di-spoken-practice')(enriched, 'addition', 'kindergarten', 'kindergarten');
  result('saved-lesson-slot', { summary, slot: enriched, hydrated,
    checks: inspect(hydrated.data, { mode: 'say_answer', targets: ['+', '='] }) });
  evidence.finishedAt = new Date().toISOString();
  evidence.passed = evidence.results.every(r => r.checks && Object.values(r.checks).every(Boolean));
  save();
  if (!evidence.passed) process.exitCode = 1;
} catch (error) {
  result('probe-error', { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  await server.close();
}
