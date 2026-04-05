'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { TimelineBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface TimelineEvent {
  id: string;
  label: string;
  description?: string;
  /** 0-based index in correct chronological order */
  correctPosition: number;
}

export interface TimelineBuilderChallenge {
  id: string;
  type: 'daily' | 'yearly' | 'historical';
  title: string;
  instruction: string;
  /** Label for the start of the timeline (e.g., "Morning", "January", "1900") */
  scaleStart: string;
  /** Label for the end of the timeline (e.g., "Night", "December", "2000") */
  scaleEnd: string;
  /** Events to place on the timeline — correctPosition gives true order */
  events: TimelineEvent[];
  hint: string;
  narration: string;
}

export interface TimelineBuilderData {
  title: string;
  description?: string;
  challenges: TimelineBuilderChallenge[];
  gradeBand?: 'K-1' | '2-3' | '4-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TimelineBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  daily:      { label: 'Daily Events',      icon: '🌅', accentColor: 'amber' },
  yearly:     { label: 'Yearly Events',     icon: '📅', accentColor: 'blue' },
  historical: { label: 'Historical Events', icon: '🏛️', accentColor: 'purple' },
};

const SCALE_COLORS: Record<string, string> = {
  daily:      'from-amber-500/20 to-orange-500/20',
  yearly:     'from-blue-500/20 to-cyan-500/20',
  historical: 'from-purple-500/20 to-pink-500/20',
};

const SLOT_ACCENT: Record<string, string> = {
  daily:      'border-amber-500/40 bg-amber-500/10',
  yearly:     'border-blue-500/40 bg-blue-500/10',
  historical: 'border-purple-500/40 bg-purple-500/10',
};

// ============================================================================
// Component
// ============================================================================

