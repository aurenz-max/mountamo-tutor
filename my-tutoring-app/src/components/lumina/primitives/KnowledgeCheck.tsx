'use client';

/**
 * KnowledgeCheck — DI modality (qa/di/BACKLOG.md item 23 slice 2). The Live
 * tutor owns the clock: it asks the closing questions of the lesson, waits,
 * judges the child's answer from the audio in-band, corrects contrastively,
 * and its own affirmation is the advance. In the judged surface there is no
 * advance timer, no Next button, no Verify, no push-to-talk mic, and no
 * printed answer anywhere before the tutor's affirmation.
 *
 * THE FORK (all-or-nothing). Knowledge-check completion is gated per problem
 * (`${instanceId}::pN` — KindergartenStage counts them), so a judged session
 * that dropped one problem would strand the whole check. The build is
 * therefore all-or-nothing: if every problem in the set yields at least one
 * judged item AND the mic pipeline exists, the judged surface renders;
 * otherwise the whole set renders as the tap surface
 * (`KnowledgeCheckTapFlow`) — the DI-off experience, including the slice-1
 * categorization microstep. Never both: a tap-answerable problem beside a
 * live judged mic is the voice-mode fork this family deletes.
 *
 * WHAT THE JUDGED SURFACE REPLACES, per problem type — the answer-material
 * fork, gates and every spoken line live in `knowledgeCheckScript.ts`
 * (hand-authored, DISTAR):
 *  - true_false: the mic-orb + Verify chrome is gone; the child SAYS
 *    "true"/"false" (or "yes"/"no") and the tutor judges it.
 *  - multiple_choice: sayable options are a spoken menu (`closed_set_choice`
 *    — the child says which one); KaTeX/symbol draws are an honest POINT
 *    (tap), the one gesture in this pack.
 *  - fill_in_blanks: the child SAYS the missing word (the ruled
 *    letter-spotter case); the word bank stays on screen as the closed set.
 *  - matching: one ask per pair over a bank that never shrinks on screen; at
 *    most N-1 pairs are asked so the last is never elimination.
 *  - categorization: the slice-1 microstep, spoken — "which group does X go
 *    in?" one item at a time.
 *
 * EVALUATION: one submission per PROBLEM (R7/R8), through hidden per-problem
 * bridges that each own a `usePrimitiveEvaluation` — the judged run's item
 * outcomes aggregate onto the same `::pN` identities the tap surface uses,
 * so KindergartenStage and per-objective attribution see no difference.
 *
 * The summary is the family's (PhaseSummaryPanel): `solved` is not `solved
 * alone` — corrections show, honest-completion ruling.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KnowledgeCheckData, ProblemData } from '../types';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import type { KnowledgeCheckJudgedMetrics } from '../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../hooks/judgedScriptContract';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';
import JudgedMicPanel from '../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../hooks/usePhaseResults';
import {
  LuminaChallengeCounter,
  LuminaPanel,
  motion,
} from '../ui';
import { isPreReaderGrade } from '../utils/kindergartenMode';
import { KnowledgeCheckTapFlow } from './KnowledgeCheckTapFlow';
import {
  itemsFromProblems,
  knowledgeCheckPackBase,
  tapVerdictCue,
  correctOptionText,
  type KnowledgeCheckItem,
} from './knowledgeCheckScript';

interface KnowledgeCheckProps {
  data: KnowledgeCheckData | {
    problems: ProblemData[];
    instanceId?: string;
    skillId?: string;
    subskillId?: string;
    objectiveId?: string;
    exhibitId?: string;
    onEvaluationSubmit?: (result: any) => void;
  };
}

function isLegacyKnowledgeCheck(data: any): data is KnowledgeCheckData {
  return 'question' in data && 'options' in data && 'correctAnswerId' in data;
}

function isProblemRegistryFormat(data: any): data is { problems: ProblemData[] } {
  return 'problems' in data && Array.isArray(data.problems);
}

/** Summary-row icons, by what the child actually DID on that item. */
const ITEM_ICONS: Record<KnowledgeCheckItem['kind'], string> = {
  true_false: '⚖️',
  choice: '🗣️',
  choice_tap: '👆',
  blank: '💬',
  match: '🔗',
  sort: '🗂️',
};

