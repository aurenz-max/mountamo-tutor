'use client';

/**
 * Story Ribbon — Kindergarten oral storytelling.
 *
 * The child touches the learning object: three mixed picture cards. Tapping two
 * cards swaps them on the first/next/last ribbon. The board is a planning aid;
 * the assessed production is the child's original connected spoken account.
 * Model sentences stay private until a tutor verdict, so the board never turns
 * into a script to read back.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaReadAloudGlyph,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoryRibbonMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  itemsFromChallenges,
  mixedEventIds,
  storyRibbonPack,
  type StoryRibbonItem,
} from './storyRibbonScript';
import {
  normalizeSupportTier,
  resolveSupportStructure,
  storyRibbonPromptFor,
  type StoryRibbonProblemShape,
  type StoryRibbonSupportOptions,
  type SupportTier,
} from './storyRibbonSupport';

export type StoryRibbonChallengeType =
  | 'tell_connected_account'
  | 'tell_present_account'
  | 'tell_future_account'
  | 'tell_past_account'
  | 'story_to_experience';

export type StoryRibbonTimeCue = 'Today' | 'Yesterday' | 'Tomorrow';
export type StoryRibbonSessionType = StoryRibbonChallengeType | 'mixed';

export interface StoryRibbonEvent {
  id: string;
  /** Canonical chronological position. Code owns it; generated values are validated. */
  order: number;
  /** One pictorial event cue. */
  emoji: string;
  /** Short time-neutral noun phrase shown under the picture, never a sentence. */
  pictureLabel: string;
  /** Hidden semantic answer used by the live judge and post-verdict model. */
  modelSentence: string;
}

export interface StoryRibbonChallenge {
  id: string;
  type: StoryRibbonChallengeType;
  title: string;
  characterName: string;
  characterEmoji: string;
  setting: string;
  /** Visible context cue for tense modes. It never supplies a conjugated verb. */
  timeCue?: StoryRibbonTimeCue;
  /** Exactly three events in canonical first-next-last order. */
  events: StoryRibbonEvent[];
  /** Manifest difficulty after strict normalization. */
  supportTier?: SupportTier;
  /** Code-verified narrative structure for tiered content. */
  problemShape?: StoryRibbonProblemShape;
  /** QA provenance for the structural post-process; absent on untiered content. */
  problemShapeSource?: 'generated' | 'fallback' | 'saturated';
  /** Code-owned display/instruction withdrawal for this challenge's own mode. */
  support?: StoryRibbonSupportOptions;
}

export interface StoryRibbonData {
  title: string;
  description: string;
  gradeLevel?: string;
  challengeType: StoryRibbonSessionType;
  /** Three long-form oral challenges. REQUIRED; built by the Fork B orchestrator. */
  challenges: StoryRibbonChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryRibbonMetrics>) => void;
}

interface StoryRibbonProps {
  data: StoryRibbonData;
  className?: string;
}

const PHASE_CONFIG: Record<StoryRibbonChallengeType, PhaseConfig> = {
  tell_connected_account: { label: 'Connected Story', icon: '🎗️', accentColor: 'emerald' },
  tell_present_account: { label: 'Present-Time Story', icon: '☀️', accentColor: 'amber' },
  tell_future_account: { label: 'Future-Time Story', icon: '🔭', accentColor: 'blue' },
  tell_past_account: { label: 'Past-Time Story', icon: '🕰️', accentColor: 'purple' },
  story_to_experience: { label: 'Story-to-World Connection', icon: '💭', accentColor: 'pink' },
};

const orderedIds = (item: StoryRibbonItem): string[] => item.challenge.events.map((event) => event.id);
const isExperienceItem = (item: StoryRibbonItem): boolean => item.mode === 'story_to_experience';
const initialIdsFor = (item: StoryRibbonItem): string[] =>
  isExperienceItem(item) ? orderedIds(item) : mixedEventIds(item);

const StoryRibbon: React.FC<StoryRibbonProps> = ({ data, className }) => (
  <StoryRibbonSession
    key={[data.instanceId ?? '', ...data.challenges.map((challenge) => challenge.id)].join('|')}
    data={data}
    className={className}
  />
);

