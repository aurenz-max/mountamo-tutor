'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaCallout,
  LuminaChallengeCounter,
  LuminaInput,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TwoWayTableMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  colSum, describeTwoWayWork, formatProbability, grandSum, parseProbabilityInput, rowSum, totalsVisibility,
  twoWayCorrect, twoWayMiss, workspaceScene, type TableTarget,
} from './twoWayTableWorkspace';
import {
  MODEL_LEVER, OUTLINE_LEVER, OUT_OF_LEVER, SUM_LEVER, TWO_WAY_LEVERS, isPracticeTable, outOfFrame, outlineCells,
  sumFrames, tableModel,
} from './twoWayTableLevers';
import { twoWayTableBoss } from './twoWayTable.boss';

// ============================================================================
// Data Types — canonical interface re-exported from the generator
// ============================================================================

export type TwoWayTableChallengeType =
  | 'joint_probability'
  | 'marginal_distribution'
  | 'conditional_probability'
  | 'independence_test';

export type TwoWayTableSupportTier = 'easy' | 'medium' | 'hard';

export interface TwoWayTableChallenge {
  id: string;
  challengeType: TwoWayTableChallengeType;
  scenario: string;
  rowLabel: string;
  columnLabel: string;
  rowCategories: string[];
  columnCategories: string[];
  frequencies: number[][];
  question: string;
  expectedProbability: number;
  tolerance: number;
  /** Legacy single switch — default source when no support tier present. */
  showTotals: boolean;
  hint: string;

  // ── Support-tier scaffolds (set by generator when config.difficulty present) ──
  supportTier?: TwoWayTableSupportTier;
  /** Render the per-row total column. When undefined, falls back to showTotals. */
  showRowTotals?: boolean;
  /** Render the per-column total row. When undefined, falls back to showTotals. */
  showColTotals?: boolean;
  /** Render the grand-total corner cell. When undefined, falls back to showTotals. */
  showGrandTotal?: boolean;
  /** Easy-tier worked "sum reminder" anchor line (never states the answer total). */
  sumReminder?: string;
  /** Which cell, row or column the question names (generator-built; never rendered). */
  target?: TableTarget;
}

export interface TwoWayTableData {
  title: string;
  description: string;
  challenges: TwoWayTableChallenge[];
  challengeType: TwoWayTableChallengeType;
  educationalContext?: string;
  gradeBand?: '7-8' | 'statistics';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TwoWayTableMetrics>) => void;
}

// ============================================================================
// Phase config (one row per challenge type)
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  joint_probability:       { label: 'Joint',       icon: '∩', accentColor: 'purple' },
  marginal_distribution:   { label: 'Marginal',    icon: 'Σ', accentColor: 'amber' },
  conditional_probability: { label: 'Conditional', icon: '|', accentColor: 'blue' },
  independence_test:       { label: 'Independence', icon: '⊥', accentColor: 'emerald' },
};

function phaseScore(attempts: number): number {
  return Math.max(20, 100 - (Math.max(0, attempts - 1) * 20));
}

// ============================================================================
// Frequency Table Renderer (read-only with tier-gated totals)
//
// BESPOKE PAINTING: this is the primitive's core visual surface — a
// pedagogically color-coded contingency table (purple columns, blue rows,
// amber totals) the student reads counts out of. Support tiers withdraw the
// amber total scaffolds independently (row / column / grand) so a hard tier
// makes the student compute every sum; the cell counts never change. The
// `outline_question` lever rings the cells the question is about.
// ============================================================================

interface FrequencyTableProps {
  challenge: TwoWayTableChallenge;
  outline?: { cells: Array<[number, number]>; mark: [number, number] | null } | null;
}

