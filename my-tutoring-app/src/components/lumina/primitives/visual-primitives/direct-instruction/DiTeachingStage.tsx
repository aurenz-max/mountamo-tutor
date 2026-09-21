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
 */

import React, { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingAssignment, type TeachingItem, type TeachingWorkspace,
  type WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { PrimitiveMetrics } from '../../../evaluation';
import type { ComponentId } from '../../../types';

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

/** The metrics every spoken DI pack reports from the shared teaching result. */
export function diStageMetrics<C extends string>(result: TeachingEvaluationResult,
    items: readonly { challengeType: C }[], evalMode: string) {
  return { evalMode, challengeType: items[0].challengeType, totalChallenges: items.length,
    correctCount: result.solvedCount, attemptsCount: result.attemptsCount, firstTryCount: result.firstTryCount,
    hintsViewed: 0, overallAccuracy: result.accuracy,
    averageAttemptsPerChallenge: Math.round(result.attemptsCount / items.length * 10) / 10 };
}

export default function DiTeachingStage<Item extends { id: string }, M extends PrimitiveMetrics>(
    props: DiTeachingStageProps<Item, M>) {
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
      {stimulus(item, marks)}
      {trail?.(committed)}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">{copy.prompt}</p>
    </LuminaCardContent>
  </LuminaCard>;
}
