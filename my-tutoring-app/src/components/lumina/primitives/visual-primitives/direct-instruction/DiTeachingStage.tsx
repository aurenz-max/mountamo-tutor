'use client';

/**
 * DiTeachingStage — the shell every spoken DI pack shares on the tutor/JEV teaching
 * workspace: the empty state, the workspace binding, the evaluation submit, the completion
 * recap and the card around the stimulus. A pack supplies its domain
 * (`workspaceAssignment`, `workspaceScene`), its drawn stimulus, an optional trail of
 * committed answers, its recap label, its metrics and its wording.
 *
 * Every mode of these packs is spoken, so there is no gesture channel to check and no
 * transcript parser in front of the answer: the tutor hears the audio and JEV reads its
 * completed feedback. Nothing here composes a model line, counts corrections or advances.
 *
 * The trail is keyed on COMMITTED attempts, never on a local phase: the observer submits and
 * advances inside one `flushSync`, so a reward keyed on the current item's phase would render
 * on the held-success path and never on the advance path.
 *
 * The workspace is the only teaching path these packs have (the scripted drill was deleted in
 * LA-14 S5). A mount with no live runtime around it, which is what a host gives a section that
 * did not bind, renders a plain "needs the tutor" card instead of a blank or stalled stage, and
 * logs why in development. An unbound section is a defect to fix at its host, not a mode to
 * route around (09-20 ruling).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingAssignment, type TeachingItem, type TeachingWorkspace,
  type WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { NeedsTutor } from '../../../components/live-activity/runtime/NeedsTutor';
import type { PrimitiveMetrics } from '../../../evaluation';
import type { ComponentId } from '../../../types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import { diStagePipPose } from '../../../pip/diStagePipPose';
import { PIP_DOCK_CLASS } from '../../../pip/useWorkspacePipSurface';

export interface DiStageData {
  instanceId?: string;
  objectiveId?: string;
  title?: string;
  description?: string;
  skillId?: string;
  subskillId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: unknown;
}

export interface DiTeachingStageProps<Item extends { id: string }, M extends PrimitiveMetrics> {
  primitiveId: ComponentId;
  data: DiStageData;
  items: Item[];
  /** Resolved by the pack from the session's eval mode, never from a flattened label. */
  evalMode: string;
  className?: string;
  runtimePlanItemId?: string;
  assignment: (item: Item) => TeachingAssignment;
  scene: (item: Item) => WorkspaceScene;
  metrics: (result: TeachingEvaluationResult) => M;
  copy: { empty: string; title: string; badge: string; prompt: string; heading: string; celebration: string };
  /** The recap row for one item. `solved` is false for a missed item, whose recap must not
   *  print an answer the child never produced. */
  recapLabel: (item: Item, solved: boolean) => string;
  stimulus: (item: Item, marks: readonly string[]) => ReactNode;
  /** Items the observer has already credited, for a reward trail under the stimulus. */
  trail?: (committed: Item[]) => ReactNode;
}

/**
 * The metrics every spoken DI pack reports from the shared teaching result. `sessionMode` is the
 * generated session's `challengeType`, the value the scripted drill reports too. In a lesson a
 * single-mode pin replaces it at the evaluation boundary; a blended or `mixed` section keeps it,
 * so moving blends onto the workspace records them exactly as before.
 */
export function diStageMetrics<C extends string>(result: TeachingEvaluationResult,
    items: readonly unknown[], sessionMode: C) {
  return { evalMode: sessionMode, challengeType: sessionMode, totalChallenges: items.length,
    correctCount: result.solvedCount, attemptsCount: result.attemptsCount, firstTryCount: result.firstTryCount,
    hintsViewed: 0, overallAccuracy: result.accuracy,
    averageAttemptsPerChallenge: Math.round(result.attemptsCount / items.length * 10) / 10 };
}

export default function DiTeachingStage<Item extends { id: string }, M extends PrimitiveMetrics>(
    props: DiTeachingStageProps<Item, M>) {
  const runtime = useLiveRuntime();
  if (!runtime) return <NeedsTutor primitiveId={props.primitiveId} evalMode={props.evalMode}
    title={props.data.title || props.copy.title} className={props.className} />;
  if (!props.items.length) {
    return <LuminaCard className={props.className}><LuminaCardContent>
      <p>{props.copy.empty}</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <StageWorkspace key={props.data.instanceId} {...props} />;
}

function StageWorkspace<Item extends { id: string }, M extends PrimitiveMetrics>({ primitiveId, data, items,
    evalMode, className, runtimePlanItemId, assignment, scene, metrics, copy, recapLabel, stimulus, trail }:
    DiTeachingStageProps<Item, M>) {
  const instance = useRef(data.instanceId || `${primitiveId}-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    ...assignment(item), checkResponse: () => null })), [items, assignment]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId,
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace });

  const evaluation = useTeachingEvaluation<M>({ primitiveType: primitiveId, instanceId: instance.current,
    data, assignments, lesson, evalMode, metrics });

  const item = items[lesson.state.index];
  const committed = items.filter(candidate =>
    lesson.state.attempts.some(attempt => attempt.itemId === candidate.id && attempt.correct));

  useLayoutEffect(() => {
    workspace.current = {
      ...scene(item),
      demonstration: marks,
      readyForResponse: true, canDemonstrate: true, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of committed workspace state onto the stimulus as a whole; Pip never answers,
  // judges, or advances. Audio belongs to this block only while a lesson is pointed at it.
  const ai = useLuminaAIContext();
  const tutorSpeaking = ai.isAudioPlaying && (ai.sessionMode !== 'lesson' || ai.activePrimitiveId === instance.current);
  const speechOnItem = useSpeechScope(item.id, tutorSpeaking);
  const [cuedItemId, setCuedItemId] = useState<string | null>(null);
  useEffect(() => { if (speechOnItem) setCuedItemId(item.id); }, [speechOnItem, item.id]);
  const { attempts } = lesson.state;
  const latest = attempts[attempts.length - 1];
  const pip = usePipTargets(item.id, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || lesson.summary) return null;
    const targets = pip.targets(['stimulus'], () => copy.title);
    const pose = diStagePipPose({
      running: lesson.state.phase !== 'completed',
      heldSolved: lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct,
      creditedOnAdvance: !!latest?.correct && latest.itemId === items[lesson.state.index - 1]?.id,
      tutorSpeaking, cuedCurrentItem: cuedItemId === item.id || speechOnItem, speechOnItem,
      visibleIds: targets.map(target => target.id),
    });
    return { instanceId: instance.current, scopeId: item.id, label: copy.title, dock: pip.dock.current, targets, pose };
  });

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading={copy.heading} celebrationMessage={copy.celebration}
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          label: items[position] ? recapLabel(items[position], outcome.score > 0) : '',
          score: outcome.score, attempts: outcome.attempts, firstTry: outcome.corrections === 0,
          accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-3">
        <div>
          <LuminaCardTitle>{data.title || copy.title}</LuminaCardTitle>
          <LuminaCardDescription>{data.description}</LuminaCardDescription>
        </div>
        <LuminaBadge accent="cyan">{copy.badge}</LuminaBadge>
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
      <div ref={pip.ref('stimulus')} data-pip-object="stimulus">{stimulus(item, marks)}</div>
      {/* Every answer is spoken, so no answer surface lies between the dock and the stimulus. */}
      {pipStore && <div ref={pip.dock} data-pip-dock={instance.current} className={PIP_DOCK_CLASS} />}
      {trail?.(committed)}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">{copy.prompt}</p>
    </LuminaCardContent>
  </LuminaCard>;
}