const FrequencyTable: React.FC<FrequencyTableProps> = ({ challenge, outline }) => {
  const { rowLabel, columnLabel, rowCategories, columnCategories, frequencies, sumReminder } = challenge;
  const { showRow, showCol, showGrand } = totalsVisibility(challenge);
  const anyTotals = showRow || showCol || showGrand;

  const rowTotals = useMemo(() => frequencies.map((_, r) => rowSum(frequencies, r)), [frequencies]);
  const columnTotals = useMemo(() => columnCategories.map((_, c) => colSum(frequencies, c)), [frequencies, columnCategories]);
  const grandTotal = useMemo(() => grandSum(frequencies), [frequencies]);

  const outlined = (r: number, c: number) => !!outline?.cells.some(([i, j]) => i === r && j === c);
  const marked = (r: number, c: number) => !!outline?.mark && outline.mark[0] === r && outline.mark[1] === c;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs uppercase tracking-wider text-slate-500">
              <span className="font-mono text-slate-400">{rowLabel}</span>
              <span className="px-2 text-slate-600">/</span>
              <span className="font-mono text-slate-400">{columnLabel}</span>
            </th>
            {columnCategories.map((col, ci) => (
              <th key={ci} className="p-2 text-center font-semibold text-purple-200 border-b border-white/10">
                {col}
              </th>
            ))}
            {showRow && (
              <th className="p-2 text-center font-semibold text-amber-300 border-b border-white/10 border-l-2 border-l-white/20">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {frequencies.map((row, ri) => (
            <tr key={ri} className="border-t border-white/5">
              <td className="p-2 font-semibold text-blue-200 border-r border-white/10">{rowCategories[ri]}</td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  data-lever={marked(ri, ci) ? 'outline-mark' : outlined(ri, ci) ? 'outline' : undefined}
                  className={`p-2 text-center font-mono text-base text-white border border-white/5 ${
                    marked(ri, ci) ? 'ring-2 ring-inset ring-amber-300 bg-amber-400/10'
                      : outlined(ri, ci) ? 'ring-2 ring-inset ring-cyan-400/80 bg-cyan-400/10' : ''}`}
                >
                  {cell}
                </td>
              ))}
              {showRow && (
                <td className="p-2 text-center font-mono text-amber-200 font-bold border-l-2 border-l-white/20">
                  {rowTotals[ri]}
                </td>
              )}
            </tr>
          ))}
          {(showCol || showGrand) && (
            <tr className="border-t-2 border-t-white/20 bg-slate-900/50">
              <td className="p-2 font-semibold text-amber-300 border-r border-white/10">Total</td>
              {columnTotals.map((t, ci) => (
                <td key={ci} className="p-2 text-center font-mono text-amber-200 font-bold">
                  {showCol ? t : ''}
                </td>
              ))}
              {/* Grand-total corner cell — shown independently of the column row. */}
              <td className="p-2 text-center font-mono text-purple-200 font-bold text-lg border-l-2 border-l-white/20">
                {showGrand ? grandTotal : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Easy-tier worked "sum reminder" — a safe (non-answer) total demonstrated. */}
      {sumReminder && <p className="mt-2 text-xs text-emerald-300/90 italic">{sumReminder}</p>}

      {!anyTotals && (
        <p className="mt-2 text-xs text-slate-500 italic">
          Row, column, and grand totals are hidden for this challenge — compute the totals you need from the cells.
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Component
// ============================================================================

interface TwoWayTableProps {
  data: TwoWayTableData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const useTwoWayProgress = useWorkspaceProgressFor('two-way-table');
const PRACTICE_NOTE = 'An easier practice table is on screen in place of the item. It is not graded; the full item comes back after it.';

const TwoWayTableSurface = ({ data, className, runtimePlanItemId }: TwoWayTableProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    challengeType: sessionChallengeType,
    educationalContext,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `two-way-table-${Date.now()}`);
  const resolvedInstanceId = stableInstanceIdRef.current;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<TwoWayTableMetrics>({
    primitiveType: 'two-way-table',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Challenge progression: the teaching workspace owns it. ──
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useTwoWayProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: twoWayTableBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`TWO_WAY_LEVERS`), keyed by the session item they were pulled on, and the easier table a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<TwoWayTableChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier table while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice table. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-challenge state ───────────────────────────────────────────
  const [answerInput, setAnswerInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  const submittedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  /** A fresh item or Try again: the answer box empty, the feedback gone. */
  const resetWork = () => {
    setAnswerInput('');
    setFeedback(null);
  };
  openItem.current = (_index, retry) => {
    // Try again on a practice table keeps it; a fresh item (or the full item back after practice) drops it.
    if (!retry) setPractice(null);
    resetWork();
  };

  // ── Aggregate score (live preview) ────────────────────────────────
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    const sum = challengeResults.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
    return Math.round(sum / challengeResults.length);
  }, [challengeResults]);

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.challengeType,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => {
      if (rs.length === 0) return 0;
      const sum = rs.reduce((s, r) => s + ((r.score as number) ?? (r.correct ? 100 : 0)), 0);
      return Math.round(sum / rs.length);
    },
  });

  const [submittedResult, setSubmittedResult] =
    useState<PrimitiveEvaluationResult<TwoWayTableMetrics> | null>(null);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || submittedRef.current || challenges.length === 0) return;
    submittedRef.current = true;
    const metrics: TwoWayTableMetrics = {
      type: 'two-way-table',
      challengeType: sessionChallengeType,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    setSubmittedResult(submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence));
  };

  // ── Check answer. Every check commits (right or wrong); an entry that is not a number is not a check. ──
  const handleCheck = useCallback(() => {
    if (!currentChallenge || learnerBlocked() || feedback?.correct) return;

    if (parseProbabilityInput(answerInput) === null) {
      SoundManager.invalid();
      setFeedback({ correct: false, message: 'Please enter a decimal between 0 and 1, or a percent with %.' });
      return;
    }

    const attempts = currentAttempts + 1;
    const correct = twoWayCorrect(currentChallenge, answerInput);

    if (correct) {
      SoundManager.playCorrect();
      const score = phaseScore(attempts);
      setFeedback({
        correct: true,
        message: `Correct! P = ${formatProbability(currentChallenge.expectedProbability)}`
          + (isPracticeTable(currentChallenge) ? '' : ` (+${score} points)`),
      });
    } else {
      SoundManager.playIncorrect();
      setFeedback({
        correct: false,
        message: attempts === 1
          ? 'Not quite — re-check which counts go into the numerator and denominator.'
          : 'Still off. Check which group the probability is out of.',
      });
    }
    // The checked gesture (counts the attempt, records the verdict), then this primitive's own fields.
    progress.commitCheck(describeTwoWayWork(answerInput), correct, twoWayMiss(currentChallenge, answerInput));
    // An easier practice table (a simplify lever) is not the session's challenge: it records nothing of its own.
    if (correct && !isPracticeTable(currentChallenge)) {
      mergeResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score: phaseScore(attempts),
        challengeType: currentChallenge.challengeType,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, feedback, answerInput, mergeResult, progress.commitCheck]);

  // ── What the tutor and the observer are shown, republished every render. ──
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { typed: answerInput });
    const levers = practice ? [] : TWO_WAY_LEVERS.declare(sessionChallenge, null, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : TWO_WAY_LEVERS.support(sessionChallenge, null),
      onScreen: practice ? '' : TWO_WAY_LEVERS.onScreen(sessionChallenge, null, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = TWO_WAY_LEVERS.simpler(sessionChallenge, null, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork();
          return { practice: twoWayTableBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(); },
    };
  });

  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400">No two-way table challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const inputClosed = !!feedback?.correct || blocked || allChallengesComplete;
  const canSubmit = answerInput.trim().length > 0 && !inputClosed;
  const phaseLabel = currentChallenge
    ? PHASE_TYPE_CONFIG[currentChallenge.challengeType]?.label ?? currentChallenge.challengeType
    : '';

  // Lever pictures (`twoWayTableLevers.ts`), on the session item only.
  const outline = sessionChallenge && leverOn(OUTLINE_LEVER) ? outlineCells(sessionChallenge) : null;
  const frames = sessionChallenge && leverOn(SUM_LEVER) ? sumFrames(sessionChallenge) : [];
  const outOf = sessionChallenge && leverOn(OUT_OF_LEVER) ? outOfFrame(sessionChallenge) : null;
  const model = sessionChallenge && leverOn(MODEL_LEVER) ? tableModel(sessionChallenge) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Summary panel (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="Probability Session Complete!"
            celebrationMessage="You worked through every table!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Scenario + question */}
            <LuminaPrompt>
              <div className="flex items-center gap-2 mb-2">
                <LuminaBadge accent="purple" className="text-[10px] uppercase tracking-wider">{phaseLabel}</LuminaBadge>
                {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
                <span className="text-xs text-slate-400">{currentChallenge.scenario}</span>
              </div>
              <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>
            </LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the table and the answer
                box as one region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {/* Frequency table (tier-gated totals) — bespoke painting */}
              <FrequencyTable challenge={currentChallenge} outline={outline} />

              {frames.length > 0 && (
                <div data-lever="sum-frame" className="space-y-1 rounded-lg border border-cyan-500/30 bg-slate-950/40 p-3 font-mono text-sm text-cyan-200">
                  {frames.map((fr) => (
                    <p key={fr.label}>{fr.label}: {fr.addends.join(' + ')} = ?</p>
                  ))}
                </div>
              )}
              {outOf && (
                <p data-lever="out-of-frame" className="rounded-lg border border-cyan-500/30 bg-slate-950/40 p-3 text-center text-sm text-cyan-200">
                  {outOf}
                </p>
              )}
              {model && (
                <figure data-lever="model-table" className="mx-auto w-72 rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
                  <figcaption className="mb-1 text-xs uppercase tracking-wider text-slate-400">Worked example</figcaption>
                  <table className="mx-auto border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="p-1 text-slate-500">{model.rowLabel} / {model.columnLabel}</th>
                        {model.cols.map((c) => <th key={c} className="p-1 text-purple-200">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {model.frequencies.map((row, r) => (
                        <tr key={model.rows[r]}>
                          <td className="p-1 text-blue-200">{model.rows[r]}</td>
                          {row.map((v, c) => <td key={c} className="p-1 font-mono text-white">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 font-mono text-xs text-emerald-200">{model.line}</p>
                </figure>
              )}

              {/* Answer input */}
              <div className="flex items-center gap-3 p-4 bg-slate-950/30 rounded-lg border border-white/10">
                <label htmlFor="twt-answer" className="text-sm font-mono text-emerald-300 font-semibold">P =</label>
                <LuminaInput
                  id="twt-answer"
                  aria-label="Your answer"
                  type="text"
                  inputMode="decimal"
                  value={answerInput}
                  onChange={(e) => { if (!learnerBlocked()) setAnswerInput(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit && !learnerBlocked()) handleCheck();
                  }}
                  disabled={inputClosed}
                  placeholder="0.00"
                  className="w-40 h-12 text-center text-lg font-mono font-semibold border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-emerald-500/30"
                />
                <span className="text-xs text-slate-500 italic">
                  A decimal from 0 to 1, to 2 places. A percent works with %.
                </span>
              </div>
            </PipWorkspace>

            {/* Feedback */}
            {feedback && (
              <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'}>{feedback.message}</LuminaFeedbackCard>
            )}

            {/* Check; the runtime retries and advances. */}
            {!feedback?.correct && (
              <div className="flex flex-wrap items-center gap-2">
                <LuminaActionButton action="check" onClick={handleCheck} disabled={!canSubmit} />
              </div>
            )}
          </>
        )}

        {/* Educational context (session-level) */}
        {educationalContext && !allChallengesComplete && (
          <LuminaCallout accent="purple" label="In Context">{educationalContext}</LuminaCallout>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const TwoWayTable = withWorkspaceOnly<TwoWayTableProps>('two-way-table', TwoWayTableSurface, props => props.data.title);

export default TwoWayTable;
