/**
 * Practice Content Hydrator
 *
 * Takes a PracticeManifest and hydrates each item with generated content:
 * - Visual items: uses generateComponentContent (existing generator registry)
 * - Standard items: uses generateKnowledgeCheck (existing problem generator)
 *
 * This runs server-side and is called from route.ts.
 */

import { PracticeManifest, HydratedPracticeItem, ProblemType } from '../../types';
import { generateComponentContent } from '../geminiService';
import { generateKnowledgeCheck } from '../knowledge-check/gemini-knowledge-check';

/**
 * Callback fired each time an individual item finishes hydrating.
 */
export type OnItemHydrated = (item: HydratedPracticeItem, index: number, total: number) => void;

/**
 * Hydrate a practice manifest by generating content for each item.
 * Visual items get component data via the generator registry.
 * Standard items get problem data via knowledge-check generator.
 * All items are hydrated in parallel for performance.
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

  const hydratePromises = manifest.items.map(async (item, index): Promise<void> => {
    let hydrated: HydratedPracticeItem;

    if (item.visualPrimitive) {
      // Visual primitive path: use existing generator registry
      try {
        const manifestItem = {
          componentId: item.visualPrimitive.componentId,
          instanceId: item.instanceId,
          // Pass the visual intent combined with the problem text as generator context
          intent: item.visualPrimitive.intent || item.problemText,
          config: {
            intent: item.visualPrimitive.intent || item.problemText,
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
          // Generator returned null — fall back to standard problem
          console.warn(`Visual generator returned null for ${item.visualPrimitive.componentId}, falling back to standard`);
          hydrated = await hydrateAsFallbackProblem(item, manifest);
        }
      } catch (err) {
        console.warn(`Visual hydration failed for ${item.instanceId}:`, err);
        hydrated = await hydrateAsFallbackProblem(item, manifest);
      }
    } else if (item.standardProblem) {
      // Standard problem path: use knowledge-check generator
      try {
        const problems = await generateKnowledgeCheck(
          manifest.topic,
          manifest.gradeLevel,
          {
            problemType: item.standardProblem.problemType,
            count: 1,
          }
        );

        const problemData = Array.isArray(problems) ? problems[0] : problems;
        hydrated = { manifestItem: item, problemData };
      } catch (err) {
        console.warn(`Standard problem hydration failed for ${item.instanceId}:`, err);
        hydrated = { manifestItem: item };
      }
    } else {
      // Neither visual nor standard — shouldn't happen, but handle gracefully
      console.warn(`Item ${item.instanceId} has neither visualPrimitive nor standardProblem`);
      hydrated = { manifestItem: item };
    }

    results[index] = hydrated;
    onItemHydrated?.(hydrated, index, total);
  });

  await Promise.all(hydratePromises);
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
      manifest.gradeLevel,
      {
        problemType: 'multiple_choice' as ProblemType,
        count: 1,
      }
    );

    const problemData = Array.isArray(problems) ? problems[0] : problems;

    // Rewrite the manifest item to standard mode
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
