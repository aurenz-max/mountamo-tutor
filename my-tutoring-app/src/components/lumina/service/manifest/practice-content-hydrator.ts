/**
 * Practice Content Hydrator
 *
 * Takes a PracticeManifest and hydrates each item with generated content:
 * - Visual items: uses generateComponentContent (existing generator registry)
 * - Standard items: batched through the KC orchestrator for optimal problem type
 *   mix, inset selection, and difficulty progression.
 *
 * This runs server-side and is called from route.ts.
 */

import { PracticeManifest, HydratedPracticeItem, ProblemType } from '../../types';
import { generateComponentContent, normalizeGradeLevel } from '../geminiService';
import { generateKnowledgeCheck, BloomsTier } from '../knowledge-check/gemini-knowledge-check';
import { normalizeObjectiveGrade } from '../generation/resolveGenerationContext';

type ManifestItem = PracticeManifest['items'][0];

/** What a generator builds for: the item's own subskill when it has one (Pulse),
 *  else the session topic and grade. */
function scopeFor(item: ManifestItem, manifest: PracticeManifest): { topic: string; gradeLevel: string } {
  return {
    topic: item.objective?.text || manifest.topic,
    gradeLevel: item.objective?.grade || manifest.gradeLevel,
  };
}

/**
 * Callback fired each time an individual item finishes hydrating.
 */
export type OnItemHydrated = (item: HydratedPracticeItem, index: number, total: number) => void;

/**
 * Hydrate a practice manifest by generating content for each item.
 *
 * Visual items are hydrated individually via the generator registry.
 * Standard items are BATCHED into a single orchestrated KC call so the
 * orchestrator can plan the optimal problem type mix, insets, and progression
 * across the full set.
 *
 * When onItemHydrated is provided, each item is reported as soon as it finishes,
 * enabling the caller to stream results to the client progressively.
 */
export async function hydratePracticeManifest(
  manifest: PracticeManifest,
  onItemHydrated?: OnItemHydrated,
): Promise<HydratedPracticeItem[]> {
  const total = manifest.items.length;
  const results: HydratedPracticeItem[] = new Array(total);

  // Separate visual items (hydrated individually) from standard items (batched)
  const visualItems: { item: PracticeManifest['items'][0]; index: number }[] = [];
  const standardItems: { item: PracticeManifest['items'][0]; index: number }[] = [];
  const emptyItems: { item: PracticeManifest['items'][0]; index: number }[] = [];

  for (let i = 0; i < manifest.items.length; i++) {
    const item = manifest.items[i];
    if (item.visualPrimitive) {
      visualItems.push({ item, index: i });
    } else if (item.standardProblem) {
      standardItems.push({ item, index: i });
    } else {
      emptyItems.push({ item, index: i });
    }
  }

  // Hydrate visual items in parallel (unchanged)
  const visualPromises = visualItems.map(async ({ item, index }): Promise<void> => {
    let hydrated: HydratedPracticeItem;
    try {
      // An item with an objective takes its number scope from the objective
      // (ctx.scope / objectiveNumberWindow). The manifest's numberRange comes
      // from a grade table and, being explicit, would override the subskill's
      // own numbers ("count 11-20" capped at K's 1-10).
      const nr = item.objective ? null : item.visualPrimitive!.numberRange;
      console.log(`[Hydrator] ${item.visualPrimitive!.componentId} numberRange:`, nr ?? (item.objective ? 'from objective' : 'none'));
      const scope = scopeFor(item, manifest);
      // With an objective, the intent is the subskill too. The manifest's intent
      // describes one sample problem ("teen number 14"), and generators that
      // read a range from intent then built the whole session on that one value.
      const intent = item.objective?.text || item.visualPrimitive!.intent || item.problemText;

      const manifestItem = {
        componentId: item.visualPrimitive!.componentId,
        instanceId: item.instanceId,
        intent,
        config: {
          intent,
          ...(nr && { numberRange: nr }),
          // Pinned by resolvePulseEvalModes — short-circuits the generator's
          // own per-item eval-mode micro-call. Absent → generator self-resolves.
          ...(item.visualPrimitive!.targetEvalMode && { targetEvalMode: item.visualPrimitive!.targetEvalMode }),
          difficulty: item.difficulty,
          ...(item.objective && {
            objectiveId: item.objective.id,
            objectiveText: item.objective.text,
            objectiveGrade: item.objective.grade,
            fitSource: 'pulse',
          }),
        },
      };

      const visualData = await generateComponentContent(manifestItem, scope.topic, scope.gradeLevel);

      if (visualData && item.objective && visualData.fitGate?.pass === false) {
        // Still off the subskill after the fit gate's redraw: a problem built
        // from the subskill teaches it; the visual would teach something else.
        console.warn(`[Hydrator] ${item.visualPrimitive!.componentId} misses "${item.objective.text.slice(0, 50)}" after redraw → standard problem`);
        hydrated = await hydrateAsFallbackProblem(item, manifest);
      } else if (visualData) {
        hydrated = { manifestItem: item, visualData };
      } else {
        console.warn(`Visual generator returned null for ${item.visualPrimitive!.componentId}, falling back to standard`);
        hydrated = await hydrateAsFallbackProblem(item, manifest);
      }
    } catch (err) {
      console.warn(`Visual hydration failed for ${item.instanceId}:`, err);
      hydrated = await hydrateAsFallbackProblem(item, manifest);
    }

    results[index] = hydrated;
    onItemHydrated?.(hydrated, index, total);
  });

  // Standard items that serve a subskill (Pulse): one problem each, built for
  // that subskill at its grade. Batching them under the session topic gave every
  // item the same generic problem, whatever subskill it was for.
  const objectivePromises = standardItems
    .filter(({ item }) => item.objective)
    .map(async ({ item, index }): Promise<void> => {
      results[index] = await hydrateStandardForObjective(item, manifest);
      onItemHydrated?.(results[index], index, total);
    });
  const batchedStandard = standardItems.filter(({ item }) => !item.objective);

  // Batch the remaining standard items through the KC orchestrator
  const standardPromise = (async (): Promise<void> => {
    const standardItems = batchedStandard;
    if (standardItems.length === 0) return;

    // Determine Bloom's tier — use the first item's evalMode (they're typically the same within a manifest)
    const bloomsTier = standardItems[0].item.standardProblem?.evalMode as BloomsTier | undefined;

    try {
      console.log(`[Hydrator] Orchestrating ${standardItems.length} standard problems`);

      const problems = await generateKnowledgeCheck(
        manifest.topic,
        normalizeGradeLevel(manifest.gradeLevel),
        {
          count: standardItems.length,
          bloomsTier,
          useOrchestrator: true,
        }
      );

      // Distribute generated problems back to their manifest positions
      for (let i = 0; i < standardItems.length; i++) {
        const { item, index } = standardItems[i];
        const problemData = problems[i] || undefined;

        const hydrated: HydratedPracticeItem = problemData
          ? { manifestItem: item, problemData }
          : { manifestItem: item };

        if (!problemData) {
          console.warn(`[Hydrator] Orchestrator returned no problem for index ${i} (${item.instanceId})`);
        }

        results[index] = hydrated;
        onItemHydrated?.(hydrated, index, total);
      }
    } catch (err) {
      console.warn('[Hydrator] Orchestrated KC failed, falling back to per-item direct generation:', err);

      // Fallback: generate each standard item individually with direct mode
      await Promise.all(standardItems.map(async ({ item, index }) => {
        let hydrated: HydratedPracticeItem;
        try {
          const problems = await generateKnowledgeCheck(
            manifest.topic,
            normalizeGradeLevel(manifest.gradeLevel),
            {
              problemType: item.standardProblem!.problemType,
              count: 1,
              bloomsTier: item.standardProblem!.evalMode as BloomsTier | undefined,
            }
          );
          const problemData = Array.isArray(problems) ? problems[0] : problems;
          hydrated = { manifestItem: item, problemData };
        } catch {
          hydrated = { manifestItem: item };
        }
        results[index] = hydrated;
        onItemHydrated?.(hydrated, index, total);
      }));
    }
  })();

  // Handle orphan items
  for (const { item, index } of emptyItems) {
    console.warn(`Item ${item.instanceId} has neither visualPrimitive nor standardProblem`);
    results[index] = { manifestItem: item };
    onItemHydrated?.({ manifestItem: item }, index, total);
  }

  await Promise.all([...visualPromises, ...objectivePromises, standardPromise]);
  return results;
}

