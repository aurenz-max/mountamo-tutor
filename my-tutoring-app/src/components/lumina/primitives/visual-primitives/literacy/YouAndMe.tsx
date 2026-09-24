'use client';

/**
 * You & Me — two partners, one action. The child plays the speaking partner and tells the
 * other what happened, choosing I or you (and myself or yourself on independent actions)
 * from that role. It runs only on the shared tutor/JEV teaching workspace (workspace
 * rollout B3; the scripted runner was retired, LA-14, user ruling 09-23: one path). The
 * observer judges each spoken sentence and the runtime owns progression. An unbound mount
 * shows the shared "needs the tutor" card.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaPanel, LuminaPrompt } from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { YouAndMeMetrics } from '../../../evaluation/types';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { sceneStatement, taskPrompt } from './youAndMeScript';
import type { SupportTier } from '../../../service/generation/generationContext';
import { supportFor, type YouAndMeSupportScaffold } from './youAndMeSupport';
import { hearSceneRequest, youAndMeAssignment, youAndMeScene } from './youAndMeWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { youAndMePipPose } from '../../../pip/youAndMePipPose';

export type YouAndMeMode = 'describe_action' | 'describe_independent_action';

export interface YouAndMeChallenge {
  id: string;
  /** Both turns in a pair retain this scene, actor and object. */
  sceneId: string;
  type: YouAndMeMode;
  participants: [{ name: string; emoji: string }, { name: string; emoji: string }];
  actor: 0 | 1;
  speaker: 0 | 1;
  object: string;
  objectEmoji: string;
  /** Past-tense action without a subject: "packed the bag". */
  action: string;
  supportTier?: SupportTier;
  support?: YouAndMeSupportScaffold;
}

export interface YouAndMeData {
  title: string;
  description: string;
  gradeLevel: string;
  challengeType: YouAndMeMode | 'mixed';
  challenges: YouAndMeChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<YouAndMeMetrics>) => void;
}

