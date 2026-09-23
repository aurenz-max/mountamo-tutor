'use client';

/**
 * How each adopted family RENDERS inside the live host.
 *
 * Kept out of `activityContract.ts` because that module is imported by the server
 * route and must stay free of React, and kept out of the sandbox so the sandbox's
 * own tests can replace every primitive with one mock instead of one per family.
 * Adding a family is a row here plus its adapter file — never another ternary.
 */
import React from 'react';
import NumberLine, { type NumberLineControls, type NumberLineData } from '../../primitives/visual-primitives/math/NumberLine';
import TenFrame, { type TenFrameData } from '../../primitives/visual-primitives/math/TenFrame';
import CountingBoard, { type CountingBoardData } from '../../primitives/visual-primitives/math/CountingBoard';
import NumberSequencer, { type NumberSequencerData } from '../../primitives/visual-primitives/math/NumberSequencer';
import NumberBond, { type NumberBondData } from '../../primitives/visual-primitives/math/NumberBond';
import OrdinalLine, { type OrdinalLineData } from '../../primitives/visual-primitives/math/OrdinalLine';
import SortingStation, { type SortingStationData } from '../../primitives/visual-primitives/math/SortingStation';
import NumberTracer, { type NumberTracerData } from '../../primitives/visual-primitives/math/NumberTracer';
import ComparisonBuilder, { type ComparisonBuilderData } from '../../primitives/visual-primitives/math/ComparisonBuilder';
import CompareObjects, { type CompareObjectsData } from '../../primitives/visual-primitives/math/CompareObjects';
import PlaceValueChart, { type PlaceValueChartData } from '../../primitives/visual-primitives/math/PlaceValueChart';
import ShapeSorter, { type ShapeSorterData } from '../../primitives/visual-primitives/math/ShapeSorter';
import DiLetterSounds, { type DiLetterSoundsData } from '../../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import DiWordReading, { type DiWordReadingData } from '../../primitives/visual-primitives/direct-instruction/DiWordReading';
import DiMathFacts, { type DiMathFactsData } from '../../primitives/visual-primitives/direct-instruction/DiMathFacts';
import DiSentenceReading, { type DiSentenceReadingData } from '../../primitives/visual-primitives/direct-instruction/DiSentenceReading';
import LetterSoundLink, { type LetterSoundLinkData } from '../../primitives/visual-primitives/literacy/LetterSoundLink';
import type { LivePrimitiveId } from './activityContract';

export type { NumberLineControls };

export interface MountProps {
  data: any;
  /** The host mounts without a mic-panel click, so a judged runner starts itself. */
  autoStart: boolean;
  planItemId?: string;
  /** The RESOLVED eval mode from the mount; never reconstructed from interactionMode. */
  evalMode: string;
  onControls: (controls: NumberLineControls | null) => void;
}

export const LIVE_RENDERERS: Record<LivePrimitiveId, (p: MountProps) => React.ReactElement> = {
  'number-line': p => <NumberLine data={p.data as NumberLineData} onControlsReady={p.onControls}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'ten-frame': p => <TenFrame data={p.data as TenFrameData} autoStart={p.autoStart} runtimePlanItemId={p.planItemId}
    runtimeEvalMode={p.evalMode} />,
  'counting-board': p => <CountingBoard data={p.data as CountingBoardData} autoStart={p.autoStart} runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'number-sequencer': p => <NumberSequencer data={p.data as NumberSequencerData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'number-bond': p => <NumberBond data={p.data as NumberBondData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'ordinal-line': p => <OrdinalLine data={p.data as OrdinalLineData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'sorting-station': p => <SortingStation data={p.data as SortingStationData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  // Tutor-led: no `autoStart`, because there is no judged runner to start.
  'number-tracer': p => <NumberTracer data={p.data as NumberTracerData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'comparison-builder': p => <ComparisonBuilder data={p.data as ComparisonBuilderData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'compare-objects': p => <CompareObjects data={p.data as CompareObjectsData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'place-value-chart': p => <PlaceValueChart data={p.data as PlaceValueChartData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'shape-sorter': p => <ShapeSorter data={p.data as ShapeSorterData} autoStart={p.autoStart}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  // Tutor-led: the workspace binding has no judged runner to start.
  'di-letter-sounds': p => <DiLetterSounds data={p.data as DiLetterSoundsData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'di-word-reading': p => <DiWordReading data={p.data as DiWordReadingData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'di-math-facts': p => <DiMathFacts data={p.data as DiMathFactsData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'di-sentence-reading': p => <DiSentenceReading data={p.data as DiSentenceReadingData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
  'letter-sound-link': p => <LetterSoundLink data={p.data as LetterSoundLinkData}
    runtimePlanItemId={p.planItemId} runtimeEvalMode={p.evalMode} />,
};
