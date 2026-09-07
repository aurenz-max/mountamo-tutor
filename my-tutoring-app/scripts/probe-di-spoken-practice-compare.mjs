// Pilot probe for di-spoken-practice `compare_choice` (lesson-bench item 30c /
// qa/di item 34). Run from my-tutoring-app. Real Gemini calls, no student writes.
//
// Two halves, because either alone would be a false pass:
//   SELECTION — does the unpinned lesson resolver now route obj3's spoken slot
//     to compare_choice on BOTH frozen draws? (Before this change the only
//     reachable mode was say_answer, which is what produced `items: []`.)
//   RESOLUTION — does the generator come back with a full session covering
//     EVERY word the objective named, three independent draws running?
// Plus a refusal case: the explain-shaped objective the handoff put out of
// scope must still ship nothing, not launder open production through a menu.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const output = resolve(root, process.argv[2] || 'qa/eval-reports/di-spoken-practice-compare-2026-09-06.json');
const server = await createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const evidence = { startedAt: new Date().toISOString(), results: [] };
const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));
const result = (name, details) => {
  evidence.results.push({ name, ...details });
  save();
  console.log('PROBE', name, JSON.stringify(details.checks ?? details.error ?? 'recorded'));
};

const PKG = 'qa/lesson-bench/packages/';
const DRAWS = [
  { name: '3rvk', file: `${PKG}kindergarten-compare-and-describe-objects-attributes-longer-s-20260906034421-3rvk.json` },
  { name: 'wxyu', file: `${PKG}kindergarten-compare-and-describe-objects-attributes-longer-s-20260906035023-wxyu.json` },
];
const MENU = ['longer', 'shorter', 'heavier', 'lighter'];

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const { generateDiSpokenPractice } = await runner.import(`${base}service/direct-instruction/gemini-di-spoken-practice.ts`);
  const gates = await runner.import(`${base}primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts`);
  const { resolveLessonEvalModes } = await runner.import(`${base}service/manifest/resolveLessonEvalModes.ts`);

  const slots = [];

  // ── SELECTION: unpinned routing over both frozen manifests ────────────────
  for (const draw of DRAWS) {
    const pkg = JSON.parse(readFileSync(resolve(root, draw.file), 'utf8'));
    const manifest = JSON.parse(JSON.stringify(pkg.manifest));
    for (const block of manifest.objectiveBlocks) {
      for (const c of block.components) delete c.config?.targetEvalMode;
    }
    const routing = await resolveLessonEvalModes(manifest, manifest.topic, manifest.gradeLevel);
    const picked = manifest.objectiveBlocks.flatMap(b => b.components
      .filter(c => c.componentId === 'di-spoken-practice')
      .map(c => ({ objectiveId: b.objectiveId, objectiveText: b.objectiveText,
        instanceId: c.instanceId, intent: c.intent, mode: c.config?.targetEvalMode })));
    for (const p of picked) slots.push({ draw: draw.name, ...p });
    result(`selection-${draw.name}`, { routing, picked,
      checks: { foundSpokenSlot: picked.length > 0,
        routesToCompareChoice: picked.every(p => p.mode === 'compare_choice') } });
  }

  // ── RESOLUTION: three independent draws per routed slot ───────────────────
  const inspect = (data) => ({
    mode: data.challengeType === 'compare_choice',
    count: data.items.length >= 3,
    pairs: data.items.every(i => i.stimulusKind === 'pair' && i.stimulusEmoji && i.stimulusEmoji2
      && i.stimulusText && i.stimulusText2),
    closedSetClass: data.items.every(i => i.responseClass === 'closed_set_choice'),
    // Independent of the production gate: the objective NAMED four words and a
    // session that asks two of them is the failure this mode exists to close.
    menuCovered: MENU.every(w => data.items.some(i => i.expectedAnswer.toLowerCase() === w)),
    noLeaks: gates.findAnswerLeaks(data.items).length === 0,
    menuIntact: gates.findChoiceMenuDefects(data.items).length === 0,
    bothThingsSpoken: gates.findUnspokenStimulus(data.items).length === 0,
  });

  for (const slot of slots) {
    for (let draw = 1; draw <= 3; draw++) {
      const started = Date.now();
      const data = await generateDiSpokenPractice(
        DRAWS.find(d => d.name === slot.draw) ? 'Compare and describe objects\' attributes (longer/shorter, heavier/lighter) using direct observation and manipulation' : '',
        'kindergarten',
        { objectiveText: slot.objectiveText, intent: slot.intent, targetEvalMode: slot.mode ?? 'compare_choice' },
      );
      result(`generate-${slot.draw}-${slot.objectiveId}-draw${draw}`, {
        input: { objectiveText: slot.objectiveText, intent: slot.intent, mode: slot.mode },
        elapsedMs: Date.now() - started, checks: inspect(data), data,
      });
    }
  }

  // ── REFUSAL: the out-of-scope explain shape must still ship nothing ───────
  const explain = await generateDiSpokenPractice(
    'understanding the equal sign with balance scales', 'first grade',
    { objectiveText: 'Explain what the equal sign means using the balance scale example',
      intent: 'The child explains in their own words what the equal sign means.',
      targetEvalMode: 'compare_choice' });
  result('refuses-open-explanation', { data: explain,
    checks: { shipsNothing: explain.items.length === 0 } });

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
