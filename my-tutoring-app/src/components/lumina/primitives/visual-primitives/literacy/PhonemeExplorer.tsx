'use client';

/**
 * PhonemeExplorer — DI modality (sixth literacy port, 2026-08-11; second
 * literacy consumer of useJudgedScriptRunner). The Live tutor owns the clock
 * in every mode: it asks, waits, judges the child's spoken answer from the
 * audio in-band, corrects contrastively, and its OWN verdict is the advance.
 * There is no advance timer, no answer buttons, no Next button and no
 * push-to-talk mic anywhere in this file.
 *
 * ALL FOUR MODES ARE VERBAL — the old 4-choice grid was a costume on each:
 *  - isolate: the four cards STAY as the on-screen MENU (the question side,
 *    unmarked — print is not a leak here) but the answer is SAID, not tapped.
 *    Tapping a card speaks that word (tap-to-hear, never a commit).
 *  - blend: the phoneme tiles stay (stimulus; tap one to hear that sound) and
 *    the child SAYS the blended word. Picking "cat" among four printed words
 *    was word recognition, not blending.
 *  - segment: the child SAYS how many sounds they hear. The printed word is
 *    GONE deliberately — a reader counts letters, which is exactly the skill
 *    this mode is not; the word arrives by voice (+ picture, tap-to-hear).
 *  - manipulate: the child SAYS the new word (sound-swap's ruling in its
 *    sibling primitive). The original word stays printed — it is the stimulus.
 *
 * SUPPORT TIERS SURVIVE THE PORT (L3 contract): the worked-example card and
 * its sub-label (isolate), the picture cues, the blend cue furniture and the
 * printed operation detail are still tier-withdrawn at render time from the
 * same generator-stamped flags; the read-aloud lever now governs whether the
 * scripted ask ENUMERATES the menu (phonemeExplorerScript honors it).
 *
 * ANSWER-LEAK RULE: blend/manipulate answers and segment's count appear on
 * screen only after the tutor has affirmed. Tap-to-hear re-speaks question-
 * side audio only ([PE_HEAR] cues).
 *
 * Items that cannot be asked or judged honestly (unsayable blend walk, the
 * answer inside the operation prose, an example word sitting in the menu) are
 * DROPPED at build time by `itemsFromChallenges` — ship nothing over a broken
 * ask.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhonemeExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  hearSoundCue,
  hearWordCue,
  itemsFromChallenges,
  phonemeExplorerPackBase,
  type PhonemeExplorerItem,
} from './phonemeExplorerScript';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface PhonemeChoice {
  word: string;
  emoji: string;
  correct: boolean;
}

interface PhonemeChallenge {
  id: string;
  mode: 'isolate' | 'blend' | 'segment' | 'manipulate';
  // -- isolate fields --
  phoneme?: string;
  phonemeSound?: string;
  exampleWord?: string;
  exampleEmoji?: string;
  /** isolate ONLY: the 4-card menu (1 correct, unmarked on screen). */
  choices?: PhonemeChoice[];
  // -- blend fields --
  phonemeSequence?: string[];
  /** blend: the ANSWER — the word the sounds make. Never printed pre-affirm. */
  word?: string;
  emoji?: string;
  // -- segment fields --
  targetWord?: string;
  targetEmoji?: string;
  /** segment: the correct breakdown; its LENGTH is the graded answer. */
  segments?: string[];
  // -- manipulate fields --
  originalWord?: string;
  originalEmoji?: string;
  operation?: string;
  operationDescription?: string;
  /** manipulate: the ANSWER. Never printed pre-affirm. */
  resultWord?: string;
  resultEmoji?: string;
  remediationMove?: 'contrast_phoneme' | 'blend_through' | 'segment_boundary' | 'isolate_operation';

  // ── Within-mode support tier scaffolds (stamped by the generator from
  //    ctx.supportTier). Display/instruction only — they NEVER change the
  //    phonemes, the words, or the answer. ALL OPTIONAL: absent ⇒ legacy
  //    full-help render, which is why every read is `!== false`. ──
  /** isolate — render the worked-example card at all. Default: shown. */
  showExampleWord?: boolean;
  /** isolate — render the "starts with X" sub-label under the example. Default: shown. */
  showExampleHint?: boolean;
  /** all modes — render emoji on the menu cards + the segment/manipulate stimulus. Default: shown. */
  showChoiceEmoji?: boolean;
  /** blend — render the "Blend these sounds together:" cue and the "+" separators. Default: shown. */
  showBlendCue?: boolean;
  /** manipulate — render the authored operationDescription (vs a neutral line). Default: shown. */
  showOperationDetail?: boolean;
  /** ask — enumerate the isolate menu aloud. Default: enumerate. */
  readOptionsAloud?: boolean;
}

export interface PhonemeExplorerData {
  title: string;
  challenges: PhonemeChallenge[];
  /** Within-mode support tier from the manifest (generator stamps per-challenge flags). */
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeLevel?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonemeExplorerMetrics>) => void;
}

