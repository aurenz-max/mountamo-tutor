'use client';

/**
 * PictureVocabulary — DI modality (fifth literacy port, 2026-08-11; FIRST
 * literacy consumer of useJudgedScriptRunner). The Live tutor owns the clock
 * in every mode: it asks, waits, judges, corrects contrastively, and its OWN
 * verdict is the advance. There is no advance timer, no push-to-talk mic, no
 * Next button and no answer chips anywhere in this file.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - naming / opposite / gradable_scale / sentence_frame: the answer is
 *    SPOKEN into an open mic and judged by the tutor from the audio in-band.
 *    The old 4-chip "support net" printed the answer for any Grade-1 reader
 *    (word-flip's chips, a third time) and is deleted.
 *  - receptive_match / association: the answer is a TAP on emoji-only picture
 *    cards. Receptive identification is a real 1-in-4 selection skill, and
 *    association PRODUCTION is an open spoken set ("what goes with sock" —
 *    shoe, foot, laundry are all honest), a BLOCKED response class — so the
 *    cards close the set while the relation stays the skill. The tap commits
 *    through the gesture anchor; the tutor's verdict is the advance.
 *
 * DELETED from the click-driven version: the Start with Voice / Start
 * tap-only fork and the whole voiceMode axis, the 4-option word chips and
 * "Show me choices", MAX_WRONG_TAPS and the reveal-after-3 ladder, the
 * 1600ms auto-advance timer, Next/Finish buttons, the word-match voice-answer
 * beat, and every sendText choreography block — the pack's cues carry the
 * entire spoken surface (`pictureVocabularyScript.ts`).
 *
 * ANSWER-LEAK RULE: the target word appears on screen only after the tutor
 * has affirmed (or, spoken by the tutor, inside a scripted correction).
 * Tap-to-hear re-speaks the QUESTION, never the answer.
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
import type { PictureVocabularyMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  pictureVocabularyPackBase,
  scaleSpokenFor,
  tapVerdictCue,
  type PictureVocabItem,
} from './pictureVocabularyScript';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PictureVocabChallengeType =
  | 'receptive_match'   // tutor says the word → student taps the picture (gesture)
  | 'naming'            // student sees the picture → says the word (spoken)
  | 'opposite'          // student sees a word+picture → says its opposite (spoken)
  | 'association'       // student sees a word+picture → taps what GOES WITH it (gesture)
  | 'gradable_scale'    // ordered gradient with one rung blank → says the missing rung (spoken)
  | 'sentence_frame';   // tutor voices a sentence with a blank → says the missing word (spoken)

export interface PictureVocabOption {
  word: string;
  emoji: string;
}

export interface PictureVocabChallenge {
  id: string;
  type: PictureVocabChallengeType;
  /** The word the student must produce (or tap). For 'opposite' this is the OPPOSITE word. */
  word: string;
  /** Picture (emoji) of the target word. Never shown pre-solve in sentence_frame mode. */
  emoji: string;
  /** TAP MODES ONLY (receptive_match, association): exactly 4 emoji-distinct
   *  cards including the target once. Spoken modes carry none — a printed
   *  option list is an answer leak. */
  options?: PictureVocabOption[];
  // -- opposite / association --
  baseWord?: string;
  baseEmoji?: string;
  // -- sentence_frame mode --
  /** Display text with a blank, e.g. "We sleep in a ____." Must NOT contain the target word. */
  frameDisplay?: string;
  /** What the tutor says aloud. Must NOT contain the target word. */
  frameSpoken?: string;
  // -- gradable_scale mode --
  /** Ordered rung words on the gradient, e.g. ['freezing','cold','cool','warm','hot']. */
  scaleWords?: string[];
  /** Index into scaleWords of the blanked target rung (scaleWords[scaleTargetIndex] === word). */
  scaleTargetIndex?: number;
  /** Private generation trace; never rendered to the student. */
  remediationMove?: 'semantic_contrast' | 'relation_contrast' | 'reverse_relation' | 'context_contrast' | 'adjacent_scale';
}

