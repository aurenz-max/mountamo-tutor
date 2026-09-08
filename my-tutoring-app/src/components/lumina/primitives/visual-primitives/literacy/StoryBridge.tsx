'use client';

/**
 * StoryBridge — K Comparing Texts, judged-loop birth (2026-09-07).
 *
 * Two stories sit on facing shores. The Live tutor reads both, names ONE
 * character (the anchor), and the child TAPS the character on the other shore
 * who is alike by what they did or felt. The tap is the commit: the runner's
 * gesture path hands the tutor the verdict line, the tutor speaks it, and its
 * affirmation is the only advance. No Next button, no timer, no answer on
 * screen before the affirm.
 *
 * Stage rules (the answer-leak audit, walked at birth):
 *  - Story TEXT never prints while the child chooses — the stories are audio,
 *    re-hearable by the 🔁 tap. On the affirm the two evidence sentences print
 *    side by side, which is the design's feedback ("bring the two excerpts
 *    together").
 *  - Cards carry a picture and a name only. No trait text, no shared color
 *    coding: every card wears the same chrome, the anchor a glow ring, and the
 *    far shore is reshuffled on every item so position cannot encode the pair.
 *  - The anchor's own shore is never tappable; the far shore is the whole
 *    answer set (2-4 characters), so a guess floors at 1-in-3 and the
 *    correction cap (2) plus evidence-based re-modeling carries the teaching.
 *
 * Cue lines, judging contract and build gates live in `storyBridgeScript.ts`
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
  LuminaPanel,
  LuminaReadAloudGlyph,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryBridgeMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  itemsFromChallenges,
  storyBridgePack,
  tapVerdictCue,
  type StoryBridgeItem,
} from './storyBridgeScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/** Core task identity at birth. `/add-eval-modes` widens this union
 *  (match_setting, say_alike, say_different, …). */
export type StoryBridgeChallengeType = 'match_character';

export interface StoryBridgeCharacter {
  id: string;
  /** Spoken by the tutor; printed under the picture. "Kitten", "Little Bird". */
  name: string;
  /** The card picture. Paired characters must NOT share one (build gate). */
  emoji: string;
  /** The story sentence about THIS character — read aloud inside the story,
   *  printed only on the affirm as evidence. */
  sentence: string;
}

export interface StoryBridgeStory {
  id: string;
  title: string;
  sceneEmoji: string;
  opening: string;
  closing: string;
  /** 2-4 characters; 3 at birth. Their sentences, in order, ARE the story body. */
  characters: StoryBridgeCharacter[];
}

export interface StoryBridgeChallenge {
  id: string;
  type: StoryBridgeChallengeType;
  /** Both stories of one pair share this; the first item of a pair reads them. */
  pairId: string;
  anchorStoryId: string;
  anchorCharacterId: string;
  targetStoryId: string;
  targetCharacterId: string;
  /** Name-free past-tense clause after "both": "were lost and felt scared". */
  sharedBehavior: string;
}

export interface StoryBridgeData {
  title: string;
  description: string;
  gradeLevel?: string;
  challengeType: StoryBridgeChallengeType;
  /** Every story any challenge references — two per pair, in shore order. */
  stories: StoryBridgeStory[];
  /** 3-6 challenges. REQUIRED — built by the generator's pair orchestrator. */
  challenges: StoryBridgeChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryBridgeMetrics>) => void;
}

