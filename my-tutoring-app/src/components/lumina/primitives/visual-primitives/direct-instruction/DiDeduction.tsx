'use client';

/**
 * DiDeduction — the second "DI for Older Learners" pack (design brief
 * 2026-09-07, concept 3): a RULE card, a CASE card, and the child SAYS what the
 * rule tells them — and how they know — judged aloud.
 *
 * WHAT THE CHILD DOES. Sees "All insects have six legs." and "A beetle is an
 * insect." The tutor asks "So what does the rule tell you about a beetle?" and
 * the child says "it has six legs". On the harder shapes the case is "A spider
 * does not have six legs." → "no, not an insect, because…", or "This animal
 * has six legs." → "can't tell — other things have six legs too." The tutor's
 * affirmation is the advance; the correction lands on the case where the
 * reasoning went wrong.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every affirmed case writes its
 * conclusion under the cards, and the verdict pill (yes / no / can't tell)
 * lights on the affirmation. Nothing the child must say is ever printed before
 * they say it (answer-leak rule), which is why the ledger is keyed to affirmed
 * item ids and never derived from the plan alone.
 *
 * A MOVE-ON CARRIES THE CASE. When the correction cap closes a case, the tutor
 * states its conclusion and the page writes it as CARRIED, dimmer than the
 * child's own — so the ledger never has a hole where a case was closed.
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
  DiDeductionMetrics,
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
  diDeductionPackBase,
  itemsFromRules,
  withDeductionAction,
  type ActionableDeductionItem,
  type DeductionChallengeType,
  type DeductionItem,
  type DiDeductionData,
} from './diDeductionScript';

export type {
  DeductionChallengeType,
  DeductionItem,
  DeductionRuleSpec,
  DeductionSupportTier,
  DiDeductionData,
} from './diDeductionScript';

/** Misconception Loop S1 — the task identity, named so a distilled sentence
 *  stays self-limiting under this pack's primitive-scoped key. */
const TASK_PHRASE: Record<DeductionChallengeType, string> = {
  conclude: 'concluding what a rule says about a named member (affirming the antecedent)',
  deny: 'ruling a thing OUT because it lacks what the rule says every member has (denying the consequent)',
  cannot_tell: 'recognizing that having the property does not make a thing a member — the rule cannot tell (affirming the consequent is the error)',
};

const VERDICT_PILLS: Array<{ key: 'yes' | 'no' | 'cannot_tell'; label: string }> = [
  { key: 'yes', label: 'yes' },
  { key: 'no', label: 'no' },
  { key: 'cannot_tell', label: "can't tell" },
];

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — generated data arrives as ONE `data`
 *  prop with the evaluation props merged in, never spread. */