const StoryRibbonSession: React.FC<StoryRibbonProps> = ({ data, className }) => {
  const items = useMemo(() => itemsFromChallenges(data.challenges), [data.challenges]);
  const stableInstanceIdRef = useRef(data.instanceId || `story-ribbon-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  const [eventOrder, setEventOrder] = useState<string[]>(() => items[0] ? initialIdsFor(items[0]) : []);
  const eventOrderRef = useRef(eventOrder);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);
  const [affirmedItem, setAffirmedItem] = useState<StoryRibbonItem | null>(null);
  const preparedItemRef = useRef(items[0]?.id ?? '');
  const arrangementsRef = useRef<Record<string, string[][]>>({});
  const arrangementAtTellRef = useRef<Record<string, { order: string[]; correct: boolean }>>({});
  const transcriptsRef = useRef<Record<string, string[]>>({});

  const evaluation = usePrimitiveEvaluation<StoryRibbonMetrics>({
    primitiveType: 'story-ribbon',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const total = items.length;
    const modes = new Set(items.map((item) => item.mode));
    const metrics: StoryRibbonMetrics = {
      type: 'story-ribbon',
      challengeType: modes.size === 1 ? items[0]?.mode ?? 'mixed' : 'mixed',
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
        arrangements: arrangementsRef.current,
        arrangementAtTell: arrangementAtTellRef.current,
        transcripts: transcriptsRef.current,
      },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [evaluation, items.length]);

  const pack = useMemo(() => storyRibbonPack(items), [items]);
  const runner = useJudgedScriptRunner<StoryRibbonItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: data.gradeLevel ?? 'K',
    exhibitId: data.exhibitId,
    silenceCloseMs: 1600,
    onItemOpened: (item) => {
      const mixed = initialIdsFor(item);
      preparedItemRef.current = item.id;
      eventOrderRef.current = mixed;
      setEventOrder(mixed);
      setSelectedEventId(null);
      selectedEventIdRef.current = null;
      arrangementsRef.current[item.id] = [mixed];
    },
    onAffirmed: (item) => setAffirmedItem(item),
    onFinished: handleFinished,
    onEmission: (emission, item) => {
      if (!item) return;
      if (emission.kind === 'attempt-open' && emission.attempt.source === 'voice') {
        const target = orderedIds(item);
        const selected = selectedEventIdRef.current;
        arrangementAtTellRef.current[item.id] = {
          order: isExperienceItem(item) && selected ? [selected] : [...eventOrderRef.current],
          correct: isExperienceItem(item)
            ? Boolean(selected)
            : eventOrderRef.current.every((id, index) => id === target[index]),
        };
      }
      if (emission.kind === 'attempt-transcript') {
        (transcriptsRef.current[item.id] ??= []).push(emission.text);
      }
    },
  });

  const currentItem = runner.currentItem ?? items[0] ?? null;

  /** Belt-and-braces reset keyed to the active content. The runner normally
   * prepares in onItemOpened; this catches a future alternate open path without
   * reshuffling a board that was already prepared. */
  useEffect(() => {
    if (!currentItem || preparedItemRef.current === currentItem.id) return;
    const mixed = initialIdsFor(currentItem);
    preparedItemRef.current = currentItem.id;
    eventOrderRef.current = mixed;
    setEventOrder(mixed);
    setSelectedEventId(null);
    selectedEventIdRef.current = null;
    arrangementsRef.current[currentItem.id] = [mixed];
  }, [currentItem]);

  const displayedEvents = useMemo(() => {
    if (!currentItem) return [];
    return eventOrder
      .map((id) => currentItem.challenge.events.find((event) => event.id === id))
      .filter((event): event is StoryRibbonEvent => Boolean(event));
  }, [currentItem, eventOrder]);

  const arrangementCorrect = Boolean(currentItem)
    && (isExperienceItem(currentItem)
      ? Boolean(selectedEventId)
      : eventOrder.every((id, index) => id === currentItem.challenge.events[index]?.id));

  const handleEventTap = (eventId: string) => {
    if (!currentItem || runner.currentSolved || evaluation.hasSubmitted) return;
    if (isExperienceItem(currentItem)) {
      SoundManager.select();
      setSelectedEventId(eventId);
      selectedEventIdRef.current = eventId;
      (arrangementsRef.current[currentItem.id] ??= []).push([eventId]);
      return;
    }
    if (!selectedEventId) {
      SoundManager.select();
      setSelectedEventId(eventId);
      selectedEventIdRef.current = eventId;
      return;
    }
    if (selectedEventId === eventId) {
      SoundManager.tap();
      setSelectedEventId(null);
      selectedEventIdRef.current = null;
      return;
    }
    const next = [...eventOrderRef.current];
    const first = next.indexOf(selectedEventId);
    const second = next.indexOf(eventId);
    if (first < 0 || second < 0) return;
    SoundManager.snap();
    [next[first], next[second]] = [next[second], next[first]];
    eventOrderRef.current = next;
    (arrangementsRef.current[currentItem.id] ??= []).push([...next]);
    setEventOrder(next);
    setSelectedEventId(null);
    selectedEventIdRef.current = null;
  };

  const phaseResults = useMemo(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => PHASE_CONFIG[item.mode]);
  }, [evaluation.hasSubmitted, items, runner.summary]);

  if (!currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These picture stories are still being made. Try generating the activity again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const phase = PHASE_CONFIG[currentItem.mode];
  const experienceMode = isExperienceItem(currentItem);
  const supportTier = normalizeSupportTier(currentItem.challenge.supportTier);
  const support = currentItem.challenge.support
    ?? resolveSupportStructure(currentItem.mode, supportTier);
  const prompt = supportTier === null
    ? experienceMode
      ? 'Tap one story picture. Then tell what it reminds you of and how the two experiences connect.'
      : currentItem.challenge.timeCue
        ? `Put the pictures in order. Tell the whole story as ${currentItem.challenge.timeCue.toLowerCase()} time.`
        : 'Tap one picture, then another, to trade their places. Tell the story when your ribbon is ready.'
    : storyRibbonPromptFor(currentItem.mode, currentItem.challenge.timeCue, support);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <p className="mt-1 text-sm text-slate-400">{data.description}</p>
          </div>
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent={phase.accentColor}>{phase.icon} {phase.label}</LuminaBadge>
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
              <LuminaReadAloudGlyph size={32} speaking={runner.tutorSpeaking} />
            </div>

            <LuminaPrompt>{prompt}</LuminaPrompt>

            <LuminaPanel accent="emerald" className="overflow-hidden">
              <div className="mb-4 flex items-center justify-center gap-3 text-center">
                <span className="text-4xl" role="img" aria-label={currentItem.challenge.characterName}>
                  {currentItem.challenge.characterEmoji}
                </span>
                <div>
                  <p className="font-semibold text-slate-100">{currentItem.challenge.title}</p>
                  <p className="text-sm text-slate-400">{currentItem.challenge.characterName} · {currentItem.challenge.setting}</p>
                </div>
              </div>

              {currentItem.challenge.timeCue && (
                <div className="mb-4 flex justify-center">
                  <LuminaBadge accent={phase.accentColor}>{currentItem.challenge.timeCue}</LuminaBadge>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                {displayedEvents.map((event, index) => (
                  <React.Fragment key={event.id}>
                    <button
                      type="button"
                      onClick={() => handleEventTap(event.id)}
                      aria-pressed={selectedEventId === event.id}
                      aria-label={`${support.showSequenceLabels ? `${['First', 'Next', 'Last'][index]} picture` : 'Story picture'}: ${event.pictureLabel}. ${experienceMode ? 'Tap to choose this story moment.' : 'Tap to move it.'}`}
                      className={`min-h-36 rounded-2xl border-2 p-4 text-center transition-all ${
                        selectedEventId === event.id
                          ? 'scale-[1.03] border-amber-300 bg-amber-400/15 shadow-lg shadow-amber-400/15'
                          : 'border-white/10 bg-slate-900/35 hover:border-emerald-300/50 hover:bg-emerald-400/10 active:scale-95'
                      }`}
                    >
                      {support.showSequenceLabels && (
                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">
                          {['First', 'Next', 'Last'][index]}
                        </span>
                      )}
                      <span className="my-2 block text-5xl" role="img" aria-hidden>{event.emoji}</span>
                      <span className="block text-sm font-semibold text-slate-100">{event.pictureLabel}</span>
                    </button>
                    {support.showFlowArrows && index < 2 && (
                      <span className="hidden text-2xl text-emerald-300/70 sm:block" aria-hidden>→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {support.showSelfCheck && (
                <p className={`mt-4 text-center text-sm ${arrangementCorrect ? 'text-emerald-200' : 'text-slate-400'}`}>
                  {experienceMode
                    ? selectedEventId
                      ? 'Now connect this moment to something you did, saw, heard about, or imagined.'
                      : 'Choose one story moment. You never have to share anything private.'
                    : arrangementCorrect
                      ? 'The ribbon flows from first to last. Now tell it in your own words.'
                      : selectedEventId
                        ? 'Now tap the picture you want it to trade places with.'
                        : 'Choose any picture you want to move.'}
                </p>
              )}
            </LuminaPanel>

            {experienceMode && (
              <LuminaPanel accent="rose" className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200/80">Your world</p>
                <p className="mt-2 text-3xl" aria-hidden>💭</p>
                {support.showConnectionFrame && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-rose-100">
                    <span className="rounded-full bg-rose-400/15 px-3 py-1.5">Story moment</span>
                    <span aria-hidden>→</span>
                    <span className="rounded-full bg-rose-400/15 px-3 py-1.5">Another experience</span>
                    <span aria-hidden>→</span>
                    <span className="rounded-full bg-rose-400/15 px-3 py-1.5">What is alike?</span>
                  </div>
                )}
                <p className="mt-2 text-sm text-slate-200">
                  You may use something you did, saw, heard about, or imagined. Keep private things private.
                </p>
              </LuminaPanel>
            )}

            {runner.revealHeld && affirmedItem && (
              <LuminaFeedbackCard status="correct" label="Your story connected">
                {affirmedItem.modelResponse}
              </LuminaFeedbackCard>
            )}

            <JudgedMicPanel
              run={runner}
              voiceLabel={experienceMode ? 'Tell your connection' : 'Tell your story'}
              idleLabel={experienceMode ? 'Connect this moment' : 'Tell this story'}
              openingLabel="Opening story time…"
            >
              {runner.running && (
                <LuminaButton tone="ghost" onClick={runner.hearStimulus}>
                  Hear the directions again
                </LuminaButton>
              )}
            </JudgedMicPanel>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Story Ribbons Complete!"
            celebrationMessage="You turned picture moments into connected stories."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryRibbon;
