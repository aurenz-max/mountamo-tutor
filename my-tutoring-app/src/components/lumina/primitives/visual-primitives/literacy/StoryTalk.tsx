'use client';

/**
 * StoryTalk — DI modality (FIFTEENTH literacy port, 2026-08-14). The Live tutor
 * owns the clock: it reads the story, asks ONCE, waits, judges the child's spoken
 * answer from the audio in-band, corrects contrastively, and its OWN affirmation
 * is the advance. There is no advance timer, no Next button, no push-to-talk mic,
 * and no answer anywhere on screen before the tutor affirms.
 *
 * WHAT WENT, AND WHY:
 *  - **The four-picture answer grid.** Every mode's answer is ONE WORD
 *    (a noun, a feeling, a cause), so every mode is spoken; the menu converted
 *    production into recognition and floored a guess at 1 in 4. A teacher reading
 *    a story to one child and asking "Who hid the acorn?" has no cards on the
 *    table. The distractor words survive off-screen as harness material only —
 *    see storyTalkScript.ts.
 *  - **The mic gate on tutor-busy.** The click era ran the mic only while the
 *    tutor was fully quiet, because a separate capture could otherwise hear the
 *    TUTOR read the answer word out of the story and credit it to the child. Its
 *    own docblock called it "a deliberate, narrow exception" to the standing
 *    open-mic rule. The judged loop removes the reason rather than the rule: the
 *    judge is the tutor, judging its own session audio, and it cannot mistake its
 *    read-aloud for the learner. The family now has no tutor-busy gate anywhere.
 *  - **The 3-wrong-taps reveal ladder, the Next/Finish button, the start-screen
 *    fork, the shake animation and the feedback card that printed the answer.**
 *    Corrections cap in the runner; the moveOn line names the answer so a capped
 *    story never ends with the child not knowing how it came out.
 *  - **Six improvised tutor sends** (`[ACTIVITY_START]`, `[NEXT_ITEM]`,
 *    `[READ_AGAIN]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[ANSWER_REVEALED]`,
 *    `[ALL_COMPLETE]`). The cues carry the entire spoken surface.
 *
 * WHAT STAYED:
 *  - **The listening card.** The story is audio-only while the child answers —
 *    it contains the answer verbatim for two of three modes — and prints on the
 *    affirm as the reveal. That was the click era's best idea and the port keeps
 *    it; "hear it again" is now the family's tap-to-hear channel.
 *
 * Cue lines, judging contracts and build gates live in `storyTalkScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaReadAloudGlyph,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StoryTalkMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  itemsFromChallenges,
  storyTalkPackBase,
  type StoryTalkItem,
} from './storyTalkScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Comprehension task identities, all now sharing the "listen → SAY the answer"
// surface. who_what_where = literal recall (answer stated in the story);
// feeling_check = emotion inference (feeling never stated); why_because = causal
// inference. (first_next_last needs a sequencing render; retell needs a
// connected-text judge — both remain deferred.)
export type StoryTalkChallengeType = 'who_what_where' | 'feeling_check' | 'why_because';

export interface StoryTalkOption {
  /** The single picturable word (e.g. "squirrel"). */
  word: string;
  /** Emoji picture of the word (🐿️). */
  emoji: string;
}

export interface StoryTalkChallenge {
  id: string;
  type: StoryTalkChallengeType;
  /** Kid-friendly title for the mini-story ("Milo's Acorn"). Suppressed by the
   *  build gate when it names the answer. */
  storyTitle: string;
  /**
   * 3-5 short sentences the TUTOR READS ALOUD. This is a listening task: the
   * story text is NEVER shown while the student is answering (for two of three
   * modes it contains the answer verbatim). It surfaces on the tutor's affirm.
   */
  story: string;
  /** The comprehension question ("Who hid the acorn?"). MUST NOT contain the answer. */
  question: string;
  /** The correct single-word answer ("squirrel") — SPOKEN by the child. */
  answer: string;
  /** Emoji picture of the answer. Reveal-on-affirm only. */
  answerEmoji: string;
  /**
   * The answer once + 3 same-category distractors.
   *
   * NOT AN ANSWER MENU — the DI port deleted the picture grid, and nothing on
   * screen or in a cue can reach this array. It survives for two jobs: it makes
   * the generator commit to what a fair near miss WOULD be (which measurably
   * improves the answer it picks), and the judged-loop harness drives one of
   * those distractors as the signature wrong answer.
   */
  options: StoryTalkOption[];
}