interface YouAndMeProps {
  data: YouAndMeData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

/** A new payload remounts the session so an old verdict cannot score regenerated scenes. */
function YouAndMeSurface(props: YouAndMeProps) {
  return <YouAndMeSession key={JSON.stringify([props.data.instanceId, props.data.challenges])} {...props} />;
}

function YouAndMeSession({ data, className, runtimePlanItemId, runtimeEvalMode }: YouAndMeProps) {
  const ctx = useLuminaAIContext();
  const instanceId = useRef(data.instanceId ?? `you-and-me-${crypto.randomUUID()}`).current;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [correctedId, setCorrectedId] = useState<string | null>(null);
  const items = data.challenges;
  const evaluation = usePrimitiveEvaluation<YouAndMeMetrics>({
    primitiveType: 'you-and-me', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const modes = Array.from(new Set(items.map(item => item.type)));
    const metrics: YouAndMeMetrics = {
      type: 'you-and-me', challengeType: modes.length === 1 ? modes[0] : 'mixed', totalChallenges: items.length,
      correctCount: summary.solvedCount, attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount, hintsViewed: 0,
      overallAccuracy: summary.accuracy, averageAttemptsPerChallenge: summary.attemptsCount / items.length,
      modeResults: modes.map(mode => {
        const ids = new Set(items.filter(item => item.type === mode).map(item => item.id));
        const outcomes = summary.outcomes.filter(outcome => ids.has(outcome.id));
        return { mode, total: ids.size, correct: outcomes.filter(outcome => outcome.solved).length,
          accuracy: outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / ids.size };
      }),
    };
    evaluation.submitResult(summary.passed, summary.accuracy, metrics,
      { outcomes: summary.outcomes, learningResponses: summary.learningResponses,
        perspectives: items.map(({ id, sceneId, type, actor, speaker }) => ({ id, sceneId, type, actor, speaker })),
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, summary.diagnosisEvidence);
  };

  const run = useWorkspaceRunner<YouAndMeChallenge>({
    primitiveId: 'you-and-me',
    assignment: youAndMeAssignment,
    items,
    workspace,
    objectiveId: data.objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || data.challengeType,
    instanceId,
    onFinished: finish,
    onItemOpened: () => setCorrectedId(null),
    // After a checked miss the roles are restated on screen (the scripted correction's panel).
    onCorrectionRetry: item => setCorrectedId(item.id),
  });
  const item = run.currentItem;
  const showSummary = evaluation.hasSubmitted || !!run.practiceSummary;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!item) return;
    workspace.current = { ...youAndMeScene(item), demonstration: [], canDemonstrate: false, canPresent: false,
      readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    run.publishWorkspace();
  });

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state onto the scene as a whole; Pip never
  // answers, judges, or advances.
  const pip = usePipTargets(item?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !item || showSummary) return null;
    const targets = pip.targets(['scene'], () => 'The partners and the scene');
    const pose = youAndMePipPose({
      running: run.running, preparing: false,
      currentSolved: run.currentSolved, revealHeld: run.revealHeld, judging: false,
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === instanceId),
      cueMatchesItem: run.cuedItemId === item.id,
      visibleIds: targets.map((target) => target.id),
    });
    return { instanceId, scopeId: item.id, label: 'You and me', dock: pip.dock.current, targets, pose };
  });

  const phases = useMemo(() => phaseResultsFromSummary(items, run.practiceSummary, ch => ({
    label: `${ch.participants[ch.speaker].name} speaking`, icon: ch.objectEmoji,
  })), [items, run.practiceSummary]);

  if (!item) return <LuminaCard><LuminaCardContent>No scenes available. Generate a new activity.</LuminaCardContent></LuminaCard>;
  if (showSummary) return <PhaseSummaryPanel phases={phases}
    overallScore={evaluation.submittedResult?.score ?? run.teachingResult?.accuracy} heading="You & Me"
    celebrationMessage="Both partners had a turn." />;

  const speaker = item.participants[item.speaker];
  const actor = item.participants[item.actor];
  const support = supportFor(item);
  const swapped = run.currentIndex > 0 && items[run.currentIndex - 1]?.sceneId === item.sceneId;
  return <LuminaCard className={className}>
    <LuminaCardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LuminaCardTitle>{data.title}</LuminaCardTitle>
        <LuminaChallengeCounter current={run.currentIndex + 1} total={items.length} />
      </div>
      <p className="text-sm text-slate-400">{data.description}</p>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <div className="flex justify-center"><LuminaBadge accent="pink">
        {swapped ? 'Trade roles · same action, new speaker' : 'Meet the partners'}
      </LuminaBadge></div>
      <div ref={pip.ref('scene')} data-pip-object="scene" className="relative grid grid-cols-2 gap-4 rounded-3xl bg-gradient-to-br from-rose-950/20 to-teal-950/25 p-4 sm:p-8">
        {item.participants.map((person, index) => <div key={person.name}
          className={`relative flex min-h-52 flex-col items-center justify-center gap-3 rounded-3xl border-2 p-4 transition-all duration-500 ${support.showSpeakerHighlight && index === item.speaker ? 'border-pink-300 bg-pink-300/10 shadow-lg shadow-pink-300/10' : 'border-slate-600/40 bg-slate-800/20'}`}>
          <span className="text-6xl sm:text-7xl" role="img" aria-label={person.name}>{person.emoji}</span>
          <span className="text-lg font-semibold text-slate-100">{person.name}</span>
          <span className="text-sm text-slate-300">{index === item.speaker ? 'Speaking now' : 'Listening partner'}</span>
          {support.showActorMarker && index === item.actor && <span className="flex items-center gap-2 text-sm text-slate-200">
            <span className="text-3xl" role="img" aria-label={item.object}>{item.objectEmoji}</span> Did the action
          </span>}
        </div>)}
        <div className="col-span-2 text-center text-lg text-slate-100">{sceneStatement(item)}</div>
      </div>
      <LuminaPrompt>{taskPrompt(item)}</LuminaPrompt>
      {/* Pip's dock sits below the prompt: the scene is outlined as a region. */}
      {pipStore && <div ref={pip.dock} data-pip-dock={instanceId}
        className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}
      {support.preparation && <LuminaPanel><p className="text-center text-slate-200">{support.preparation}</p></LuminaPanel>}
      {correctedId === item.id && <LuminaPanel>
        <p className="text-center text-slate-200">{speaker.name} is speaking. {actor.name} did the action.</p>
      </LuminaPanel>}
      <div className="text-center"><LuminaButton tone="ghost"
        onClick={() => ctx.sendText(hearSceneRequest(item), { silent: true, author: 'host' })}>
        Hear the scene again
      </LuminaButton></div>
    </LuminaCardContent>
  </LuminaCard>;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const YouAndMe = withWorkspaceOnly<YouAndMeProps>('you-and-me', YouAndMeSurface, props => props.data.title);

export default YouAndMe;
