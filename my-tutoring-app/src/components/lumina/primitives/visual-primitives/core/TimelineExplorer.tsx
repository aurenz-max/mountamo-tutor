'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TimelineExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface TimelineExplorerData {
  title: string;
  subtitle: string;
  overview: string;

  timeSpan: {
    start: string;
    end: string;
  };

  events: Array<{
    id: string;
    date: string;
    sortOrder: number;
    title: string;
    description: string;
    imagePrompt: string;
    impact?: string;
    connection?: string;
  }>;

  summary: {
    text: string;
    keyTheme: string;
    lookingForward?: string;
  };

  challenges?: Array<{
    type: 'order' | 'date' | 'cause_effect' | 'identify';
    question: string;
    // For order: events to sort
    orderItems?: Array<{ id: string; text: string }>;
    correctOrder?: string[];
    // For date/identify: multiple choice
    options?: string[];
    correctIndex?: number;
    // For cause_effect: match pairs
    causes?: string[];
    effects?: string[];
    correctPairs?: Array<[number, number]>;
    explanation: string;
    relatedEventId: string;
  }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TimelineExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface TimelineExplorerProps {
  data: TimelineExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const TimelineExplorer: React.FC<TimelineExplorerProps> = ({ data, className }) => {
  const {
    title,
    subtitle,
    overview,
    timeSpan,
    events = [],
    summary,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Sort events chronologically
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.sortOrder - b.sortOrder),
    [events]
  );

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [visitedEvents, setVisitedEvents] = useState<Set<string>>(new Set());
  const [explorationOrder, setExplorationOrder] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeAnswers, setChallengeAnswers] = useState<Array<{ correct: boolean; attempts: number }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false);
  const [allChallengesComplete, setAllChallengesComplete] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Order challenge state
  const [orderSequence, setOrderSequence] = useState<string[]>([]);
  const [orderChecked, setOrderChecked] = useState(false);
  const [orderCorrect, setOrderCorrect] = useState(false);

  // Cause-effect challenge state
  const [selectedCause, setSelectedCause] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Array<[number, number]>>([]);
  const [ceChecked, setCeChecked] = useState(false);
  const [ceCorrect, setCeCorrect] = useState(false);

  // Timing
  const [eventEntryTime, setEventEntryTime] = useState(Date.now());
  const [eventTimes, setEventTimes] = useState<Record<string, number>>({});

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `timeline-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const totalEvents = sortedEvents.length;
  const eventsExplored = visitedEvents.size;
  const allEventsExplored = eventsExplored >= totalEvents;
  const selectedEvent = selectedEventIndex !== null ? sortedEvents[selectedEventIndex] : null;

  // Determine exploration pattern
  const explorationPattern = useMemo((): 'sequential' | 'random' | 'reverse' => {
    if (explorationOrder.length < 3) return 'sequential';
    const indices = explorationOrder.map(id => sortedEvents.findIndex(e => e.id === id));
    let forward = 0, backward = 0;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] > indices[i - 1]) forward++;
      else if (indices[i] < indices[i - 1]) backward++;
    }
    if (forward >= indices.length * 0.6) return 'sequential';
    if (backward >= indices.length * 0.6) return 'reverse';
    return 'random';
  }, [explorationOrder, sortedEvents]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<TimelineExplorerMetrics>({
    primitiveType: 'timeline-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    timeSpan: `${timeSpan?.start || '?'} — ${timeSpan?.end || '?'}`,
    totalEvents,
    currentEventIndex: selectedEventIndex !== null ? selectedEventIndex + 1 : 0,
    currentEventTitle: selectedEvent?.title || '',
    currentEventDate: selectedEvent?.date || '',
    eventsExplored,
    challengesCompleted: challengeAnswers.length,
    totalChallenges: challenges.length,
  }), [title, timeSpan, totalEvents, selectedEventIndex, selectedEvent, eventsExplored, challengeAnswers.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'timeline-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Timeline Explorer: "${title}" — ${subtitle}. `
      + `Spanning ${timeSpan?.start} to ${timeSpan?.end}. ${totalEvents} events to explore. `
      + `${challenges.length > 0 ? `${challenges.length} challenges after exploration.` : ''} `
      + `Overview: ${overview}. Introduce the timeline warmly and encourage exploration.`,
      { silent: true }
    );
  }, [isConnected, title, subtitle, timeSpan, overview, totalEvents, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Event Selection
  // -------------------------------------------------------------------------
  const handleEventSelect = useCallback((index: number) => {
    // Record time on previous event
    if (selectedEvent) {
      const elapsed = Date.now() - eventEntryTime;
      setEventTimes(prev => ({
        ...prev,
        [selectedEvent.id]: (prev[selectedEvent.id] || 0) + elapsed,
      }));
    }
    setEventEntryTime(Date.now());

    const event = sortedEvents[index];
    setSelectedEventIndex(index);

    setVisitedEvents(prev => {
      const next = new Set(prev);
      next.add(event.id);
      return next;
    });

    setExplorationOrder(prev => {
      if (prev[prev.length - 1] === event.id) return prev;
      return [...prev, event.id];
    });

    if (isConnected) {
      const prevEvent = selectedEventIndex !== null ? sortedEvents[selectedEventIndex] : null;
      sendText(
        `[EVENT_SELECTED] Student selected event ${index + 1} of ${totalEvents}: `
        + `"${event.title}" (${event.date}). `
        + `${prevEvent ? `Previous: "${prevEvent.title}" (${prevEvent.date}). ` : ''}`
        + `Events explored: ${visitedEvents.has(event.id) ? eventsExplored : eventsExplored + 1}/${totalEvents}. `
        + `${event.impact ? `Impact: ${event.impact}. ` : ''}`
        + `Introduce with historical context and connect to the previous event.`,
        { silent: true }
      );
    }
  }, [sortedEvents, selectedEvent, selectedEventIndex, eventEntryTime, visitedEvents, eventsExplored, totalEvents, isConnected, sendText]);

  // Track all events explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allEventsExplored && !hasNotifiedAllExploredRef.current && isConnected) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_EVENTS_EXPLORED] Student explored all ${totalEvents} events! `
        + `Key theme: ${summary?.keyTheme || 'progression'}. `
        + `${challenges.length > 0 ? `${challenges.length} challenges coming up.` : 'Timeline complete!'} `
        + `Summarize the arc of the timeline and celebrate.`,
        { silent: true }
      );
    }
  }, [allEventsExplored, totalEvents, summary, challenges.length, isConnected, sendText]);

  // Show summary when all events explored
  useEffect(() => {
    if (allEventsExplored && !showSummary) {
      setShowSummary(true);
    }
  }, [allEventsExplored, showSummary]);

  // -------------------------------------------------------------------------
  // Challenge Handling
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const handleStartChallenges = useCallback(() => {
    setShowChallenges(true);
    setCurrentChallengeIndex(0);
    setCurrentAttempts(0);
    if (challenges[0]?.type === 'order' && challenges[0].orderItems) {
      setOrderSequence(shuffleArray(challenges[0].orderItems.map(i => i.id)));
    }
  }, [challenges]);

  // MC answer (identify / date)
  const handleMCAnswer = useCallback((optionIndex: number) => {
    if (!currentChallenge || showChallengeFeedback) return;
    if (currentChallenge.type !== 'identify' && currentChallenge.type !== 'date') return;

    setSelectedOption(optionIndex);
    setShowChallengeFeedback(true);

    const correct = optionIndex === currentChallenge.correctIndex;
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Challenge ${currentChallengeIndex + 1}/${challenges.length} (${currentChallenge.type}): `
        + `"${currentChallenge.question}" — Student chose "${currentChallenge.options?.[optionIndex]}". `
        + `${correct ? 'Correct! Reinforce the chronological connection.' : 'Incorrect. Ask about cause-and-effect to guide thinking.'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentChallengeIndex, challenges, showChallengeFeedback, currentAttempts, isConnected, sendText]);

  // Order check
  const handleOrderCheck = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'order') return;

    const correct = JSON.stringify(orderSequence) === JSON.stringify(currentChallenge.correctOrder);
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);
    setOrderChecked(true);
    setOrderCorrect(correct);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
      setShowChallengeFeedback(true);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Order challenge: "${currentChallenge.question}" — `
        + `${correct ? 'Correct chronological order!' : 'Wrong order. Think about what had to happen first.'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, orderSequence, currentAttempts, isConnected, sendText]);

  // Cause-effect matching
  const handleCauseSelect = useCallback((causeIdx: number) => {
    if (ceChecked) return;
    setSelectedCause(causeIdx);
  }, [ceChecked]);

  const handleEffectSelect = useCallback((effectIdx: number) => {
    if (ceChecked || selectedCause === null) return;
    // Check if this cause is already matched
    if (matchedPairs.some(([c]) => c === selectedCause)) {
      setSelectedCause(null);
      return;
    }
    setMatchedPairs(prev => [...prev, [selectedCause, effectIdx]]);
    setSelectedCause(null);
  }, [ceChecked, selectedCause, matchedPairs]);

  const handleCECheck = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'cause_effect') return;
    const correctPairs = currentChallenge.correctPairs || [];

    // Check if all pairs match
    const correct = correctPairs.length === matchedPairs.length &&
      correctPairs.every(([c, e]) => matchedPairs.some(([mc, me]) => mc === c && me === e));

    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);
    setCeChecked(true);
    setCeCorrect(correct);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
      setShowChallengeFeedback(true);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Cause-effect challenge: "${currentChallenge.question}" — `
        + `${correct ? 'All pairs matched correctly!' : 'Some pairs are wrong. Think about which cause leads to which effect.'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, matchedPairs, currentAttempts, isConnected, sendText]);

  // Next challenge
  const handleNextChallenge = useCallback(() => {
    setSelectedOption(null);
    setShowChallengeFeedback(false);
    setOrderChecked(false);
    setOrderCorrect(false);
    setMatchedPairs([]);
    setCeChecked(false);
    setCeCorrect(false);
    setSelectedCause(null);
    setCurrentAttempts(0);

    if (currentChallengeIndex + 1 >= challenges.length) {
      setAllChallengesComplete(true);

      const correctCount = challengeAnswers.filter(a => a.correct).length;
      const totalAttempts = challengeAnswers.reduce((sum, a) => sum + a.attempts, 0);
      const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;

      if (isConnected) {
        sendText(
          `[ALL_COMPLETE] Student finished all ${challenges.length} challenges. `
          + `Accuracy: ${accuracy}%. Events explored: ${eventsExplored}/${totalEvents}. `
          + `Key theme: ${summary?.keyTheme || 'progression'}. `
          + `Summarize the timeline arc and highlight the key theme.`,
          { silent: true }
        );
      }

      if (!hasSubmittedEvaluation) {
        const avgTimePerEvent = totalEvents > 0
          ? Math.round(Object.values(eventTimes).reduce((a, b) => a + b, 0) / totalEvents)
          : 0;

        const byType = (type: string) => {
          const relevant = challenges
            .map((c, i) => ({ ...c, answer: challengeAnswers[i] }))
            .filter(c => c.type === type && c.answer);
          if (relevant.length === 0) return 0;
          return Math.round((relevant.filter(c => c.answer?.correct).length / relevant.length) * 100);
        };

        const metrics: TimelineExplorerMetrics = {
          type: 'timeline-explorer',
          eventsExplored,
          totalEvents,
          orderingAccuracy: byType('order'),
          identifyAccuracy: byType('identify'),
          causeEffectAccuracy: byType('cause_effect'),
          challengeAttempts: totalAttempts,
          averageTimePerEvent: avgTimePerEvent,
          explorationPattern,
        };

        const overallScore = Math.round(
          (eventsExplored / Math.max(totalEvents, 1)) * 30 + accuracy * 0.7
        );

        submitEvaluation(
          accuracy >= 70 && eventsExplored >= totalEvents,
          overallScore,
          metrics,
          { challengeAnswers: [...challengeAnswers] }
        );
      }
    } else {
      const nextIdx = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIdx);
      if (challenges[nextIdx]?.type === 'order' && challenges[nextIdx].orderItems) {
        setOrderSequence(shuffleArray(challenges[nextIdx].orderItems!.map(i => i.id)));
      }
    }
  }, [
    currentChallengeIndex, challenges, challengeAnswers, eventsExplored, totalEvents,
    eventTimes, explorationPattern, summary, isConnected, sendText,
    hasSubmittedEvaluation, submitEvaluation,
  ]);

  // Auto-submit for display-only (no challenges)
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (challenges.length === 0 && allEventsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      const avgTimePerEvent = totalEvents > 0
        ? Math.round(Object.values(eventTimes).reduce((a, b) => a + b, 0) / totalEvents)
        : 0;

      const metrics: TimelineExplorerMetrics = {
        type: 'timeline-explorer',
        eventsExplored,
        totalEvents,
        orderingAccuracy: 0,
        identifyAccuracy: 0,
        causeEffectAccuracy: 0,
        challengeAttempts: 0,
        averageTimePerEvent: avgTimePerEvent,
        explorationPattern,
      };

      submitEvaluation(true, 100, metrics, {});
    }
  }, [challenges.length, allEventsExplored, hasSubmittedEvaluation, eventsExplored, totalEvents, eventTimes, explorationPattern, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Sequence reorder helper
  // -------------------------------------------------------------------------
  const moveOrderItem = useCallback((fromIndex: number, direction: number) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= orderSequence.length) return;
    setOrderSequence(prev => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
    setOrderChecked(false);
  }, [orderSequence.length]);

  // -------------------------------------------------------------------------
  // Render: Timeline
  // -------------------------------------------------------------------------
  const renderTimeline = () => (
    <div className="space-y-4">
      {/* Timeline track */}
      <div className="relative">
        {/* Horizontal line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10" />

        {/* Event nodes */}
        <div className="flex justify-between relative">
          {sortedEvents.map((event, i) => {
            const isSelected = selectedEventIndex === i;
            const isVisited = visitedEvents.has(event.id);

            return (
              <button
                key={event.id}
                onClick={() => handleEventSelect(i)}
                className="flex flex-col items-center group relative z-10"
                title={`${event.date}: ${event.title}`}
              >
                {/* Node */}
                <div
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-xs font-bold ${
                    isSelected
                      ? 'bg-blue-500/30 border-blue-400 text-blue-300 scale-125 ring-2 ring-blue-400/30'
                      : isVisited
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-white/5 border-white/20 text-slate-500 hover:bg-white/10 hover:border-white/40'
                  }`}
                >
                  {i + 1}
                </div>

                {/* Date label */}
                <span className={`text-[10px] mt-1.5 max-w-[60px] text-center leading-tight ${
                  isSelected ? 'text-blue-300' : isVisited ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {event.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time span labels */}
      {timeSpan && (
        <div className="flex justify-between text-[10px] text-slate-600 px-1">
          <span>{timeSpan.start}</span>
          <span>{timeSpan.end}</span>
        </div>
      )}

      {/* Selected event detail card */}
      {selectedEvent ? (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 transition-all duration-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-slate-100 text-sm font-semibold">{selectedEvent.title}</h3>
              <Badge className="bg-blue-500/10 border-blue-400/20 text-blue-300 text-[10px] mt-1">
                {selectedEvent.date}
              </Badge>
            </div>
            <span className="text-slate-600 text-xs shrink-0">
              {(selectedEventIndex ?? 0) + 1} of {totalEvents}
            </span>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">{selectedEvent.description}</p>

          {selectedEvent.impact && (
            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-start gap-2">
                <Badge className="bg-amber-500/20 border-amber-400/30 text-amber-300 text-[10px] shrink-0">
                  Impact
                </Badge>
                <p className="text-slate-300 text-xs leading-relaxed">{selectedEvent.impact}</p>
              </div>
            </div>
          )}

          {selectedEvent.connection && (
            <p className="text-slate-500 text-xs italic border-l-2 border-white/10 pl-3">
              {selectedEvent.connection}
            </p>
          )}

          {/* Prev/Next navigation */}
          <div className="flex justify-between pt-1">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs h-7 px-3"
              onClick={() => handleEventSelect((selectedEventIndex ?? 0) - 1)}
              disabled={selectedEventIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs h-7 px-3"
              onClick={() => handleEventSelect((selectedEventIndex ?? 0) + 1)}
              disabled={selectedEventIndex === totalEvents - 1}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-slate-500 text-sm">Click an event on the timeline to explore it</p>
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Challenge {currentChallengeIndex + 1} of {challenges.length}
          </p>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
            {currentChallenge.type.replace('_', ' ')}
          </Badge>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>

        {/* Multiple choice (identify / date) */}
        {(currentChallenge.type === 'identify' || currentChallenge.type === 'date') && currentChallenge.options && (
          <div className="space-y-2">
            {currentChallenge.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrectOption = i === currentChallenge.correctIndex;
              const showAsCorrect = showChallengeFeedback && isCorrectOption;
              const showAsWrong = showChallengeFeedback && isSelected && !isCorrectOption;

              return (
                <Button
                  key={i}
                  variant="ghost"
                  className={`w-full justify-start text-left h-auto py-3 px-4 text-sm transition-all duration-200 ${
                    showAsCorrect
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                      : showAsWrong
                        ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                        : isSelected
                          ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => handleMCAnswer(i)}
                  disabled={showChallengeFeedback}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        )}

        {/* Order challenge */}
        {currentChallenge.type === 'order' && currentChallenge.orderItems && (
          <div className="space-y-2">
            {orderSequence.map((id, position) => {
              const item = currentChallenge.orderItems!.find(oi => oi.id === id);
              if (!item) return null;

              const isCorrectPos = orderChecked && currentChallenge.correctOrder?.[position] === id;
              const isWrongPos = orderChecked && !orderCorrect && currentChallenge.correctOrder?.[position] !== id;

              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                    isCorrectPos
                      ? 'bg-emerald-500/20 border border-emerald-400/50'
                      : isWrongPos
                        ? 'bg-red-500/20 border border-red-400/50'
                        : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <span className="text-slate-500 text-xs font-mono w-4">{position + 1}.</span>
                  <span className="text-slate-200 text-sm flex-1">{item.text}</span>
                  {!orderChecked && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveOrderItem(position, -1)}
                        disabled={position === 0}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveOrderItem(position, 1)}
                        disabled={position === orderSequence.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!showChallengeFeedback && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                  onClick={handleOrderCheck}
                >
                  Check Order
                </Button>
              </div>
            )}
            {orderChecked && !orderCorrect && !showChallengeFeedback && (
              <p className="text-amber-400 text-xs text-center">Not quite — think about what had to happen first!</p>
            )}
          </div>
        )}

        {/* Cause-effect challenge */}
        {currentChallenge.type === 'cause_effect' && currentChallenge.causes && currentChallenge.effects && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Causes column */}
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Causes</p>
                {currentChallenge.causes.map((cause, i) => {
                  const isMatched = matchedPairs.some(([c]) => c === i);
                  const isActive = selectedCause === i;
                  const pairIdx = matchedPairs.findIndex(([c]) => c === i);
                  const isCorrectPair = ceChecked && currentChallenge.correctPairs?.some(([c, e]) =>
                    c === i && matchedPairs.some(([mc, me]) => mc === c && me === e)
                  );
                  const isWrongPair = ceChecked && !ceCorrect && isMatched && !isCorrectPair;

                  return (
                    <button
                      key={i}
                      onClick={() => handleCauseSelect(i)}
                      disabled={ceChecked || isMatched}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all duration-200 ${
                        isCorrectPair
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : isWrongPair
                            ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                            : isActive
                              ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                              : isMatched
                                ? 'bg-purple-500/10 border border-purple-400/30 text-purple-300'
                                : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      {isMatched && <span className="text-purple-400 mr-1">{pairIdx + 1}.</span>}
                      {cause}
                    </button>
                  );
                })}
              </div>

              {/* Effects column */}
              <div className="space-y-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Effects</p>
                {currentChallenge.effects.map((effect, i) => {
                  const isMatched = matchedPairs.some(([, e]) => e === i);
                  const pairIdx = matchedPairs.findIndex(([, e]) => e === i);
                  const isCorrectPair = ceChecked && currentChallenge.correctPairs?.some(([c, e]) =>
                    e === i && matchedPairs.some(([mc, me]) => mc === c && me === e)
                  );
                  const isWrongPair = ceChecked && !ceCorrect && isMatched && !isCorrectPair;

                  return (
                    <button
                      key={i}
                      onClick={() => handleEffectSelect(i)}
                      disabled={ceChecked || isMatched || selectedCause === null}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all duration-200 ${
                        isCorrectPair
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : isWrongPair
                            ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                            : isMatched
                              ? 'bg-purple-500/10 border border-purple-400/30 text-purple-300'
                              : selectedCause !== null
                                ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 ring-1 ring-blue-400/20'
                                : 'bg-white/5 border border-white/10 text-slate-400'
                      }`}
                    >
                      {isMatched && <span className="text-purple-400 mr-1">{pairIdx + 1}.</span>}
                      {effect}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCause !== null && !ceChecked && (
              <p className="text-blue-400 text-xs text-center">Now select the matching effect</p>
            )}

            {!showChallengeFeedback && matchedPairs.length > 0 && matchedPairs.length >= (currentChallenge.correctPairs?.length || 0) && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                  onClick={handleCECheck}
                >
                  Check Matches
                </Button>
              </div>
            )}
            {ceChecked && !ceCorrect && !showChallengeFeedback && (
              <p className="text-amber-400 text-xs text-center">Some pairs are wrong — think about which cause leads to which effect!</p>
            )}
          </div>
        )}

        {/* Feedback */}
        {showChallengeFeedback && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${
              challengeAnswers[challengeAnswers.length - 1]?.correct ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {challengeAnswers[challengeAnswers.length - 1]?.correct ? 'Correct!' : 'Not quite, but let\'s keep going.'}
            </p>
            <p className="text-slate-400 text-xs">{currentChallenge.explanation}</p>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={handleNextChallenge}
              >
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = challengeAnswers.filter(a => a.correct).length;
    const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">Timeline Mastered!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          <span>{eventsExplored}/{totalEvents} events explored</span>
          <span>{correctCount}/{challenges.length} challenges correct</span>
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
        {summary && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-left space-y-2">
            <p className="text-slate-200 text-sm">{summary.text}</p>
            <Badge className="bg-emerald-500/10 border-emerald-400/20 text-emerald-300 text-xs">
              Theme: {summary.keyTheme}
            </Badge>
            {summary.lookingForward && (
              <p className="text-slate-400 text-xs italic">{summary.lookingForward}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#128336;</span>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          </div>
          {timeSpan && (
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
              {timeSpan.start} — {timeSpan.end}
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        <p className="text-slate-500 text-xs mt-1">{overview}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {allChallengesComplete ? (
          renderResults()
        ) : showChallenges ? (
          <div className="border-t border-white/10 pt-4">
            <p className="text-slate-300 text-xs font-medium mb-3 uppercase tracking-wider">
              Chronology Check
            </p>
            {renderChallenge()}
          </div>
        ) : (
          <>
            {/* Timeline */}
            {renderTimeline()}

            {/* Summary (shown after all events explored) */}
            {showSummary && summary && (
              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-slate-300 text-xs font-medium uppercase tracking-wider">Timeline Summary</p>
                <p className="text-slate-200 text-sm leading-relaxed">{summary.text}</p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/10 border-cyan-400/20 text-cyan-300 text-xs">
                    Theme
                  </Badge>
                  <span className="text-slate-300 text-xs">{summary.keyTheme}</span>
                </div>
                {summary.lookingForward && (
                  <p className="text-slate-500 text-xs italic border-l-2 border-white/10 pl-3">
                    {summary.lookingForward}
                  </p>
                )}
              </div>
            )}

            {/* Exploration Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>{eventsExplored} of {totalEvents} events explored</span>
              {allEventsExplored && challenges.length > 0 && !showChallenges && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 text-xs h-8"
                  onClick={handleStartChallenges}
                >
                  Start Challenges ({challenges.length})
                </Button>
              )}
              {!allEventsExplored && (
                <span className="text-slate-600">Explore all events to unlock challenges</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Utility
// ============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default TimelineExplorer;