export interface StoryTalkData {
  title: string;
  description: string;
  /** Session-level mode. */
  challengeType: StoryTalkChallengeType;
  /** 3-6 challenges. REQUIRED — built by the generator's story orchestrator. */
  challenges: StoryTalkChallenge[];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryTalkMetrics>) => void;
}

interface StoryTalkProps {
  data: StoryTalkData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Narrowed to what the summary panel accepts, because the same accent drives
 *  both the badge and the phase rows and `LuminaAccent` is the wider set. */
type StoryTalkAccent = NonNullable<PhaseResult['accentColor']>;

const MODE_META: Record<
  StoryTalkChallengeType,
  { label: string; icon: string; accent: StoryTalkAccent }
> = {
  who_what_where: { label: 'Listen & Tell', icon: '👂', accent: 'emerald' },
  feeling_check: { label: 'How Did They Feel?', icon: '💗', accent: 'pink' },
  why_because: { label: 'Why Did It Happen?', icon: '🤔', accent: 'amber' },
};

// ============================================================================
// Component
// ============================================================================

const StoryTalk: React.FC<StoryTalkProps> = ({ data, className }) => {
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

  const gradeLevel = data.gradeLevel ?? 'K';

  const stableInstanceIdRef = useRef(instanceId || `story-talk-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<StoryTalkItem[]>(() => itemsFromChallenges(challenges), [challenges]);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<StoryTalkMetrics>({
    primitiveType: 'story-talk',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const total = items.length;
    const metrics: StoryTalkMetrics = {
      type: 'story-talk',
      challengeType: data.challengeType,
      totalChallenges: total,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      // The hint channel the click era counted no longer exists — stated as
      // zero rather than repurposed into something it does not measure.
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
      // Every solved story here was solved OUT LOUD; there is no other path.
      voiceAnswerCount: summary.solvedCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, data.challengeType, evaluation]);

  // ── The pack — wording lives in storyTalkScript.ts ─────────────────────────
  const pack = useMemo<JudgedScriptPack<StoryTalkItem>>(() => ({
    ...storyTalkPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to hear your first story.',
      ready: () => 'Listen to the story — then say your answer.',
      retry: () => 'Listen again — then say your answer.',
      noVerdict: () => 'One more time — say your answer out loud.',
      done: 'Great listening today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard?.trim() ?? '';
      return {
        challenge: `Hear a short story, then answer: ${item.question}`,
        expected: `"${item.answer}" said out loud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<StoryTalkItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the story text and the answer may appear. */
  const revealed = runner.currentSolved;
  const modeMeta = MODE_META[currentItem?.mode ?? 'who_what_where'];

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
          These stories are still being written. Try generating them again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — the whole story again, then the question. The
                  listening task's stimulus channel, never a hint ladder, and
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
                aria-label="Hear the story again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {/* The listening card. While the child answers this is AUDIO ONLY —
                for who_what_where and why_because the story states the answer
                word, so printing it would let any reader skip the listening. On
                the affirm it prints as the reveal, beside the answer picture. */}
            {currentItem && (
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`
                    rounded-2xl border-2 px-8 py-6 text-center max-w-md w-full transition-colors
                    ${revealed
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-slate-900/40 border-white/10'}
                  `}
                >
                  {currentItem.displayTitle && (
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-mono mb-1">
                      {currentItem.displayTitle}
                    </div>
                  )}
                  {revealed ? (
                    <>
                      <p className="text-base text-slate-100 leading-relaxed mt-2">
                        {currentItem.story}
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="text-4xl">{currentItem.answerEmoji}</span>
                        <span className="text-lg font-semibold text-emerald-200">
                          {currentItem.answer}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 flex justify-center" aria-hidden>
                      <LuminaReadAloudGlyph size={48} speaking={runner.tutorSpeaking} />
                    </div>
                  )}
                </div>

                {/* The question is the one generated string gated answer-free,
                    so it is the only thing safe to print beside the card. */}
                <p className="text-center text-lg text-slate-200 font-semibold">
                  {currentItem.question}
                </p>
              </div>
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
            heading="Story Time Complete!"
            celebrationMessage="Great listening — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryTalk;