interface PhonemeExplorerProps {
  data: PhonemeExplorerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<string, { badge: string; icon: string; prompt: string; accent: LuminaAccent }> = {
  isolate: { badge: 'Sound Match', icon: '🔊', prompt: 'Which word begins with my sound? Say it!', accent: 'blue' },
  blend: { badge: 'Sound Blend', icon: '🧩', prompt: 'Say the sounds fast — what word?', accent: 'purple' },
  segment: { badge: 'Sound Count', icon: '✂️', prompt: 'How many sounds? Say the number!', accent: 'emerald' },
  manipulate: { badge: 'Sound Swap', icon: '🔀', prompt: 'Say the new word!', accent: 'amber' },
};

// ============================================================================
// Component
// ============================================================================

const PhonemeExplorer: React.FC<PhonemeExplorerProps> = ({ data, className }) => {
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

  const stableInstanceIdRef = useRef(instanceId || `phoneme-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const ctx = useLuminaAIContext();

  // ── Items (drop-gated) + a lookup back to the source challenge ────────────
  const items = useMemo<PhonemeExplorerItem[]>(() => {
    const built = itemsFromChallenges(challenges);
    if (built.length < challenges.length) {
      console.warn(
        `[PhonemeExplorer] dropped ${challenges.length - built.length} unaskable challenge(s) (leak/sayability gates)`,
      );
    }
    return built;
  }, [challenges]);

  const challengeById = useMemo(() => {
    const map = new Map<string, PhonemeChallenge>();
    for (const ch of challenges) map.set(ch.id, ch);
    return map;
  }, [challenges]);

  // ── Per-item stage state ──────────────────────────────────────────────────
  /** Affirmed: the first moment the answer may appear on screen. */

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<PhonemeExplorerMetrics>({
    primitiveType: 'phoneme-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: PhonemeExplorerMetrics = {
      type: 'phoneme-explorer',
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      accuracy: summary.accuracy,
      attemptsCount: summary.attemptsCount,
      // Every answer in the DI modality is spoken.
      voiceAnswerCount: summary.solvedCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items.length, evaluation]);

  // ── The pack — the tutor's whole side is `phonemeExplorerPackBase`, spread ─
  //    from the script module so the DI drive-plan endpoint replays the SAME
  //    cues this component sends. Only what the SCREEN owns stays here.
  const pack = useMemo<JudgedScriptPack<PhonemeExplorerItem>>(() => ({
    ...phonemeExplorerPackBase(items),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.kind === 'segment'
        ? 'Listen, then say how many sounds.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.kind === 'segment'
        ? 'Have another go — say how many sounds.'
        : 'Have another go — say your answer.',
      affirmedNext: 'Yes! You heard it.',
      done: 'Great sound work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: item.kind === 'isolate'
        ? `Say which word starts with the ${item.phonemeSound ?? item.phoneme} sound.`
        : item.kind === 'blend'
          ? `Blend ${item.walk} into a whole word.`
          : item.kind === 'segment'
            ? `Count the sounds in "${item.targetWord}".`
            : `${item.operationSpoken ?? 'Change one sound.'} (from "${item.originalWord}")`,
      expected: item.kind === 'segment' ? `${item.answer} (${item.soundCount})` : item.answer,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const runner = useJudgedScriptRunner<PhonemeExplorerItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. The runner
   *  owns this latch now (it replaces the `onItemOpened`/`onAffirmed` pair). */
  const revealed = runner.currentSolved;
  const currentChallenge = currentItem ? challengeById.get(currentItem.id) : undefined;

  // ── Tap-to-hear question-side audio (never a commit, never the answer) ────
  const hearWord = useCallback((word: string | undefined) => {
    if (!word || !ctx.isConnected) return;
    SoundManager.tap();
    ctx.sendText(hearWordCue(word), { silent: true });
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected]);

  const hearSound = useCallback((raw: string | undefined) => {
    if (!raw || !ctx.isConnected) return;
    SoundManager.tap();
    ctx.sendText(hearSoundCue(raw), { silent: true });
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render helpers per mode
  // ============================================================================

  const renderIsolate = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* Phoneme tile — the stimulus. Tap to hear the sound. */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => hearSound(item.phonemeSound ?? item.phoneme)}
          className="rounded-2xl bg-blue-500/15 border-2 border-blue-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <div className="text-5xl font-black text-blue-200 tracking-wide">{item.phoneme}</div>
          <p className="text-sm text-blue-400/70 mt-2 italic">&ldquo;{item.phonemeSound}&rdquo;</p>
        </button>
      </div>

      {/* Worked example — SCAFFOLDING, tier-withdrawn whole at hard; the
          sub-label goes first at medium. Tap to hear the example word. */}
      {ch?.showExampleWord !== false && item.exampleWord && (
        <button
          onClick={() => hearWord(item.exampleWord)}
          className="mx-auto flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3 cursor-pointer"
        >
          <span className="text-3xl">{item.exampleEmoji}</span>
          <div className="text-center">
            <span className="text-xl font-bold text-slate-100">{item.exampleWord}</span>
            {ch?.showExampleHint !== false && (
              <p className="text-xs text-slate-500">
                starts with <span className="text-blue-300 font-semibold">{item.phoneme}</span>
              </p>
            )}
          </div>
        </button>
      )}

      <p className="text-center text-base text-slate-300 font-medium">
        {MODE_META.isolate.prompt}
      </p>

      {/* The MENU — the question side, unmarked. Tap a card to HEAR its word;
          the answer is spoken, never tapped. Reveal highlights on affirm. */}
      <div className="grid grid-cols-2 gap-3">
        {(item.menu ?? []).map((card, idx) => {
          const isAnswer = card.word.toLowerCase() === item.answer.toLowerCase();
          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => hearWord(card.word)}
              className={`
                rounded-xl border-2 p-4 flex flex-col items-center gap-2
                transition-all duration-200 cursor-pointer
                ${revealed && isAnswer
                  ? 'bg-emerald-500/15 border-emerald-400/50 ring-2 ring-emerald-400/40'
                  : 'bg-white/5 border-white/10 hover:border-white/25'}
              `}
            >
              {(ch?.showChoiceEmoji !== false) && <span className="text-3xl">{card.emoji}</span>}
              <span className="text-lg font-bold">{card.word}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-500">Tap a card to hear it — then say your answer out loud.</p>
    </div>
  );

  const renderBlend = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        {ch?.showBlendCue !== false && (
          <p className="text-sm text-purple-400/70 font-medium">Blend these sounds together:</p>
        )}
        <div className="flex items-center gap-2">
          {item.phonemeSequence?.map((p, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => hearSound(p)}
                className="rounded-xl bg-purple-500/15 border-2 border-purple-500/30 px-5 py-4 text-center cursor-pointer"
              >
                <span className="text-2xl font-black text-purple-200">/{p.replace(/\//g, '')}/</span>
              </button>
              {ch?.showBlendCue !== false && i < (item.phonemeSequence?.length ?? 0) - 1 && (
                <span className="text-purple-400/50 text-lg">+</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.blend.prompt}</p>

      {/* The reveal — the first moment the word may appear on screen. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.answerEmoji} {item.answer}
          </span>
        </LuminaPanel>
      )}
      <p className="text-center text-xs text-slate-500">Tap a sound to hear it.</p>
    </div>
  );

  const renderSegment = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* The word is NEVER printed — a reader would count letters, not sounds.
          The picture (tier-withdrawable) + tap-to-hear carry the stimulus. */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => hearWord(item.targetWord)}
          className="rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 px-10 py-6 text-center cursor-pointer"
        >
          <span className="text-5xl">
            {(ch?.showChoiceEmoji !== false) ? item.targetEmoji : '🔊'}
          </span>
          <p className="text-xs text-emerald-300/70 mt-2">Tap to hear the word</p>
        </button>
      </div>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.segment.prompt}</p>

      {/* The reveal — count + breakdown appear only after the affirmation. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.targetWord} — {item.answer} sounds
          </span>
          {item.segments && (
            <p className="text-slate-300 text-sm mt-1 font-mono">
              {item.segments.map((s) => `/${s.replace(/\//g, '')}/`).join(' ')}
            </p>
          )}
        </LuminaPanel>
      )}
    </div>
  );

  const renderManipulate = (item: PhonemeExplorerItem, ch: PhonemeChallenge | undefined) => (
    <div className="space-y-5">
      {/* Original word — the stimulus, printed (sound-swap's rule). Tap to hear. */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => hearWord(item.originalWord)}
          className="rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 px-10 py-6 text-center cursor-pointer"
        >
          {(ch?.showChoiceEmoji !== false) && <span className="text-4xl">{item.originalEmoji}</span>}
          <div className="text-3xl font-black text-amber-200 mt-2">{item.originalWord}</div>
        </button>
      </div>

      {/* Operation — tier-withdrawable print; the scripted ask always says it. */}
      <LuminaPanel className="text-center">
        <p className="text-base text-slate-200 font-medium">
          {ch?.showOperationDetail === false ? 'Make a new word.' : ch?.operationDescription}
        </p>
      </LuminaPanel>

      <p className="text-center text-base text-slate-300 font-medium">{MODE_META.manipulate.prompt}</p>

      {/* The reveal — the first moment the new word may appear on screen. */}
      {revealed && (
        <LuminaPanel className="p-3 text-center">
          <span className="text-emerald-300 text-xl font-black">
            {item.answerEmoji} {item.answer}
          </span>
        </LuminaPanel>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
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

  const modeMeta = MODE_META[currentItem?.kind ?? 'isolate'];

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
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {currentItem && currentItem.kind === 'isolate' && renderIsolate(currentItem, currentChallenge)}
            {currentItem && currentItem.kind === 'blend' && renderBlend(currentItem, currentChallenge)}
            {currentItem && currentItem.kind === 'segment' && renderSegment(currentItem, currentChallenge)}
            {currentItem && currentItem.kind === 'manipulate' && renderManipulate(currentItem, currentChallenge)}

            {/* Every mode here is answered out loud. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Phoneme Explorer Complete!"
            celebrationMessage="Great job hearing every sound!"
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PhonemeExplorer;
