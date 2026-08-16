'use client';

/**
 * LetterSoundLink — DI modality (SEVENTH literacy port, 2026-08-11). The Live
 * tutor owns the clock in every mode: it asks, waits, judges the answer,
 * corrects by re-modeling, and its OWN verdict is the advance. There is no
 * advance timer, no push-to-talk mic, no Next button, no per-option audition
 * protocol and no answer text anywhere before the tutor affirms.
 *
 * WHAT WENT, AND WHY:
 *  - **The two-tap audition protocol** (tap a speaker to hear an option, tap
 *    again to keep it) was the whole see-hear/keyword-match interaction, and it
 *    handed the answer over as audio: the child only had to RECOGNISE the sound
 *    someone else produced. Both modes now ask the child to produce — the sound
 *    in see-hear, the word in keyword-match.
 *  - **`useSpokenWordCapture` + the "say the keyword" bonus beat + its 1400ms
 *    auto-advance timer.** That was speaking bolted onto clicking, which is
 *    exactly the modality the ruling rejected. Saying something is now the
 *    answer, not a reward for having already answered.
 *  - **Every `[ACTIVITY_START]` / `[NEXT_CHALLENGE]` / `[SAY_KEYWORD]` /
 *    `[TAP_OPTION]` tag and the whole `KEYWORD_SAFE_PRE_ANSWER` table.** The
 *    keyword is now simply never spoken or pictured before a verdict, in any
 *    mode — one rule instead of a per-mode reveal matrix.
 *
 * WHAT STAYED, AND WHY:
 *  - **`hear-see` is answered with the hands.** Naming a letter aloud is
 *    `letter_name`, a BLOCKED response class. The grapheme cannot be spoken, so
 *    it is touched — and it is still an honest answer surface, because a child
 *    who cannot map the sound onto its letter cannot pick it out of two
 *    confusable letters. Verdicts are CODE-COMPUTED and the tutor is handed its
 *    exact line ([LSL_TAP]).
 *  - **The support tier**, re-based onto di-letter-sounds' DISTAR rungs (easy =
 *    model + guide + test, medium = model + test, hard = test only). The old
 *    tier levers were on-card text and an audition step — one invisible to a
 *    pre-reader, the other deleted here — so the axis moved to how much of the
 *    sequence precedes the attempt. The generator still stamps the legacy
 *    scaffold fields; they are inert on this surface and kept so the tier
 *    resolver and its tests stay green.
 *  - **The pre-reader chrome gate** (reader-fit rule 7): no group/mode badges,
 *    no counter text at K.
 *
 * Cue lines, judging contracts and the continuant gate live in
 * `letterSoundLinkScript.ts` (hand-authored, DISTAR). Nothing in this file
 * writes a spoken line.
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
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSoundLinkMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  letterSoundLinkPackBase,
  tapVerdictCue,
  type LetterSoundItem,
  type LetterSoundMode,
  type LetterSoundTier,
} from './letterSoundLinkScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSoundLinkChallenge {
  id: string;
  mode: LetterSoundMode;
  targetLetter: string;
  targetSound: string;
  keywordWord: string;
  keywordImage: string;
  options?: Array<{ letter?: string; sound?: string; isCorrect: boolean }>;
  sharedSoundLetters?: string[];
  /** Private generator trace; never rendered as student-visible copy. */
  remediationMove?: 'contrast_sound' | 'contrast_letter' | 'contrast_keyword';

  // ── Legacy within-mode support-tier scaffolds, stamped by the generator.
  //    INERT on the judged surface: the tier now composes the DISTAR lead-in
  //    (letterSoundLinkScript) instead of toggling on-card text a pre-reader
  //    could never read. Kept on the type so the tier resolver, its unit tests
  //    and any pre-DI cached content still typecheck. ──
  showKeywordAnchor?: 'proactive' | 'after-miss' | 'never';
  strategyHint?: string | null;
  protocolHint?: string | null;
  showSharedSoundHint?: boolean;
  auditionBeforeCommit?: boolean;
}

export interface LetterSoundLinkData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  challenges: LetterSoundLinkChallenge[];
  /** Canonical grade key ('K' | '1' | '2'…). Drives the pre-reader chrome gate. */
  gradeLevel?: string;
  /** Within-mode support tier from the manifest — the DISTAR lead-in ladder. */
  supportTier?: LetterSoundTier;
  /** Attempts before an item is closed. Absent ⇒ legacy 3 (⇒ 2 corrections). */
  maxAttempts?: number;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSoundLinkMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<LetterSoundMode, { badge: string; icon: string; accent: LuminaAccent }> = {
  'see-hear': { badge: 'Say the Sound', icon: '🗣️', accent: 'blue' },
  'hear-see': { badge: 'Find the Letter', icon: '👂', accent: 'purple' },
  'keyword-match': { badge: 'Say the Word', icon: '🖼️', accent: 'emerald' },
};

