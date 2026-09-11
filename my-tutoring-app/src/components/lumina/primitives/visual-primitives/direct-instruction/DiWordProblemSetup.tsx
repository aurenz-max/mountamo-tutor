'use client';

/**
 * DiWordProblemSetup — the "name the problem, build the family" pack (design
 * brief 2026-09-07 "DI for Older Learners", concept 4), and the family's first
 * math pack to MIX hands and voice inside one problem.
 *
 * WHAT THE CHILD DOES. Sees the story printed. The tutor reads it, then asks
 * one step at a time. The entry mode asks for one big-amount placement; family
 * modes ask the child to build small + small = big by dragging all three story
 * parts WITH THEIR HANDS. The setup commits on stillness. Then, where the mode
 * calls for it, the child reads the family aloud, chooses an operation, and solves.
 * The tutor's affirmation advances; correction lands where the error happened.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every affirmed step draws
 * itself: the three story parts lock into the family, the sign appears, the
 * answer fills the box, and the bar
 * model grows underneath. Nothing the child must say or place is drawn before
 * they do it (answer-leak rule), which is why every mark is keyed to affirmed
 * item ids and never derived from the plan alone.
 *
 * A MOVE-ON CARRIES THE STEP. When the correction cap closes a step, the tutor
 * states it ("The big number is Jen's stickers.") and the page draws it as
 * CARRIED, dimmer than the child's own marks — otherwise "Say the family" would
 * refer to a big number the page never placed.
 *
 * Everything else is the family's: `useJudgedScriptRunner` owns the run, the
 * mic, progression, the correction cap, the stillness window and context sync;
 * the script module owns every spoken line and judging contract.
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
  LuminaChip,
  LuminaDropZone,
  type DropZoneState,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type {
  DiWordProblemSetupMetrics,
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
import { SoundManager } from '../../../utils/SoundManager';
import { SHAPE_WORD, type Quantity } from './diWordProblemPlan';
import {
  bigNumberVerdictCue,
  diWordProblemSetupPackBase,
  itemsFromProblems,
  type DiWordProblemSetupData,
  type WordProblemChallengeType,
  type WordProblemItem,
  type WordProblemStepKind,
} from './diWordProblemScript';

export type {
  DiWordProblemSetupData,
  WordProblemChallengeType,
  WordProblemItem,
  WordProblemProblemSpec,
  WordProblemSupportTier,
} from './diWordProblemScript';

/** Stillness that commits a completed hands action. The window is short enough
 *  to revise a placement and never acts like a Check button in costume. */
const BIG_SETTLE_MS = 1800;

/** Misconception Loop S1 — the task identity, named so a distilled sentence
 *  stays self-limiting under this pack's primitive-scoped key. */
const TASK_PHRASE: Record<WordProblemChallengeType, string> = {
  find_big_number: 'finding the big number of an addition or subtraction story, then working it',
  build_family: 'building the number family, reading it, choosing the operation, then working it',
  classify_and_build: 'naming the story kind, building the number family, reading it, choosing the operation, then working it',
};

type Mark = 'child' | 'tutor' | null;
type FamilySlot = 'small1' | 'small2' | 'big';
type FamilyPlacements = Record<FamilySlot, string | null>;

const emptyFamilyPlacements = (): FamilyPlacements => ({
  small1: null,
  small2: null,
  big: null,
});

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — generated data arrives as ONE `data`
 *  prop with the evaluation props merged in, never spread. */
