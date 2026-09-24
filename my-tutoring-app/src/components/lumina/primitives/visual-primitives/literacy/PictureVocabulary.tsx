'use client';

/**
 * PictureVocabulary — word meaning with pictures. It runs only on the shared
 * tutor/JEV teaching workspace (workspace rollout C2; the scripted runner was
 * retired, LA-14, user ruling 09-23: one path). The observer judges each spoken
 * answer, the activity checks each picture tap, and the runtime owns progression.
 * An unbound mount shows the shared "needs the tutor" card. There is no advance
 * timer, no Next button and no answer chips anywhere in this file.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - naming / opposite / gradable_scale / sentence_frame / association: the
 *    answer is SPOKEN into an open mic and judged by the tutor from the audio
 *    in-band. The old 4-chip "support net" printed the answer for any Grade-1
 *    reader (word-flip's chips, a third time) and is deleted.
 *  - receptive_match: the answer is a TAP on emoji-only picture cards.
 *    Receptive identification is a real 1-in-4 selection skill — the tap IS
 *    the skill, not a costume over a spoken one — so it stays. The tap commits
 *    through `commitGesture` with the activity's own check.
 *
 * ⭐ ASSOCIATION WENT SPOKEN ON 2026-08-19 (item 25). It tapped four emoji
 * cards for exactly one reason: "what goes with sock" is an OPEN production
 * set (shoe, foot, drawer, laundry are all honest) and `open_set_word` was a
 * BLOCKED response class, so the cards closed the set while the relation
 * stayed the skill. The class was BENCHED — the block is gone and the cards
 * were the costume. THE ABSENCE OF FOUR CARDS ON AN ASSOCIATION ITEM IS THE
 * PROOF THIS SHIPPED, exactly as the deleted word bank was for rhyme-studio.
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

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { itemsFromChallenges, type PictureVocabItem } from './pictureVocabularyScript';
import { describeCardTap, hearQuestionRequest, pictureVocabAssignment, pictureVocabScene } from './pictureVocabularyWorkspace';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { pictureVocabularyPipPose } from '../../../pip/pictureVocabularyPipPose';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PictureVocabChallengeType =
  | 'receptive_match'   // tutor says the word → student taps the picture (gesture)
  | 'naming'            // student sees the picture → says the word (spoken)
  | 'opposite'          // student sees a word+picture → says its opposite (spoken)
  | 'association'       // student sees a word+picture → SAYS what goes with it (spoken, open set)
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
  /** TAP MODE ONLY (receptive_match): exactly 4 emoji-distinct cards including
   *  the target once. Every spoken mode carries none — a printed option list is
   *  an answer leak. Association stopped carrying them when it went spoken
   *  (item 25); the field stays optional and simply goes unset there. */
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
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<PictureVocabChallengeType, { badge: string; icon: string; accent: LuminaAccent; prompt: string }> = {
  receptive_match: { badge: 'Listen & Find', icon: '👂', accent: 'blue', prompt: 'Listen… then tap the picture!' },
  naming: { badge: 'Say It', icon: '🎙️', accent: 'emerald', prompt: 'What is this? Say it out loud!' },
  opposite: { badge: 'Opposites', icon: '🔁', accent: 'amber', prompt: 'What’s the opposite? Say it!' },
  association: { badge: 'Goes Together', icon: '🧩', accent: 'pink', prompt: 'What goes with it? Say it out loud!' },
  gradable_scale: { badge: 'Word Scale', icon: '🎚️', accent: 'cyan', prompt: 'Which word is missing? Say it!' },
  sentence_frame: { badge: 'Finish the Sentence', icon: '💬', accent: 'purple', prompt: 'Say the missing word!' },
};

// ============================================================================
// Component
// ============================================================================