/** One standard problem for the item's own subskill and grade. */
async function hydrateStandardForObjective(
  item: ManifestItem,
  manifest: PracticeManifest,
): Promise<HydratedPracticeItem> {
  const scope = scopeFor(item, manifest);
  const grade = normalizeObjectiveGrade(item.objective!.grade);
  try {
    // Text problems skip generateComponentContent, so they pass the same fit gate here.
    const { generateWithFitGate } = await import('../fitGate/fitGate');
    const { result: problemData } = await generateWithFitGate({
      componentId: 'knowledge-check',
      objective: item.objective!.text,
      grade: grade === 'K' ? 'Kindergarten' : grade ? `Grade ${grade}` : scope.gradeLevel,
      canonicalGrade: grade,
      gradeLevel: normalizeGradeLevel(scope.gradeLevel),
      subskillId: item.objective!.id,
      source: 'pulse',
    }, async (notes) => {
      const problems = await generateKnowledgeCheck(
        notes.length ? `${scope.topic}\n\nA previous attempt was rejected. Fix this:\n${notes.map((n) => `- ${n}`).join('\n')}` : scope.topic,
        normalizeGradeLevel(scope.gradeLevel), {
          problemType: item.standardProblem!.problemType,
          count: 1,
          bloomsTier: item.standardProblem!.evalMode as BloomsTier | undefined,
          objectiveText: item.objective!.text,
          preciseGrade: grade,
        });
      return (Array.isArray(problems) ? problems[0] : problems) ?? null;
    });
    if (problemData && item.objective) problemData.objectiveId = item.objective.id;
    return problemData ? { manifestItem: item, problemData } : { manifestItem: item };
  } catch (err) {
    console.warn(`[Hydrator] Standard problem failed for ${item.instanceId}:`, err);
    return { manifestItem: item };
  }
}

/**
 * Fallback: when visual generation fails, generate a standard multiple-choice problem instead.
 */
async function hydrateAsFallbackProblem(
  item: PracticeManifest['items'][0],
  manifest: PracticeManifest
): Promise<HydratedPracticeItem> {
  try {
    const scope = scopeFor(item, manifest);
    const problems = await generateKnowledgeCheck(
      scope.topic,
      normalizeGradeLevel(scope.gradeLevel),
      {
        problemType: 'multiple_choice' as ProblemType,
        count: 1,
        ...(item.objective && {
          objectiveText: item.objective.text,
          preciseGrade: normalizeObjectiveGrade(item.objective.grade),
        }),
      }
    );

    const problemData = Array.isArray(problems) ? problems[0] : problems;

    return {
      manifestItem: {
        ...item,
        visualPrimitive: null,
        standardProblem: {
          problemType: 'multiple_choice',
          generationIntent: item.problemText,
        },
      },
      problemData,
    };
  } catch {
    return { manifestItem: item };
  }
}