// ─── Per-problem evaluation bridge ───────────────────────────────────────────
// The judged run is ONE component but must submit N per-problem evaluations
// (`::pN`, R7/R8). Hooks can't be called in a loop, so each problem mounts a
// tiny invisible bridge that owns its `usePrimitiveEvaluation` — the same ID
// resolution (per-objective attribution, subject precedence) the tap surface's
// problem primitives get, with none of the UI.

type BridgeSubmit = (
  success: boolean,
  score: number,
  metrics: KnowledgeCheckJudgedMetrics,
  studentWork?: unknown,
  partialCredit?: number,
  diagnosisEvidence?: PrimitiveEvaluationResult['diagnosisEvidence'],
) => unknown;

const ProblemEvaluationBridge: React.FC<{
  index: number;
  instanceId: string;
  problem: ProblemData;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
  register: (index: number, submit: BridgeSubmit) => void;
}> = ({ index, instanceId, problem, exhibitId, onEvaluationSubmit, register }) => {
  const p = problem as any;
  const { submitResult } = usePrimitiveEvaluation<KnowledgeCheckJudgedMetrics>({
    primitiveType: 'knowledge-check',
    instanceId,
    skillId: p.skillId,
    subskillId: p.subskillId,
    objectiveId: p.objectiveId,
    exhibitId,
    contentSubject: p.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });
  useEffect(() => {
    register(index, submitResult as BridgeSubmit);
  }, [register, index, submitResult]);
  return null;
};

// ─── The judged surface ──────────────────────────────────────────────────────