export interface PictureVocabularyData {
  title: string;
  description: string;
  /** Session-level mode; mixed sessions still render per challenge.type. */
  challengeType: PictureVocabChallengeType;
  /** 4-6 challenges. REQUIRED — built by the generator from the word pool. */
  challenges: PictureVocabChallenge[];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PictureVocabularyMetrics>) => void;
}

interface PictureVocabularyProps {
  data: PictureVocabularyData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<PictureVocabChallengeType, { badge: string; icon: string; accent: LuminaAccent; prompt: string }> = {
  receptive_match: { badge: 'Listen & Find', icon: '👂', accent: 'blue', prompt: 'Listen… then tap the picture!' },
  naming: { badge: 'Say It', icon: '🎙️', accent: 'emerald', prompt: 'What is this? Say it out loud!' },
  opposite: { badge: 'Opposites', icon: '🔁', accent: 'amber', prompt: 'What’s the opposite? Say it!' },
  association: { badge: 'Goes Together', icon: '🧩', accent: 'pink', prompt: 'Tap the picture that goes with it!' },
  gradable_scale: { badge: 'Word Scale', icon: '🎚️', accent: 'cyan', prompt: 'Which word is missing? Say it!' },
  sentence_frame: { badge: 'Finish the Sentence', icon: '💬', accent: 'purple', prompt: 'Say the missing word!' },
};

// ============================================================================
// Component
// ============================================================================

const PictureVocabulary: React.FC<PictureVocabularyProps> = ({ data, className }) => {
  const {
    title,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'kindergarten';

  const stableInstanceIdRef = useRef(instanceId || `picture-vocabulary-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items ──────────────────────────────────────────────────────────────────
  // `itemsFromChallenges` is the SAME builder the DI drive-plan endpoint calls,
  // so the harness and the child drop the same unaskable items. It gates: a tap
  // mode whose cards do not contain the target, a pair whose two sides are the
  // same word, a scale whose blanked rung is not the answer, a frame with no
  // blank or one that speaks its own target. Everything downstream binds to
  // `items`, never to `challenges` — a dropped challenge is one the child is
  // never shown, and scoring it would report a 0 against an item that never ran.
  const items = useMemo<PictureVocabItem[]>(
    () => itemsFromChallenges(challenges),
    [challenges],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped card's word (gesture modes) — cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  const tappedRef = useRef<string | null>(null);
  /** Affirmed: the first moment the answer may appear on screen. */

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<PictureVocabularyMetrics>({
    primitiveType: 'picture-vocabulary',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: PictureVocabularyMetrics = {
      type: 'picture-vocabulary',
      challengeType: data.challengeType,
      // ITEMS: this is IRT evidence, and a gated-out challenge the child was
      // never asked would deflate accuracy against a denominator that never ran.
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: items.length > 0
        ? summary.attemptsCount / items.length
        : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items.length, data.challengeType, evaluation]);

  // ── The pack — wording lives in pictureVocabularyScript.ts ────────────────
  const pack = useMemo<JudgedScriptPack<PictureVocabItem>>(() => ({
    // Everything the tutor is ever told comes from the shared cue surface, so
    // the DI harness cannot drift from what production sends. What stays here
    // is what only a mounted component can own: lines that are RENDERED, and a
    // diagnosis that reads the tapped card out of component state.
    ...pictureVocabularyPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen, then tap the picture.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Look again — then tap the picture.'
        : 'Have another go — say your answer.',
      done: 'Great word work today!',
    },
    diagnosisObservation: (item, { lastHeard }) =>
      item.answerKind === 'gesture'
        ? {
            challenge: item.kind === 'receptive_match'
              ? `Hear "${item.word}" and tap its picture.`
              : `Tap the picture that goes with "${item.baseWord}".`,
            expected: `The picture of "${item.word}".`,
            observed: tappedRef.current
              ? `Tapped the picture of "${tappedRef.current}".`
              : 'Tapped a picture that did not match.',
          }
        : {
            challenge: item.kind === 'naming'
              ? 'Name the pictured vocabulary item aloud.'
              : item.kind === 'opposite'
                ? `Produce the opposite of "${item.baseWord}" aloud.`
                : item.kind === 'gradable_scale'
                  ? `Say the missing word in the scale: ${scaleSpokenFor(item)}.`
                  : `Complete the sentence: ${item.frameDisplay}`,
            expected: `The word "${item.word}".`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          },
  }), [items]);

  const runner = useJudgedScriptRunner<PictureVocabItem>({
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
      // The tutor's line re-oriented in-band; free the cards for another go.
      setTapped(null);
      tappedRef.current = null;
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. The runner
   *  owns this latch now (it replaces the `onItemOpened`/`onAffirmed` pair). */
  const revealed = runner.currentSolved;

  // ── The tap — gesture modes only; the tap IS the commit ───────────────────
  const handleOptionTap = useCallback((option: PictureVocabOption) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    if (!item || item.answerKind !== 'gesture') return;
    // Synchronous ref: `canAttempt` closes the pending window through batched
    // state, this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(option.word);
    tappedRef.current = option.word;
    runner.submitGestureAttempt(tapVerdictCue(item, option.word));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** Say-it and tap-it runs are both legitimate here, so the copy names what
   *  this one was — claiming "voice and hands" is wrong on either pure run. */
  const celebrationMessage = useMemo(() => {
    const n = items.length;
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return `You worked on ${n} words — you found every one!`;
      case 'mixed':
        return `You worked on ${n} words with your own voice and hands!`;
      default:
        return `You worked on ${n} words with your own voice!`;
    }
  }, [items]);

  // ITEMS, not challenges: a challenge the build gate dropped was never opened,
  // so it has no outcome — and `phaseResultsFromSummary` scores a missing
  // outcome 0 rather than dropping the row, which would report a failure
  // against a word the child was never asked.
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  /** A tappable stimulus card: tap = hear the question again (never the answer). */
  const stimulusCardClass = (accentBg: string, accentBorder: string) =>
    `rounded-2xl ${accentBg} border-2 ${accentBorder} text-center cursor-pointer select-none transition-all `
    + (runner.stimulusTapped ? 'ring-2 ring-cyan-300/60 ' : '');

  const renderTapCards = (item: PictureVocabItem) => (
    <div className="grid grid-cols-2 gap-3">
      {(item.options ?? []).map((option, idx) => {
        const isTarget = option.word.toLowerCase() === item.word.toLowerCase();
        const state = revealed && isTarget
          ? 'correct'
          : tapped === option.word && !isTarget
            ? 'incorrect'
            : 'idle';
        return (
          <button
            key={`${item.id}-${idx}`}
            onClick={() => handleOptionTap(option)}
            disabled={!runner.canAttempt}
            className={`
              rounded-xl border-2 p-4 flex flex-col items-center gap-1.5
              transition-all duration-200 cursor-pointer
              ${answerStateClass(state)}
              ${revealed && isTarget ? 'ring-2 ring-emerald-400/40' : ''}
            `}
          >
            <span className="text-4xl">{option.emoji}</span>
            {/* The word appears only after the tutor has affirmed. */}
            {revealed && isTarget && (
              <span className="text-sm font-bold">{option.word}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderChallenge = (item: PictureVocabItem) => {
    const meta = MODE_META[item.kind];
    switch (item.kind) {
      case 'receptive_match':
        return (
          <div className="space-y-5">
            <p className="text-center text-base text-slate-300 font-medium">
              {meta.icon} {meta.prompt}
            </p>
            <div className="flex justify-center">
              <button
                onClick={runner.hearStimulus}
                className={`text-xs rounded-full border border-white/10 px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-all ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}`}
              >
                🔊 Hear it again
              </button>
            </div>
            {renderTapCards(item)}
          </div>
        );
      case 'naming':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={stimulusCardClass('bg-emerald-500/10', 'border-emerald-500/30') + 'px-12 py-8'}
              >
                <span className="text-7xl">{item.emoji}</span>
                {revealed && (
                  <div className="text-2xl font-black text-emerald-200 mt-2">{item.word}</div>
                )}
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
          </div>
        );
      case 'opposite':
        return (
          <div className="space-y-5">
            <div className="flex justify-center items-center gap-4">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={stimulusCardClass('bg-amber-500/10', 'border-amber-500/30') + 'px-10 py-6'}
              >
                <span className="text-5xl">{item.baseEmoji}</span>
                <div className="text-2xl font-black text-amber-200 mt-2">{item.baseWord}</div>
              </div>
              <span className="text-2xl text-slate-500">🔁</span>
              <div className="rounded-2xl bg-white/5 border-2 border-dashed border-amber-300/40 px-10 py-6 text-center min-w-[120px]">
                {revealed ? (
                  <>
                    <span className="text-5xl">{item.emoji}</span>
                    <div className="text-2xl font-black text-amber-200 mt-2">{item.word}</div>
                  </>
                ) : (
                  <span className="text-4xl text-amber-300/70">?</span>
                )}
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
          </div>
        );
      case 'association':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={stimulusCardClass('bg-pink-500/10', 'border-pink-500/30') + 'px-10 py-6'}
              >
                <span className="text-5xl">{item.baseEmoji}</span>
                <div className="text-2xl font-black text-pink-200 mt-2">{item.baseWord}</div>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
            {renderTapCards(item)}
          </div>
        );
      case 'gradable_scale': {
        const rungs = item.scaleWords ?? [];
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={`flex items-stretch gap-1.5 rounded-2xl bg-cyan-500/10 border-2 border-cyan-500/30 p-3 overflow-x-auto max-w-full cursor-pointer ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}`}
              >
                {rungs.map((w, i) => {
                  const isTarget = i === item.scaleTargetIndex;
                  const reveal = isTarget && revealed;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[60px] text-center ${
                        isTarget
                          ? reveal
                            ? 'bg-emerald-500/20 border-2 border-emerald-400/50'
                            : 'bg-white/5 border-2 border-dashed border-cyan-300/60'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500">{i + 1}</span>
                      <span className={`text-base font-bold ${isTarget && !reveal ? 'text-cyan-300' : 'text-slate-100'}`}>
                        {isTarget && !reveal ? '???' : w}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
          </div>
        );
      }
      case 'sentence_frame':
        return (
          <div className="space-y-5">
            {/* No emoji pre-solve — the picture IS the answer. */}
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={runner.hearStimulus}
                className={stimulusCardClass('bg-purple-500/10', 'border-purple-500/30') + 'px-8 py-6 max-w-md'}
              >
                {revealed ? (
                  <span className="text-5xl">{item.emoji}</span>
                ) : (
                  <span className="text-4xl">💬</span>
                )}
                <div className="text-xl font-bold text-purple-100 mt-3 leading-relaxed">
                  {revealed && item.frameDisplay
                    ? item.frameDisplay.replace(/_{2,}/, item.word)
                    : item.frameDisplay}
                </div>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
          </div>
        );
    }
  };

  // ============================================================================
  // Main render
  // ============================================================================

  // ITEMS: a payload can arrive with challenges that the build gate all rejects
  // (no cards containing the target, frames with no blank). Gating on
  // `challenges` there would mount a runner with nothing to run.
  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const modeMeta = MODE_META[currentItem?.kind ?? 'naming'];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && currentItem && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex justify-center">
              {/* The runner's index counts ITEMS, so the denominator must too —
                  against `challenges.length` the dots would show "4 of 5" on
                  the last word of a session one item was gated out of. */}
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {currentItem && renderChallenge(currentItem)}

            {/* The picture-tap modes are answered with the hands — the orb
                names that turn instead of claiming to listen for it. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap the picture" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Picture Vocabulary Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PictureVocabulary;
