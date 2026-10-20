'use client';

/**
 * PictureVocabulary, taught on the shared teaching workspace only (the boss: `pictureVocabulary.card.ts` +
 * `pictureVocabulary.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 * The tutor teaches in its own words and judges each spoken answer against the key, the activity checks each picture
 * tap, and the runtime owns progression. There is no advance timer, no Next button and no answer chips in this file.
 * The domain is `pictureVocabularyDomain.ts`, the levers `pictureVocabularyLevers.ts`; nothing here writes a spoken
 * line. pair_build is the shared pair board (`RhymePairSurface.tsx`), wired from the same boss.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - naming / opposite / gradable_scale / sentence_frame / association: the answer is SPOKEN and judged by the tutor.
 *    No word chips: a printed option list is an answer leak.
 *  - receptive_match: the answer is a TAP on emoji-only picture cards. Picking the referent out of four IS the
 *    receptive skill, so the tap stays; it commits through `commitGesture` with the activity's own check.
 *  - association is an OPEN set: nothing names the generated partner on reveal, only a mark that they go together.
 *
 * ANSWER-LEAK RULE: the target word appears on screen only after credit. Tap-to-hear re-speaks the QUESTION, never
 * the answer.
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
import type { TeachingWorkspace, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { describeCardTap, hearQuestionRequest, itemsFromChallenges, pictureVocabScene, asPictureBoard,
  type PictureVocabItem } from './pictureVocabularyDomain';
import { CLUE_LEVER, MODEL_LEVER, PICTURE_VOCAB_LEVERS, modelFor, pictureBoardLevers, pictureVocabMiss }
  from './pictureVocabularyLevers';
import { pictureVocabularyBoss } from './pictureVocabulary.boss';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import RhymePairSurface from './RhymePairSurface';
import { PICTURE_PAIR_RULES, type PicturePairItem } from './picturePairBuild';
import type { WordSpaceStamp } from '../../../service/wordSpace/pick';

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
  /** The kind of thing (animal, food, toy): lets a wrong tap be named against the target's kind. */
  category?: string;
}

