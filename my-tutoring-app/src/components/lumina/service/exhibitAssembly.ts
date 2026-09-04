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
 */
import type { ExhibitData, ExhibitManifest, IntroBriefingData, OrderedComponent } from '../types';

export interface GeneratedContent {
  instanceId: string;
  data: unknown;
  _failed?: boolean;
}

export function assembleExhibitFromContent(
  manifest: ExhibitManifest,
  curatorBrief: IntroBriefingData,
  contentByInstance: ReadonlyMap<string, GeneratedContent>,
): ExhibitData {
  const orderedComponents: OrderedComponent[] = [];

  // Manifest layout order is the lesson order — never the content map's.
  for (const layoutItem of manifest.layout ?? []) {
    if (layoutItem.componentId === 'curator-brief') {
      orderedComponents.push({
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
    orderedComponents.push({
      componentId: layoutItem.componentId,
      instanceId: layoutItem.instanceId,
      title: layoutItem.title,
      data: { ...base, __instanceId: layoutItem.instanceId },
      objectiveIds: layoutItem.objectiveIds || [],
    });
  }

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