const TimelineBuilder: React.FC<TimelineBuilderData> = (data) => {
  const {
    title,
    description,
    challenges,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  // ── Evaluation ──────────────────────────────────────────────────
  const resolvedInstanceId = instanceId || 'standalone';
  const gradeLevel = gradeBand || 'K-1';

  const { submitResult } = usePrimitiveEvaluation<TimelineBuilderMetrics>({
    primitiveType: 'timeline-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ── AI Tutoring ─────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeBand,
    currentChallenge: challenges[0]?.title,
  }), [title, gradeBand, challenges]);

  const { sendText } = useLuminaAI({
    primitiveType: 'timeline-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Challenge Progress ──────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Local State ─────────────────────────────────────────────────
  /** Maps slot index → event id (what the student placed) */
  const [placements, setPlacements] = useState<Record<number, string>>({});
  /** Currently selected event id from the bank */
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  /** Feedback after checking */
  const [feedback, setFeedback] = useState<{
    checked: boolean;
    correctSlots: Set<number>;
    incorrectSlots: Set<number>;
  } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);
  const startTimeRef = useRef(Date.now());
  const challengeStartRef = useRef(Date.now());

  const currentChallenge = challenges[currentIndex];

  // ── Derived: which events are placed vs in bank ─────────────────
  const placedEventIds = useMemo(
    () => new Set(Object.values(placements)),
    [placements],
  );

  const bankEvents = useMemo(() => {
    if (!currentChallenge) return [];
    return currentChallenge.events.filter((e) => !placedEventIds.has(e.id));
  }, [currentChallenge, placedEventIds]);

  const slotCount = currentChallenge?.events.length ?? 0;

  // ── Handlers ────────────────────────────────────────────────────

  /** Select an event from the bank */
  const handleSelectEvent = useCallback((eventId: string) => {
    if (feedback?.checked) return;
    setSelectedEventId((prev) => (prev === eventId ? null : eventId));
  }, [feedback]);

  /** Click a slot on the timeline to place the selected event */
  const handleSlotClick = useCallback((slotIndex: number) => {
    if (feedback?.checked) return;

    // If slot already has an event, remove it (send back to bank)
    if (placements[slotIndex]) {
      setPlacements((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
      return;
    }

    // If an event is selected, place it
    if (selectedEventId) {
      // Remove event from any previous slot
      setPlacements((prev) => {
        const next: Record<number, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v !== selectedEventId) next[Number(k)] = v;
        }
        next[slotIndex] = selectedEventId;
        return next;
      });
      setSelectedEventId(null);
    }
  }, [feedback, placements, selectedEventId]);

  /** Check the placement order */
  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    const correctSlots = new Set<number>();
    const incorrectSlots = new Set<number>();

    // Build expected: slot i should have the event with correctPosition === i
    const positionToEventId: Record<number, string> = {};
    for (const evt of currentChallenge.events) {
      positionToEventId[evt.correctPosition] = evt.id;
    }

    for (let i = 0; i < slotCount; i++) {
      const placedId = placements[i];
      if (placedId && placedId === positionToEventId[i]) {
        correctSlots.add(i);
      } else if (placedId) {
        incorrectSlots.add(i);
      }
    }

    const allCorrect = correctSlots.size === slotCount && incorrectSlots.size === 0;

    setFeedback({ checked: true, correctSlots, incorrectSlots });

    if (allCorrect) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: Date.now() - challengeStartRef.current,
        score: 100,
      });
      sendText(
        `[ANSWER_CORRECT] Student placed all ${slotCount} events in the correct order on a ${currentChallenge.type} timeline: "${currentChallenge.title}". Congratulate briefly.`,
        { silent: true },
      );
    } else {
      const pct = Math.round((correctSlots.size / slotCount) * 100);
      if (currentAttempts + 1 >= 3) {
        // Max attempts — record partial score and move on
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          timeMs: Date.now() - challengeStartRef.current,
          score: pct,
        });
        sendText(
          `[ANSWER_INCORRECT] Student got ${correctSlots.size}/${slotCount} correct after 3 attempts on "${currentChallenge.title}". Show the correct order and encourage.`,
          { silent: true },
        );
      } else {
        sendText(
          `[ANSWER_INCORRECT] Student has ${correctSlots.size}/${slotCount} events correct, attempt ${currentAttempts + 1}. The ${incorrectSlots.size} incorrect ones are highlighted red. Give a hint about ordering.`,
          { silent: true },
        );
      }
    }
  }, [currentChallenge, placements, slotCount, currentAttempts, incrementAttempts, recordResult, sendText]);

  /** Retry after incorrect check */
  const handleRetry = useCallback(() => {
    setFeedback(null);
    // Keep placements so student can adjust
  }, []);

  /** Advance to next challenge */
  const handleNext = useCallback(() => {
    setPlacements({});
    setSelectedEventId(null);
    setFeedback(null);
    setShowHint(false);
    challengeStartRef.current = Date.now();

    if (!advanceProgress()) {
      // All done — submit evaluation
      const elapsedMs = Date.now() - startTimeRef.current;
      const totalEvents = challengeResults.reduce((s, r) => s + 1, 0);
      const correctChallenges = challengeResults.filter((r) => r.correct).length;
      const avgScore = challengeResults.length > 0
        ? Math.round(challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / challengeResults.length)
        : 0;
      const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

      const metrics: TimelineBuilderMetrics = {
        type: 'timeline-builder',
        eventsPlaced: challenges.reduce((s, c) => s + c.events.length, 0),
        eventsTotal: challenges.reduce((s, c) => s + c.events.length, 0),
        orderCorrect: correctChallenges === challenges.length,
        positionAccuracy: avgScore,
        attemptsCount: totalAttempts,
      };

      const success = avgScore >= 60;
      submitResult(success, avgScore, metrics);
      setSubmittedResult({ score: avgScore });

      const phaseScoreStr = phaseResults.map(
        (p) => `${p.label} ${p.score}% (${p.attempts} attempts)`,
      ).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${avgScore}%. Give encouraging phase-specific feedback.`,
        { silent: true },
      );
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to timeline ${currentIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [advanceProgress, challengeResults, challenges, currentIndex, phaseResults, sendText, submitResult]);

  // ── Derived state ─────────────────────────────────────────────
  const hasAnsweredCurrent = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id,
  );
  const allSlotsFilled = Object.keys(placements).length === slotCount;
  const canCheck = allSlotsFilled && !feedback?.checked;
  const isCorrect = feedback?.checked && feedback.incorrectSlots.size === 0;
  const canRetry = feedback?.checked && !isCorrect && !hasAnsweredCurrent;
  const canProceed = hasAnsweredCurrent;

  // ── Helper: get event by id ──────────────────────────────────
  const eventById = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    currentChallenge?.events.forEach((e) => map.set(e.id, e));
    return map;
  }, [currentChallenge]);

  // ── Render ──────────────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-light text-slate-100">
              {title}
            </CardTitle>
            <Badge className="bg-white/5 border border-white/20 text-slate-300 text-xs">
              {currentIndex + 1} / {challenges.length}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Summary panel when complete */}
      {allChallengesComplete && phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? 0}
          durationMs={Date.now() - startTimeRef.current}
          heading="Timeline Complete!"
          celebrationMessage="Great work placing events on the timeline!"
          className="mb-6"
        />
      )}

      {/* Active challenge */}
      {!allChallengesComplete && currentChallenge && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            {/* Challenge header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">
                  {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon}
                </span>
                <h3 className="text-lg text-slate-100 font-medium">
                  {currentChallenge.title}
                </h3>
              </div>
              <p className="text-sm text-slate-400">
                {currentChallenge.instruction}
              </p>
            </div>

            {/* Timeline visualization */}
            <div className="relative">
              {/* Scale labels */}
              <div className="flex justify-between mb-2 text-xs text-slate-500 font-mono px-2">
                <span>{currentChallenge.scaleStart}</span>
                <span>{currentChallenge.scaleEnd}</span>
              </div>

              {/* Timeline bar */}
              <div className={`relative h-2 rounded-full bg-gradient-to-r ${SCALE_COLORS[currentChallenge.type] || SCALE_COLORS.daily} mb-4`}>
                {/* Tick marks for slots */}
                {Array.from({ length: slotCount }, (_, i) => {
                  const pct = slotCount <= 1 ? 50 : (i / (slotCount - 1)) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-500"
                      style={{ left: `${pct}%`, transform: `translate(-50%, -50%)` }}
                    />
                  );
                })}
              </div>

              {/* Drop slots */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${slotCount}, 1fr)` }}>
                {Array.from({ length: slotCount }, (_, slotIdx) => {
                  const placedEventId = placements[slotIdx];
                  const placedEvent = placedEventId ? eventById.get(placedEventId) : null;

                  const isCorrectSlot = feedback?.correctSlots.has(slotIdx);
                  const isIncorrectSlot = feedback?.incorrectSlots.has(slotIdx);

                  // Show correct answer after max attempts
                  let correctEventLabel: string | undefined;
                  if (hasAnsweredCurrent && !isCorrect) {
                    const correctEvt = currentChallenge.events.find(
                      (e) => e.correctPosition === slotIdx,
                    );
                    correctEventLabel = correctEvt?.label;
                  }

                  return (
                    <button
                      key={slotIdx}
                      onClick={() => handleSlotClick(slotIdx)}
                      className={`
                        min-h-[4rem] rounded-lg border-2 border-dashed p-2 text-center text-sm
                        transition-all duration-150 flex flex-col items-center justify-center
                        ${isCorrectSlot
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                          : isIncorrectSlot
                            ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                            : placedEvent
                              ? `${SLOT_ACCENT[currentChallenge.type] || SLOT_ACCENT.daily} text-slate-200`
                              : selectedEventId
                                ? 'border-white/30 bg-white/5 text-slate-500 hover:bg-white/10 cursor-pointer ring-1 ring-white/20'
                                : 'border-white/15 bg-white/3 text-slate-600'
                        }
                      `}
                      disabled={!!feedback?.checked && !canRetry}
                    >
                      {placedEvent ? (
                        <span className="font-medium text-xs leading-tight">
                          {placedEvent.label}
                        </span>
                      ) : correctEventLabel ? (
                        <span className="text-xs text-emerald-400/70 italic leading-tight">
                          {correctEventLabel}
                        </span>
                      ) : (
                        <span className="text-xs opacity-50">
                          {slotIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event bank */}
            {bankEvents.length > 0 && !hasAnsweredCurrent && (
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  {selectedEventId ? 'Now click a slot above to place it' : 'Click an event to select it, then click a slot above'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {bankEvents.map((evt) => (
                    <Button
                      key={evt.id}
                      variant="ghost"
                      onClick={() => handleSelectEvent(evt.id)}
                      className={`
                        border text-left h-auto py-2 px-3 transition-all
                        ${selectedEventId === evt.id
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 ring-2 ring-blue-400/30'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                        }
                      `}
                    >
                      <div>
                        <div className="text-sm font-medium">{evt.label}</div>
                        {evt.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{evt.description}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback message */}
            {feedback?.checked && (
              <div className={`p-3 rounded-lg border ${
                isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {isCorrect
                  ? 'Perfect! All events are in the correct order!'
                  : hasAnsweredCurrent
                    ? 'The correct order is shown above. Study the timeline to understand the sequence.'
                    : `${feedback.correctSlots.size} of ${slotCount} events are in the right place. Try again!`
                }
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {!hasAnsweredCurrent && (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleCheck}
                    disabled={!canCheck}
                    className="bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-300 disabled:opacity-40"
                  >
                    Check Order
                  </Button>
                  {canRetry && (
                    <Button
                      variant="ghost"
                      onClick={handleRetry}
                      className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300"
                    >
                      Try Again
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setShowHint(true)}
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
                    disabled={showHint}
                  >
                    Hint
                  </Button>
                </>
              )}
              {canProceed && (
                <Button
                  variant="ghost"
                  onClick={handleNext}
                  className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300"
                >
                  {currentIndex + 1 < challenges.length ? 'Next Timeline' : 'See Results'}
                </Button>
              )}
            </div>

            {/* Hint */}
            {showHint && currentChallenge.hint && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                {currentChallenge.hint}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimelineBuilder;
