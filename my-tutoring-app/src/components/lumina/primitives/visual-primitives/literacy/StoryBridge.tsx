'use client';

/**
 * Story Bridge — Kindergarten comparison across two illustrated read-alouds.
 * The same two stories stay on screen for every task in a session. Before a
 * verdict the stage shows only accessible picture references and names; after
 * the verdict it places one evidence excerpt from each story side by side.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle,
  LuminaChallengeCounter, LuminaPanel, LuminaReadAloudGlyph, answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryBridgeMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  evidenceFor, itemsFromChallenges, storyBridgePack, tapVerdictCue,
  type StoryBridgeItem,
} from './storyBridgeScript';

export type StoryBridgeChallengeType =
  | 'match_character'
  | 'match_setting'
  | 'say_alike'
  | 'say_different'
  | 'venn_place'
  | 'sequence_two'
  | 'main_idea_compare';

export type StoryBridgeRelation = 'same' | 'different';
export type StoryBridgeVennRegion = 'story_a' | 'both' | 'story_b';

export interface StoryBridgeCharacter {
  id: string;
  name: string;
  emoji: string;
  /** Picture for this character's event; the evidence sentence stays hidden. */
  eventEmoji: string;
  sentence: string;
  /** Name-free clause true of this character but not their paired character. */
  uniqueDetail: string;
}

export interface StoryBridgeStory {
  id: string;
  title: string;
  sceneEmoji: string;
  setting: string;
  opening: string;
  closing: string;
  mainIdea: string;
  /** Three chronological main events, carried by the character records. */
  characters: StoryBridgeCharacter[];
}

export interface StoryBridgeChallenge {
  id: string;
  type: StoryBridgeChallengeType;
  pairId: string;
  storyAId: string;
  storyBId: string;
  anchorStoryId?: string;
  anchorCharacterId?: string;
  targetStoryId?: string;
  targetCharacterId?: string;
  sharedBehavior?: string;
  comparisonSummary?: string;
  relation?: StoryBridgeRelation;
  settingFocus?: 'place';
  vennDetail?: string;
  vennRegion?: StoryBridgeVennRegion;
  anchorEventIndex?: number;
  targetEventIndex?: number;
}

export interface StoryBridgeData {
  title: string;
  description: string;
  gradeLevel?: string;
  challengeType: StoryBridgeChallengeType | 'mixed';
  stories: StoryBridgeStory[];
  challenges: StoryBridgeChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryBridgeMetrics>) => void;
}

interface StoryBridgeProps { data: StoryBridgeData; className?: string }

const PHASE_CONFIG: Record<StoryBridgeChallengeType, PhaseConfig> = {
  match_character: { label: 'Match Characters', icon: '🌉', accentColor: 'cyan' },
  match_setting: { label: 'Compare Settings', icon: '🏞️', accentColor: 'amber' },
  say_alike: { label: 'Say How Alike', icon: '🟰', accentColor: 'emerald' },
  say_different: { label: 'Say How Different', icon: '↔️', accentColor: 'purple' },
  venn_place: { label: 'Venn Diagram', icon: '⭕', accentColor: 'pink' },
  sequence_two: { label: 'Compare Events', icon: '🧩', accentColor: 'blue' },
  main_idea_compare: { label: 'Compare Big Ideas', icon: '💡', accentColor: 'orange' },
};

