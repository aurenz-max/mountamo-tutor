// Runtime probe for phoneme-explorer's new `medial` eval mode (lesson-bench
// item 23). Real Gemini calls through the REAL registry dispatch — the same
// path hydration uses. Run from my-tutoring-app.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const output = resolve(root, process.argv[2] || 'qa/eval-reports/phoneme-medial-probe.json');
const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
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

// The objective text from BOTH draws in item 23 — this is the exact demand
// that came back off_target_assessment twice.
const OBJECTIVE = "Listen to and identify the short 'a' sound in spoken words";
const TOPIC = 'Decoding CVC words with short a';

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const base = '/src/components/lumina/';
  const script = await runner.import(`${base}primitives/visual-primitives/literacy/phonemeExplorerScript.ts`);
  const { resolveLessonEvalModes } = await runner.import(`${base}service/manifest/resolveLessonEvalModes.ts`);
  await runner.import(`${base}service/registry/generators/literacyGenerators.ts`);
  const { getGenerator } = await runner.import(`${base}service/registry/contentRegistry.ts`);
  const { spokenSpanOf } = await runner.import(`${base}hooks/judgedScriptContract.ts`);

  // ── A. Does the lesson-level selector now PIN medial for this objective? ──
  const manifest = {
    objectiveBlocks: [{
      objectiveId: 'obj-medial', objectiveText: OBJECTIVE, objectiveVerb: 'apply',
      components: [{ componentId: 'phoneme-explorer', instanceId: 'obj-medial-phoneme', intent: OBJECTIVE, config: {} }],
    }],
  };
  const routing = await resolveLessonEvalModes(manifest, TOPIC, 'kindergarten');
  const pinned = manifest.objectiveBlocks[0].components[0].config.targetEvalMode;
  result('lesson-routing-pins-medial', {
    routing, pinned,
    checks: { pinsMedial: typeof pinned === 'string' && pinned.split('|').includes('medial') },
  });

  // ── Per-item gates: what the ask may and may not contain ──────────────────
  const inspect = (data) => {
    const built = script.itemsFromChallenges(data.challenges);
    const asks = built.map((i) => script.itemCue(i));
    const medials = built.filter((i) => i.kind === 'medial');
    const srcByIndex = data.challenges;
    return {
      generated: data.challenges.length >= 3,
      allSurviveGates: built.length === data.challenges.length,
      everyItemMedial: built.length > 0 && medials.length === built.length,
      // The design ruling: the ask states the stimulus, never the vowel.
      // The design ruling, measured on the line the tutor actually SPEAKS.
      askNeverNamesVowel: medials.every((i) =>
        !new RegExp(i.vowelSpoken, 'i').test(spokenSpanOf(script.itemCue(i)))),
      askAsksForSameMiddleSound: medials.every((i) =>
        script.itemCue(i).includes(`same middle sound as ${i.targetWord}`)),
      correctionNamesVowelInBoth: medials.every((i) =>
        script.itemCue(i).includes(`${i.targetWord} has ${i.vowelSpoken} in the middle`)
        && script.itemCue(i).includes(`has ${i.vowelSpoken} in the middle too`)),
      vowelIsReallyInTheWord: srcByIndex.every((c) =>
        c.mode !== 'medial' || String(c.targetWord).toLowerCase().includes(String(c.vowel).toLowerCase())),
      stimulusNotOnACard: medials.every((i) =>
        !(i.menu ?? []).some((c) => c.word.toLowerCase() === String(i.targetWord).toLowerCase())),
      exactlyOneCorrectPerMenu: srcByIndex.every((c) =>
        c.mode !== 'medial' || (c.choices ?? []).filter((x) => x.correct).length === 1),
      // The pedagogy the mode exists for: distractors must differ in the MIDDLE.
      distractorsChangeTheVowel: srcByIndex.every((c) => {
        if (c.mode !== 'medial') return true;
        const v = String(c.vowel).toLowerCase();
        const wrong = (c.choices ?? []).filter((x) => !x.correct).map((x) => x.word.toLowerCase());
        const right = (c.choices ?? []).find((x) => x.correct)?.word.toLowerCase() ?? '';
        return right.includes(v) && wrong.every((w) => !w.includes(v));
      }),
      noDuplicateAsks: new Set(asks).size === asks.length,
      leakOracleExemptsOnlyTheMenu: medials.every((i) =>
        script.leakExemptSpanFor(i) === `The words are: ${(i.menu ?? []).map((c) => c.word).join(', ')}.`),
    };
  };

  /** Hard tier above K: the picture cue goes and the ask stops reading the menu. */
  const inspectHard = (data) => {
    const built = script.itemsFromChallenges(data.challenges);
    const medials = built.filter((i) => i.kind === 'medial');
    const shared = inspect(data);
    // At this tier the ask never reads the menu, so no exemption is issued —
    // `noExemptionWhenUnspoken` below is the correct assertion instead.
    delete shared.leakOracleExemptsOnlyTheMenu;
    return {
      ...shared,
      tierStamped: data.supportTier === 'hard'
        && data.challenges.every((c) => c.showChoiceEmoji === false && c.readOptionsAloud === false),
      askStopsEnumerating: medials.length > 0 && medials.every((i) =>
        i.enumerateMenu === false
        && spokenSpanOf(script.itemCue(i)).includes('Read the cards')
        && !spokenSpanOf(script.itemCue(i)).includes('The words are:')),
      noExemptionWhenUnspoken: medials.every((i) => script.leakExemptSpanFor(i) === undefined),
    };
  };

  const drive = async (name, { targetEvalMode, supportTier, grade, checker = inspect }) => {
    const item = {
      componentId: 'phoneme-explorer', instanceId: `probe-${name}`, intent: OBJECTIVE,
      // `difficulty` is the support-tier channel resolveGenerationContext reads
      // (it normalizes it to ctx.supportTier) — passing `supportTier` directly
      // reaches ctx.raw and is silently ignored.
      config: { objectiveText: OBJECTIVE, ...(targetEvalMode ? { targetEvalMode } : {}),
        ...(supportTier ? { difficulty: supportTier } : {}), ...(grade ? { objectiveGrade: grade } : {}) },
    };
    const started = Date.now();
    const hydrated = await getGenerator('phoneme-explorer')(item, TOPIC, 'kindergarten', 'kindergarten');
    result(name, {
      input: item, elapsedMs: Date.now() - started,
      checks: checker(hydrated.data), data: hydrated.data,
    });
  };

  // ── B. Pinned medial — the supply the objective was missing. ─────────────
  await drive('pinned-medial', { targetEvalMode: 'medial' });
  // ── C. UNPINNED — intent alone must reach the new mode (the half of the
  //       fix the old pin-only resolver could not do). ─────────────────────
  await drive('unpinned-intent-only', {});
  // ── D. Hard tier — medial's one ask-side lever is enumeration. ───────────
  await drive('hard-tier', { targetEvalMode: 'medial', supportTier: 'hard', grade: '1', checker: inspectHard });

  evidence.finishedAt = new Date().toISOString();
  evidence.passed = evidence.results.every((r) => r.checks && Object.values(r.checks).every(Boolean));
  save();
  if (!evidence.passed) process.exitCode = 1;
} catch (error) {
  result('probe-error', { error: error instanceof Error ? `${error.message}\n${error.stack}` : String(error) });
  process.exitCode = 1;
} finally {
  await server.close();
}
