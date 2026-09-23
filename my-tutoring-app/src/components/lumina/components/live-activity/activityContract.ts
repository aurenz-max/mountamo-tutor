/**
 * The live-activity registry: which primitive families the live session can mount,
 * and nothing about any one of them.
 *
 * Every primitive-specific fact — modes, validation, mounted state, grade gate,
 * picker copy, lesson-start wording, model guidance — lives in that primitive's own
 * module under `adapters/`. This file only composes them, so adopting a family is a
 * new adapter file plus one line here, and the server route, the capabilities route
 * and the sandbox all widen automatically.
 */
import { numberLineLiveDomain, validateActivityData, initialActivityState } from './adapters/numberLineLive';
import { tenFrameLiveDomain, validateTenFrameData } from './adapters/tenFrameLive';
import { countingBoardLiveDomain } from './adapters/countingBoardLive';
import { numberSequencerLiveDomain } from './adapters/numberSequencerLive';
import { numberBondLiveDomain } from './adapters/numberBondLive';
import { ordinalLineLiveDomain } from './adapters/ordinalLineLive';
import { sortingStationLiveDomain } from './adapters/sortingStationLive';
import { numberTracerLiveDomain } from './adapters/numberTracerLive';
import { comparisonBuilderLiveDomain } from './adapters/comparisonBuilderLive';
import { compareObjectsLiveDomain } from './adapters/compareObjectsLive';
import { placeValueLiveDomain } from './adapters/placeValueLive';
import { shapeSorterLiveDomain, validateShapeSorterData } from './adapters/shapeSorterLive';
import { diLetterSoundsLiveDomain } from './adapters/diLetterSoundsLive';
import { diWordReadingLiveDomain } from './adapters/diWordReadingLive';
import { diMathFactsLiveDomain } from './adapters/diMathFactsLive';
import { diSentenceReadingLiveDomain } from './adapters/diSentenceReadingLive';
import { letterSoundLinkLiveDomain } from './adapters/letterSoundLinkLive';
import { workspaceAdapter, type LiveActivityAdapter } from './adapters/adapterContract';

export type { LiveActivityAdapter } from './adapters/adapterContract';
// Re-exported for `activityContract.test.ts`; everything else reads `LIVE_ADAPTERS[id]`.
export { validateActivityData, initialActivityState, validateTenFrameData, validateShapeSorterData };

/**
 * Adopted families. Order is the picker's order.
 *
 * `satisfies` rather than an annotation, so `LivePrimitiveId` stays the literal
 * union of the keys and a missed registration is a type error at every consumer.
 */
export const LIVE_ADAPTERS = {
  'number-line': workspaceAdapter('number-line', numberLineLiveDomain),
  'ten-frame': workspaceAdapter('ten-frame', tenFrameLiveDomain),
  'counting-board': workspaceAdapter('counting-board', countingBoardLiveDomain),
  'number-sequencer': workspaceAdapter('number-sequencer', numberSequencerLiveDomain),
  'number-bond': workspaceAdapter('number-bond', numberBondLiveDomain),
  'ordinal-line': workspaceAdapter('ordinal-line', ordinalLineLiveDomain),
  'sorting-station': workspaceAdapter('sorting-station', sortingStationLiveDomain),
  'number-tracer': workspaceAdapter('number-tracer', numberTracerLiveDomain),
  'comparison-builder': workspaceAdapter('comparison-builder', comparisonBuilderLiveDomain),
  'compare-objects': workspaceAdapter('compare-objects', compareObjectsLiveDomain),
  'place-value-chart': workspaceAdapter('place-value-chart', placeValueLiveDomain),
  'shape-sorter': workspaceAdapter('shape-sorter', shapeSorterLiveDomain),
  'di-letter-sounds': workspaceAdapter('di-letter-sounds', diLetterSoundsLiveDomain),
  'di-word-reading': workspaceAdapter('di-word-reading', diWordReadingLiveDomain),
  'di-math-facts': workspaceAdapter('di-math-facts', diMathFactsLiveDomain),
  'di-sentence-reading': workspaceAdapter('di-sentence-reading', diSentenceReadingLiveDomain),
  'letter-sound-link': workspaceAdapter('letter-sound-link', letterSoundLinkLiveDomain),
} satisfies Record<string, LiveActivityAdapter<any>>;

export type LivePrimitiveId = keyof typeof LIVE_ADAPTERS;
/** Derived, so a new adapter widens it without an edit here. */
export type LiveActivityData = ReturnType<(typeof LIVE_ADAPTERS)[LivePrimitiveId]['validate']>;

export const LIVE_PRIMITIVE_IDS = Object.keys(LIVE_ADAPTERS) as LivePrimitiveId[];

export interface ActivityRequest {
  primitiveId: LivePrimitiveId;
  topic: string;
  intent: string;
  mode: string;
}

export interface MountedActivity {
  callId: string;
  instanceId: string;
  request: Pick<ActivityRequest, 'primitiveId'> & Partial<ActivityRequest>;
  data: LiveActivityData;
  /** Set when the activity came from a prepared lesson plan rather than a generation request. */
  planItemId?: string;
  /** Preserve the resolved plan mode, including blends. */
  resolvedEvalMode?: string;
}

export const isLivePrimitive = (id: string): id is LivePrimitiveId => Object.hasOwn(LIVE_ADAPTERS, id);

export function parseActivityRequest(value: unknown): ActivityRequest {
  const v = value as Record<string, unknown> | null;
  const id = v?.primitiveId as string;
  if (!v || typeof id !== 'string' || !isLivePrimitive(id) || !LIVE_ADAPTERS[id].modes.includes(v.mode as string)
      || ['topic', 'intent'].some(k => typeof v[k] !== 'string' || !(v[k] as string).trim()
        || (v[k] as string).length > 1000)) throw new Error('Unsupported activity request');
  return { primitiveId: id, topic: (v.topic as string).trim(),
    intent: (v.intent as string).trim(), mode: v.mode as string };
}

/** The grade gate, per family. Returns the refusal sentence, or null when allowed. */
export function gradeRefusal(primitiveId: LivePrimitiveId, gradeLevel: string): string | null {
  const adapter = LIVE_ADAPTERS[primitiveId];
  return adapter.grades.includes(gradeLevel)
    ? null
    : `The ${primitiveId} lesson supports ${adapter.grades[0]} through ${adapter.grades[adapter.grades.length - 1]}.`;
}

export function validateGeneratedActivity(primitiveId: LivePrimitiveId, value: unknown) {
  return LIVE_ADAPTERS[primitiveId].validate(value);
}

export function generatedActivityState(primitiveId: LivePrimitiveId, data: LiveActivityData) {
  // The id and the data are paired by `validateGeneratedActivity`; TypeScript cannot
  // carry that pairing across the registry, so the widened adapter is the cast site.
  return (LIVE_ADAPTERS[primitiveId] as LiveActivityAdapter).initialState(data);
}
