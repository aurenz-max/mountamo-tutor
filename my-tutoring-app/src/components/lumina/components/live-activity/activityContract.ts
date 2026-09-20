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
import { numberLineLive, ACTIVITY_MODES, validateActivityData, initialActivityState } from './adapters/numberLineLive';
import { tenFrameLive, TEN_FRAME_MODES, validateTenFrameData } from './adapters/tenFrameLive';
import { countingBoardLive, COUNTING_BOARD_MODES, validateCountingBoardData } from './adapters/countingBoardLive';
import { numberSequencerLive, NUMBER_SEQUENCER_LIVE_MODES, validateNumberSequencerData } from './adapters/numberSequencerLive';
import { numberBondLive, NUMBER_BOND_LIVE_MODES, validateNumberBondData } from './adapters/numberBondLive';
import { ordinalLineLive, ORDINAL_LINE_LIVE_MODES, validateOrdinalLineData } from './adapters/ordinalLineLive';
import { sortingStationLive, SORTING_STATION_LIVE_MODES, validateSortingStationData } from './adapters/sortingStationLive';
import { numberTracerLive, NUMBER_TRACER_LIVE_MODES, validateNumberTracerData } from './adapters/numberTracerLive';
import { comparisonBuilderLive, COMPARISON_BUILDER_LIVE_MODES, validateComparisonBuilderData } from './adapters/comparisonBuilderLive';
import { compareObjectsLive, COMPARE_OBJECTS_LIVE_MODES, validateCompareObjectsData } from './adapters/compareObjectsLive';
import { placeValueLive, PLACE_VALUE_LIVE_MODES, validatePlaceValueData } from './adapters/placeValueLive';
import { shapeSorterLive, SHAPE_SORTER_LIVE_MODES, validateShapeSorterData } from './adapters/shapeSorterLive';
import type { LiveActivityAdapter } from './adapters/adapterContract';

export type { LiveActivityAdapter } from './adapters/adapterContract';
export { ACTIVITY_MODES, TEN_FRAME_MODES, COUNTING_BOARD_MODES, NUMBER_SEQUENCER_LIVE_MODES, NUMBER_BOND_LIVE_MODES, ORDINAL_LINE_LIVE_MODES, SORTING_STATION_LIVE_MODES, NUMBER_TRACER_LIVE_MODES, COMPARISON_BUILDER_LIVE_MODES, COMPARE_OBJECTS_LIVE_MODES, PLACE_VALUE_LIVE_MODES, SHAPE_SORTER_LIVE_MODES };
export { validateActivityData, initialActivityState, validateTenFrameData, validateCountingBoardData, validateNumberSequencerData, validateNumberBondData, validateOrdinalLineData, validateSortingStationData, validateNumberTracerData, validateComparisonBuilderData, validateCompareObjectsData, validatePlaceValueData, validateShapeSorterData };

/**
 * Adopted families. Order is the picker's order.
 *
 * `satisfies` rather than an annotation, so `LivePrimitiveId` stays the literal
 * union of the keys and a missed registration is a type error at every consumer.
 */
export const LIVE_ADAPTERS = {
  'number-line': numberLineLive,
  'ten-frame': tenFrameLive,
  'counting-board': countingBoardLive,
  'number-sequencer': numberSequencerLive,
  'number-bond': numberBondLive,
  'ordinal-line': ordinalLineLive,
  'sorting-station': sortingStationLive,
  'number-tracer': numberTracerLive,
  'comparison-builder': comparisonBuilderLive,
  'compare-objects': compareObjectsLive,
  'place-value-chart': placeValueLive,
  'shape-sorter': shapeSorterLive,
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
