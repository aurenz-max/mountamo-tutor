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
 * LA-14 S5). A mount with no live runtime around it, or with a pin the catalog does not bind (the
 * rule `withWorkspaceOnly` applies), renders a plain "needs the tutor" card instead of a blank or stalled stage, and
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
import { WorkspacePin } from '../../../components/live-activity/runtime/workspacePin';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { catalogBindsWorkspace } from '../../../components/live-activity/pinnedModes';
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

/** What a pack's stimulus may read beyond its item: the committed steps (a pack that scribes each credited
 *  step onto one shared problem), and, for a pack that sets `awaitsStimulus`, whether the learner's own
 *  preparatory action (a roll) has happened yet. */
export interface DiStageView {
  committed: ReadonlySet<string>;
  ready: boolean;
  markReady: () => void;
  /** The levers on screen for this item: its tier's starting levers and any pulled since. None on a practice item. */
  pulled: readonly string[];
  /** The stimulus is the easier practice item a simplify lever opened, not the session item. */
  practice: boolean;
}

/**
 * A pack's in-item levers (`/add-support-tiers`). The stage owns their state, keyed by item, and the
 * practice item a simplify lever opens; the pack supplies only pure domain functions.
 */
export interface DiStageLevers<Item> {
  declare: (item: Item, pulled: readonly string[]) => WorkspaceLever[];
  /** What the levers on screen show, as a scene fact. Never the item's answer. */
  onScreen: (item: Item, pulled: readonly string[]) => string;
  /** Levers the item's tier starts with on screen. Not a pull, so never recorded. */
  starting?: (item: Item) => readonly string[];
  /** The easier item a simplify lever opens, with an id of its own, or null to refuse. */
  simpler?: (item: Item, lever: string) => Item | null;
}