const shuffle = <T,>(list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const StoryBridge: React.FC<StoryBridgeProps> = ({ data, className }) => (
  <StoryBridgeSession
    key={[data.instanceId ?? '', ...(data.challenges ?? []).map((challenge) => challenge.id)].join('|')}
    data={data}
    className={className}
  />
);

const StoryBridgeSession: React.FC<StoryBridgeProps> = ({ data, className }) => {
  const {
    title, stories = [], challenges = [], instanceId, skillId, subskillId,
    objectiveId, exhibitId, onEvaluationSubmit,
  } = data;
  const gradeLevel = data.gradeLevel ?? 'K';
  const stableInstanceIdRef = useRef(instanceId || `story-bridge-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const items = useMemo(() => itemsFromChallenges(challenges, stories), [challenges, stories]);
  const [tappedChoice, setTappedChoice] = useState<string | null>(null);
  const tappedChoiceRef = useRef<string | null>(null);
  const [choiceOrder, setChoiceOrder] = useState<string[]>([]);
  const tapLogRef = useRef<Record<string, string[]>>({});

  const evaluation = usePrimitiveEvaluation<StoryBridgeMetrics>({
    primitiveType: 'story-bridge', instanceId: resolvedInstanceId, skillId, subskillId,
    objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const total = items.length;
    const modes = new Set(items.map((item) => item.mode));
    const challengeType = modes.size === 1 ? items[0]?.mode ?? 'mixed' : 'mixed';
    const modeResults = Array.from(modes).map((mode) => {
      const modeItems = items.filter((item) => item.mode === mode);
      const outcomes = summary.outcomes.filter((outcome) => modeItems.some((item) => item.id === outcome.id));
      const correct = outcomes.filter((outcome) => outcome.solved).length;
      return { mode, total: modeItems.length, correct, accuracy: modeItems.length ? (correct / modeItems.length) * 100 : 0 };
    });
    const metrics: StoryBridgeMetrics = {
      type: 'story-bridge', challengeType, modeResults, totalChallenges: total,
      correctCount: summary.solvedCount, attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount, hintsViewed: summary.hearTaps,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
    };
    evaluation.submitResult(
      summary.passed, summary.accuracy, metrics,
      {
        challengeResults: summary.outcomes,
        observations: summary.observations,
        hearTaps: summary.hearTaps,
        comparisons: items.map((item) => ({
          id: item.id, mode: item.mode, storyA: item.storyA.id, storyB: item.storyB.id,
          evidence: evidenceFor(item), taps: tapLogRef.current[item.id] ?? [],
        })),
      },
      undefined, summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  const pack = useMemo(() => storyBridgePack(items, () => tappedChoiceRef.current), [items]);
  const runner = useJudgedScriptRunner<StoryBridgeItem>({
    pack, instanceId: resolvedInstanceId, gradeLevel, exhibitId, onFinished: handleFinished,
    onItemOpened: (item) => {
      setTappedChoice(null);
      tappedChoiceRef.current = null;
      setChoiceOrder(shuffle(item.choiceIds));
    },
    onCorrectionRetry: (item) => {
      setTappedChoice(null);
      tappedChoiceRef.current = null;
      setChoiceOrder(shuffle(item.choiceIds));
    },
  });

  const currentItem = runner.currentItem;
  const revealed = runner.currentSolved;
  const handleTap = useCallback((choiceId: string) => {
    const item = runner.currentItem;
    if (!item || item.answerKind !== 'gesture') return;
    if (!runner.canAttempt || evaluation.hasSubmitted || runner.isAwaitingGesture()) return;
    setTappedChoice(choiceId);
    tappedChoiceRef.current = choiceId;
    (tapLogRef.current[item.id] ??= []).push(choiceId);
    runner.submitGestureAttempt(tapVerdictCue(item, choiceId));
  }, [runner, evaluation.hasSubmitted]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => PHASE_CONFIG[item.mode]);
  }, [evaluation.hasSubmitted, runner.summary, items]);

  const choiceState = (id: string): AnswerChoiceState => {
    if (!currentItem) return 'idle';
    if (revealed) {
      if (id === currentItem.correctChoiceId) return 'correct';
      if (id === tappedChoice) return 'incorrect';
      return 'dimmed';
    }
    return id === tappedChoice ? 'incorrect' : 'idle';
  };

  const renderCharacterCard = (character: StoryBridgeCharacter, role: 'anchor' | 'choice' | 'context') => {
    const tappable = role === 'choice' && currentItem?.answerKind === 'gesture' && !revealed;
    const state: AnswerChoiceState = role === 'anchor' ? 'selected' : role === 'context' ? 'dimmed' : choiceState(character.id);
    return (
      <button key={character.id} type="button" onClick={() => handleTap(character.id)}
        disabled={!tappable || !runner.canAttempt || evaluation.hasSubmitted}
        aria-label={role === 'anchor' ? `${character.name}, the friend to compare` : character.name}
        className={`flex min-w-[6rem] flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3 transition-all ${answerStateClass(state)} ${role === 'anchor' ? 'ring-2 ring-cyan-300/70 shadow-lg shadow-cyan-400/20 scale-105' : ''} ${tappable ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}`}>
        <span className="text-4xl sm:text-5xl" role="img" aria-hidden>{character.emoji}</span>
        <span className="text-sm font-semibold text-slate-100">{character.name}</span>
      </button>
    );
  };

  const renderStoryPanel = (story: StoryBridgeStory) => {
    if (!currentItem) return null;
    const isAnchor = story.id === currentItem.anchorStory.id;
    const characterMode = ['match_character', 'say_alike', 'say_different', 'venn_place'].includes(currentItem.mode);
    const characters = isAnchor ? story.characters
      : choiceOrder.map((id) => story.characters.find((character) => character.id === id)).filter(Boolean) as StoryBridgeCharacter[];
    const ordered = characters.length ? characters : story.characters;
    return (
      <LuminaPanel key={story.id} accent={isAnchor ? 'cyan' : 'amber'} className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-4xl" role="img" aria-hidden>{story.sceneEmoji}</span>
          <span className="text-base font-semibold text-slate-100">{story.title}</span>
        </div>
        {characterMode && (
          <div className="flex flex-wrap justify-center gap-2">
            {ordered.map((character) => {
              const isComparedCharacter = character.id === currentItem.anchor.id
                || (currentItem.mode !== 'match_character' && character.id === currentItem.target.id);
              return renderCharacterCard(
                character,
                isComparedCharacter ? 'anchor'
                  : currentItem.mode === 'match_character' && story.id === currentItem.targetStory.id ? 'choice' : 'context',
              );
            })}
          </div>
        )}
      </LuminaPanel>
    );
  };

  const renderSimpleChoices = () => {
    if (!currentItem || currentItem.answerKind !== 'gesture' || currentItem.mode === 'match_character') return null;
    if (currentItem.mode === 'sequence_two') {
      const byId = new Map(currentItem.targetStory.characters.map((character) => [character.id, character]));
      return (
        <div className="grid grid-cols-3 gap-2">
          {(choiceOrder.length ? choiceOrder : currentItem.choiceIds).map((id) => {
            const event = byId.get(id);
            if (!event) return null;
            return (
              <button key={id} type="button" onClick={() => handleTap(id)} disabled={!runner.canAttempt || revealed}
                className={`rounded-2xl border-2 p-4 text-center transition-all ${answerStateClass(choiceState(id))}`}>
                <span className="block text-4xl" role="img" aria-hidden>{event.emoji}{event.eventEmoji}</span>
                <span className="mt-1 block text-xs text-slate-300">Story two event</span>
              </button>
            );
          })}
        </div>
      );
    }
    const labels: Record<string, { icon: string; label: string }> = currentItem.mode === 'match_setting'
      ? { same: { icon: '🟰', label: 'Same kind' }, different: { icon: '↔️', label: 'Different' } }
      : {
          story_a: { icon: currentItem.anchor.emoji, label: `${currentItem.anchor.name} only` },
          both: { icon: '⭕', label: 'Both friends' },
          story_b: { icon: currentItem.target.emoji, label: `${currentItem.target.name} only` },
        };
    return (
      <div className={`grid gap-2 ${currentItem.mode === 'match_setting' ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {(choiceOrder.length ? choiceOrder : currentItem.choiceIds).map((id) => (
          <button key={id} type="button" onClick={() => handleTap(id)} disabled={!runner.canAttempt || revealed}
            className={`rounded-2xl border-2 p-4 text-center transition-all ${answerStateClass(choiceState(id))}`}>
            <span className="block text-3xl" role="img" aria-hidden>{labels[id]?.icon}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-100">{labels[id]?.label}</span>
          </button>
        ))}
      </div>
    );
  };

  if (items.length === 0) {
    return <LuminaCard className={className}><LuminaCardContent className="p-8 text-center text-slate-400">These two stories are still being written. Try generating them again.</LuminaCardContent></LuminaCard>;
  }

  const evidence = currentItem ? evidenceFor(currentItem) : null;
  const answerMix = judgedAnswerMix(items);
  const celebration = answerMix === 'voice' ? 'You used both stories to explain your comparisons!'
    : answerMix === 'gesture' ? 'You matched details across both stories!'
      : 'You matched, sorted, and explained ideas across both stories!';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && currentItem && (
            <LuminaBadge accent="cyan" className="text-xs">{PHASE_CONFIG[currentItem.mode].icon} {PHASE_CONFIG[currentItem.mode].label}</LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && currentItem && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter current={Math.min(runner.currentIndex + 1, items.length)} total={items.length} variant="dots" />
              <button type="button" onClick={runner.hearStimulus}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}`}
                aria-label="Hear both stories again"><span className="text-xl">🔁</span></button>
              <LuminaReadAloudGlyph size={32} speaking={runner.tutorSpeaking} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              {renderStoryPanel(currentItem.storyA)}
              <div className={`flex items-center justify-center rounded-2xl px-3 py-2 md:min-w-[4.5rem] bg-gradient-to-b from-sky-500/10 via-sky-500/25 to-sky-500/10 border border-sky-400/20 transition-all duration-500 ${revealed ? 'shadow-lg shadow-cyan-400/20' : ''}`} aria-hidden>
                <span className={`text-3xl transition-transform duration-500 ${revealed ? 'scale-125' : 'opacity-60'}`}>{revealed ? '🌉' : '🌊'}</span>
              </div>
              {renderStoryPanel(currentItem.storyB)}
            </div>
            {currentItem.mode === 'venn_place' && !revealed && (
              <div className="mx-auto max-w-md rounded-full border-2 border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-center text-sm font-semibold text-slate-100">💬 {currentItem.vennDetail}</div>
            )}
            {currentItem.mode === 'sequence_two' && !revealed && (
              <div className="mx-auto flex max-w-sm items-center justify-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Story one event</span>
                <span className="text-4xl" role="img" aria-hidden>{currentItem.anchor.emoji}{currentItem.anchor.eventEmoji}</span>
              </div>
            )}
            {renderSimpleChoices()}
            {revealed && evidence && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-center text-base font-semibold text-emerald-200">{evidence.summary}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <LuminaPanel className="text-sm text-slate-100"><span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400 font-mono">{currentItem.storyA.title}</span>{evidence.storyA}</LuminaPanel>
                  <LuminaPanel className="text-sm text-slate-100"><span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400 font-mono">{currentItem.storyB.title}</span>{evidence.storyB}</LuminaPanel>
                </div>
              </div>
            )}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap your comparison" voiceLabel="Your turn — compare both stories" idleLabel="Story time" />
          </>
        )}
        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs} heading="Story Bridge Complete!" celebrationMessage={celebration} />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryBridge;