function PictureVocabularySurface({ data, className, runtimePlanItemId, runtimeEvalMode }: PictureVocabularyProps) {
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

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

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

  const finish = (summary: TeachingEvaluationResult) => {
    const metrics: PictureVocabularyMetrics = {
      type: 'picture-vocabulary',
      challengeType: data.challengeType,
      // ITEMS: this is IRT evidence, and a gated-out challenge the child was
      // never asked would deflate accuracy against a denominator that never ran.
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: items.length > 0
        ? summary.attemptsCount / items.length
        : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<PictureVocabItem>({
    primitiveId: 'picture-vocabulary',
    assignment: pictureVocabAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || data.challengeType,
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setTapped(null),
    onCorrectionRetry: () => {
      // Try again frees the cards.
      setTapped(null);
      pip.clear();
    },
  });

  const currentItem = runner.currentItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** Credited: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved;

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own picture tap; Pip
  // never answers, taps, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets();
    const pose = pictureVocabularyPipPose({
      kind: currentItem.kind,
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.isAwaitingGesture(),
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Picture vocabulary', dock: pip.dock.current, targets, pose };
  });

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem) return;
    workspace.current = { ...pictureVocabScene(currentItem), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── The tap — gesture modes only; the tap IS the commit, checked by the activity ──
  const handleOptionTap = useCallback((option: PictureVocabOption) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || showSummary) return;
    if (!item || item.answerKind !== 'gesture') return;
    // `canAttempt` closes through batched state; this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    pip.look(`card-${option.word}`);
    setTapped(option.word);
    commitGesture(runner, { response: describeCardTap(option.word),
      correct: option.word.toLowerCase() === item.word.toLowerCase(), cue: () => describeCardTap(option.word) });
  }, [runner, showSummary, pip]);

  /** Tapping the stimulus asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    ctx.sendText(hearQuestionRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);

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
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  /** A tappable stimulus card: tap = hear the question again (never the answer). */
  const stimulusCardClass = (accentBg: string, accentBorder: string) =>
    `rounded-2xl ${accentBg} border-2 ${accentBorder} text-center cursor-pointer select-none transition-all `;

  const renderTapCards = (item: PictureVocabItem) => (
    <div ref={pip.ref('cards')} data-pip-object="cards" className="grid grid-cols-2 gap-3">
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
            ref={pip.ref(`card-${option.word}`)}
            data-pip-object={`card-${option.word}`}
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
                onClick={hearQuestion}
                className="text-xs rounded-full border border-white/10 px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-all"
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
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
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
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
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
      /**
       * ⭐ ASSOCIATION RENDERS THE STIMULUS AND NOTHING ELSE (item 25).
       *
       * `renderTapCards` is gone from this branch and no answer slot replaces
       * it. That is the whole difference between reading four pictures and
       * picking one, and thinking of a thing that goes with a sock —
       * rhyme-studio's production mode, same shape, same argument.
       *
       * ⚠️ AND NOTHING NAMES `item.word` ON REVEAL, which is where a careless
       * port would put the generated partner back. The set is OPEN: a child who
       * was just affirmed may well have said "foot" or "drawer", and printing
       * "shoe" at them would teach that their correct answer was the wrong one.
       * The reveal is therefore a MARK, not a word — the stimulus card confirms
       * the pairing happened and stays silent about which pairing it was. The
       * generated partner reaches the child in exactly one place: the move-on
       * cue, spoken, after two failed attempts, phrased as "one thing that goes
       * with sock is…".
       */
      case 'association':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
                className={
                  stimulusCardClass('bg-pink-500/10', 'border-pink-500/30')
                  + 'px-10 py-6 '
                  + (revealed ? 'ring-2 ring-emerald-400/50 ' : '')
                }
              >
                <span className="text-5xl">{item.baseEmoji}</span>
                <div className="text-2xl font-black text-pink-200 mt-2">{item.baseWord}</div>
                {revealed && (
                  <div className="text-sm font-bold text-emerald-300 mt-2">🧩 They go together!</div>
                )}
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">{meta.prompt}</p>
          </div>
        );
      case 'gradable_scale': {
        const rungs = item.scaleWords ?? [];
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
                className="flex items-stretch gap-1.5 rounded-2xl bg-cyan-500/10 border-2 border-cyan-500/30 p-3 overflow-x-auto max-w-full cursor-pointer"
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
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
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
  if (items.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const modeMeta = MODE_META[currentItem.kind];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
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

            {/* Pip's dock sits above the stage: the stimulus tops every spoken
                mode, and receptive match is outlined as a group, never pointed
                through. */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

            {renderChallenge(currentItem)}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Picture Vocabulary Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PictureVocabulary = withWorkspaceOnly<PictureVocabularyProps>('picture-vocabulary', PictureVocabularySurface,
  props => props.data.title);

export default PictureVocabulary;
