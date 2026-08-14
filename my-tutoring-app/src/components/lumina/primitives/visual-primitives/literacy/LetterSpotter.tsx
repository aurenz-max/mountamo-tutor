'use client';

/**
 * LetterSpotter — DI modality (ELEVENTH literacy port, 2026-08-13). The Live tutor
 * owns the clock in every mode: it asks ONCE, waits, is handed the verdict for
 * what the child tapped, corrects by re-modelling, and its OWN line is the
 * advance. There is no advance timer, no Check button, no Next button, no
 * push-to-talk mic and no answer anywhere on screen before the tutor affirms.
 *
 * WHAT WENT, AND WHY (all four traced to one live session, 42edfc52e539):
 *  - **Three cue sites that each ordered the sentence re-read** — one on
 *    advance, one on a wrong answer ("re-read the sentence slowly") and, worst,
 *    one on a RIGHT answer ("read the full sentence aloud as celebration"). One
 *    item was spoken 2-4 times; the log has "I see an ant walk away" three
 *    times inside 13 seconds. The pack now speaks each item ONCE, and the only
 *    repeat is a child-initiated tap-to-hear.
 *  - **The advance handler, and every improvised tutor message this file used
 *    to push.** The cue queue they fed ran 8-16s behind the screen while the
 *    option buttons went live immediately, so the log shows a child answering
 *    before the question had finished being asked. Progression now has exactly
 *    one cause: a verdict.
 *  - **The three-attempt reveal-and-lock ladder.** Corrections cap in the
 *    runner and the lesson moves on; a hard item resurfaces through distributed
 *    review, not by drilling a five-year-old.
 *  - **The shape hint.** Group 1's `newLetters` IS the whole group, so the
 *    "NEW letter — hint at its shape" branch fired on every single item ("a
 *    triangle with a line across the middle"). That handed the answer to any
 *    child who knows letterforms. No cue in this pack may describe a letter's
 *    shape, at any tier, and the tap contract says so to the tutor explicitly.
 *
 * WHAT CHANGED AGAIN (2026-08-13, user ruling from session 6ada8c0a1bcf):
 *  - **name-it is SPOKEN, and its four option tiles are deleted.** "In real life
 *    … i ask the student to use context clues and the word to say the missing
 *    letter … they dont need to click a button." The tiles were never pedagogy:
 *    they existed because `letter_name` was marked BLOCKED, and they cost the
 *    mode its production task (a 1-in-4 menu is recognition) while smuggling the
 *    very homophony they were meant to avoid into the option set — the drive
 *    that produced the ruling offered n / s / i / a, and n and s share a cluster.
 *    The class is now `accepted-build-ahead`, judged against ONE target and
 *    accepting the letter's sound as well as its name.
 *
 * WHAT STAYED, AND WHY:
 *  - **find-it and match-it are still answered with the hands** — and only
 *    because their answers are not sayable. find-it's answer is a POSITION;
 *    match-it's is which lowercase FORM matches, which saying "S" would not
 *    demonstrate. Their verdicts stay CODE-COMPUTED ([LSP_TAP]), and the runner
 *    holds the activity bracket across the item so the tutor is silent in fact
 *    and not merely under instruction.
 *  - **The printed word residue.** The click-era render replaced the WHOLE
 *    target word with the marker ("I see a ⭐ walk away"), which threw away the
 *    one decodable cue and left the sentence pure decoration — the data model
 *    already stored the marker over just the first character. It is rendered as
 *    stored now, so the sentence carries information again.
 *  - **The structural difficulty axis** (distractor letterform similarity) and
 *    the find-it target reference — both are RENDER levers a pre-reader can
 *    actually use. `strategyHint` did not survive: it was on-card text at a
 *    band that cannot read, and the tier now composes the spoken DISTAR lead-in
 *    instead (letterSpotterScript).
 *
 * Cue lines, judging contracts, build gates and the tier ladder live in
 * `letterSpotterScript.ts` (hand-authored, DISTAR). Nothing in this file writes
 * a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSpotterMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  itemCue,
  itemsFromChallenges,
  moveOnCue,
  pronounceCue,
  stimulusFor,
  tapVerdictCue,
  SPOTTER_EMOJI,
  type LetterSpotterItem,
  type LetterSpotterMode,
  type LetterSpotterTier,
} from './letterSpotterScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSpotterChallenge {
  id: string;
  mode: LetterSpotterMode;
  targetLetter: string;
  targetCase: 'uppercase' | 'lowercase' | 'both';
  /** name-it / match-it: the tappable letters, lowercase, answer included. */
  options?: string[];
  /** find-it: sixteen uppercase cells holding EXACTLY ONE target. Under the
   *  judged loop one tap is one commit, so a second target would be a second
   *  right answer to a question asked once. */
  letterGrid?: string[];
  /** find-it: instances of the target in the grid. Recomputed by the generator;
   *  1 under the judged loop. */
  targetCount?: number;
  /** name-it: the sentence as PRINTED — the marker sits over the target word's
   *  FIRST character ("I see an ⭐nt walk away."). */
  sentence?: string;
  /** name-it: the sentence as SPOKEN, word intact ("I see an ant walk away."). */
  spokenSentence?: string;
  /** name-it: the marker. Code-owned and invariant; kept on the type so cached
   *  pre-DI content still typechecks. */
  emoji?: string;
  /** name-it: the word whose first letter the marker hides ("ant"). */
  targetWord?: string;

  // ── Legacy within-mode support-tier scaffolds, stamped by the generator.
  //    `strategyHint` is INERT on the judged surface — on-card prose at a band
  //    that cannot read it. The tier now composes the spoken lead-in instead.
  //    `showTargetReference` is live: it is a picture, not prose. ──
  strategyHint?: string;
  showTargetReference?: boolean;
}