export interface PictureVocabChallenge {
  id: string;
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: WordSpaceStamp;
  type: PictureVocabChallengeType;
  /** The word the student must produce (or tap). For 'opposite' this is the OPPOSITE word. */
  word: string;
  /** Picture (emoji) of the target word. Never shown pre-solve in sentence_frame mode. */
  emoji: string;
  /** TAP MODE ONLY (receptive_match): exactly 4 emoji-distinct cards including the target once. Every spoken mode
   *  carries none: a printed option list is an answer leak. */
  options?: PictureVocabOption[];
  // -- receptive_match / naming --
  /** The target's kind of thing (animal, food, toy). */
  category?: string;
  /** A spoken clue: what it does or where it is found. Never the word, its sounds or its letters (`clueLeak`). */
  clue?: string;
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
  /** Session-level mode; mixed sessions still render per challenge.type. `pair_build` is the open build. */
  challengeType: PictureVocabChallengeType | 'pair_build';
  /** 4-6 challenges. REQUIRED — built by the generator from the word pool. Empty on `pair_build`. */
  challenges: PictureVocabChallenge[];
  gradeLevel?: string;
  /** `pair_build` (open build): the shared pair surface runs the session from `pairItems` (`picturePairBuild.ts`). */
  task?: 'pair_build';
  pairItems?: PicturePairItem[];
  /** The lesson's support tier: when a model lever comes (default medium). */
  supportTier?: 'easy' | 'medium' | 'hard';

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

function PictureVocabularySurface({ data, className, runtimePlanItemId }: PictureVocabularyProps) {
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

  const workspace = useRef<TeachingWorkspace | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `picture-vocabulary-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items ──────────────────────────────────────────────────────────────────
  // The boss's builder: the component, the boss and the journey drop the same unaskable items. Everything downstream
  // binds to `items`, never to `challenges`: a dropped challenge was never shown, and scoring it would report a 0.
  const items = useMemo<PictureVocabItem[]>(
    () => itemsFromChallenges(challenges, data.supportTier ?? 'medium'),
    [challenges, data.supportTier],
  );
  const leverCtx = useMemo(() => ({ items }), [items]);

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped card's word (receptive_match): cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier practice item a simplify lever put
  // on screen in its place (ungraded; its success is local).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<PictureVocabItem | null>(null);
  const practiceRef = useRef<PictureVocabItem | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const setPractice = (next: PictureVocabItem | null) => { practiceRef.current = next; setPracticeState(next); setPracticeSolved(false); };

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
    assignment: pictureVocabularyBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setTapped(null),
    // Try again frees the cards.
    onCorrectionRetry: () => setTapped(null),
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const clueShown = !practice && pulledLevers.includes(CLUE_LEVER) && !!currentItem?.clue;
  const modelId = currentItem ? MODEL_LEVER[currentItem.kind] : undefined;
  const vocabModel = !practice && currentItem && modelId && pulledLevers.includes(modelId) ? modelFor(currentItem, items) : null;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** Credited: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved || practiceSolved;

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : PICTURE_VOCAB_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    const scene: WorkspaceScene = pictureVocabScene(currentItem);
    workspace.current = {
      ...leverScene(practice
        ? { ...scene, facts: { ...scene.facts, practice: 'An easier practice item with another word and two very different pictures, ungraded. The full item comes back after it.' } }
        : scene, {
        support: practice ? '' : PICTURE_VOCAB_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : PICTURE_VOCAB_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = PICTURE_VOCAB_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler || simpler.kind === 'pair_build') return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          setTapped(null);
          return { practice: pictureVocabularyBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(null); },
    };
  });

  // ── The tap — receptive_match only; the tap IS the commit, checked by the activity ──
  const handleOptionTap = useCallback((option: PictureVocabOption) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!runner.canAttempt || showSummary) return;
    if (!item || item.answerKind !== 'gesture') return;
    // `canAttempt` closes through batched state; this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(option.word);
    const correct = option.word.toLowerCase() === item.word.toLowerCase();
    if (practiceRef.current && correct) setPracticeSolved(true);
    commitGesture(runner, { response: describeCardTap(option.word), correct, cue: () => describeCardTap(option.word),
      miss: pictureVocabMiss(item, option.word) });
  }, [runner, showSummary]);

  /** Tapping the stimulus asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    runner.requestHear(hearQuestionRequest(currentItem));
  }, [runner, currentItem]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** Say-it and tap-it runs are both legitimate here, so the copy names what this one was. */
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

  // ITEMS, not challenges: a challenge the build gate dropped was never opened, so it has no outcome.
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
    <div data-pip-object="cards" className="grid grid-cols-2 gap-3">
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
            {/* The word appears only after credit. */}
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
      // Association renders the stimulus and nothing else, and nothing names `item.word` on reveal: the set is open,
      // the child may have said "foot" or "drawer", and printing "shoe" would teach that their answer was wrong. The
      // reveal is a mark, not a word.
      case 'association':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
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

  // ITEMS: a payload can arrive with challenges that the build gate all rejects.
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
              {/* The runner's index counts ITEMS, so the denominator must too. */}
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {/* Pip's dock sits above the stage; Pip watches the stage as a whole, never one card. */}
            <PipDock />

            <PipWorkspace className="space-y-4">
              {renderChallenge(currentItem)}
              {/* Help: a clue card the tutor says aloud. What the thing does or where it is found; never the word. */}
              {clueShown && (
                <div data-lever="clue-card" className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-4 py-3 text-center text-sm text-slate-100">
                  <span aria-hidden>💡</span>{currentItem.clue}
                </div>
              )}
              {/* Help on the relation modes: a worked model on words the session never uses. */}
              {vocabModel && (
                <div data-lever="vocab-model" aria-label="Model"
                  className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-4 py-3">
                  <div className="flex items-end justify-center gap-3">
                    {vocabModel.cards.map((card, i) => (
                      <React.Fragment key={card.word}>
                        {i > 0 && vocabModel.kind === 'opposite' && <span aria-hidden className="text-2xl text-cyan-300">↔</span>}
                        {i > 0 && vocabModel.kind === 'association' && <span aria-hidden className="text-2xl text-cyan-300">+</span>}
                        <div data-model-card={card.word} className="flex flex-col items-center gap-1">
                          <span className="text-4xl" role="img" aria-label={card.word}>{card.emoji}</span>
                          {vocabModel.kind === 'gradable_scale' && (
                            <span aria-hidden className="w-8 rounded-t bg-cyan-400/40" style={{ height: `${(i + 1) * 12}px` }} />
                          )}
                          <span className="text-sm text-slate-200">{card.word}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  {vocabModel.sentence && <p className="text-center text-sm text-slate-100">{vocabModel.sentence}</p>}
                </div>
              )}
            </PipWorkspace>
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
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

/** The open build (`pair_build`) on the shared pair board, wired from this boss. */
function PicturePairBuild({ data, className, runtimePlanItemId }: PictureVocabularyProps) {
  const boss = useMemo(() => {
    const tier = data.supportTier ?? 'medium';
    return { assignment: (item: PicturePairItem) => pictureVocabularyBoss.assignment(asPictureBoard(item, tier)), levers: pictureBoardLevers(tier) };
  }, [data.supportTier]);
  return <RhymePairSurface<PicturePairItem> className={className} runtimePlanItemId={runtimePlanItemId}
    rules={PICTURE_PAIR_RULES} data={{ ...data, task: 'pair_build', pairItems: data.pairItems ?? [] }} boss={boss} />;
}

/** One mount, one shape: the open build (`pair_build`) has its own surface. */
function PictureVocabularyHost(props: PictureVocabularyProps) {
  return props.data.task === 'pair_build' ? <PicturePairBuild {...props} /> : <PictureVocabularySurface {...props} />;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PictureVocabulary = withWorkspaceOnly<PictureVocabularyProps>('picture-vocabulary', PictureVocabularyHost,
  props => props.data.title);

export default PictureVocabulary;
