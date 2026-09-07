// Pilot probe for di-spoken-practice `explain_concept` (qa/di item 36; handoff
// qa/HANDOFF-di-spoken-practice-explain-2026-09-07.md §7.4). Run from
// my-tutoring-app. Real Gemini calls, no student writes.
//
// Three halves, because any one alone would be a false pass:
//   SELECTION — do the two frozen grade-1 draws, stripped of their pins, route
//     their explain-verb spoken slot to explain_concept through the REAL
//     resolveLessonEvalModes? (Before this change the only reachable mode was
//     say_answer, and the planner called the objective `unsupported` — which is
//     what produced `items: []` on both.)
//   RESOLUTION — does the generator come back with a full session (≥ 3
//     items, every one leak-free, concept_statement, instances varied, anchors
//     reviewed), three independent draws running, on BOTH sub-shapes: the
//     session-wide concept (ah5w) and the per-instance rule (f00i)?
//   REFUSAL — a PROCEDURE ("explain how to solve") is not one proposition and
//     must still ship nothing, not launder a method through an idea slot.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const output = resolve(root, process.argv[2] || 'qa/eval-reports/di-spoken-practice-explain-2026-09-07.json');
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
  { name: 'ah5w', shape: 'session-wide', objectiveId: 'obj2',
    file: `${PKG}1st-grade-understanding-the-equal-sign-with-balance-scales-20260906013700-ah5w.json` },
  { name: 'f00i', shape: 'per-item', objectiveId: 'obj3',
    file: `${PKG}grade-1-repeating-and-growing-patterns-20260906014200-f00i.json` },
];

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
    const picked = manifest.objectiveBlocks
      .filter(b => b.objectiveId === draw.objectiveId)
      .flatMap(b => b.components
        .filter(c => c.componentId === 'di-spoken-practice')
        .map(c => ({ objectiveId: b.objectiveId, objectiveText: b.objectiveText,
          instanceId: c.instanceId, intent: c.intent, mode: c.config?.targetEvalMode })));
    for (const p of picked) slots.push({ draw: draw.name, shape: draw.shape, topic: manifest.topic, grade: manifest.gradeLevel, ...p });
    result(`selection-${draw.name}`, { routing, picked,
      checks: { foundSpokenSlot: picked.length > 0,
        routesToExplainConcept: picked.every(p => p.mode === 'explain_concept') } });
  }

  // ── RESOLUTION: three independent draws per routed slot ───────────────────
  const inspect = (data, shape) => {
    const concepts = new Set(data.items.map(i => i.conceptStatement));
    return {
      mode: data.challengeType === 'explain_concept',
      count: data.items.length >= 3,
      conceptClass: data.items.every(i => i.responseClass === 'concept_statement'),
      everyItemHasConcept: data.items.every(i => (i.conceptStatement ?? '').trim().length > 0),
      // The sub-shape the lesson calls for: one sentence session-wide (ah5w),
      // or a rule per instance (f00i) — a per-item session that collapsed to
      // one sentence is the session-wide shape wearing the wrong objective.
      shapeHonored: data.items.length === 0 ? false
        : shape === 'session-wide' ? concepts.size === 1 : concepts.size >= 2,
      instancesVary: new Set(data.items.map(i => i.stimulusText.toLowerCase())).size === data.items.length,
      noLeaks: gates.findAnswerLeaks(data.items).length === 0,
      conceptIntact: gates.findConceptDefects(data.items).length === 0,
      instanceSpoken: gates.findUnspokenStimulus(data.items).length === 0,
      withSignatureError: data.items.every(i => i.signatureError),
    };
  };

  for (const slot of slots) {
    for (let draw = 1; draw <= 3; draw++) {
      const started = Date.now();
      const data = await generateDiSpokenPractice(slot.topic, slot.grade,
        { objectiveText: slot.objectiveText, intent: slot.intent, targetEvalMode: slot.mode ?? 'explain_concept' });
      result(`generate-${slot.draw}-${slot.objectiveId}-draw${draw}`, {
        input: { objectiveText: slot.objectiveText, intent: slot.intent, mode: slot.mode, shape: slot.shape },
        elapsedMs: Date.now() - started, checks: inspect(data, slot.shape), data,
      });
    }
  }

  // ── REFUSAL: a procedure is not one proposition ───────────────────────────
  const procedure = await generateDiSpokenPractice(
    'adding two-digit numbers', 'Grade 2',
    { objectiveText: 'Explain how to solve a two-digit addition problem step by step',
      intent: 'The child explains each step of the addition method in order.',
      targetEvalMode: 'explain_concept' });
  result('refuses-procedure', { data: procedure,
    checks: { shipsNothing: procedure.items.length === 0 } });

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