export const DiWordProblemSetup: React.FC<{
  data: DiWordProblemSetupData & {
    onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiWordProblemSetupMetrics>) => void;
  };
  index?: number;
}> = ({ data }) => {
  // The SAME builder the drive harness calls, so what drops here drops there.
  const built = useMemo(() => itemsFromProblems(data.problems ?? []), [data.problems]);
  const items = built.items;

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-word-problem-setup-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<DiWordProblemSetupMetrics>({
      primitiveType: 'di-word-problem-setup',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      componentIntent: data.componentIntent,
      objectiveText: data.objectiveText,
      onSubmit: data.onEvaluationSubmit,
    });

  // ── What the page has drawn ───────────────────────────────────────────────
  // `committed` = steps the CHILD got affirmed; `carried` = steps the tutor
  // stated on a move-on. Both render; the second dimmer. Refs mirror the sets
  // because the runner's callbacks fire inside its own dispatch.
  const [committed, setCommitted] = useState<Set<string>>(() => new Set());
  const [carried, setCarried] = useState<Set<string>>(() => new Set());
  const committedRef = useRef<Set<string>>(new Set());
  const carriedRef = useRef<Set<string>>(new Set());
  /** The step just affirmed — the reveal-hold reads its problem, so a finished
   *  problem stays on screen while the tutor is still closing it. */
  const [lastAffirmed, setLastAffirmed] = useState<WordProblemItem | null>(null);

  // ── The placement board (the ONE hands step) ──────────────────────────────
  const placementsRef = useRef<FamilyPlacements>(emptyFamilyPlacements());
  const [placements, setPlacements] = useState<FamilyPlacements>(emptyFamilyPlacements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<FamilySlot | null>(null);

  const resetBoard = useCallback(() => {
    placementsRef.current = emptyFamilyPlacements();
    setPlacements(emptyFamilyPlacements());
    setSelectedId(null);
    setDragOver(null);
  }, []);

  const handleAffirmed = useCallback((item: WordProblemItem) => {
    committedRef.current = new Set(committedRef.current).add(item.id);
    setCommitted(committedRef.current);
    setLastAffirmed(item);
  }, []);

  const handleItemOpened = useCallback((item: WordProblemItem) => {
    resetBoard();
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
  }, [items, resetBoard]);

  // ── The pack ──────────────────────────────────────────────────────────────
  const pack = useMemo<JudgedScriptPack<WordProblemItem>>(() => ({
    ...diWordProblemSetupPackBase(items),
    statusLines: {
      ready: (item) => item.actionContract.instruction,
      retry: (item) => `Have another go. ${item.actionContract.instruction}`,
      noVerdict: () => 'One more time — say it again.',
      affirmedNext: 'Yes! On to the next step.',
      affirmedLast: 'You set up every problem!',
      done: 'Great word-problem work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge:
        `Direct Instruction word-problem setup — ${TASK_PHRASE[item.challengeType]}. `
        + `Story: ${item.plan.story} Step: ${item.actionContract.label}.`,
      expected: item.kind === 'big_number' ? item.plan.big.label : item.answerSpoken,
      observed: item.kind === 'big_number'
        ? `${item.challengeType === 'find_big_number' ? 'Placed' : 'Built the family with'} "${item.plan.quantities.find((x) => x.id === placementsRef.current.big)?.label ?? 'nothing'}" in the big-amount slot.`
        : lastHeard
          ? `Heard "${lastHeard}".`
          : 'The tutor judged the step wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const ofKind = (kind: WordProblemStepKind) =>
      new Set(items.filter((it) => it.kind === kind).map((it) => it.id));
    const bigIds = ofKind('big_number');
    const familyIds = ofKind('family');
    const bigOutcomes = summary.outcomes.filter((o) => bigIds.has(o.id));
    const familyOutcomes = summary.outcomes.filter((o) => familyIds.has(o.id));
    const timed = summary.outcomes.filter((o) => o.seconds != null);
    const metrics: DiWordProblemSetupMetrics = {
      type: 'di-word-problem-setup',
      challengeType: data.challengeType,
      // The mode rides the submission (`evaluationApi` sends `eval_mode: 'default'`
      // without it), so retrieval runs the mode-scoped query and the β priors in
      // `problem_type_registry.py` are reached — the /curriculum-fit 2026-09-10
      // finding, the DiShapes/DiMathFacts shape.
      evalMode: data.challengeType,
      totalChallenges: summary.outcomes.length,
      problemCount: new Set(items.map((it) => it.problemId)).size,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
      bigNumberStepsTotal: bigOutcomes.length,
      bigNumberStepsCorrect: bigOutcomes.filter((o) => o.solved).length,
      familyStepsTotal: familyOutcomes.length,
      familyStepsCorrect: familyOutcomes.filter((o) => o.solved).length,
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

  const runner = useJudgedScriptRunner<WordProblemItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel || 'Grade 2',
    exhibitId: data.exhibitId,
    onFinished: handleFinished,
    onAffirmed: handleAffirmed,
    onItemOpened: handleItemOpened,
    onCorrectionRetry: () => resetBoard(),
  });

  const current = runner.currentItem;

  // ── Hands: place, remove, and the stillness close ─────────────────────────
  /** Called by the runner's stillness window once the placement has sat still.
   *  Reads the board through the ref, at fire time. */
  const commitPlacement = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'big_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    const board = placementsRef.current;
    const complete = item.challengeType === 'find_big_number'
      ? !!board.big
      : !!board.small1 && !!board.small2 && !!board.big;
    if (!complete) return;
    const id = board.big;
    if (!id) return;
    runner.submitGestureAttempt(bigNumberVerdictCue(item, id));
  }, [runner]);

  /** Drop a card into a slot, or tap the card and then the slot. The focused
   *  find mode closes after one big-amount placement; family modes close only
   *  after all three roles have been constructed. */
  const handlePlace = useCallback((id: string, slot: FamilySlot) => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'big_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    if (!item.plan.quantities.some((x) => x.id === id)) return;

    const next = { ...placementsRef.current };
    (Object.keys(next) as FamilySlot[]).forEach((key) => {
      if (next[key] === id) next[key] = null;
    });
    next[slot] = id;
    placementsRef.current = next;
    setPlacements(next);
    setSelectedId(null);
    setDragOver(null);
    SoundManager.select();
    runner.clearStillness();
    const complete = item.challengeType === 'find_big_number'
      ? !!next.big
      : !!next.small1 && !!next.small2 && !!next.big;
    if (complete) {
      runner.armStillness(commitPlacement, BIG_SETTLE_MS);
    }
    // `armStillness`/`clearStillness` are identity-stable; `runner` is not, but
    // this is an event handler, never an effect dep.
  }, [runner, commitPlacement]);

  /** Tap the placed chip → it returns to the bank. Starting over is thinking. */
  const handleRemove = useCallback((slot: FamilySlot) => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'big_number') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    if (!placementsRef.current[slot]) return;
    const next = { ...placementsRef.current, [slot]: null };
    placementsRef.current = next;
    setPlacements(next);
    setSelectedId(null);
    SoundManager.tap();
    runner.clearStillness();
  }, [runner]);

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
      label: `Story ${it.problemIndex + 1} · ${it.actionContract.label}`,
      icon: it.actionContract.icon,
    }));
  }, [hasSubmitted, runner.summary, items]);

  // ── The stage: the story, the family arrow, the bar model ─────────────────
  const renderStage = () => {
    if (shownSteps.length === 0) return null;
    const plan = shownSteps[0].plan;
    const stepOf = (kind: WordProblemStepKind) => shownSteps.find((it) => it.kind === kind);
    const mark = (kind: WordProblemStepKind): Mark => {
      const it = stepOf(kind);
      if (!it) return null;
      return committed.has(it.id) ? 'child' : carried.has(it.id) ? 'tutor' : null;
    };
    const classifyMark = mark('classify');
    const bigMark = mark('big_number');
    const familyMark = mark('family');
    const operationMark = mark('operation');
    const solveMark = mark('solve');

    const tone = (m: Mark) => (m === 'child' ? 'text-emerald-300' : m === 'tutor' ? 'text-amber-200/80' : 'text-slate-500');
    const isBigStep = current?.kind === 'big_number' && current.problemId === shownProblemId;
    const live = isBigStep && runner.canAttempt && !runner.isAwaitingGesture();
    const focusedBigMode = shownSteps[0].challengeType === 'find_big_number';

    // While the child works, each story-part card occupies the slot where it
    // was dropped. Once affirmed, the canonical family remains on screen for
    // the read, choose, and solve steps.
    const quantityFor = (id: string | null): Quantity | null =>
      id ? plan.quantities.find((x) => x.id === id) ?? null : null;
    const atSlot = (slot: FamilySlot): Quantity | null => {
      if (bigMark) {
        if (slot === 'small1') return plan.small1;
        if (slot === 'small2') return plan.small2;
        return plan.big;
      }
      return quantityFor(placements[slot]);
    };
    const placedIds = new Set(Object.values(placements).filter(Boolean));
    const bank = plan.quantities.filter((x) => !placedIds.has(x.id));

    const valueOf = (x: Quantity): string => {
      if (x.known) return String(x.value);
      return solveMark ? String(plan.answer) : '?';
    };
    const zoneState = (slot: FamilySlot): DropZoneState => bigMark
      ? 'correct'
      : dragOver === slot ? 'dragOver' : atSlot(slot) ? 'filled' : 'idle';

    const chip = (x: Quantity, opts: { placedSlot?: FamilySlot } = {}) => (
      <LuminaChip
        key={x.id}
        state={opts.placedSlot ? (bigMark ? 'correct' : 'selected') : selectedId === x.id ? 'selected' : live ? 'idle' : 'dimmed'}
        draggable={live && !opts.placedSlot}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', x.id); e.dataTransfer.effectAllowed = 'move'; }}
        onClick={() => (opts.placedSlot ? handleRemove(opts.placedSlot) : setSelectedId(selectedId === x.id ? null : x.id))}
        disabled={!live}
        className={`min-w-[7rem] flex-col gap-0.5 px-3 py-2 ${opts.placedSlot && bigMark === 'tutor' ? 'opacity-70' : ''}`}
        aria-label={opts.placedSlot ? `${x.label}, in the ${opts.placedSlot} slot` : `Select ${x.label}`}
      >
        <span className="text-[11px] font-normal leading-tight text-slate-300">{x.label}</span>
        <span className="text-lg font-semibold leading-tight">{valueOf(x)}</span>
      </LuminaChip>
    );

    const familySlot = (slot: FamilySlot, label: string) => {
      const quantity = atSlot(slot);
      return (
        <div className="flex min-w-[8rem] flex-1 basis-32 flex-col items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${slot === 'big' ? 'text-cyan-300' : 'text-slate-400'}`}>
            {label}
          </span>
          <LuminaDropZone
            state={zoneState(slot)}
            className="min-h-[92px] w-full px-2 py-2"
            onClick={() => { if (selectedId) handlePlace(selectedId, slot); }}
            onDragOver={(e) => { if (live) { e.preventDefault(); setDragOver(slot); } }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              handlePlace(e.dataTransfer.getData('text/plain'), slot);
            }}
            emptyPrompt={(
              <span className="text-center text-xs font-normal text-slate-500">
                Drop a story part here
              </span>
            )}
            aria-label={`${label} drop zone`}
          >
            {quantity && chip(quantity, { placedSlot: slot })}
          </LuminaDropZone>
        </div>
      );
    };

    const storyPartBank = !bigMark && (
      <div className="mt-5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-3" aria-label="Story parts">
        <div className="mb-2 text-center text-xs font-medium text-cyan-200">
          {selectedId
            ? `Now tap the ${focusedBigMode ? 'big amount box' : 'matching space'} above`
            : `Drag a card, or tap a card then tap the ${focusedBigMode ? 'box' : 'matching space'}`}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {bank.map((x) => chip(x, {}))}
        </div>
      </div>
    );

    const operationSign = plan.operation === 'add' ? '+' : '−';
    const knownSmall = plan.small1.known ? plan.small1 : plan.small2;
    const equationLine = plan.operation === 'add'
      ? `${plan.small1.value} + ${plan.small2.value} = ${solveMark ? plan.answer : '▢'}`
      : `${plan.big.value} − ${knownSmall.value} = ${solveMark ? plan.answer : '▢'}`;

    return (
      <div className="space-y-5">
        {/* The story, printed. */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          {classifyMark && (
            <div className={`mb-2 text-[11px] uppercase tracking-[0.2em] ${tone(classifyMark)}`}>
              {SHAPE_WORD[plan.shape]} problem
            </div>
          )}
          <p className="text-lg leading-relaxed text-slate-100" aria-label="The story">{plan.story}</p>
          <div className="mt-3">
            <LuminaButton
              tone={runner.stimulusTapped ? 'primary' : 'subtle'}
              className="text-xs"
              onClick={runner.hearStimulus}
              disabled={!runner.running}
            >
              🔊 Hear the story again
            </LuminaButton>
          </div>
        </div>

        {focusedBigMode ? (
          /* The entry mode asks one honest question and gives it one target. */
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5" aria-label="Big amount builder">
            <div className="mb-1 text-center text-sm font-semibold text-slate-200">
              {bigMark ? 'The big amount' : 'Find the big amount'}
            </div>
            <p className="mb-5 text-center text-xs text-slate-400">
              The big amount is the whole amount — the one that has it all.
            </p>
            <div className="mx-auto max-w-[13rem]">
              {familySlot('big', 'big amount')}
            </div>
            {storyPartBank}
          </div>
        ) : (
          /* Family modes make the whole mathematical relationship visible. */
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5">
            <div className="mb-1 text-center text-sm font-semibold text-slate-200">
              {isBigStep ? 'Build the number family' : 'Your number family'}
            </div>
            <p className="mb-5 text-center text-xs text-slate-400">
              {isBigStep
                ? 'Put every story part in its role. The two small amounts make the big amount.'
                : familyMark
                  ? 'You read the setup. Now use it to finish the problem.'
                  : 'Read this setup out loud: small plus small equals big.'}
            </p>

            <div className="flex flex-wrap items-end justify-center gap-2" aria-label="Number family equation">
              {familySlot('small1', 'small amount')}
              <span className="pb-8 font-mono text-3xl text-cyan-200" aria-hidden="true">+</span>
              {familySlot('small2', 'small amount')}
              <span className="pb-8 font-mono text-3xl text-cyan-200" aria-hidden="true">=</span>
              {familySlot('big', 'big amount')}
            </div>

            {storyPartBank}

            {/* The operation and the working line — drawn as they are said. */}
            {operationMark && (
              <div className={`mt-4 text-center font-mono text-xl ${tone(operationMark)}`} aria-label="The working">
                <span className="mr-3 rounded-md border border-white/15 px-2 py-0.5 text-base">{operationSign}</span>
                {equationLine}
              </div>
            )}
          </div>
        )}

        {/* The bar model — grows underneath once the big number is placed. */}
        {bigMark && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4" aria-label="Bar model">
            <div className="mx-auto max-w-md space-y-2">
              <div className="flex h-10 items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 text-sm">
                <span className="text-slate-300">{plan.big.label}</span>
                <span className={`font-mono text-lg ${plan.big.known ? 'text-slate-100' : tone(solveMark)}`}>{valueOf(plan.big)}</span>
              </div>
              <div className="flex h-10 gap-1">
                {[plan.small1, plan.small2].map((x) => {
                  const known = plan.quantities.filter((y) => y.known && y.slot !== 'big');
                  const total = plan.big.value;
                  const width = x.known ? x.value : Math.max(1, total - known.reduce((s, y) => s + y.value, 0));
                  return (
                    <div
                      key={x.id}
                      className={`flex items-center justify-between overflow-hidden rounded-md border px-2 text-xs ${x.known ? 'border-white/15 bg-white/5' : 'border-dashed border-white/20'}`}
                      style={{ flexGrow: width, flexBasis: 0 }}
                    >
                      <span className="truncate text-slate-400">{x.label}</span>
                      <span className={`ml-1 font-mono text-base ${x.known ? 'text-slate-200' : tone(solveMark)}`}>
                        {familyMark || x.known ? valueOf(x) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="py-10 text-center">
          <p className="text-slate-300 text-sm">
            No word problems were built for this objective.
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
          <LuminaBadge accent="cyan" className="text-xs">Set it up</LuminaBadge>
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

            {renderStage()}

            <DiActionPanel
              run={runner}
              running={runner.running}
              stage={runner.stage}
              currentItem={current}
              steps={shownSteps}
              completedIds={committed}
              carriedIds={carried}
              startInstruction="Start the lesson, listen to the story, then follow each highlighted step."
            />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Word Problems Set Up!"
            celebrationMessage="You found the big number and said the family yourself."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiWordProblemSetup;