/** Vowels = red, consonants = blue (the shipped colour code). */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/* The keyword picture map moved to `letterSoundLinkScript.LETTER_KEYWORDS`,
   beside the WORD it belongs to. It lived here while the words lived in the
   generator, so a pair that disagreed rendered the 📝 fallback silently — in
   the one mode whose ask is "say the picture word". */

// ============================================================================
// Props
// ============================================================================

interface LetterSoundLinkProps {
  data: LetterSoundLinkData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const LetterSoundLink: React.FC<LetterSoundLinkProps> = ({ data, className }) => {
  const {
    title,
    letterGroup,
    challenges = [],
    gradeLevel = 'K',
    supportTier,
    maxAttempts,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  /** Pre-reader band: adult chrome is hidden, never read (reader-fit rule 7). */
  const isPreReader = gradeLevel === 'K';

  const stableInstanceIdRef = useRef(instanceId || `letter-sound-link-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const tier: LetterSoundTier = supportTier ?? 'medium';

  /** The session build gate lives in the script module, because the invariant
   *  it enforces spans ITEMS (a letter answered once; an answered letter never
   *  offered back as the wrong choice) and no per-item builder can see it. */
  const items = useMemo<LetterSoundItem[]>(
    () => itemsFromChallenges(challenges, tier),
    [challenges, tier],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped letter (hear-see only) — cleared on retry and on item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  const tappedRef = useRef<string | null>(null);
  /** [target, chosen] letter pairs from wrong hear-see taps — the one place
   *  this primitive can observe a confusion directly. */
  const confusedPairsRef = useRef<Array<[string, string]>>([]);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<LetterSoundLinkMetrics>({
    primitiveType: 'letter-sound-link',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const rate = (predicate: (item: LetterSoundItem) => boolean) => {
      const scoped = items.filter(predicate);
      if (scoped.length === 0) return 100;
      const solved = scoped.filter(
        (item) => summary.outcomes.find((o) => o.id === item.id)?.solved,
      ).length;
      return Math.round((solved / scoped.length) * 100);
    };

    const metrics: LetterSoundLinkMetrics = {
      type: 'letter-sound-link',
      letterGroup,
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      // see-hear is now grapheme → SPOKEN phoneme; hear-see stays phoneme →
      // grapheme. keyword-match contributes to neither direction on purpose.
      graphemeToPhonemeAccuracy: rate((item) => item.mode === 'see-hear'),
      phonemeToGraphemeAccuracy: rate((item) => item.mode === 'hear-see'),
      vowelSoundAccuracy: rate((item) => VOWELS.has(item.letter.toLowerCase())),
      consonantSoundAccuracy: rate((item) => !VOWELS.has(item.letter.toLowerCase())),
      confusedSoundPairs: Array.from(
        new Set(confusedPairsRef.current.map(([a, b]) => [a, b].sort().join('↔'))),
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
  }, [items, letterGroup, evaluation]);

  // ── The pack — every cue comes off the shared surface ──────────────────────
  // `letterSoundLinkPackBase` is the SAME value `run_tutor_live.py --di` drives
  // through the drive-plan endpoint. Only what the SCREEN owns stays here.
  const pack = useMemo<JudgedScriptPack<LetterSoundItem>>(() => ({
    ...letterSoundLinkPackBase(items, maxAttempts),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then tap the letter.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Listen again — then tap the letter.'
        : 'Have another go — say your answer.',
      done: 'Great letter-sound work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      if (item.answerKind === 'gesture') {
        return {
          challenge: `Hear the sound ${item.spoken} and tap the letter that makes it.`,
          expected: `The letter "${item.answer.toUpperCase()}".`,
          observed: tappedRef.current
            ? `Tapped the letter "${tappedRef.current.toUpperCase()}".`
            : 'Tapped a letter that did not match.',
        };
      }
      return {
        challenge: item.mode === 'see-hear'
          ? `Say the sound the letter "${item.letter.toUpperCase()}" makes.`
          : `Say which pictured word starts with the sound of "${item.letter.toUpperCase()}".`,
        expected: item.mode === 'see-hear'
          ? `The sound ${item.spoken}.`
          : `The word "${item.answer}".`,
        observed: lastHeard
          ? `Heard "${lastHeard}".`
          : 'The tutor judged the answer wrong from the audio.',
      };
    },
  }), [items, maxAttempts]);

  const runner = useJudgedScriptRunner<LetterSoundItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: () => {
      setTapped(null);
      tappedRef.current = null;
    },
    onCorrectionRetry: () => {
      // The tutor's correction re-modeled in-band; free the letters for another go.
      setTapped(null);
      tappedRef.current = null;
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. The runner
   *  owns this latch now (it replaces the `onItemOpened`/`onAffirmed` pair). */
  const revealed = runner.currentSolved;

  // ── The tap — hear-see only; the tap IS the commit ────────────────────────
  const handleLetterTap = useCallback((letter: string) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    if (!item || item.answerKind !== 'gesture') return;
    // Synchronous ref: `canAttempt` closes the pending window through batched
    // state, this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(letter);
    tappedRef.current = letter;
    if (letter.toLowerCase() !== item.answer.toLowerCase()) {
      confusedPairsRef.current.push([item.answer.toLowerCase(), letter.toLowerCase()]);
    }
    runner.submitGestureAttempt(tapVerdictCue(item, letter));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** What the child actually DID. A run of `hear-see` items is answered by
   *  tapping, and congratulating them for using "your own voice" is the same
   *  lie the orb used to tell one screen earlier (user drive 2026-08-13). */
  const celebrationMessage = useMemo(() => {
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return `You found ${items.length} letters by their sounds!`;
      case 'mixed':
        return `You worked on ${items.length} letter sounds — out loud and by ear!`;
      default:
        return `You worked on ${items.length} letter sounds with your own voice!`;
    }
  }, [items]);

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

  /** The printed grapheme — the stimulus in see-hear and keyword-match. Tapping
   *  it re-speaks the QUESTION (never the answer). */
  const renderLetterCard = (item: LetterSoundItem) => (
    <div className="flex justify-center">
      <div
        role="button"
        tabIndex={0}
        onClick={runner.hearStimulus}
        className={`
          text-8xl font-bold ${letterColor(item.letter)}
          bg-white/5 border-2 border-white/15 rounded-2xl
          px-12 py-8 select-none cursor-pointer transition-all
          ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
        `}
      >
        {item.letter.toUpperCase()}
      </div>
    </div>
  );

  /** The keyword anchor. It appears ONLY once the tutor has affirmed — the
   *  picture encodes the sound, so showing it earlier is the same leak as
   *  saying it. */
  const renderKeywordReveal = (item: LetterSoundItem) => (
    <div className="flex items-center justify-center gap-2 animate-in fade-in duration-500">
      <span className="text-4xl">{item.keywordEmoji}</span>
      <span className="text-emerald-200 text-lg font-bold">{item.keyword}</span>
    </div>
  );

  const renderChallenge = (item: LetterSoundItem) => {
    switch (item.mode) {
      // ── Say the sound this letter makes (the child produces it) ──────────
      case 'see-hear':
        return (
          <div className="space-y-5">
            {renderLetterCard(item)}
            {revealed && renderKeywordReveal(item)}
          </div>
        );

      // ── Hear a sound, tap the letter that makes it (the one gesture mode) ─
      case 'hear-see':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <button
                onClick={runner.hearStimulus}
                className={`
                  flex items-center justify-center w-24 h-24 rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the sound again"
              >
                <span className="text-4xl">🔊</span>
              </button>
            </div>
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {item.options.map((option, idx) => {
                const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
                const state = revealed && isTarget
                  ? 'correct'
                  : tapped === option.value && !isTarget
                    ? 'incorrect'
                    : 'idle';
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    onClick={() => handleLetterTap(option.value)}
                    disabled={!runner.canAttempt}
                    className={`
                      w-28 h-28 sm:w-32 sm:h-32 rounded-2xl text-5xl font-bold border-2
                      transition-all duration-200 cursor-pointer
                      ${answerStateClass(state)}
                      ${state === 'idle' ? letterColor(option.value) : ''}
                      ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
                    `}
                  >
                    {option.value.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        );

      // ── Say the picture word that starts with this letter's sound ────────
      case 'keyword-match':
        return (
          <div className="space-y-5">
            {renderLetterCard(item)}
            {/* Display only — the answer is SPOKEN. Nothing here is tappable,
                and no word is printed until the tutor affirms. */}
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {item.options.map((option, idx) => {
                const isTarget = option.value.toLowerCase() === item.answer.toLowerCase();
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`
                      w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2
                      flex flex-col items-center justify-center gap-1.5
                      transition-all duration-200
                      ${revealed && isTarget
                        ? 'bg-emerald-500/20 border-emerald-400/50 ring-2 ring-emerald-400/40 scale-105'
                        : 'bg-white/5 border-white/15'}
                    `}
                  >
                    <span className="text-4xl">{option.emoji}</span>
                    {revealed && isTarget && (
                      <span className="text-sm font-bold text-emerald-200">{option.value}</span>
                    )}
                  </div>
                );
              })}
            </div>
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

  const modeMeta = MODE_META[currentItem?.mode ?? 'see-hear'];

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

            {/* hear-see is answered with a TAP on a letter — the orb says so
                instead of claiming to listen for an answer it will not get. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap the letter" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Letter-Sound Link Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default LetterSoundLink;
