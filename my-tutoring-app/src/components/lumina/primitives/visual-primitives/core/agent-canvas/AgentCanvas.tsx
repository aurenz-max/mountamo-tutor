'use client';

/**
 * Agent Canvas: a general agent primitive (USER 2026-11-09/10). An author agent writes a small program the child
 * operates (drag, place, connect, set, run), plays it itself in a browser, and ships it when its own playthrough
 * reaches the goal and its own wrong attempt does not (`service/agent-kit/canvas/canvasAuthor.ts`).
 *
 * This component is the host. The program runs in a sandboxed frame and reports whether its goal is met, plain facts of
 * what is on screen, and what the child's hands did. The host owns everything around it: the prompt, Check, the
 * verdict, the sounds, the tutor's scene and the evaluation record. The program never tells the child they are right.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPrompt,
} from '../../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../../evaluation';
import type { AgentCanvasMetrics } from '../../../../evaluation/types';
import type { TeachingWorkspace } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import { CanvasFrame, type CanvasAct } from '../../../../service/agent-kit/canvas/CanvasFrame';
import { canvasPage, canvasScene, describeCanvasWork, type CanvasChallenge, type CanvasTry } from './agentCanvasWorkspace';
import { agentCanvasBoss } from './agentCanvas.boss';
import { CanvasPilotVote } from './CanvasPilotVote';

// ============================================================================
// Data contract
// ============================================================================

export interface AgentCanvasData {
  title: string;
  description: string;
  /** 1-6 canvases, each written, played and checked by the author agent. REQUIRED. */
  challenges: CanvasChallenge[];
  /** One page shared by every challenge that carries `params` instead of its own `html` (several problems on one program). */
  page?: string;
  challengeType: 'canvas';
  gradeBand?: string;
  /** How the session was authored (for QA; never shown). */
  agentDebug?: Record<string, unknown>;
  /** The library canvas this lesson serves, when it came from the library or the pilot. */
  canvasId?: string;
  /** A pilot canvas (passed the check, not promoted): the finished lesson asks the pilot student for a vote. */
  pilot?: { studentId: string | null };

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AgentCanvasMetrics>) => void;
}

interface AgentCanvasProps {
  data: AgentCanvasData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  canvas: { label: 'Canvas', icon: '🛠️', accentColor: 'cyan' },
};

const useCanvasProgress = useWorkspaceProgressFor('agent-canvas');

const AgentCanvasSurface: React.FC<AgentCanvasProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], page, challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `agent-canvas-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // What the page last reported. `goal` is null until it reports, so Check waits for a running canvas.
  const [goal, setGoal] = useState<boolean | null>(null);
  const [scene, setScene] = useState<unknown>(null);
  const [run, setRun] = useState(0);
  const [acts, setActs] = useState(0);
  const [pageError, setPageError] = useState<string | null>(null);
  const [tries, setTries] = useState<CanvasTry[]>([]);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  /** Load the page fresh: nothing it reported before holds. */
  const reload = () => { setRun(n => n + 1); setGoal(null); setScene(null); setPageError(null); setActs(0); };

  const progress = useCanvasProgress<CanvasChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: agentCanvasBoss.assignment,
    // Try again keeps the child's work on the canvas (they change it). Opening an item never reloads its page: the
    // child may already have worked on it, and a new item is a new frame by its key.
    onItemOpened: (_index, retry) => { setVerdict(null); setFeedback(null); if (!retry) setTries([]); },
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const current = challenges[currentIndex] ?? null;
  // A new item is a new page: nothing the last one reported holds.
  const shownId = useRef(current?.id);
  useEffect(() => {
    if (shownId.current === current?.id) return;
    shownId.current = current?.id;
    setGoal(null); setScene(null); setPageError(null); setActs(0);
  }, [current?.id]);
  const html = useMemo(() => (current ? canvasPage(current, page) : ''), [current, page]);
  const solved = verdict === 'correct';
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: () => challengeType, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / Math.max(rs.length, 1)),
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<AgentCanvasMetrics>({
    primitiveType: 'agent-canvas', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const ready = goal !== null;

  const check = () => {
    if (!current || locked || !ready) return;
    const correct = goal === true;
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: correct ? 'Yes, that works.' : 'Not yet. Look at what the canvas shows, then change something.', status: correct ? 'correct' : 'incorrect' });
    const work = describeCanvasWork(scene);
    setTries(t => [...t, { work, correct }]);
    progress.commitCheck(work, correct, correct ? undefined : 'goal_unmet');
    // The workspace plays the credit sound itself (`useTeachingWorkspace`); a miss is the host's.
    if (!correct) SoundManager.playIncorrect();
  };

  const onAct = (act: CanvasAct) => {
    if (locked) return;
    setActs(n => n + 1);
    setFeedback(null);
    SoundManager.playById(act.type === 'drop' ? 'snap' : 'tap');
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const total = challenges.length;
    const metrics: AgentCanvasMetrics = {
      type: 'agent-canvas', challengeType, totalChallenges: total, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: total ? Math.round((result.attemptsCount / total) * 10) / 10 : 0,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  useLayoutEffect(() => {
    if (!current || allChallengesComplete) return;
    workspace.current = { ...canvasScene(current, { scene, tries, solved }) };
  });

  const localScore = useMemo(() => phaseResults.length ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No canvas yet.</LuminaCardContent></LuminaCard>;
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {gradeBand && <LuminaBadge accent="cyan">{gradeBand}</LuminaBadge>}
            {challenges.length > 1 && <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />}
          </div>
        </div>
        {description && <LuminaCardDescription>{description}</LuminaCardDescription>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Canvas complete!" celebrationMessage="You made it work." className="mb-2" />
        )}
        {allChallengesComplete && data.pilot && data.canvasId && (
          <CanvasPilotVote canvasId={data.canvasId} studentId={data.pilot.studentId} objective={objectiveId}
            outcome={{ score: submittedResult?.score ?? localScore, passed: submittedResult?.success, elapsedMs, problems: challenges.length,
              results: challengeResults.map(r => ({ id: r.challengeId, correct: r.correct, attempts: r.attempts })) }} />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="cyan"><div className="text-base" data-canvas-prompt="">{current.ask}</div></LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {current && !allChallengesComplete && (
            <>
              <CanvasFrame key={current.id} html={html} title={current.title} run={run} locked={locked}
                onGoal={setGoal} onScene={setScene} onAct={onAct} onError={setPageError} />
              {pageError && <p className="text-sm text-rose-300">The canvas reported an error. Press Start over.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <LuminaButton tone="ghost" onClick={() => { if (!locked) { reload(); setFeedback(null); } }} disabled={locked || (!acts && !pageError)}>Start over</LuminaButton>
                <LuminaActionButton action="check" onClick={check} disabled={locked || !ready}>Check</LuminaActionButton>
              </div>
            </>
          )}
          {feedback && <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const AgentCanvas = withWorkspaceOnly<AgentCanvasProps>('agent-canvas', AgentCanvasSurface, props => props.data.title);

/** Agent Canvas runs only on the teaching workspace: Check commits, and the runtime moves to the next item. */
export default AgentCanvas;
