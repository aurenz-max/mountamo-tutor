'use client';

/**
 * DiWorkedProcedure — the first "DI for Older Learners" pack (design brief
 * 2026-09-07): a multi-digit subtraction the child works OUT LOUD, one column
 * at a time, judged step by step.
 *
 * WHAT THE CHILD DOES. Sees the problem printed in columns, empty. The tutor
 * asks "Start in the ones column. Tell me what you do." and the child says the
 * move — "three minus eight, I can't, so I regroup: four tens, thirteen ones"
 * — then the difference, then the next column. The tutor's affirmation is the
 * advance, and the correction lands at the column where the error happened.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every affirmed step writes
 * itself onto the problem: the strike and the small digit above on a regroup,
 * the difference digit under the rule. Nothing the child must say is ever
 * printed before they say it (answer-leak rule), which is why the marks are
 * keyed to affirmed item ids and never derived from the plan alone.
 *
 * A MOVE-ON CARRIES THE STEP. When the correction cap closes a step, the tutor
 * states it ("We regroup: four tens, thirteen ones.") and the page writes it as
 * CARRIED, dimmer than the child's own marks — otherwise the next ask ("Now
 * subtract the ones") would refer to a thirteen the page never showed.
 *
 * Everything else is the family's: `useJudgedScriptRunner` owns the run, the
 * mic, progression, the correction cap and context sync; the script module
 * owns every spoken line and judging contract.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaChallengeCounter,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type {
  DiWorkedProcedureMetrics,
  PrimitiveEvaluationResult,
} from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import DiActionPanel from '../../../components/DiActionPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  diWorkedProcedurePackBase,
  itemsFromProblems,
  withWorkedProcedureAction,
  type ActionableWorkedProcedureItem,
  type DiWorkedProcedureData,
  type WorkedProcedureChallengeType,
  type WorkedProcedureItem,
} from './diWorkedProcedureScript';

export type {
  DiWorkedProcedureData,
  WorkedProblemSpec,
  WorkedProcedureChallengeType,
  WorkedProcedureItem,
  WorkedProcedureSupportTier,
} from './diWorkedProcedureScript';

/** Misconception Loop S1 — the task identity, named so a distilled sentence
 *  stays self-limiting under this pack's primitive-scoped key. */
const TASK_PHRASE: Record<WorkedProcedureChallengeType, string> = {
  subtract_no_regroup: 'talking through a multi-digit subtraction with no regrouping, one column at a time',
  subtract_regroup: 'talking through a multi-digit subtraction WITH regrouping, one column at a time',
};

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — generated data arrives as ONE `data`
 *  prop with the evaluation props merged in, never spread. */