export interface DiTeachingStageProps<Item extends { id: string }, M extends PrimitiveMetrics> {
  primitiveId: ComponentId;
  data: DiStageData;
  items: Item[];
  /** The lesson's pin from the mount. The stage provides it to the workspace hooks (`workspacePin.ts`). */
  runtimeEvalMode?: string;
  className?: string;
  runtimePlanItemId?: string;
  assignment: (item: Item) => TeachingAssignment;
  scene: (item: Item, view: { ready: boolean }) => WorkspaceScene;
  metrics: (result: TeachingEvaluationResult) => M;
  copy: { empty: string; title: string; badge: string; prompt: string; heading: string; celebration: string };
  /** The recap row for one item. `solved` is false for a missed item, whose recap must not
   *  print an answer the child never produced. */
  recapLabel: (item: Item, solved: boolean) => string;
  stimulus: (item: Item, marks: readonly string[], view: DiStageView) => ReactNode;
  /** Items the observer has already credited, for a reward trail under the stimulus. */
  trail?: (committed: Item[], current: Item) => ReactNode;
  /** The item cannot be answered until the learner does something first (dice-roll's roll): until the
   *  stimulus calls `markReady`, the workspace reports `readyForResponse: false`. */
  awaitsStimulus?: boolean;
  /** The progress dots, when an item is one step of a larger problem. Default: one dot per item. */
  counter?: (item: Item, items: readonly Item[]) => { current: number; total: number };
  levers?: DiStageLevers<Item>;
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
  if (!runtime || !catalogBindsWorkspace(props.primitiveId, props.runtimeEvalMode)) return <NeedsTutor primitiveId={props.primitiveId} evalMode={props.runtimeEvalMode}
    title={props.data.title || props.copy.title} className={props.className} />;
  if (!props.items.length) {
    return <LuminaCard className={props.className}><LuminaCardContent>
      <p>{props.copy.empty}</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <WorkspacePin pin={props.runtimeEvalMode}><StageWorkspace key={props.data.instanceId} {...props} /></WorkspacePin>;
}

function StageWorkspace<Item extends { id: string }, M extends PrimitiveMetrics>({ primitiveId, data, items,
    className, runtimePlanItemId, assignment, scene, metrics, copy, recapLabel, stimulus, trail,
    awaitsStimulus, counter, levers }:
    DiTeachingStageProps<Item, M>) {
  const instance = useRef(data.instanceId || `${primitiveId}-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    ...assignment(item), checkResponse: () => null })), [items, assignment]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId,
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace });

  const evaluation = useTeachingEvaluation<M>({ primitiveType: primitiveId, instanceId: instance.current,
    data, assignments, lesson, metrics });

  const sessionItem = items[lesson.state.index];
  // Lever state is keyed by the session item, so a new item starts from its own tier. The practice item a
  // simplify lever opened stays through a retry and leaves only through `endPractice`.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<{ for: string; item: Item } | null>(null);
  const practiceItem = practice && practice.for === sessionItem?.id ? practice.item : null;
  const pulled = !sessionItem || !levers ? [] : leverState.item === sessionItem.id ? leverState.pulled
    : [...(levers.starting?.(sessionItem) ?? [])];
  const item = practiceItem ?? sessionItem;
  const committed = items.filter(candidate =>
    lesson.state.attempts.some(attempt => attempt.itemId === candidate.id && attempt.correct));
  const committedKey = committed.map(candidate => candidate.id).join(' ');
  const committedIds = useMemo(() => new Set(committedKey ? committedKey.split(' ') : []), [committedKey]);
  // Every item the learner has prepared (rolled) stays prepared: returning from an easier practice item must not
  // cover the full item's dice again.
  const [readyIds, setReadyIds] = useState<ReadonlySet<string>>(new Set());
  const ready = !awaitsStimulus || (!!item && readyIds.has(item.id));

  useLayoutEffect(() => {
    const drawn = scene(item, { ready });
    const declared = levers && !practiceItem ? levers.declare(sessionItem, pulled) : [];
    const onScreen = levers && !practiceItem ? levers.onScreen(sessionItem, pulled) : '';
    workspace.current = {
      ...drawn,
      ...(onScreen ? { facts: { ...drawn.facts, onScreen } } : {}),
      demonstration: marks,
      readyForResponse: ready, canDemonstrate: true, mark, clearPresentation: () => mark([]),
      ...(levers ? {
        levers: declared,
        // A synchronous commit (the workspace runs it inside flushSync): the stage changes before this returns.
        pullLever: (id: string) => {
          const lever = declared.find(l => l.id === id);
          if (practiceItem || !lever) return `No lever ${id} on this item.`;
          if (lever.pulled) return `${id} is already on screen.`;
          const next = { item: sessionItem.id, pulled: [...pulled, id] };
          if (lever.kind === 'simplify') {
            const easier = levers.simpler?.(sessionItem, id);
            if (!easier) return 'There is no easier one for this item.';
            setLeverState(next); setPractice({ for: sessionItem.id, item: easier }); mark([]);
            return { practice: assignment(easier) };
          }
          setLeverState(next);
          return true;
        },
        endPractice: () => { setPractice(null); mark([]); },
      } : {}),
    };
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
      <LuminaChallengeCounter {...(counter?.(sessionItem, items) ?? { current: lesson.state.index + 1, total: items.length })}
        variant="dots" />
      <div ref={pip.ref('stimulus')} data-pip-object="stimulus">
        {stimulus(item, marks, { committed: committedIds, ready, markReady: () => setReadyIds(prev => new Set(prev).add(item.id)),
          pulled: practiceItem ? [] : pulled, practice: !!practiceItem })}
      </div>
      {/* Every answer is spoken, so no answer surface lies between the dock and the stimulus. */}
      {pipStore && <div ref={pip.dock} data-pip-dock={instance.current} className={PIP_DOCK_CLASS} />}
      {trail?.(committed, sessionItem)}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">{copy.prompt}</p>
    </LuminaCardContent>
  </LuminaCard>;
}