export interface LetterSpotterData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  newLetters: string[];
  challenges: LetterSpotterChallenge[];
  /** Canonical grade key ('K' | '1' | '2'…). Drives the pre-reader chrome gate. */
  gradeLevel?: string;
  /** Within-mode support tier from the manifest — the DISTAR lead-in ladder. */
  supportTier?: LetterSpotterTier;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSpotterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<LetterSpotterMode, { badge: string; icon: string; accent: LuminaAccent }> = {
  'name-it': { badge: 'Sentence Spotter', icon: '⭐', accent: 'blue' },
  'find-it': { badge: 'Find It', icon: '🔎', accent: 'purple' },
  'match-it': { badge: 'Match It', icon: '🔤', accent: 'emerald' },
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// ============================================================================
// Props
// ============================================================================

interface LetterSpotterProps {
  data: LetterSpotterData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const LetterSpotter: React.FC<LetterSpotterProps> = ({ data, className }) => {
  const {
    title,
    letterGroup,
    cumulativeLetters = [],
    newLetters = [],
    challenges = [],
    gradeLevel = 'K',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  /** Pre-reader band: adult chrome is hidden, never read (reader-fit rule 7). */
  const isPreReader = gradeLevel === 'K';

  const stableInstanceIdRef = useRef(instanceId || `letter-spotter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const tier: LetterSpotterTier = supportTier ?? 'medium';

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<LetterSpotterItem[]>(
    () => itemsFromChallenges(challenges, tier),
    [challenges, tier],
  );

  /** Render-only lookups the pack has no business carrying. */
  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped letter (name-it / match-it) — cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  const tappedRef = useRef<string | null>(null);
  /** The tapped grid index (find-it) — a cell, not a letter. */
  const [tappedCell, setTappedCell] = useState<number | null>(null);
  /** [target, chosen] pairs from wrong taps — the confusion evidence this
   *  primitive exists to collect. */
  const confusedPairsRef = useRef<Array<[string, string]>>([]);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<LetterSpotterMetrics>({
    primitiveType: 'letter-spotter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const rate = (predicate: (item: LetterSpotterItem) => boolean) => {
      const scoped = items.filter(predicate);
      if (scoped.length === 0) return 100;
      const solved = scoped.filter(
        (item) => summary.outcomes.find((o) => o.id === item.id)?.solved,
      ).length;
      return Math.round((solved / scoped.length) * 100);
    };

    const isNew = (item: LetterSpotterItem) =>
      newLetters.includes(item.targetLetter.toLowerCase());

    const metrics: LetterSpotterMetrics = {
      type: 'letter-spotter',
      letterGroup,
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      newLetterAccuracy: rate(isNew),
      reviewLetterAccuracy: rate((item) => !isNew(item)),
      // Case accuracy is read off the FORM the child actually worked with, not
      // a `targetCase` field the click-era render never honoured (it printed
      // every option uppercase regardless). find-it grids and the match-it
      // stimulus are uppercase; the match-it ANSWER is the little form.
      // name-it counts as neither since its tiles went: a spoken letter name
      // carries no case at all.
      uppercaseAccuracy: rate((item) => item.mode !== 'name-it'),
      lowercaseAccuracy: rate((item) => item.mode === 'match-it'),
      confusedLetterPairs: Array.from(
        new Set(confusedPairsRef.current.map(([a, b]) => [a, b].sort().join('-'))),
      ),
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, letterGroup, newLetters, evaluation]);

  // ── The pack — wording lives in letterSpotterScript.ts ─────────────────────
  const pack = useMemo<JudgedScriptPack<LetterSpotterItem>>(() => ({
    primitiveType: 'letter-spotter',
    activityLine: 'live direct instruction letter spotting practice',
    items,
    itemCue,
    moveOnCue,
    completeCue,
    pronounceCue,
    contextFor: (item) => ({
      challengeType: item.mode,
      stimulus: stimulusFor(item),
    }),
    // Only what DIFFERS from the runner's defaults — a line restated here reads
    // as a deliberate pedagogic choice, so a byte-identical one is noise.
    statusLines: {
      // The two answer surfaces get different lines, because the child is being
      // told what to DO: name-it is spoken, the other two are tapped.
      ready: (item) => (item.answerKind === 'voice'
        ? 'Listen, then say your answer.'
        : 'Listen, then tap your answer.'),
      retry: (item) => (item.answerKind === 'voice'
        ? 'Listen again — then say your answer.'
        : 'Listen again — then tap your answer.'),
      noVerdict: () => 'One more time — say the letter.',
      done: 'Great letter spotting today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const chosen = tappedRef.current;
      switch (item.mode) {
        case 'name-it': {
          // Spoken mode: the evidence is what the child SAID. A heard single
          // letter is also a confusion pair, which is the signal this primitive
          // exists to collect — the tap path used to be the only source.
          const heard = lastHeard?.trim() ?? '';
          const heardLetter = /^[a-z]$/i.test(heard) ? heard.toLowerCase() : null;
          if (heardLetter && heardLetter !== item.targetLetter.toLowerCase()) {
            confusedPairsRef.current.push([item.targetLetter.toLowerCase(), heardLetter]);
          }
          return {
            challenge: `Hear "${item.spokenSentence}" and say the letter "${item.targetWord}" starts with.`,
            expected: `The letter "${item.targetLetter.toUpperCase()}".`,
            observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
          };
        }
        case 'find-it':
          return {
            challenge: `Find the letter "${item.targetLetter.toUpperCase()}" among sixteen letters.`,
            expected: `The one cell holding "${item.targetLetter.toUpperCase()}".`,
            observed: chosen
              ? `Tapped a cell holding "${chosen.toUpperCase()}".`
              : 'Tapped a cell that did not hold it.',
          };
        case 'match-it':
          return {
            challenge: `Match big "${item.targetLetter.toUpperCase()}" to its little form.`,
            expected: `The little letter "${item.targetLetter}".`,
            observed: chosen
              ? `Tapped the little letter "${chosen}".`
              : 'Tapped a little letter that did not match.',
          };
      }
    },
  }), [items]);

  const runner = useJudgedScriptRunner<LetterSpotterItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: () => {
      setTapped(null);
      tappedRef.current = null;
      setTappedCell(null);
    },
    onCorrectionRetry: () => {
      // The tutor's correction re-modelled in-band; free the surface for another go.
      setTapped(null);
      tappedRef.current = null;
      setTappedCell(null);
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. The runner
   *  owns this now — the local `revealed` latch it replaces had to be reset in
   *  `onItemOpened` and set in `onAffirmed`, one more pair to keep in step. */
  const revealed = runner.currentSolved;

  // ── The tap IS the commit, in every mode ──────────────────────────────────
  const commitTap = useCallback((item: LetterSpotterItem, letter: string) => {
    if (!runner.canAttempt || evaluation.hasSubmitted) return false;
    // `canAttempt` closes the pending window through `stage`, which is batched
    // React state; this ref flips synchronously, so it is what stops a second
    // tap in the same tick from recording a second confusion pair.
    if (runner.isAwaitingGesture()) return false;
    SoundManager.tap();
    setTapped(letter);
    tappedRef.current = letter;
    if (letter.toLowerCase() !== item.targetLetter.toLowerCase()) {
      confusedPairsRef.current.push([item.targetLetter.toLowerCase(), letter.toLowerCase()]);
    }
    runner.submitGestureAttempt(tapVerdictCue(item, letter));
    return true;
  }, [runner, evaluation.hasSubmitted]);

  const handleOptionTap = useCallback((letter: string) => {
    const item = runner.currentItem;
    // match-it is the only tile mode left — name-it's answer is spoken.
    if (!item || item.mode !== 'match-it') return;
    commitTap(item, letter);
  }, [runner, commitTap]);

  const handleCellTap = useCallback((index: number) => {
    const item = runner.currentItem;
    if (!item || item.mode !== 'find-it') return;
    const letter = item.letterGrid?.[index];
    if (!letter) return;
    if (commitTap(item, letter)) setTappedCell(index);
  }, [runner, commitTap]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = MODE_META[item.mode];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const letterColor = (letter: string) =>
    VOWELS.has(letter.toLowerCase()) ? 'text-red-300' : 'text-blue-300';

  /** The tappable answer tiles — match-it ONLY. Lowercase, because the match-it
   *  answer IS the little form. (The click-era render printed every option
   *  uppercase while the tutor described a lowercase shape — the buttons said
   *  "I", the tutor said "a straight line with a little dot on top".)
   *
   *  name-it lost its tiles in the 2026-08-13 ruling: a four-way menu turned
   *  "say the letter this word starts with" into a 1-in-4 recognition task, and
   *  the menu is the reason the mode was ever a tap. */
  const renderOptions = (item: LetterSpotterItem) => (
    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
      {item.options.map((option) => {
        const isTarget = option.toLowerCase() === item.targetLetter.toLowerCase();
        const state = revealed && isTarget
          ? 'correct'
          : tapped === option && !isTarget
            ? 'incorrect'
            : 'idle';
        return (
          <button
            key={`${item.id}-${option}`}
            type="button"
            onClick={() => handleOptionTap(option)}
            disabled={!runner.canAttempt}
            className={`
              h-20 rounded-xl border-2 text-4xl font-bold transition-all
              ${answerStateClass(state)}
              ${state === 'idle' ? letterColor(option) : ''}
              ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
            `}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  const renderChallenge = (item: LetterSpotterItem) => {
    switch (item.mode) {
      // ── Hear a sentence, SAY the letter the marker is hiding ──────────────
      case 'name-it': {
        const printed = item.sentence ?? '';
        const parts = printed.split(SPOTTER_EMOJI);
        return (
          <div className="space-y-6">
            {/* The sentence. Tapping it re-speaks the QUESTION — the click-era
                item had no replay at all, and its audio ran up to 16s behind. */}
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={`
                  bg-white/5 border-2 border-white/15 rounded-2xl px-8 py-6 max-w-lg
                  cursor-pointer transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
              >
                <p className="text-3xl font-bold text-slate-100 text-center leading-relaxed">
                  {parts.map((part, i) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <span className="relative inline-block mx-0.5">
                          <span className="absolute inset-0 -m-1.5 rounded-full border-2 border-dashed border-amber-400/70 animate-pulse" />
                          {revealed ? (
                            <span className="text-4xl text-emerald-300">
                              {item.targetLetter}
                            </span>
                          ) : (
                            <span className="text-4xl" role="img" aria-label="hidden letter">
                              {SPOTTER_EMOJI}
                            </span>
                          )}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
            {/* No answer tiles. The sentence IS the whole stage — the child
                reads the star, hears the word, and says the letter. */}
          </div>
        );
      }

      // ── Hear a letter named, tap the one cell holding it ──────────────────
      case 'find-it': {
        const grid = item.letterGrid ?? [];
        const showReference = challengeById.get(item.id)?.showTargetReference;
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                onClick={runner.hearStimulus}
                className={`
                  flex items-center justify-center w-20 h-20 rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the letter again"
              >
                <span className="text-3xl">🔊</span>
              </button>
            </div>

            {/* Perception support (tier lever). It prints the letter to FIND —
                the answer is WHERE it is, so this is a reference, not a reveal. */}
            {showReference && (
              <div className="flex justify-center">
                <div className="bg-white/5 border-2 border-white/15 rounded-xl px-5 py-2 flex items-center gap-3">
                  <span className="text-slate-400 text-xs">Looking for</span>
                  <span className={`text-2xl font-bold ${letterColor(item.targetLetter)}`}>
                    {item.targetLetter.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
              {grid.map((letter, i) => {
                const isTarget = letter.toLowerCase() === item.targetLetter.toLowerCase();
                const state = revealed && isTarget
                  ? 'correct'
                  : tappedCell === i && !isTarget
                    ? 'incorrect'
                    : 'idle';
                return (
                  <button
                    key={`${item.id}-${i}`}
                    onClick={() => handleCellTap(i)}
                    disabled={!runner.canAttempt}
                    className={`
                      aspect-square rounded-xl border-2 font-bold text-2xl
                      transition-all select-none
                      ${answerStateClass(state)}
                      ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
                    `}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      // ── See a big letter, tap its little form ────────────────────────────
      case 'match-it':
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={`
                  text-8xl font-bold ${letterColor(item.targetLetter)}
                  bg-white/5 border-2 border-white/15 rounded-2xl
                  px-12 py-8 select-none cursor-pointer transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
              >
                {item.targetLetter.toUpperCase()}
              </div>
            </div>
            {renderOptions(item)}
          </div>
        );
    }
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const modeMeta = MODE_META[currentItem?.mode ?? 'name-it'];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {/* Pre-reader: hide adult chrome (group/mode badges) — rule 7. */}
          {!isPreReader && !evaluation.hasSubmitted && currentItem && (
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Group {letterGroup}</LuminaBadge>
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            </div>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {currentItem && renderChallenge(currentItem)}

            {/* The orb reads `answerKind` off the runner: on find-it and
                match-it the mic is still open (the tutor is audible, the child
                may talk) but the answer is the tap, so it must not say it is
                listening for one. This port's wording is the panel's default. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Letter Spotting Complete!"
            celebrationMessage={`You spotted letters across ${items.length} rounds — ${cumulativeLetters.length} letters in play!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default LetterSpotter;