interface StoryBridgeProps {
  data: StoryBridgeData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<StoryBridgeChallengeType, PhaseConfig> = {
  match_character: { label: 'Alike Across Stories', icon: '🌉', accentColor: 'cyan' },
};

const shuffle = <T,>(list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ============================================================================
// Component
// ============================================================================

/** A new payload remounts the session so an old verdict cannot score regenerated stories. */
const StoryBridge: React.FC<StoryBridgeProps> = ({ data, className }) => (
  <StoryBridgeSession
    key={[data.instanceId ?? '', ...(data.challenges ?? []).map((c) => c.id)].join('|')}
    data={data}
    className={className}
  />
);

const StoryBridgeSession: React.FC<StoryBridgeProps> = ({ data, className }) => {
  const {
    title,
    stories = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const gradeLevel = data.gradeLevel ?? 'K';

  const stableInstanceIdRef = useRef(instanceId || `story-bridge-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked. */
  const items = useMemo<StoryBridgeItem[]>(
    () => itemsFromChallenges(challenges, stories),
    [challenges, stories],
  );

  // ── Stage state (reset per item) ──────────────────────────────────────────
  const [tapped, setTapped] = useState<StoryBridgeCharacter | null>(null);
  const tappedRef = useRef<StoryBridgeCharacter | null>(null);
  const [farShoreOrder, setFarShoreOrder] = useState<string[]>([]);
  /** Evidence for the submit payload: every tap, per item. */
  const tapLogRef = useRef<Record<string, string[]>>({});

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<StoryBridgeMetrics>({
    primitiveType: 'story-bridge',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const total = items.length;
    const metrics: StoryBridgeMetrics = {
      type: 'story-bridge',
      challengeType: 'match_character',
      totalChallenges: total,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      {
        challengeResults: summary.outcomes,
        observations: summary.observations,
        hearTaps: summary.hearTaps,
        // The design's evidence rule: the source of each selected card and the
        // relation asserted, per bridge.
        bridges: items.map((item) => ({
          id: item.id,
          anchor: { story: item.anchorStory.id, character: item.anchor.id },
          target: { story: item.targetStory.id, character: item.target.id },
          sharedBehavior: item.sharedBehavior,
          taps: tapLogRef.current[item.id] ?? [],
        })),
      },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  // ── The pack — wording lives in storyBridgeScript.ts ──────────────────────
  const pack = useMemo(
    () => storyBridgePack(items, () => tappedRef.current),
    [items],
  );

  const runner = useJudgedScriptRunner<StoryBridgeItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onItemOpened: (item) => {
      setTapped(null);
      tappedRef.current = null;
      setFarShoreOrder(shuffle(item.options.map((c) => c.id)));
    },
    onFinished: handleFinished,
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the pair and its evidence may appear. */
  const revealed = runner.currentSolved;

  // ── The tap IS the commit ─────────────────────────────────────────────────
  const handleTap = useCallback((character: StoryBridgeCharacter) => {
    const item = runner.currentItem;
    if (!item) return;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    // `canAttempt` closes through batched React state; this ref check stops a
    // second tap in the same tick.
    if (runner.isAwaitingGesture()) return;
    setTapped(character);
    tappedRef.current = character;
    (tapLogRef.current[item.id] ??= []).push(character.id);
    runner.submitGestureAttempt(tapVerdictCue(item, character));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, () => PHASE_CONFIG.match_character);
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const shoreStories = useMemo(() => {
    if (!currentItem) return [] as StoryBridgeStory[];
    const ids = new Set([currentItem.anchorStory.id, currentItem.targetStory.id]);
    return stories.filter((s) => ids.has(s.id));
  }, [currentItem, stories]);

  const farShoreState = (character: StoryBridgeCharacter): AnswerChoiceState => {
    if (!currentItem) return 'idle';
    const isTarget = character.id === currentItem.target.id;
    if (revealed) {
      if (isTarget) return 'correct';
      if (tapped?.id === character.id) return 'incorrect';
      return 'dimmed';
    }
    if (tapped?.id === character.id && !isTarget) return 'incorrect';
    return 'idle';
  };

  const renderCard = (
    character: StoryBridgeCharacter,
    role: 'anchor' | 'anchor-shore' | 'far-shore',
  ) => {
    const tappable = role === 'far-shore' && !revealed && runner.canAttempt && !evaluation.hasSubmitted;
    const state: AnswerChoiceState = role === 'far-shore'
      ? farShoreState(character)
      : role === 'anchor'
        ? 'selected'
        : 'dimmed';
    return (
      <button
        key={character.id}
        type="button"
        onClick={() => handleTap(character)}
        disabled={!tappable}
        aria-label={role === 'anchor' ? `${character.name}, the friend to match` : character.name}
        className={`
          flex min-w-[6.5rem] flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3 transition-all
          ${answerStateClass(state)}
          ${role === 'anchor' ? 'ring-2 ring-cyan-300/70 shadow-lg shadow-cyan-400/20 scale-105' : ''}
          ${tappable ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
        `}
      >
        <span className="text-4xl sm:text-5xl" role="img" aria-hidden>{character.emoji}</span>
        <span className="text-sm font-semibold text-slate-100">{character.name}</span>
      </button>
    );
  };

  const renderShore = (story: StoryBridgeStory) => {
    if (!currentItem) return null;
    const isAnchorShore = story.id === currentItem.anchorStory.id;
    const ordered = isAnchorShore
      ? story.characters
      : farShoreOrder
        .map((id) => story.characters.find((c) => c.id === id))
        .filter((c): c is StoryBridgeCharacter => Boolean(c));
    const cards = ordered.length ? ordered : story.characters;
    return (
      <LuminaPanel
        key={story.id}
        accent={isAnchorShore ? 'cyan' : 'amber'}
        className="flex flex-col items-center gap-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-3xl" role="img" aria-hidden>{story.sceneEmoji}</span>
          <span className="text-base font-semibold text-slate-100">{story.title}</span>
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400 font-mono">
          {isAnchorShore ? 'This friend…' : '…is like which friend here?'}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {cards.map((c) =>
            renderCard(
              c,
              isAnchorShore
                ? (c.id === currentItem.anchor.id ? 'anchor' : 'anchor-shore')
                : 'far-shore',
            ))}
        </div>
      </LuminaPanel>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These two stories are still being written. Try generating them again.
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
            <LuminaBadge accent="cyan" className="text-xs">
              🌉 {PHASE_CONFIG.match_character.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && currentItem && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — BOTH stories again, then the ask. The listening
                  task's stimulus channel, never a hint ladder. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear both stories again"
              >
                <span className="text-xl">🔁</span>
              </button>
              <LuminaReadAloudGlyph size={32} speaking={runner.tutorSpeaking} />
            </div>

            {/* The two shores and the river between them. */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              {shoreStories[0] && renderShore(shoreStories[0])}
              <div
                className={`
                  flex items-center justify-center rounded-2xl px-3 py-2 md:min-w-[4.5rem]
                  bg-gradient-to-b from-sky-500/10 via-sky-500/25 to-sky-500/10
                  border border-sky-400/20 transition-all duration-500
                  ${revealed ? 'shadow-lg shadow-cyan-400/20' : ''}
                `}
                aria-hidden
              >
                <span className={`text-3xl transition-transform duration-500 ${revealed ? 'scale-125' : 'opacity-60'}`}>
                  {revealed ? '🌉' : '🌊'}
                </span>
              </div>
              {shoreStories[1] && renderShore(shoreStories[1])}
            </div>

            {/* Reveal-on-affirm: the pair, the shared behavior, and the two
                evidence sentences side by side. Nothing here renders before
                the tutor's affirm. */}
            {revealed && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-center text-base font-semibold text-emerald-200">
                  {currentItem.anchor.emoji} {currentItem.anchor.name} and {currentItem.target.emoji} {currentItem.target.name}
                  {' '}— both {currentItem.sharedBehavior}.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <LuminaPanel className="text-sm text-slate-100">
                    <span className="block text-[11px] uppercase tracking-wide text-slate-400 font-mono mb-1">
                      {currentItem.anchorStory.title}
                    </span>
                    {currentItem.anchor.sentence}
                  </LuminaPanel>
                  <LuminaPanel className="text-sm text-slate-100">
                    <span className="block text-[11px] uppercase tracking-wide text-slate-400 font-mono mb-1">
                      {currentItem.targetStory.title}
                    </span>
                    {currentItem.target.sentence}
                  </LuminaPanel>
                </div>
              </div>
            )}

            {/* Open for the whole run — the tutor's audio needs the gesture,
                and the panel carries the status line and start control. */}
            <JudgedMicPanel
              run={runner}
              answerKind="gesture"
              gestureLabel="Tap the friend who is alike"
              idleLabel="Story time"
            />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Story Bridge Complete!"
            celebrationMessage="You found the friends who are alike in both stories!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryBridge;