export const DiWorkedProcedure: React.FC<{
  data: DiWorkedProcedureData & {
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWorkedProcedureMetrics>) => void;
  };
  index?: number;
}> = ({ data }) => {
  // The SAME builder the drive harness calls, so what drops here drops there.
  const built = useMemo(() => itemsFromProblems(data.problems ?? []), [data.problems]);
  const items = useMemo(
    () => built.items.map(withWorkedProcedureAction),
    [built.items],
  );

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-worked-procedure-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<DiWorkedProcedureMetrics>({
      primitiveType: 'di-worked-procedure',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      componentIntent: data.componentIntent,
      objectiveText: data.objectiveText,
      onSubmit: data.onEvaluationSubmit,
    });

  // ── What the page has written ─────────────────────────────────────────────
  // `committed` = steps the CHILD got affirmed; `carried` = steps the tutor
  // stated on a move-on. Both render; the second dimmer. Refs mirror the sets
  // because the runner's callbacks fire inside its own dispatch.
  const [committed, setCommitted] = useState<Set<string>>(() => new Set());
  const [carried, setCarried] = useState<Set<string>>(() => new Set());
  const committedRef = useRef<Set<string>>(new Set());
  const carriedRef = useRef<Set<string>>(new Set());
  /** The step just affirmed — the reveal-hold reads its problem, so a finished
   *  problem stays on screen while the tutor is still closing it. */
  const [lastAffirmed, setLastAffirmed] = useState<WorkedProcedureItem | null>(null);

  const handleAffirmed = useCallback((item: WorkedProcedureItem) => {
    committedRef.current = new Set(committedRef.current).add(item.id);
    setCommitted(committedRef.current);
    setLastAffirmed(item);
  }, []);

  const handleItemOpened = useCallback((item: WorkedProcedureItem) => {
    // Any earlier step of THIS problem that was never affirmed was closed by a
    // move-on: the tutor stated it, so the page carries it.
    const skipped = items.filter(
      (it) => it.problemId === item.problemId
        && it.stepIndex < item.stepIndex
        && !committedRef.current.has(it.id)
        && !carriedRef.current.has(it.id),
    );
    if (skipped.length === 0) return;
    const next = new Set(carriedRef.current);
    skipped.forEach((it) => next.add(it.id));
    carriedRef.current = next;
    setCarried(next);
  }, [items]);

  // ── The pack ──────────────────────────────────────────────────────────────
  const pack = useMemo<JudgedScriptPack<WorkedProcedureItem>>(() => ({
    ...diWorkedProcedurePackBase(items),
    statusLines: {
      ready: (item) => withWorkedProcedureAction(item).actionContract.instruction,
      retry: (item) => `Have another go. ${withWorkedProcedureAction(item).actionContract.instruction}`,
      noVerdict: () => 'One more time — what do you do?',
      affirmedNext: 'Yes! On to the next column.',
      affirmedLast: 'You worked every column!',
      done: 'Great subtraction work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge:
        `Direct Instruction talk-through subtraction — ${TASK_PHRASE[item.challengeType]}. `
        + `Problem ${item.problemDisplay}, ${item.place} column, `
        + (item.kind === 'subtract'
          ? 'subtracting after a regroup.'
          : item.regroup
            ? 'where the correct move is to regroup.'
            : 'where no regrouping is needed.'),
      expected: item.answerSpoken,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the step wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const regroupIds = new Set(items.filter((it) => it.kind === 'decide' && it.regroup).map((it) => it.id));
    const regroupOutcomes = summary.outcomes.filter((o) => regroupIds.has(o.id));
    const timed = summary.outcomes.filter((o) => o.seconds != null);
    const metrics: DiWorkedProcedureMetrics = {
      type: 'di-worked-procedure',
      challengeType: data.challengeType,
      totalChallenges: summary.outcomes.length,
      problemCount: new Set(items.map((it) => it.problemId)).size,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
      regroupStepsTotal: regroupOutcomes.length,
      regroupStepsCorrect: regroupOutcomes.filter((o) => o.solved).length,
      meanResponseMs: timed.length
        ? Math.round(timed.reduce((sum, o) => sum + (o.seconds ?? 0) * 1000, 0) / timed.length)
        : null,
    };
    submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { outcomes: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [data.challengeType, items, submitResult]);

  const runner = useJudgedScriptRunner<WorkedProcedureItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel || 'Grade 2',
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
    onAffirmed: handleAffirmed,
    onItemOpened: handleItemOpened,
  });

  const current = runner.currentItem;
  const currentAction: ActionableWorkedProcedureItem | null = current
    ? withWorkedProcedureAction(current)
    : null;

  // The reveal hold (18b): a just-finished problem stays up while the tutor is
  // still saying its closing line; the next problem appears when her next cue
  // is SENT. Within a problem both branches name the same problem.
  const shownProblemId = runner.revealHeld && lastAffirmed
    ? lastAffirmed.problemId
    : current?.problemId ?? null;
  const shownSteps = useMemo(
    () => items.filter((it) => it.problemId === shownProblemId),
    [items, shownProblemId],
  );

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (it) => ({
      label: `${it.problemDisplay} · ${it.actionContract.label}`,
      icon: it.actionContract.icon,
    }));
  }, [hasSubmitted, runner.summary, items]);

  // ── The stage: the problem, with whatever has been written on it ─────────
  const renderProblem = () => {
    if (shownSteps.length === 0) return null;
    const first = shownSteps[0];
    const digits = String(first.minuend).length;
    const marked = (id: string): 'child' | 'tutor' | null =>
      committed.has(id) ? 'child' : carried.has(id) ? 'tutor' : null;
    // Per column (ones first): what has been written.
    const columns = Array.from({ length: digits }, (_, c) => {
      const decide = shownSteps.find((it) => it.columnIndex === c && it.kind === 'decide');
      const subtract = shownSteps.find((it) => it.columnIndex === c && it.kind === 'subtract');
      const below = shownSteps.find((it) => it.columnIndex === c - 1 && it.kind === 'decide' && it.regroup);
      const top = Math.floor(first.minuend / 10 ** c) % 10;
      const bottom = Math.floor(first.subtrahend / 10 ** c) % 10;
      const lentMark = below ? marked(below.id) : null;          // this column was decremented
      const regroupMark = decide?.regroup ? marked(decide.id) : null; // this column borrowed
      const answerItem = subtract ?? (decide && !decide.regroup ? decide : undefined);
      const answerMark = answerItem ? marked(answerItem.id) : null;
      return {
        columnIndex: c, top, bottom, lentMark, regroupMark, answerMark,
        answerDigit: answerItem?.column.difference ?? null,
      };
    }).reverse(); // render hundreds → ones

    const tone = (mark: 'child' | 'tutor' | null) =>
      mark === 'child' ? 'text-emerald-300' : 'text-amber-200/70';
    const activeColumn = (columnIndex: number): boolean =>
      current?.problemId === shownProblemId && current.columnIndex === columnIndex;

    return (
      <div
        className="mx-auto grid select-none font-mono text-6xl font-semibold text-slate-100"
        style={{
          gridTemplateColumns: `1.2ch repeat(${digits}, 1.4ch)`,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
        aria-label={`${first.problemDisplay}`}
      >
        {/* Minuend row — with strike + small digit above where a column lent. */}
        <span />
        {columns.map((col, i) => (
          <span
            key={`top-${i}`}
            className={`relative rounded-sm text-right ${activeColumn(col.columnIndex) ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : ''}`}
            aria-label={activeColumn(col.columnIndex) ? `Current ${current?.place} column, top digit` : undefined}
          >
            {col.lentMark && (
              <span className={`absolute -top-6 right-0 text-2xl ${tone(col.lentMark)}`}>{col.top - 1}</span>
            )}
            {col.regroupMark && (
              <span className={`absolute -top-6 -left-3 text-2xl ${tone(col.regroupMark)}`}>1</span>
            )}
            <span className={col.lentMark ? 'line-through decoration-4 decoration-slate-400 text-slate-500' : ''}>
              {col.top}
            </span>
          </span>
        ))}
        {/* Subtrahend row. */}
        <span className="text-slate-400">−</span>
        {columns.map((col, i) => (
          <span
            key={`bot-${i}`}
            className={`rounded-sm text-right ${activeColumn(col.columnIndex) ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : ''}`}
            aria-label={activeColumn(col.columnIndex) ? `Current ${current?.place} column, bottom digit` : undefined}
          >
            {col.bottom}
          </span>
        ))}
        {/* The rule. */}
        <span className="col-span-full my-1 border-t-4 border-slate-200" />
        {/* Answer row — only what has been written. */}
        <span />
        {columns.map((col, i) => (
          <span
            key={`ans-${i}`}
            className={`rounded-sm text-right ${tone(col.answerMark)} ${activeColumn(col.columnIndex) ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : ''}`}
            aria-label={activeColumn(col.columnIndex) ? `Current ${current?.place} column, answer digit` : undefined}
          >
            {col.answerMark ? col.answerDigit : <span className="text-slate-700">·</span>}
          </span>
        ))}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="py-10 text-center">
          <p className="text-slate-300 text-sm">
            No subtraction problems were built for this objective.
          </p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const problemCount = new Set(items.map((it) => it.problemId)).size;
  const problemNumber = current ? current.problemIndex + 1 : problemCount;

  return (
    <LuminaCard>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <p className="text-slate-400 text-sm">{data.description}</p>
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Talk it through</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!hasSubmitted && (
          <>
            <div className="mb-2 flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(problemNumber, problemCount)}
                total={problemCount}
                variant="dots"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10">
              {renderProblem()}
            </div>

            <div className="flex justify-center">
              <LuminaButton
                tone={runner.stimulusTapped ? 'primary' : 'subtle'}
                className="text-xs"
                onClick={runner.hearStimulus}
                disabled={!runner.running}
              >
                🔊 Hear the problem
              </LuminaButton>
            </div>

            <DiActionPanel
              run={runner}
              running={runner.running}
              stage={runner.stage}
              currentItem={currentAction}
              steps={shownSteps}
              completedIds={committed}
              carriedIds={carried}
              startInstruction="Start the lesson, listen to the problem, then work one highlighted column at a time."
            />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Subtraction Complete!"
            celebrationMessage="You talked through every column yourself."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiWorkedProcedure;
