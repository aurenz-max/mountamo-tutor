'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardContent, LuminaChallengeCounter } from '../../../ui';
import DiActionPanel from '../../../components/DiActionPanel';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { FractionCirclesMetrics } from '../../../evaluation/types';
import type { FractionCirclesData } from './FractionCircles';
import { buildFractionTouchItems, describeTouch, touchAssignment, touchMatches, touchScene, type FractionPicture }
  from './fractionCirclesWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { stimulusPipPose } from '../../../pip/stimulusPipPose';
import { PIP_DOCK_CLASS } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';

export function FractionTouchPicture({ picture }: { picture: FractionPicture }) {
  const r = 66, center = 72;
  return <svg viewBox="0 0 144 144" className="w-full max-w-44" aria-hidden="true">
    {Array.from({ length: picture.denominator }, (_, i) => {
      const a = i * 2 * Math.PI / picture.denominator - Math.PI / 2;
      const b = (i + 1) * 2 * Math.PI / picture.denominator - Math.PI / 2;
      return <path key={i} d={`M ${center} ${center} L ${center + r * Math.cos(a)} ${center + r * Math.sin(a)} A ${r} ${r} 0 0 1 ${center + r * Math.cos(b)} ${center + r * Math.sin(b)} Z`}
        fill={picture.shaded.includes(i) ? '#38bdf8' : '#18283e'} stroke="#cbd5e1" strokeWidth="2" />;
    })}
  </svg>;
}

export interface FractionTouchProps {
  data: FractionCirclesData;
  className?: string;
  localOnly?: boolean;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
  /** This surface's teaching session settled (the mixed chain's cue to move on). */
  onWorkspaceFinished?: () => void;
}

/** The teaching workspace is touch_fraction's only controller: the tutor says the fraction, the runtime owns progression. */
function FractionTouchSurface({ data, className, localOnly = false, runtimePlanItemId, runtimeEvalMode, onWorkspaceFinished }: FractionTouchProps) {
  const instance = useRef(data.instanceId ?? `fraction-touch-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const items = useMemo(() => buildFractionTouchItems(data.challenges), [data.challenges]);
  const taps = useRef<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const evaluation = usePrimitiveEvaluation<FractionCirclesMetrics>({
    primitiveType: 'fraction-circles', instanceId: instance.current, localOnly,
    skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit,
  });
  // Called once, with the finished record, and only under an evaluation provider.
  const finished = useCallback((summary: TeachingEvaluationResult) => {
    evaluation.submitResult(summary.passed, summary.accuracy, {
      type: 'fraction-circles', evalMode: 'touch_fraction', totalChallenges: items.length,
      correctCount: summary.solvedCount, accuracy: summary.accuracy, touchFractionAccuracy: summary.accuracy,
      identifyAccuracy: 0, buildAccuracy: 0, compareAccuracy: 0, equivalentAccuracy: 0, attemptsCount: summary.attemptsCount,
    }, { challengeResults: summary.outcomes, pictures: items, taps: taps.current,
      learningResponses: summary.learningResponses,
      teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance,
    }, undefined, summary.diagnosisEvidence);
  }, [evaluation, items]);
  const resetTap = () => { setSelected(null); pip.clear(); };
  const runner = useWorkspaceRunner({ items, workspace, instanceId: instance.current, primitiveId: 'fraction-circles',
    assignment: touchAssignment, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || 'touch_fraction',
    onFinished: finished, onItemOpened: resetTap, onCorrectionRetry: resetTap,
  });
  const item = runner.currentItem ?? items[0];
  // The finish shows without an evaluation provider (the live host has none).
  const showSummary = !!runner.practiceSummary || evaluation.hasSubmitted;
  const finishedRef = useRef(onWorkspaceFinished); finishedRef.current = onWorkspaceFinished;
  const reportedFinish = useRef(false);
  useEffect(() => {
    if (!runner.practiceSummary || reportedFinish.current) return;
    reportedFinish.current = true;
    finishedRef.current?.();
  }, [runner.practiceSummary]);
  // Pip: every picture is an answer choice, so it outlines the pictures only as
  // a group and watches the one the child touches; it never touches one itself.
  const pip = usePipTargets(item?.id ?? null, runner.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !item || showSummary) return null;
    const targets = pip.targets();
    const pose = stimulusPipPose({
      running: runner.running, preparing: runner.preparing,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      // The workspace judges no speech here: a touch is checked by code at once.
      judging: false, tutorSpeaking: runner.tutorSpeaking,
      cueMatchesItem: runner.cuedItemId === item.id, gesture: true,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: instance.current, scopeId: item.id, label: 'Fraction pictures', dock: pip.dock.current, targets, pose };
  });
  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation; the pictures show from the start.
  useLayoutEffect(() => {
    if (!item) return;
    workspace.current = { ...touchScene(item), demonstration: [], canDemonstrate: false, canPresent: false,
      readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });
  if (!item) return <p>No fraction pictures are available.</p>;
  // A picture's object id names what it shows (as its aria-label does), never whether it matches.
  const pictureObject = (picture: FractionPicture) => `picture-${picture.numerator}-of-${picture.denominator}`;
  const touch = (picture: FractionPicture) => {
    const id = picture.id;
    if (!runner.canAttempt || runner.isAwaitingGesture() || evaluation.hasSubmitted) return;
    pip.look(pictureObject(picture));
    setSelected(id);
    (taps.current[item.id] ??= []).push(id);
    runner.commitGesture({ response: describeTouch(item, id), correct: touchMatches(item, id), cue: () => '' });
  };
  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader><LuminaCardTitle>Touch the Fraction</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      {showSummary ? <p className="text-center text-lg text-slate-100">You finished your fraction pictures.</p> : <>
        <LuminaChallengeCounter current={runner.currentIndex + 1} total={items.length} variant="dots" />
        {pipStore && <div ref={pip.dock} data-pip-dock={instance.current} className={PIP_DOCK_CLASS} />}
        <div ref={pip.ref('stimulus')} data-pip-object="stimulus" className="grid grid-cols-3 gap-2 sm:gap-5" aria-label="Fraction pictures">
          {item.choices.map((picture, index) => <button key={picture.id} type="button"
            ref={pip.ref(pictureObject(picture))} data-pip-object={pictureObject(picture)}
            aria-label={`Picture ${index + 1}: ${picture.numerator} of ${picture.denominator} equal parts shaded`}
            aria-pressed={selected === picture.id} onClick={() => touch(picture)}
            disabled={!runner.canAttempt || runner.isAwaitingGesture()}
            className={`flex min-h-28 items-center justify-center rounded-2xl border-2 p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200 ${runner.currentSolved && picture.id === item.correctChoiceId ? 'border-emerald-400 bg-emerald-400/15' : selected === picture.id ? 'border-sky-300 bg-sky-300/10' : 'border-white/15 bg-white/5 hover:border-sky-300/60'}`}>
            <FractionTouchPicture picture={picture} />
          </button>)}
        </div>
        <DiActionPanel run={runner} running={runner.running} stage={runner.stage} currentItem={item} steps={[item]}
          startInstruction="Start the tutor. Listen, then touch the matching picture." />
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const FractionTouch = withWorkspaceOnly<FractionTouchProps>('fraction-circles', FractionTouchSurface, props => props.data.title);
export default FractionTouch;
