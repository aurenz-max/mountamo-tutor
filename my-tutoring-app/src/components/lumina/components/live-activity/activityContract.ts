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
import { balanceScaleLiveDomain } from './adapters/balanceScaleLive';
import { fractionCirclesLiveDomain } from './adapters/fractionCirclesLive';
import { placeValueLiveDomain } from './adapters/placeValueLive';
import { baseTenBlocksLiveDomain } from './adapters/baseTenBlocksLive';
import { shapeSorterLiveDomain, validateShapeSorterData } from './adapters/shapeSorterLive';
import { diLetterSoundsLiveDomain } from './adapters/diLetterSoundsLive';
import { diWordReadingLiveDomain } from './adapters/diWordReadingLive';
import { diMathFactsLiveDomain } from './adapters/diMathFactsLive';
import { diSentenceReadingLiveDomain } from './adapters/diSentenceReadingLive';
import { letterSoundLinkLiveDomain } from './adapters/letterSoundLinkLive';
import { barModelLiveDomain } from './adapters/barModelLive';
import { phonicsBlenderLiveDomain } from './adapters/phonicsBlenderLive';
import { adaptationInvestigatorLiveDomain } from './adapters/adaptationInvestigatorLive';
import { wordFlipLiveDomain } from './adapters/wordFlipLive';
import { soundSwapLiveDomain } from './adapters/soundSwapLive';
import { cvcSpellerLiveDomain } from './adapters/cvcSpellerLive';
import { syllableClapperLiveDomain } from './adapters/syllableClapperLive';
import { rhymeStudioLiveDomain } from './adapters/rhymeStudioLive';
import { phonemeExplorerLiveDomain } from './adapters/phonemeExplorerLive';
import { wordWorkoutLiveDomain } from './adapters/wordWorkoutLive';
import { wordBuilderLiveDomain } from './adapters/wordBuilderLive';
import { wordSorterLiveDomain } from './adapters/wordSorterLive';
import { pictureVocabularyLiveDomain } from './adapters/pictureVocabularyLive';
import { letterSpotterLiveDomain } from './adapters/letterSpotterLive';
import { decodableReaderLiveDomain } from './adapters/decodableReaderLive';
import { interactiveBookLiveDomain } from './adapters/interactiveBookLive';
import { storyBridgeLiveDomain } from './adapters/storyBridgeLive';
import { storyRibbonLiveDomain } from './adapters/storyRibbonLive';
import { additionSubtractionSceneLiveDomain } from './adapters/additionSubtractionSceneLive';
import { threeDShapeExplorerLiveDomain } from './adapters/threeDShapeExplorerLive';
import { calendarExplorerLiveDomain } from './adapters/calendarExplorerLive';
import { pushPullArenaLiveDomain } from './adapters/pushPullArenaLive';
import { habitatDioramaLiveDomain } from './adapters/habitatDioramaLive';
import { matterExplorerLiveDomain } from './adapters/matterExplorerLive';
import { statesOfMatterLiveDomain } from './adapters/statesOfMatterLive';
import { solarSystemExplorerLiveDomain } from './adapters/solarSystemExplorerLive';
import { youAndMeLiveDomain } from './adapters/youAndMeLive';
import { rampLabLiveDomain } from './adapters/rampLabLive';
import { diShapesLiveDomain } from './adapters/diShapesLive';
import { diSpokenPracticeLiveDomain } from './adapters/diSpokenPracticeLive';
import { diDiceRollLiveDomain } from './adapters/diDiceRollLive';
import { diDeductionLiveDomain } from './adapters/diDeductionLive';
import { spatialSceneLiveDomain } from './adapters/spatialSceneLive';
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
  'balance-scale': workspaceAdapter('balance-scale', balanceScaleLiveDomain),
  'fraction-circles': workspaceAdapter('fraction-circles', fractionCirclesLiveDomain),
  'place-value-chart': workspaceAdapter('place-value-chart', placeValueLiveDomain),
  'base-ten-blocks': workspaceAdapter('base-ten-blocks', baseTenBlocksLiveDomain),
  'shape-sorter': workspaceAdapter('shape-sorter', shapeSorterLiveDomain),
  'di-letter-sounds': workspaceAdapter('di-letter-sounds', diLetterSoundsLiveDomain),
  'di-word-reading': workspaceAdapter('di-word-reading', diWordReadingLiveDomain),
  'di-math-facts': workspaceAdapter('di-math-facts', diMathFactsLiveDomain),
  'di-sentence-reading': workspaceAdapter('di-sentence-reading', diSentenceReadingLiveDomain),
  'letter-sound-link': workspaceAdapter('letter-sound-link', letterSoundLinkLiveDomain),
  'bar-model': workspaceAdapter('bar-model', barModelLiveDomain),
  'phonics-blender': workspaceAdapter('phonics-blender', phonicsBlenderLiveDomain),
  'adaptation-investigator': workspaceAdapter('adaptation-investigator', adaptationInvestigatorLiveDomain),
  'word-flip': workspaceAdapter('word-flip', wordFlipLiveDomain),
  'sound-swap': workspaceAdapter('sound-swap', soundSwapLiveDomain),
  'cvc-speller': workspaceAdapter('cvc-speller', cvcSpellerLiveDomain),
  'syllable-clapper': workspaceAdapter('syllable-clapper', syllableClapperLiveDomain),
  'rhyme-studio': workspaceAdapter('rhyme-studio', rhymeStudioLiveDomain),
  'phoneme-explorer': workspaceAdapter('phoneme-explorer', phonemeExplorerLiveDomain),
  'word-workout': workspaceAdapter('word-workout', wordWorkoutLiveDomain),
  'word-builder': workspaceAdapter('word-builder', wordBuilderLiveDomain),
  'word-sorter': workspaceAdapter('word-sorter', wordSorterLiveDomain),
  'picture-vocabulary': workspaceAdapter('picture-vocabulary', pictureVocabularyLiveDomain),
  'letter-spotter': workspaceAdapter('letter-spotter', letterSpotterLiveDomain),
  'decodable-reader': workspaceAdapter('decodable-reader', decodableReaderLiveDomain),
  'interactive-book': workspaceAdapter('interactive-book', interactiveBookLiveDomain),
  'story-bridge': workspaceAdapter('story-bridge', storyBridgeLiveDomain),
  'story-ribbon': workspaceAdapter('story-ribbon', storyRibbonLiveDomain),
  'addition-subtraction-scene': workspaceAdapter('addition-subtraction-scene', additionSubtractionSceneLiveDomain),
  '3d-shape-explorer': workspaceAdapter('3d-shape-explorer', threeDShapeExplorerLiveDomain),
  'calendar-explorer': workspaceAdapter('calendar-explorer', calendarExplorerLiveDomain),
  'push-pull-arena': workspaceAdapter('push-pull-arena', pushPullArenaLiveDomain),
  'habitat-diorama': workspaceAdapter('habitat-diorama', habitatDioramaLiveDomain),
  'matter-explorer': workspaceAdapter('matter-explorer', matterExplorerLiveDomain),
  'states-of-matter': workspaceAdapter('states-of-matter', statesOfMatterLiveDomain),
  'solar-system-explorer': workspaceAdapter('solar-system-explorer', solarSystemExplorerLiveDomain),
  'you-and-me': workspaceAdapter('you-and-me', youAndMeLiveDomain),
  'ramp-lab': workspaceAdapter('ramp-lab', rampLabLiveDomain),
  'di-shapes': workspaceAdapter('di-shapes', diShapesLiveDomain),
  'di-spoken-practice': workspaceAdapter('di-spoken-practice', diSpokenPracticeLiveDomain),
  'di-dice-roll': workspaceAdapter('di-dice-roll', diDiceRollLiveDomain),
  'di-deduction': workspaceAdapter('di-deduction', diDeductionLiveDomain),
  'spatial-scene': workspaceAdapter('spatial-scene', spatialSceneLiveDomain),
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