const KnowledgeCheckJudged: React.FC<{
  problems: ProblemData[];
  items: KnowledgeCheckItem[];
  instanceId: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}> = ({ problems, items, instanceId, exhibitId, onEvaluationSubmit }) => {
  const preReader = useMemo(
    () => problems.some((p) => isPreReaderGrade((p as any).gradeLevel)),
    [problems],
  );
  const gradeLevel = (problems[0] as any)?.gradeLevel || 'elementary';

  // ── Per-problem submission bridges ────────────────────────────────────────
  const bridgesRef = useRef(new Map<number, BridgeSubmit>());
  const registerBridge = useCallback((index: number, submit: BridgeSubmit) => {
    bridgesRef.current.set(index, submit);
  }, []);

  const [finished, setFinished] = useState(false);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const byProblem = new Map<number, typeof summary.outcomes>();
    for (const outcome of summary.outcomes) {
      const item = itemById.get(outcome.id);
      if (!item) continue;
      byProblem.set(item.problemIndex, [...(byProblem.get(item.problemIndex) ?? []), outcome]);
    }
    let evidenceAttached = false;
    problems.forEach((problem, index) => {
      const outcomes = byProblem.get(index) ?? [];
      const kinds = Array.from(new Set(
        items.filter((i) => i.problemIndex === index).map((i) => i.kind),
      ));
      const solved = outcomes.filter((o) => o.solved).length;
      const corrections = outcomes.reduce((sum, o) => sum + o.corrections, 0);
      const accuracy = outcomes.length
        ? Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length)
        : 0;
      const success = outcomes.length > 0 && solved === outcomes.length;
      const metrics: KnowledgeCheckJudgedMetrics = {
        type: 'knowledge-check-judged',
        problemType: problem.type,
        itemKinds: kinds,
        itemsTotal: outcomes.length,
        itemsSolved: solved,
        corrections,
        accuracy,
        firstTryCount: outcomes.filter((o) => o.solved && o.corrections === 0).length,
      };
      // Run-level Tier-A evidence rides the first unsuccessful problem.
      const attachEvidence = !success && !evidenceAttached && summary.diagnosisEvidence;
      if (attachEvidence) evidenceAttached = true;
      bridgesRef.current.get(index)?.(
        success,
        accuracy,
        metrics,
        { itemResults: outcomes },
        undefined,
        attachEvidence ? summary.diagnosisEvidence : undefined,
      );
    });
    setFinished(true);
  }, [items, problems]);

  // ── Stage-payload state (the runner owns progression; this is the page) ───
  /** Post-answer only (answer-leak rule). Keyed to the AFFIRMED item so the
   *  next item's menu can never pre-highlight during the affirmation tail.
   *  NOT cleared in `onItemOpened` (18b); `runner.revealHeld` is the gate. */
  const [reveal, setReveal] = useState<{ itemId: string; text: string } | null>(null);
  /** Sort items the tutor has AFFIRMED into their group — the microstep's
   *  board building up. Files only after the verdict, never before. */
  const [filed, setFiled] = useState<Record<string, { focus: string; group: string; problemIndex: number }>>({});
  /** choice_tap: which option the child committed (pre-verdict selection). */
  const [tappedId, setTappedId] = useState<string | null>(null);

  const revealTextFor = (item: KnowledgeCheckItem): string => {
    switch (item.kind) {
      case 'true_false': return item.correctBool ? 'True' : 'False';
      case 'blank': return item.answerWord ?? '';
      default: return correctOptionText(item);
    }
  };

  // ── The pack — everything the TUTOR is told lives in the shared cue
  //    surface (knowledgeCheckScript.ts), which the DI drive harness reads
  //    too. Only what the SCREEN owns stays here.
  const pack = useMemo<JudgedScriptPack<KnowledgeCheckItem>>(() => ({
    ...knowledgeCheckPackBase(items),
    statusLines: {
      ready: (item) => item.kind === 'choice_tap'
        ? 'Listen, then touch the one you pick.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.kind === 'choice_tap'
        ? 'Have another look — touch the one you pick.'
        : 'Have another go — say your answer.',
      noVerdict: () => 'One more time — say it out loud.',
      affirmedNext: 'Yes! Next question.',
      done: 'Great thinking today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: `${item.kind}: ${item.prompt}${item.focusText ? ` (${item.focusText})` : ''}`,
      expected: revealTextFor(item),
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const runner = useJudgedScriptRunner<KnowledgeCheckItem>({
    pack,
    instanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => {
      setReveal({ itemId: item.id, text: revealTextFor(item) });
      if (item.kind === 'sort') {
        setFiled((prev) => ({
          ...prev,
          [item.id]: {
            focus: item.focusText ?? '',
            group: correctOptionText(item),
            problemIndex: item.problemIndex,
          },
        }));
      }
    },
    onItemOpened: () => {
      // Interaction state only — the reveal payload deliberately survives
      // this callback (18b).
      setTappedId(null);
    },
    onCorrectionRetry: () => {
      setTappedId(null);
    },
  });

  const currentItem = runner.currentItem;

  const handleTapChoice = (item: KnowledgeCheckItem, optionId: string, index: number) => {
    if (!runner.canAttempt || item.answerKind !== 'gesture') return;
    if (runner.isAwaitingGesture()) return;
    setTappedId(optionId);
    // The match is CODE-COMPUTED; the cue tells the tutor which line to say.
    runner.submitGestureAttempt(tapVerdictCue(item, index));
  };

  // ── Phase summary — `solved` is not `solved alone` ────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!finished) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: item.focusText ? `${item.focusText} — ${item.prompt}` : item.prompt,
      icon: ITEM_ICONS[item.kind],
    }));
  }, [finished, runner.summary, items]);

  // ── Stage renderers ───────────────────────────────────────────────────────

  const menuCard = (
    item: KnowledgeCheckItem,
    option: { id: string; text: string; emoji?: string },
    index: number,
  ) => {
    const isTarget = option.id === item.correctOptionId;
    const showAsAnswer = runner.revealHeld && reveal?.itemId === item.id && isTarget;
    const isTapKind = item.kind === 'choice_tap';
    const tapped = isTapKind && tappedId === option.id;
    const surface = `flex min-h-[6rem] flex-col items-center justify-center gap-2 rounded-xl border-2 p-4
      text-center transition-all duration-200
      ${showAsAnswer
        ? 'border-emerald-400/60 bg-emerald-500/15 ring-2 ring-emerald-400/40'
        : tapped
          ? 'border-blue-400/60 bg-blue-500/15'
          : 'border-white/10 bg-slate-800/40'}`;
    const inner = (
      <>
        {option.emoji && <span className="text-4xl leading-none" aria-hidden>{option.emoji}</span>}
        <span className={`${preReader ? 'text-lg' : 'text-sm'} text-slate-100`}>{option.text}</span>
      </>
    );
    // Spoken kinds: the menu is a list to read from, NOT buttons — nothing
    // here commits an answer (the ruled decodable-reader fork). The one tap
    // kind commits a POINT.
    return isTapKind ? (
      <button
        key={option.id}
        type="button"
        disabled={!runner.canAttempt}
        onClick={() => handleTapChoice(item, option.id, index)}
        className={`${surface} ${runner.canAttempt ? 'cursor-pointer hover:border-white/25' : 'opacity-80'}`}
      >
        {inner}
      </button>
    ) : (
      <li key={option.id} className={surface}>
        {inner}
      </li>
    );
  };

  const renderStage = (item: KnowledgeCheckItem) => {
    const prompt = (
      <p className={`${preReader ? 'text-2xl' : 'text-xl'} font-semibold leading-snug text-white text-center`}>
        {item.kind === 'match'
          ? `What goes with ${item.focusText}?`
          : item.kind === 'sort'
            ? item.prompt || 'Which group does it go in?'
            : item.prompt}
      </p>
    );

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-slate-900/50 p-6">
          {prompt}
          {/* The focus card — the thing being sorted or matched. */}
          {(item.kind === 'sort' || item.kind === 'match') && (
            <div className={`mt-4 flex justify-center ${motion.reveal}`} key={item.id}>
              <div className="px-8 py-4 bg-white/5 border border-white/15 rounded-2xl">
                <span className="text-2xl md:text-3xl font-bold text-white">{item.focusText}</span>
              </div>
            </div>
          )}
          {/* blank: the printed sentence, gap visible; the answer prints only
              on the reveal. The word bank below is the closed set. */}
          {item.kind === 'blank' && (
            <div className="mt-3 text-center">
              {runner.revealHeld && reveal?.itemId === item.id && (
                <div className={`text-3xl font-black text-emerald-300 ${motion.pop}`}>{item.answerWord}</div>
              )}
              {!!item.wordBank?.length && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {item.wordBank.map((word) => (
                    <span key={word} className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/20 text-slate-200 text-sm">
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* true_false: the two verdict cards are the printed menu. */}
          {item.kind === 'true_false' && (
            <div className="mt-4 grid grid-cols-2 gap-4 max-w-md mx-auto">
              {[{ id: 'true', label: 'True', icon: '✓', isIt: item.correctBool === true },
                { id: 'false', label: 'False', icon: '✗', isIt: item.correctBool === false }].map((v) => (
                <div
                  key={v.id}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all duration-200 ${
                    runner.revealHeld && reveal?.itemId === item.id && v.isIt
                      ? 'border-emerald-400/60 bg-emerald-500/15 ring-2 ring-emerald-400/40'
                      : 'border-white/10 bg-slate-800/40'
                  }`}
                >
                  <span className="text-3xl" aria-hidden>{v.icon}</span>
                  <span className="text-lg font-bold text-slate-100">{v.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The menu — options / partners / groups. */}
        {(item.kind === 'choice' || item.kind === 'choice_tap' || item.kind === 'match') && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(item.options ?? []).map((option, i) => menuCard(item, option, i))}
          </ul>
        )}
        {item.kind === 'sort' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(item.options ?? []).map((group) => {
              const chips = Object.values(filed).filter(
                (f) => f.problemIndex === item.problemIndex && f.group === group.text,
              );
              const isAnswer = runner.revealHeld && reveal?.itemId === item.id
                && group.id === item.correctOptionId;
              return (
                <LuminaPanel
                  key={group.id}
                  className={`min-h-[110px] transition-all duration-200 ${
                    isAnswer ? 'ring-2 ring-emerald-400/40 border-emerald-400/50' : ''
                  }`}
                >
                  <h4 className="text-base font-bold text-blue-400 mb-2 text-center">{group.text}</h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    {chips.map((chip) => (
                      <span key={chip.focus} className="px-3 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-slate-200 text-sm">
                        {chip.focus} <span className="text-emerald-400">✓</span>
                      </span>
                    ))}
                  </div>
                </LuminaPanel>
              );
            })}
          </div>
        )}

        {/* The reward — the affirmed answer, visible for exactly as long as
            the tutor is saying it (revealHeld, 18b). */}
        {reveal && runner.revealHeld && (
          <div className="text-center">
            <span className={`inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 font-bold ${motion.pop}`}>
              ✓ {reveal.text}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-12 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20 relative">
        {!preReader && (
          <div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
            <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
              Knowledge Check — Out Loud
            </span>
            {items.length > 1 && !finished && (
              <LuminaChallengeCounter
                variant="dots"
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
              />
            )}
          </div>
        )}

        <div className="p-6 md:p-10 space-y-5">
          {!finished && currentItem && renderStage(currentItem)}

          {!finished && (
            <JudgedMicPanel run={runner} gestureLabel="Your turn — touch the one you pick">
              <button
                onClick={runner.hearStimulus}
                disabled={!runner.running}
                className={`text-xs text-blue-300/80 underline underline-offset-4 disabled:opacity-30 ${
                  runner.stimulusTapped ? 'opacity-50' : ''
                }`}
              >
                Say that again
              </button>
            </JudgedMicPanel>
          )}

          {finished && phaseResults.length > 0 && (
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={runner.summary?.accuracy}
              heading={preReader ? '🎉 You did it!' : '🎉 Knowledge check complete'}
              celebrationMessage={`You answered ${runner.summary?.firstTryCount ?? 0} of ${items.length} on the first try.`}
            />
          )}
        </div>
      </div>

      {/* Hidden per-problem evaluation bridges (R7/R8). */}
      {problems.map((problem, index) => (
        <ProblemEvaluationBridge
          key={index}
          index={index}
          instanceId={`${instanceId}::p${index}`}
          problem={problem}
          exhibitId={exhibitId}
          onEvaluationSubmit={onEvaluationSubmit}
          register={registerBridge}
        />
      ))}
    </div>
  );
};

// ─── Entry: the fork ─────────────────────────────────────────────────────────

export const KnowledgeCheck: React.FC<KnowledgeCheckProps> = ({ data }) => {
  const problems: ProblemData[] = useMemo(() => {
    if (isLegacyKnowledgeCheck(data)) {
      return [{
        type: 'multiple_choice' as const,
        id: 'legacy_mc_1',
        difficulty: 'medium' as const,
        gradeLevel: 'elementary',
        question: data.question,
        visual: data.visual,
        options: data.options,
        correctOptionId: data.correctAnswerId,
        rationale: data.explanation,
        teachingNote: '',
        successCriteria: [],
      }];
    }
    if (isProblemRegistryFormat(data)) {
      return data.problems;
    }
    return [];
  }, [data]);

  const instanceId = useMemo(
    () => ('instanceId' in data ? data.instanceId : undefined) || `knowledge-check-${Date.now()}`,
    [data],
  );
  const exhibitId = 'exhibitId' in data ? data.exhibitId : undefined;
  const onEvaluationSubmit =
    'onEvaluationSubmit' in data ? data.onEvaluationSubmit : undefined;

  const build = useMemo(() => itemsFromProblems(problems), [problems]);

  useEffect(() => {
    if (build.judgedViable && build.dropped > 0) {
      console.warn(
        `[KnowledgeCheck] judged build dropped ${build.dropped} item(s) (leak / sentinel / `
        + 'ear-separability / answered-once / session-cap gates)',
      );
    }
  }, [build]);

  // Same render-time probe JudgedMicPanel runs — a surface with no usable
  // microphone renders the tap flow rather than a dead orb.
  const micSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  if (!build.judgedViable || !micSupported || problems.length === 0) {
    return <KnowledgeCheckTapFlow data={data} />;
  }

  return (
    <KnowledgeCheckJudged
      problems={problems}
      items={build.items}
      instanceId={instanceId}
      exhibitId={exhibitId}
      onEvaluationSubmit={onEvaluationSubmit}
    />
  );
};
