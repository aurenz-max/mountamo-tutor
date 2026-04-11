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
      const nr = item.visualPrimitive!.numberRange;
      console.log(`[Hydrator] ${item.visualPrimitive!.componentId} numberRange from manifest:`, nr ?? 'none');

      const manifestItem = {
        componentId: item.visualPrimitive!.componentId,
        instanceId: item.instanceId,
        intent: item.visualPrimitive!.intent || item.problemText,
        config: {
          intent: item.visualPrimitive!.intent || item.problemText,
          ...(nr && { numberRange: nr }),
          difficulty: item.difficulty,
        },
      };

      const visualData = await generateComponentContent(
        manifestItem,
        manifest.topic,
        manifest.gradeLevel
      );

      if (visualData) {
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

  // Batch standard items through the KC orchestrator
  const standardPromise = (async (): Promise<void> => {
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

  await Promise.all([...visualPromises, standardPromise]);
  return results;
}

/**
 * Fallback: when visual generation fails, generate a standard multiple-choice problem instead.
 */
async function hydrateAsFallbackProblem(
  item: PracticeManifest['items'][0],
  manifest: PracticeManifest
): Promise<HydratedPracticeItem> {
  try {
    const problems = await generateKnowledgeCheck(
      manifest.topic,
      normalizeGradeLevel(manifest.gradeLevel),
      {
        problemType: 'multiple_choice' as ProblemType,
        count: 1,
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
