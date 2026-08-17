'use client';

/**
 * WordSorter — DI modality (SEVENTEENTH literacy port, 2026-08-16). The Live
 * tutor owns the clock: it says the word, asks ONCE, waits, judges the child's
 * spoken answer from the audio in-band, corrects contrastively, and its OWN
 * affirmation is the advance. There is no advance timer, no Next button, no
 * push-to-talk mic, and no answer on screen before the tutor affirms.
 *
 * THE MODALITY, in one exchange:
 *
 *   "I say a word — you tell me which group it belongs with.
 *    Your turn. Listen: dog. Animals, or Food?"      → "Animals!"
 *   "Yes, dog belongs with Animals."
 *
 * WHAT WENT, AND WHY:
 *  - **Every tap.** The child tapped a bucket, or tapped a term and then its
 *    match. A child who cannot categorise at all could still tap correctly at a
 *    1-in-2 floor, be told instantly it was wrong, and re-tap until it landed —
 *    the tap produced no evidence of the skill, so it is a costume for the
 *    category NAME. All three modes are spoken now (`wordSorterScript.ts`).
 *  - **The shrinking match column.** It CONSUMED its entries, so the last pair
 *    of every challenge had exactly one option left and needed no reading at
 *    all. The bank is now printed whole for the whole challenge; what withdraws
 *    the elimination information is the `showFiledWords` tier lever, which is
 *    what that lever was always for.
 *  - **The Next Challenge button, the attempt badge, the feedback card and the
 *    bucket flash.** Corrections cap in the runner; the moveOn line names the
 *    answer so a capped word never ends up unplaced.
 *  - **Six improvised tutor sends** (`[ACTIVITY_START]`, `[WORD_STAGED]`,
 *    `[WORD_TAP]`, `[ANSWER_INCORRECT]` ×2, `[NEXT_ITEM]`, `[ALL_COMPLETE]`) and
 *    the `tutorRevealPolicy` prose that steered them. The cues carry the entire
 *    spoken surface; the support tier now rides the ASK (whether the groups are
 *    named aloud) instead of a paragraph of improvisation licence.
 *  - **The printed instruction sentence.** The tutor's opening line IS the
 *    instruction now (SWAP-1). Two instruction channels is what the click era
 *    had.
 *
 * WHAT STAYED — the PAGE, never the voice:
 *  - The mats, their labels and their picture cues. A sort whose groups are not
 *    knowable is a broken task, not a harder one.
 *  - The word card and its emoji: the stimulus, and the pre-reader's only way in.
 *  - The word bank, the tier decoys and the filed-word badges.
 *  - Tap-to-hear, which re-speaks the QUESTION and is never withdrawn.
 *
 * Cue lines, judging contracts and build gates live in `wordSorterScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaDropZone,
  LuminaReadAloudGlyph,
  type DropZoneState,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordSorterMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  itemsFromChallenges,
  wordSorterPackBase,
  type WordSorterItem,
  type WordSorterMode,
  type WordSorterTier,
} from './wordSorterScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface WordCard {
  id: string;
  word: string;
  emoji?: string;
  correctBucket: string;
}

export interface MatchPair {
  id: string;
  term: string;
  termEmoji?: string;
  match: string;
  matchEmoji?: string;
}

/** A non-answer entry in the word bank (support-tier answer-form lever). Under
 *  the judged loop it raises DISCRIMINATION load only: the bank never shrinks,
 *  so a decoy can neither shorten the challenge nor be eliminated by counting. */
export interface DistractorMatch {
  id: string;
  text: string;
  emoji?: string;
}

export interface WordSorterChallenge {
  id: string;
  type: WordSorterMode;
  instruction: string;
  bucketLabels?: string[];
  /** Optional emoji per bucket, index-aligned with bucketLabels. */
  bucketEmojis?: string[];
  words?: WordCard[];
  pairs?: MatchPair[];
  /** match_pairs: how the partner relates to the term ("opposite", "plural"…).
   *  It is what lets the ask be a question rather than a shrug. */
  relationLabel?: string;

  // ── Within-mode support tier scaffolds (stamped by the generator from
  //    config.difficulty). ALL OPTIONAL: absent ⇒ the full-help render. ──
  /** #1 perception — the picture cue on each mat. Forced on at K (band floor). */
  showBucketEmojis?: boolean;
  /** #1 perception — the badges of words already placed. Withdrawn at hard,
   *  which is also what withdraws the elimination information from a match. */
  showFiledWords?: boolean;
  /** #2 instruction — whether the ASK names the groups aloud. Forced true at K:
   *  a pre-reader cannot read a mat, so an unnamed group is unanswerable. */
  namesSortCriterion?: boolean;
  /** #5 answer-form (match_pairs) — extra non-answer entries in the bank. */
  distractorMatches?: DistractorMatch[];
}

