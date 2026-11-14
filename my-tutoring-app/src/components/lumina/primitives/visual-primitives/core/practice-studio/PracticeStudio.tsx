'use client';

/**
 * Practice Studio: a general agent primitive (USER 2026-11-08). An author agent assembles each item for the lesson from
 * the kit's answer surfaces (choose, categorize, order, make, set, point) and displays (its own SVG pictures, code-drawn bar graphs and
 * number lines, tables, short text), looks at each item the way a child sees it and revises it (`service/agent-kit/
 * itemLoop.ts`). This component draws whatever was assembled; the kit's pure modules own scoring and drawing.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../../evaluation';
import type { PracticeStudioMetrics } from '../../../../evaluation/types';
import type { TeachingWorkspace } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../../components/live-activity/runtime/useWorkspaceProgress';
import { useAuthoredLevers } from '../../../../service/agent-kit/useAuthoredLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import { SurfaceBoard, useSurfaceAnswer } from '../../../../service/agent-kit/SurfaceBoard';
import { answerReady, gradeAnswer, missHint, type SurfaceItem } from '../../../../service/agent-kit/surfaces';
import { describeWork, studioScene, type StudioTry } from './practiceStudioWorkspace';
import { practiceStudioBoss, practiceStudioLevers } from './practiceStudio.boss';

// ============================================================================
// Data contract
// ============================================================================

export interface PracticeStudioData {
  title: string;
  description: string;
  /** 2-6 items, each assembled by the author agent and checked by code. REQUIRED. */
  challenges: SurfaceItem[];
  challengeType: 'practice';
  gradeBand?: string;
  /** How the session was authored (for QA; never shown). */
  agentDebug?: Record<string, unknown>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PracticeStudioMetrics>) => void;
}

interface PracticeStudioProps {
  data: PracticeStudioData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  choose: { label: 'Choose', icon: '👆', accentColor: 'cyan' },
  categorize: { label: 'Sort', icon: '🗂️', accentColor: 'cyan' },
  order: { label: 'Order', icon: '🔢', accentColor: 'cyan' },
  make: { label: 'Make', icon: '🧺', accentColor: 'cyan' },
  set: { label: 'Set', icon: '✂️', accentColor: 'cyan' },
  point: { label: 'Find it', icon: '📍', accentColor: 'cyan' },
  teach: { label: 'Teach', icon: '🗣️', accentColor: 'amber' },
};

const useStudioProgress = useWorkspaceProgressFor('practice-studio');

const PracticeStudioSurface: React.FC<PracticeStudioProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `practice-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const board = useSurfaceAnswer();
  const { answer } = board;
  const [tries, setTries] = useState<StudioTry[]>([]);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const clear = () => { board.reset(); setVerdict(null); setFeedback(null); };

  const progress = useStudioProgress<SurfaceItem>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: practiceStudioBoss.assignment,
    onItemOpened: (_index, retry) => { clear(); if (!retry) setTries([]); },
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const session = challenges[currentIndex] ?? null;
  const levers = useAuthoredLevers(session, practiceStudioLevers, practiceStudioBoss.assignment, () => clear());
  const current = levers.shown;
  const solved = verdict === 'correct';
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.surface, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / Math.max(rs.length, 1)),
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<PracticeStudioMetrics>({
    primitiveType: 'practice-studio', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const ready = !!current && answerReady(current, answer);

  const check = () => {
    if (!current || locked || !ready) return;
    const g = gradeAnswer(current, answer);
    setVerdict(g.correct ? 'correct' : 'incorrect');
    const hint = g.correct ? undefined : missHint(current, answer);
    // A model's results appear on the board at this point, so a miss is something the child can see happen.
    const ran = current.surface === 'set' && current.board?.kind === 'system';
    setFeedback({ text: g.correct ? 'Yes, that works.' : ran ? 'Not yet. Look at what happened, then change something and run it again.' : `Not yet. ${hint ? `${hint} ` : ''}Look again.`, status: g.correct ? 'correct' : 'incorrect' });
    const work = describeWork(current, answer);
    setTries(t => [...t, { work, correct: g.correct }]);
    progress.commitCheck(work, g.correct, g.miss);
    if (g.correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const total = challenges.length;
    const metrics: PracticeStudioMetrics = {
      type: 'practice-studio', challengeType, totalChallenges: total, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: total ? Math.round((result.attemptsCount / total) * 10) / 10 : 0,
      surfaces: Array.from(new Set(challenges.map(c => c.surface))).join(','),
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  useLayoutEffect(() => {
    if (!current || allChallengesComplete) return;
    workspace.current = levers.publish(studioScene(current, { answer, tries, solved }));
  });

  const localScore = useMemo(() => phaseResults.length ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No practice items yet.</LuminaCardContent></LuminaCard>;
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {gradeBand && <LuminaBadge accent="cyan">{gradeBand}</LuminaBadge>}
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Practice complete!" celebrationMessage="You worked through every item." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="cyan"><div className="text-base" data-studio-prompt="">{current.prompt}</div></LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {current && !allChallengesComplete && (
            <>
              <SurfaceBoard item={current} board={board} locked={locked} checked={verdict !== null} onChanged={() => setFeedback(null)} />

              {/* A teach item is answered out loud and judged by the tutor: nothing to clear or check on screen. */}
              {current.surface !== 'teach' && (
                <div className="flex flex-wrap items-center gap-2">
                  {current.surface !== 'choose' && current.surface !== 'point' && <LuminaButton tone="ghost" onClick={() => { if (!locked) { board.reset(); setFeedback(null); } }} disabled={locked}>Clear</LuminaButton>}
                  <LuminaActionButton action="check" onClick={check} disabled={locked || !ready}>Check</LuminaActionButton>
                </div>
              )}
            </>
          )}
          {feedback && <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const PracticeStudio = withWorkspaceOnly<PracticeStudioProps>('practice-studio', PracticeStudioSurface, props => props.data.title);

/** Practice Studio runs only on the teaching workspace: Check commits, and the runtime moves to the next item. */
export default PracticeStudio;
