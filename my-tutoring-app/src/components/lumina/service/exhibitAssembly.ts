/**
 * exhibitAssembly — the ONE place a manifest + curator brief + per-instance
 * generated content become an `ExhibitData`.
 *
 * Extracted from `buildCompleteExhibitFromManifest` (geminiService.ts, phase 3)
 * so the production build and a Lesson Bench REPLAY assemble through the same
 * code path. Pure: no Gemini, no fetch, no React — safe on server and client.
 *
 * Replay contract: given the same manifest, brief and content map, this
 * returns the exhibit the student saw. Anything a primitive draws at MOUNT
 * (rather than in its generator) sits outside that guarantee — the Lesson
 * Bench panel flags such blocks per package, it does not hide them.
 *
 * CAREGIVER BLOCKS (Lesson Bench item 12, 2026-09-04). A primitive whose
 * catalog `affordances.audience` is `caregiver` (take-home-activity) is read by
 * an ADULT: it does not teach the child on screen, and the first Bench label
 * cut one from a K lesson as "too much reading". The curator still places it
 * inside an objective. This is the ONE assembly transform that acts on an
 * affordance, and it ADDS a placement rather than removing a block: every
 * caregiver block moves after the final assessment, stamped `audience:
 * 'caregiver'`, so the renderers frame it as a parent card behind the child's
 * path — at EVERY grade, never dropped, never filtered from the catalog
 * (user ruling: demands are facts about the primitive, not grade floors).
 * The Lesson Bench scorer partitions the same way, so it scores the lesson
 * the child actually plays.
 */
import type { ExhibitData, ExhibitManifest, IntroBriefingData, OrderedComponent } from '../types';
import { getComponentById } from './manifest/catalog';
import { resolveAffordances } from './manifest/catalog/affordances';

export interface GeneratedContent {
  instanceId: string;
  data: unknown;
  _failed?: boolean;
}

/** Whether the catalog says an ADULT reads this block (`affordances.audience === 'caregiver'`). */
export function isCaregiverBlock(componentId: string): boolean {
  const def = getComponentById(componentId);
  return !!def && resolveAffordances(def).audience === 'caregiver';
}

/**
 * Split a lesson-ordered list into the child's stream and the parent cards.
 * Relative order is preserved inside each half; nothing is dropped. The
 * predicate is injectable so the Bench can score against a synthetic catalog.
 */
export function partitionCaregiverBlocks<T extends { componentId: string }>(
  items: readonly T[],
  isCaregiver: (componentId: string) => boolean = isCaregiverBlock,
): { stream: T[]; parentCards: T[] } {
  const stream: T[] = [];
  const parentCards: T[] = [];
  for (const item of items) (isCaregiver(item.componentId) ? parentCards : stream).push(item);
  return { stream, parentCards };
}

export function assembleExhibitFromContent(
  manifest: ExhibitManifest,
  curatorBrief: IntroBriefingData,
  contentByInstance: ReadonlyMap<string, GeneratedContent>,
): ExhibitData {
  const inLayoutOrder: OrderedComponent[] = [];

  // Manifest layout order is the lesson order — never the content map's.
  for (const layoutItem of manifest.layout ?? []) {
    if (layoutItem.componentId === 'curator-brief') {
      inLayoutOrder.push({
        componentId: 'curator-brief',
        instanceId: layoutItem.instanceId,
        title: layoutItem.title,
        data: curatorBrief,
        objectiveIds: layoutItem.objectiveIds || [],
      });
      continue;
    }
    const generated = contentByInstance.get(layoutItem.instanceId);
    if (!generated || generated._failed) continue;
    const base = (generated.data && typeof generated.data === 'object')
      ? (generated.data as Record<string, unknown>)
      : {};
    inLayoutOrder.push({
      componentId: layoutItem.componentId,
      instanceId: layoutItem.instanceId,
      title: layoutItem.title,
      data: { ...base, __instanceId: layoutItem.instanceId },
      objectiveIds: layoutItem.objectiveIds || [],
    });
  }

  // Caregiver blocks ride behind the child's path (see header). A lesson with
  // none is byte-identical to layout order.
  const { stream, parentCards } = partitionCaregiverBlocks(inLayoutOrder);
  const orderedComponents: OrderedComponent[] = [
    ...stream,
    ...parentCards.map((c) => ({ ...c, audience: 'caregiver' as const })),
  ];

  const exhibit = {
    topic: manifest.topic,
    themeColor: manifest.themeColor,
    manifest,
    introBriefing: curatorBrief,
    intro: {
      hook: curatorBrief.hook.content,
      objectives: curatorBrief.objectives.map((obj) => obj.text),
    },
    orderedComponents,
    // Legacy arrays kept for backward compatibility with older consumers.
    cards: [],
    featureExhibit: null,
    comparison: null,
    tables: [],
    graphBoards: [],
    scaleSpectrums: [],
    annotatedExamples: [],
    nestedHierarchies: [],
    imagePanels: [],
    takeHomeActivities: [],
    knowledgeCheck: null,
    specializedExhibits: [],
    relatedTopics: [],
  };
  return exhibit as unknown as ExhibitData;
}