export interface WordSorterData {
  title: string;
  description?: string;
  gradeLevel: string;
  sortingTopic: string;
  /** Within-mode support tier from the manifest. Drives the DISTAR lead-in and
   *  whether the ask names the groups. */
  supportTier?: WordSorterTier;
  challenges: WordSorterChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordSorterMetrics>) => void;
}

interface WordSorterProps {
  data: WordSorterData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type WordSorterAccent = NonNullable<PhaseResult['accentColor']>;

const MODE_META: Record<
  WordSorterMode,
  { label: string; icon: string; accent: WordSorterAccent }
> = {
  binary_sort: { label: 'Two Groups', icon: '📂', accent: 'purple' },
  ternary_sort: { label: 'Three Groups', icon: '🗂️', accent: 'blue' },
  match_pairs: { label: 'Find the Partner', icon: '🔗', accent: 'emerald' },
};

const MAT_COLORS = ['text-violet-300', 'text-sky-300', 'text-emerald-300'];

// ============================================================================
// Component
// ============================================================================

const WordSorter: React.FC<WordSorterProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel = 'K',
    supportTier,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const isPreReader = gradeLevel === 'K';

  const stableInstanceIdRef = useRef(instanceId || `word-sorter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<WordSorterItem[]>(
    () => itemsFromChallenges(challenges, { tier: supportTier, isPreReader }),
    [challenges, supportTier, isPreReader],
  );

  /**
   * The affirmed item's reveal payload. Set on the affirm and rendered behind
   * `runner.revealHeld` — NOT `currentSolved` and NOT `stage`, and deliberately
   * never cleared in `onItemOpened` (18b): the runner opens the next item in the
   * SAME dispatch as the affirmation, so both of the obvious gates are already
   * false by render time and a payload cleared there paints on the last item and
   * nowhere else.
   */
  const [reveal, setReveal] = useState<{
    challengeId: string;
    word: string;
    answer: string;
  } | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<WordSorterMetrics>({
    primitiveType: 'word-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: WordSorterMetrics = {
      type: 'word-sorter',
      sortingAccuracy: summary.accuracy,
      attemptsCount: summary.attemptsCount,
      wordsProcessed: items.length,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items.length, evaluation]);

  // ── The pack — wording lives in wordSorterScript.ts ────────────────────────
  const pack = useMemo<JudgedScriptPack<WordSorterItem>>(() => ({
    ...wordSorterPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to start sorting.',
      ready: () => 'Listen to the word — then say your answer.',
      retry: () => 'Have another go — say your answer out loud.',
      noVerdict: () => 'One more time — say your answer out loud.',
      done: 'Great sorting today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard?.trim() ?? '';
      return {
        challenge: item.mode === 'match_pairs'
          ? `Hear a word, then say the word on screen that goes with it: "${item.word}"`
          : `Hear a word, then say which group it belongs with: "${item.word}"`,
        expected: `"${item.answer}" said out loud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<WordSorterItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => setReveal({
      challengeId: item.challengeId,
      word: item.word,
      answer: item.answer,
    }),
  });

  const currentItem = runner.currentItem;
  const modeMeta = MODE_META[currentItem?.mode ?? 'binary_sort'];

  /**
   * The words this challenge has already placed — the surviving `showFiledWords`
   * lever. Read off the runner's solved ledger rather than a local map, so the
   * only thing that can put a word on a mat is a tutor affirmation.
   */
  const placedByChoice = useMemo(() => {
    const map = new Map<string, WordSorterItem[]>();
    if (!currentItem) return map;
    for (const item of items) {
      if (item.challengeId !== currentItem.challengeId) continue;
      if (!runner.solvedIds.has(item.id)) continue;
      map.set(item.answer, [...(map.get(item.answer) ?? []), item]);
    }
    return map;
  }, [items, currentItem, runner.solvedIds]);

  /** The mat/bank entry the tutor is affirming right now, for the reveal ring.
   *  Guarded on the challenge: by render time the surface may already point at
   *  the next challenge's mats, and highlighting one of those would be wrong. */
  const revealedChoice =
    runner.revealHeld && reveal && reveal.challengeId === currentItem?.challengeId
      ? reveal.answer
      : null;

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: MODE_META[item.mode].label,
      icon: MODE_META[item.mode].icon,
      accentColor: MODE_META[item.mode].accent,
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These sorting words are still being written. Try generating them again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /** The mats — printed material, never an answer surface. Nothing here is
   *  clickable: the child says the group out loud. */
  const renderMats = (item: WordSorterItem) => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? [];
        const isRevealed = revealedChoice === label;
        const zoneState: DropZoneState = isRevealed
          ? 'correct'
          : placed.length > 0
            ? 'filled'
            : 'idle';
        return (
          <div key={label} className="w-full">
            <div className="mb-3 flex flex-col items-center gap-1">
              {item.showChoiceEmojis && item.choiceEmojis[idx] && (
                <span className="text-4xl leading-none">{item.choiceEmojis[idx]}</span>
              )}
              <h3
                className={`font-bold text-center ${MAT_COLORS[idx] ?? MAT_COLORS[0]} ${
                  isPreReader ? 'text-lg' : 'text-sm'
                }`}
              >
                {label}
              </h3>
            </div>
            <LuminaDropZone
              state={zoneState}
              className="min-h-[104px] pointer-events-none content-center justify-center"
            >
              {item.showFiledWords
                ? placed.map((p) => (
                  <LuminaBadge
                    key={p.id}
                    className={`bg-white/10 border-white/10 text-slate-200 ${
                      isPreReader ? 'text-base' : 'text-xs'
                    }`}
                  >
                    {p.emoji && <span className="mr-1">{p.emoji}</span>}
                    {p.word}
                  </LuminaBadge>
                ))
                // Hard tier: the exemplars are withheld so the criterion cannot
                // be read off what is already placed. PROGRESS is not — an
                // anonymous count keeps the "words landed here" feedback.
                : placed.length > 0 && (
                  <LuminaBadge
                    aria-label={`${placed.length} words placed here`}
                    className="bg-white/10 border-white/10 text-slate-300 text-xs"
                  >
                    {placed.length}
                  </LuminaBadge>
                )}
            </LuminaDropZone>
          </div>
        );
      })}
    </div>
  );

  /**
   * The word bank — printed WHOLE for the whole challenge and never consumed.
   * A shrinking bank made the last pair of every challenge answerable with no
   * reading at all; keeping every entry keeps the discrimination constant, and
   * the tier decoys sit in the same list, indistinguishable from real partners.
   */
  const renderBank = (item: WordSorterItem) => (
    <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      {item.choices.map((text, idx) => (
        <span
          key={text}
          className={`
            inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors
            ${revealedChoice === text
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : 'bg-white/5 border-white/15 text-slate-200'}
          `}
        >
          {item.choiceEmojis[idx] && <span className="mr-1.5">{item.choiceEmojis[idx]}</span>}
          {text}
        </span>
      ))}
    </div>
  );

  /** What has already been paired. Gated on the same tier lever as the mat
   *  badges: at hard it goes, which is what withdraws the elimination
   *  information from a bank that deliberately never shrinks. */
  const renderPaired = (item: WordSorterItem) => {
    const paired = items.filter(
      (i) => i.challengeId === item.challengeId && runner.solvedIds.has(i.id),
    );
    if (!item.showFiledWords || paired.length === 0) return null;
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {paired.map((p) => (
          <LuminaBadge key={p.id} accent="emerald" className="text-xs">
            {p.word} → {p.answer}
          </LuminaBadge>
        ))}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && !isPreReader && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — the question again, never a hint ladder, and
                  never withdrawn by band or tier. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {currentItem && (
              <>
                {/* The stimulus card. The word is the QUESTION in every mode —
                    the answer is a group name or a bank word — so printing it
                    leaks nothing, and its picture is the pre-reader's way in. */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-white/15 bg-white/5 px-10 py-6">
                    {currentItem.emoji && (
                      <span className="text-7xl leading-none">{currentItem.emoji}</span>
                    )}
                    <span
                      className={`font-bold text-slate-100 ${
                        currentItem.emoji ? 'text-2xl' : 'text-4xl'
                      }`}
                    >
                      {currentItem.word}
                    </span>
                    <LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} />
                  </div>
                </div>

                {currentItem.mode === 'match_pairs' ? (
                  <div className="space-y-3">
                    {renderBank(currentItem)}
                    {renderPaired(currentItem)}
                  </div>
                ) : (
                  renderMats(currentItem)
                )}
              </>
            )}

            {/* Open for the whole run — no tutor-busy gate, no push-to-talk. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Word Sorting Complete!"
            celebrationMessage="Great sorting — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default WordSorter;