export const DiDeduction: React.FC<{
  data: DiDeductionData & {
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiDeductionMetrics>) => void;
  };
  index?: number;
}> = ({ data }) => {
  // The SAME builder the drive harness calls, so what drops here drops there.
  const built = useMemo(
    () => itemsFromRules(data.rules ?? [], data.supportTier),
    [data.rules, data.supportTier],
  );
  const items = useMemo(
    () => built.items.map(withDeductionAction),
    [built.items],
  );

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-deduction-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<DiDeductionMetrics>({
      primitiveType: 'di-deduction',
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
  // `committed` = cases the CHILD got affirmed; `carried` = cases the tutor
  // stated on a move-on. Both render; the second dimmer. Refs mirror the sets
  // because the runner's callbacks fire inside its own dispatch.
  const [committed, setCommitted] = useState<Set<string>>(() => new Set());
  const [carried, setCarried] = useState<Set<string>>(() => new Set());
  const committedRef = useRef<Set<string>>(new Set());
  const carriedRef = useRef<Set<string>>(new Set());
  /** The case just affirmed — the reveal-hold reads it, so a finished case
   *  stays on screen while the tutor is still closing it. */
  const [lastAffirmed, setLastAffirmed] = useState<DeductionItem | null>(null);

  const handleAffirmed = useCallback((item: DeductionItem) => {
    committedRef.current = new Set(committedRef.current).add(item.id);
    setCommitted(committedRef.current);
    setLastAffirmed(item);
  }, []);

  const handleItemOpened = useCallback((item: DeductionItem) => {
    // Any earlier case of THIS rule that was never affirmed was closed by a
    // move-on: the tutor stated it, so the page carries it.
    const skipped = items.filter(
      (it) => it.ruleId === item.ruleId
        && it.caseIndex < item.caseIndex
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
  const pack = useMemo<JudgedScriptPack<DeductionItem>>(() => ({
    ...diDeductionPackBase(items),
    statusLines: {
      ready: (item) => withDeductionAction(item).actionContract.instruction,
      retry: (item) => `Have another go. ${withDeductionAction(item).actionContract.instruction}`,
      noVerdict: () => 'One more time — what does the rule tell you?',
      affirmedNext: 'Yes! On to the next case.',
      affirmedLast: 'You used every rule!',
      done: 'Great thinking today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge:
        `Direct Instruction deduction — ${TASK_PHRASE[item.challengeType]}. `
        + `Rule "${item.ruleText}" Case "${item.case.caseText}"`,
      expected: item.answerSpoken,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the deduction wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const cannotTellIds = new Set(items.filter((it) => it.shape === 'cannot_tell').map((it) => it.id));
    const cannotTell = summary.outcomes.filter((o) => cannotTellIds.has(o.id));
    const timed = summary.outcomes.filter((o) => o.seconds != null);
    const metrics: DiDeductionMetrics = {
      type: 'di-deduction',
      challengeType: data.challengeType,
      // Without this the submission carries `eval_mode: 'default'` and the mode
      // β priors are never reached (/curriculum-fit di-word-problem-setup, 2026-09-10).
      evalMode: data.challengeType,
      totalChallenges: summary.outcomes.length,
      ruleCount: new Set(items.map((it) => it.ruleId)).size,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
      cannotTellTotal: cannotTell.length,
      cannotTellCorrect: cannotTell.filter((o) => o.solved).length,
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

  const runner = useJudgedScriptRunner<DeductionItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel || 'Grade 3',
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
    onAffirmed: handleAffirmed,
    onItemOpened: handleItemOpened,
  });

  const current = runner.currentItem;

  // The reveal hold (18b): a just-affirmed case stays up while the tutor is
  // still saying its closing line; the next case appears when her next cue is
  // SENT.
  const shown = runner.revealHeld && lastAffirmed ? lastAffirmed : current;
  const shownAction: ActionableDeductionItem | null = shown
    ? withDeductionAction(shown)
    : null;
  const shownRuleId = shown?.ruleId ?? null;
  const shownSteps = useMemo(
    () => items.filter((it) => it.ruleId === shownRuleId),
    [items, shownRuleId],
  );
  const ledger = useMemo(
    () => items.filter((it) => it.ruleId === shownRuleId && (committed.has(it.id) || carried.has(it.id))),
    [items, shownRuleId, committed, carried],
  );

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (it) => ({
      label: `${it.case.caseText} · ${it.actionContract.label}`,
      icon: it.actionContract.icon,
    }));
  }, [hasSubmitted, runner.summary, items]);

  const mark = (id: string): 'child' | 'tutor' | null =>
    committed.has(id) ? 'child' : carried.has(id) ? 'tutor' : null;
  const tone = (m: 'child' | 'tutor' | null) =>
    m === 'child' ? 'text-emerald-300' : 'text-amber-200/70';

  // ── The stage: the rule, the case, and whatever has been written ──────────
  const renderStage = () => {
    if (!shown) return null;
    const shownMark = mark(shown.id);
    const isVerdictShape = shown.shape !== 'conclude';
    const litVerdict = shownMark ? shown.case.verdict : null;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/5 px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Rule</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{shown.ruleText}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Case</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{shown.case.caseText}</div>
        </div>

        {isVerdictShape && (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3" aria-label="Spoken verdict choices">
            <p className="mb-2 text-center text-xs font-medium text-slate-300">
              Say one, then explain using the rule
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {VERDICT_PILLS.map((pill) => {
                const lit = litVerdict === pill.key;
                return (
                  <span
                    key={pill.key}
                    data-verdict={pill.key}
                    data-lit={lit ? 'true' : 'false'}
                    className={
                      'rounded-full border px-4 py-1 text-sm uppercase tracking-widest transition-colors '
                      + (lit
                        ? shownMark === 'child'
                          ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200'
                          : 'border-amber-200/60 bg-amber-300/10 text-amber-200/80'
                        : 'border-cyan-300/20 bg-cyan-400/5 text-slate-300')
                    }
                  >
                    {pill.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* The ledger: only what has been said (or carried) for THIS rule. */}
        {ledger.length > 0 && (
          <ul className="space-y-1 border-t border-white/10 pt-3" aria-label="what we know">
            {ledger.map((it) => (
              <li key={it.id} className={`text-lg ${tone(mark(it.id))}`}>
                {it.case.conclusionText}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="py-10 text-center">
          <p className="text-slate-300 text-sm">
            No rules were built for this objective.
          </p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const ruleCount = new Set(items.map((it) => it.ruleId)).size;
  const ruleNumber = current ? current.ruleIndex + 1 : ruleCount;

  return (
    <LuminaCard>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <p className="text-slate-400 text-sm">{data.description}</p>
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Use the rule</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!hasSubmitted && (
          <>
            <div className="mb-2 flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(ruleNumber, ruleCount)}
                total={ruleCount}
                variant="dots"
              />
            </div>

            {renderStage()}

            <div className="flex justify-center">
              <LuminaButton
                tone={runner.stimulusTapped ? 'primary' : 'subtle'}
                className="text-xs"
                onClick={runner.hearStimulus}
                disabled={!runner.running}
              >
                🔊 Hear the rule and the case
              </LuminaButton>
            </div>

            <DiActionPanel
              run={runner}
              running={runner.running}
              stage={runner.stage}
              currentItem={shownAction}
              steps={shownSteps}
              completedIds={committed}
              carriedIds={carried}
              startInstruction="Start the lesson, listen to the rule and case, then answer from the rule only."
            />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Rule Work Complete!"
            celebrationMessage="You reasoned through every case yourself."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiDeduction;
