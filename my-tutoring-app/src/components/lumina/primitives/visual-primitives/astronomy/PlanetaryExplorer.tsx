'use client';

/**
 * Planetary explorer: a guided trip through 3-5 planets, a few questions at each stop, and in identify mode a quiz
 * after the trip. Two paths, chosen by `withWorkspaceController`:
 * - scripted (no tutor runtime): overview, each planet's card, its questions, a transition, the quiz; two tries a
 *   question, the scripted tutor cues;
 * - workspace (W1, `planetaryExplorerWorkspace.ts`): the runtime owns the item and Try again / Next; the stop's card
 *   opens before its first question; every check commits through `progress.commitCheck`, a spoken answer is judged by
 *   JEV, and the in-item levers (`planetaryExplorerLevers.ts`) are published with the scene.
 */
import React, { useState, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PlanetaryExplorerMetrics } from '../../../evaluation/types';
import { LuminaReadAloud } from '../../../ui';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  describePlanetWork, planetCorrect, planetItems, planetMiss, workspaceAssignment, workspaceScene, type PlanetItem,
} from './planetaryExplorerWorkspace';
import {
  CARD_LEVER, DROP_LEVER, FAMILY_LEVER, NO_LEVERS, VISITED_LEVER, farChoice, leverFacts, planetLevers, startLevers,
  visitedStops, type PlanetLeverState,
} from './planetaryExplorerLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PlanetStat {
  label: string;
  value: string;
  unit?: string;
  comparisonToEarth?: string;
}

export interface PlanetQuestion {
  question: string;
  questionType: 'mc' | 'compare' | 'true-false';
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** For identify-mode quiz questions: which planet is the correct answer */
  aboutPlanetId?: string;
}

export interface PlanetStop {
  planetId: string;
  focusTheme: string;
  description: string;
  keyStats: PlanetStat[];
  funFact: string;
  transition: string;
  questions: PlanetQuestion[];
}

export interface PlanetaryExplorerData {
  title: string;
  description: string;

  introduction: string;
  celebration: string;
  planets: PlanetStop[];

  /** Cross-planet identification quiz (identify mode only) */
  quizQuestions?: PlanetQuestion[];

  showOrbits?: boolean;
  showScale?: boolean;
  animateTransitions?: boolean;
  gradeLevel?: string;

  /**
   * Within-mode support tier stamped by the generator from config.difficulty.
   * Never changes planets, questions, options, or correctIndex. Absent ⇒ full-support legacy render.
   *   L2: 'hard' hides comparisonToEarth captions (raw value + unit remain).
   *   L3: 'hard' skips the first-miss tutor hint (scripted path; the 2-attempt allowance is unchanged).
   *   Levers: 'easy' starts the workspace path's help levers pulled where they may be shown (`startLevers`).
   * The map's planet names are withheld in the quiz at EVERY tier: a labelled map in order from the Sun answers the
   * distance and size clues (it was the hard tier's L1 until 2026-10-15).
   */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlanetaryExplorerMetrics>) => void;
}

// ============================================================================
// Planet Visual Data
// ============================================================================

const PLANET_VISUALS: Record<string, { color: string; glow: string; radiusScale: number; orbitRadius: number; emoji: string }> = {
  mercury: { color: '#b5b5b5', glow: '#b5b5b540', radiusScale: 0.38, orbitRadius: 0.39, emoji: '☿' },
  venus:   { color: '#e8cda0', glow: '#e8cda040', radiusScale: 0.95, orbitRadius: 0.72, emoji: '♀' },
  earth:   { color: '#4a90d9', glow: '#4a90d940', radiusScale: 1.0,  orbitRadius: 1.0,  emoji: '🌍' },
  mars:    { color: '#c1440e', glow: '#c1440e40', radiusScale: 0.53, orbitRadius: 1.52, emoji: '♂' },
  jupiter: { color: '#c88b3a', glow: '#c88b3a40', radiusScale: 11.2, orbitRadius: 5.2,  emoji: '♃' },
  saturn:  { color: '#e4d191', glow: '#e4d19140', radiusScale: 9.45, orbitRadius: 9.54, emoji: '♄' },
  uranus:  { color: '#b2d8d8', glow: '#b2d8d840', radiusScale: 4.0,  orbitRadius: 19.2, emoji: '⛢' },
  neptune: { color: '#5b5ddf', glow: '#5b5ddf40', radiusScale: 3.88, orbitRadius: 30.1, emoji: '♆' },
};

function getPlanetVisual(planetId: string) {
  return PLANET_VISUALS[planetId.toLowerCase()] ?? { color: '#888', glow: '#88888840', radiusScale: 1, orbitRadius: 2, emoji: '🪐' };
}

const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** Fixed star field: random positions per render made every render a different picture. */
const STARS = Array.from({ length: 60 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { w: 1 + r(1) * 2, left: r(2) * 100, top: r(3) * 100, opacity: 0.3 + r(4) * 0.7 };
});

// ============================================================================
// View modes
// ============================================================================

type ViewMode = 'overview' | 'planet-info' | 'planet-questions' | 'transition' | 'quiz' | 'summary';

// ============================================================================
// Component
// ============================================================================

interface PlanetaryExplorerProps {
  data: PlanetaryExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

type LeverMemo = { item: string } & PlanetLeverState;

const PlanetaryExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  PlanetaryExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<PlanetItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    introduction,
    celebration,
    planets = [],
    quizQuestions = [],
    showOrbits = true,
    showScale = true,
    gradeLevel,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const hasQuiz = quizQuestions.length > 0;

  // reader-fit: the planet description, the stat cards, the fun fact, the question and every answer option are
  // silent text at K-1, so the scripted voice reads them (the workspace tutor reads them from the scene).
  const isPreReader = gradeLevel === 'K' || gradeLevel === '1';

  // ── Stable refs ──
  const stableInstanceIdRef = useRef(instanceId || `planetary-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startTimeRef = useRef(Date.now());

  // ── Items: every stop's questions in journey order, then the quiz ──
  const items = useMemo(() => planetItems(planets, quizQuestions), [planets, quizQuestions]);
  const stopCount = items.filter((i) => i.kind === 'planet').length;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (i) => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (i) => workspaceAssignment(i, planets),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: (index) => solvedAloud.current(index),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [scriptedPlanetIndex, setScriptedPlanetIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  /** Workspace path: the wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [tappedStats, setTappedStats] = useState<Set<string>>(new Set());
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);
  /** Workspace path: the stops whose card the learner has read (the card opens before a stop's first question). */
  const [cardsRead, setCardsRead] = useState<number[]>([]);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const currentItem: PlanetItem | undefined = items[currentIndex];
  const lever: PlanetLeverState = leverMemo.item === currentItem?.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: PlanetLeverState) => Partial<PlanetLeverState>) => {
    const id = currentItem?.id ?? '';
    setLeverMemo((m) => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };

  const readingCard = tutorOwned && currentItem?.kind === 'planet' && !cardsRead.includes(currentItem.planetIndex);
  const view: ViewMode = !tutorOwned ? viewMode
    : isComplete || !currentItem ? 'summary'
      : currentItem.kind === 'quiz' ? 'quiz' : readingCard ? 'planet-info' : 'planet-questions';
  const currentPlanetIndex = !tutorOwned ? scriptedPlanetIndex
    : currentItem?.kind === 'planet' ? currentItem.planetIndex : Math.max(0, planets.length - 1);
  const currentPlanet = planets[currentPlanetIndex];
  const currentPlanetQuestions = useMemo(() => items.filter((i) => i.kind === 'planet' && i.planetIndex === currentPlanetIndex),
    [items, currentPlanetIndex]);
  const currentPlanetQuestionIndex = currentItem ? currentPlanetQuestions.findIndex((q) => q.id === currentItem.id) : -1;
  const quizIndex = currentItem?.kind === 'quiz' ? currentIndex - stopCount : 0;
  const solvedNow = !!currentItem && results.some((r) => r.challengeId === currentItem.id && r.correct);

  // Phase config: one phase per planet + optional quiz phase
  const phaseConfig = useMemo<Record<string, PhaseConfig>>(() => {
    const config: Record<string, PhaseConfig> = {};
    for (const planet of planets) {
      config[planet.planetId] = { label: nameOf(planet.planetId), icon: getPlanetVisual(planet.planetId).emoji, accentColor: undefined };
    }
    if (hasQuiz) config['__quiz__'] = { label: 'Identification Quiz', icon: '?', accentColor: undefined };
    return config;
  }, [planets, hasQuiz]);

  const phaseResults = usePhaseResults({
    challenges: items,
    results,
    isComplete,
    getChallengeType: (i) => (i.kind === 'quiz' ? '__quiz__' : i.planetId ?? ''),
    phaseConfig,
  });

  // ── Evaluation ──
  const evaluation = usePrimitiveEvaluation<PlanetaryExplorerMetrics>({
    primitiveType: 'planetary-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring (scripted path only: its context carries the question and the learner's choice) ──
  const aiPrimitiveData = useMemo(() => ({
    currentPlanet: view === 'quiz' ? undefined : currentPlanet?.planetId,
    focusTheme: view === 'quiz' ? 'Identification Quiz' : currentPlanet?.focusTheme,
    planetsVisited: planets.slice(0, currentPlanetIndex).map((p) => p.planetId),
    planetsRemaining: planets.slice(currentPlanetIndex + 1).map((p) => p.planetId),
    questionText: currentItem?.question.question,
    // `correctAnswer` is deliberately NOT here: parking the answer key in the prompt for the whole question leaks.
    studentAnswer: selectedOption === null ? 'nothing yet' : currentItem?.question.options[selectedOption] ?? 'nothing yet',
    currentScore: results.filter((r) => r.correct && !String(r.challengeId).startsWith('quiz-')).length,
    attemptNumber: currentAttempts + 1,
    gradeLevel,
    ...(supportTier ? { supportTier } : {}),
  }), [currentPlanet, currentPlanetIndex, planets, currentItem, gradeLevel, view, supportTier, selectedOption, results, currentAttempts]);

  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'planetary-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Workspace callbacks ──
  /** A fresh item, or Try again: the choice is cleared; a retry counts one more wrong answer for the levers. */
  openItem.current = (_index, retry) => {
    setSelectedOption(null);
    setShowFeedback(false);
    setWrongPick(null);
    if (retry) editLevers((s) => ({ wrongs: s.wrongs + 1 }));
  };
  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some((r) => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1,
      planetId: solved.kind === 'quiz' ? '__quiz__' : solved.planetId, questionType: solved.question.questionType,
      difficulty: solved.question.difficulty });
    setSelectedOption(solved.question.correctIndex);
    setWrongPick(null);
    setShowFeedback(true);
  };

  // ── Handlers ──

  // `silent` suppresses only the chat-transcript entry; the tutor still speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[PLANET_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  const handleStartJourney = () => {
    setViewMode('planet-info');
    setScriptedPlanetIndex(0);
    sendText(`[JOURNEY_START] Topic: "${title}". We're exploring ${planets.map(p => p.planetId).join(', ')}. Introduce the journey briefly.`, { silent: true });
    sendText(`[PLANET_ARRIVE] Arriving at ${planets[0]?.planetId}. Focus: ${planets[0]?.focusTheme}. Introduce this planet.`, { silent: true });
  };

  // Reading a question aloud only helps if something tells the tutor a question has appeared.
  const speakQuestion = useCallback((q: { question: string; options: string[] } | undefined, lead: string) => {
    if (!q) return;
    sendText(
      `[QUESTION_SHOWN] ${lead} Read this question aloud, then read EVERY choice aloud in order so they can pick one they cannot read. `
      + `Question: "${q.question}". Choices: ${q.options.map((o, i) => `${i + 1}) ${o}`).join('  ')}. `
      + `Do NOT say which one is right.`,
      { silent: true },
    );
  }, [sendText]);

  const handleStartQuestions = () => {
    if (tutorOwned) {
      if (currentItem?.kind === 'planet') setCardsRead((r) => [...r, currentItem.planetIndex]);
      return;
    }
    setViewMode('planet-questions');
    setSelectedOption(null);
    setShowFeedback(false);
    speakQuestion(currentItem?.question, 'The questions are starting.');
  };

  const handleSelectOption = (optionIndex: number) => {
    if (showFeedback || wrongPick !== null || learnerBlocked() || lever.dropped.includes(optionIndex)) return;
    SoundManager.select();
    setSelectedOption(optionIndex);
  };

  const resultFor = (item: PlanetItem, correct: boolean, attempts: number) => ({
    challengeId: item.id, correct, attempts,
    planetId: item.kind === 'quiz' ? '__quiz__' : item.planetId,
    questionType: item.question.questionType, difficulty: item.question.difficulty,
  });

  const handleCheckAnswer = () => {
    if (selectedOption === null || !currentItem || showFeedback || wrongPick !== null || learnerBlocked()) return;
    const q = currentItem.question;
    const quiz = currentItem.kind === 'quiz';
    const correct = planetCorrect(currentItem, selectedOption);
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(describePlanetWork(currentItem, selectedOption), correct,
      correct ? undefined : planetMiss(currentItem, selectedOption, planets));
    const attempts = currentAttempts + 1;

    if (correct) {
      SoundManager.playCorrect();
      tappedCorrect.current = currentItem.id;
      setShowFeedback(true);
      progress.mergeResult(resultFor(currentItem, true, attempts));
      sendText(quiz
        ? `[QUIZ_CORRECT] Student identified "${q.options[selectedOption]}" correctly for "${q.question}". Brief praise.`
        : `[ANSWER_CORRECT] Student answered "${q.options[selectedOption]}" correctly for "${q.question}". Congratulate briefly.`,
      { silent: true });
      return;
    }
    if (tutorOwned) {
      // The tutor and the runtime take it from here: the wrong choice stays marked until Try again.
      const picked = selectedOption;
      SoundManager.playIncorrect();
      setWrongPick(picked);
      editLevers((s) => ({ picked: [...s.picked, picked] }));
      return;
    }
    if (attempts >= 2) {
      // Scripted path: two tries, then the answer and the explanation are shown.
      SoundManager.playIncorrect();
      setShowFeedback(true);
      progress.recordResult(resultFor(currentItem, false, attempts));
      sendText(quiz
        ? `[QUIZ_INCORRECT] Student chose "${q.options[selectedOption]}" but correct is "${q.options[q.correctIndex]}". Explain why.`
        : `[ANSWER_INCORRECT] FINAL ATTEMPT — the reveal is now correct pedagogy. Student chose "${q.options[selectedOption]}" but correct is "${q.options[q.correctIndex]}" for "${q.question}". Say the right answer plainly and give a clear explanation.`,
      { silent: true });
      return;
    }
    // First wrong attempt: a hint that is NOT handed the correct option (L3: withdrawn at the hard tier).
    if (supportTier !== 'hard') {
      sendText(quiz
        ? `[QUIZ_HINT] Student chose "${q.options[selectedOption]}" but that's not right. Give a hint about the correct planet without naming it.`
        : `[ANSWER_INCORRECT] Student chose "${q.options[selectedOption]}" for "${q.question}" and it is wrong, but they have ONE more try. You are NOT being told the right answer. Point them at the thing on screen that decides it. Do not eliminate options for them.`,
      { silent: true });
    }
    setSelectedOption(null);
  };

  // ── Scripted path: Next / transitions / quiz ──

  const handleSubmitEvaluation = () => {
    const elapsedMs = Date.now() - startTimeRef.current;
    const correctCount = results.filter((r) => r.correct).length;
    const totalQuestions = items.length;
    const overallScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const perPlanetScores = scoresByPhase();
    const metrics: PlanetaryExplorerMetrics = {
      type: 'planetary-explorer',
      totalQuestions,
      correctAnswers: correctCount,
      accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
      planetsExplored: planets.length,
      perPlanetScores,
      statsExplored: tappedStats.size,
      durationMs: elapsedMs,
    };
    if (progress.recordsEvaluation !== false) evaluation.submitResult(overallScore >= 50, overallScore, metrics);
    setSubmittedResult({ score: overallScore });
    const phaseScoreStr = planets.map((p) => `${p.planetId}: ${perPlanetScores[p.planetId] ?? 0}%`).join(', ');
    const quizScoreStr = hasQuiz ? `, Quiz: ${perPlanetScores['__quiz__'] ?? 0}%` : '';
    sendText(`[ALL_COMPLETE] Journey complete! Planet scores: ${phaseScoreStr}${quizScoreStr}. Overall: ${overallScore}%. ${celebration}. Give encouraging planet-specific feedback.`, { silent: true });
  };

  /** Per planet (and the quiz), the share of its questions answered right. */
  const scoresByPhase = () => {
    const scores: Record<string, number> = {};
    const groups = [...planets.map((p) => p.planetId), ...(hasQuiz ? ['__quiz__'] : [])];
    for (const g of groups) {
      const mine = items.filter((i) => (i.kind === 'quiz' ? '__quiz__' : i.planetId) === g);
      const right = mine.filter((i) => results.some((r) => r.challengeId === i.id && r.correct)).length;
      if (mine.length) scores[g] = Math.round((right / mine.length) * 100);
    }
    return scores;
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    const nextQIndex = currentPlanetQuestionIndex + 1;
    if (nextQIndex < currentPlanetQuestions.length) {
      progress.advance();
      speakQuestion(currentPlanetQuestions[nextQIndex]?.question,
        `Moving to question ${nextQIndex + 1} of ${currentPlanetQuestions.length} for ${currentPlanet?.planetId}.`);
      return;
    }
    // Done with this planet's questions
    const advanced = progress.advance();
    sendText(`[PLANET_COMPLETE] Finished all questions for ${currentPlanet?.planetId}. Summarize what we learned.`, { silent: true });
    if (currentPlanetIndex < planets.length - 1) {
      setViewMode('transition');
    } else if (hasQuiz && advanced) {
      setViewMode('quiz');
      sendText(`[QUIZ_START] All planets visited! Now it's time for the identification quiz. The student will identify planets from descriptions. Encourage them.`, { silent: true });
    } else {
      handleSubmitEvaluation();
      setViewMode('summary');
    }
  };

  const handleNextPlanet = () => {
    const nextIndex = currentPlanetIndex + 1;
    setScriptedPlanetIndex(nextIndex);
    setViewMode('planet-info');
    setTappedStats(new Set());
    const nextPlanet = planets[nextIndex];
    if (nextPlanet) {
      sendText(`[TRANSITION] Moving from ${currentPlanet?.planetId} to ${nextPlanet.planetId}. Bridge: "${currentPlanet?.transition}".`, { silent: true });
      sendText(`[PLANET_ARRIVE] Arriving at ${nextPlanet.planetId}. Focus: ${nextPlanet.focusTheme}. Introduce this planet.`, { silent: true });
    }
  };

  const handleStatTap = (planetId: string, statLabel: string) => {
    SoundManager.pop();
    setTappedStats((prev) => new Set(prev).add(`${planetId}-${statLabel}`));
    sendText(`[STAT_TAPPED] Student tapped "${statLabel}" for ${planetId}. Give interesting context or comparison.`, { silent: true });
  };

  const handleQuizNext = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    if (progress.advance()) {
      sendText(`[QUIZ_NEXT] Moving to quiz question ${quizIndex + 2} of ${quizQuestions.length}.`, { silent: true });
      return;
    }
    handleSubmitEvaluation();
    setViewMode('summary');
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (evaluation.hasSubmitted || items.length === 0) return;
    const metrics: PlanetaryExplorerMetrics = {
      type: 'planetary-explorer',
      totalQuestions: items.length,
      correctAnswers: result.solvedCount,
      accuracy: result.accuracy / 100,
      planetsExplored: planets.length,
      perPlanetScores: scoresByPhase(),
      statsExplored: tappedStats.size,
      durationMs: Date.now() - startTimeRef.current,
    };
    setSubmittedResult({ score: result.accuracy });
    evaluation.submitResult(result.passed, result.accuracy, metrics,
      { studentWork: { questions: items.map((i) => i.question.question) },
        challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Levers on screen (workspace path): runtime pulls plus the easy tier's starting position ──
  const shownLevers = tutorOwned && currentItem && !readingCard
    ? [...lever.pulled, ...startLevers(currentItem, supportTier, planets)] : [];
  const leverOn = (id: string) => shownLevers.includes(id);

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration targets
  // and no presentation; the card before a stop's first question holds the response until it is closed.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem || isComplete) return;
    const scene = workspaceScene(currentItem, {
      readingCard, choice: wrongPick ?? selectedOption, solved: solvedNow,
      visited: planets.slice(0, Math.max(0, currentItem.planetIndex)).map((p) => p.planetId), grade: gradeLevel,
    }, planets);
    const state: PlanetLeverState = { ...lever, pulled: shownLevers };
    const levers = readingCard ? [] : planetLevers(currentItem, state, planets);
    const onScreen = readingCard ? null : leverFacts(currentItem, shownLevers, lever.dropped, planets);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}) },
      readyForResponse: !readingCard,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find((x) => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === DROP_LEVER) {
          const far = farChoice(currentItem, lever);
          if (far === null) return 'No more choices can be greyed out here; too few would be left.';
          editLevers((s) => ({ pulled: [...s.pulled, id], dropped: [...s.dropped, far] }));
          if (selectedOption === far) setSelectedOption(null);
          return true;
        }
        editLevers((s) => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // ── Computed values ──
  const elapsedMs = Date.now() - startTimeRef.current;
  const overallScore = items.length ? Math.round((results.filter((r) => r.correct).length / items.length) * 100) : 0;

  // ── Render helpers ──

  const renderSolarSystemCanvas = () => {
    const activePlanetId = view === 'quiz' ? undefined : currentPlanet?.planetId?.toLowerCase();
    const visitedPlanetIds = new Set(planets.slice(0, currentPlanetIndex).map((p) => p.planetId.toLowerCase()));
    const journeyPlanetIds = new Set(planets.map((p) => p.planetId.toLowerCase()));
    const allVisited = view === 'quiz' || view === 'summary';
    // While the quiz is on screen the map wears no names, at every tier: a labelled map in order from the Sun answers
    // the distance and size clues. Names are a legitimate scaffold in every other view.
    const hideLabels = view === 'quiz';

    return (
      <div className="relative w-full h-48 md:h-64 overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-white/5">
        <div className="absolute inset-0 opacity-40">
          {STARS.map((s, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: `${s.w}px`, height: `${s.w}px`, left: `${s.left}%`, top: `${s.top}%`, opacity: s.opacity }} />
          ))}
        </div>

        {/* Sun */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]" />

        {Object.entries(PLANET_VISUALS).map(([id, vis]) => {
          const isInJourney = journeyPlanetIds.has(id);
          const isActive = activePlanetId === id;
          const isVisited = allVisited || visitedPlanetIds.has(id);
          const xPos = 40 + (vis.orbitRadius / 32) * 800;
          const size = Math.max(6, Math.min(24, 4 + Math.log2(vis.radiusScale + 1) * 8));
          return (
            <React.Fragment key={id}>
              {/* dropzone-triage: decorative, out of scope — a vertical dashed guide marking each planet's orbit
                  position on the solar-system diagram, not a drop target. */}
              {showOrbits && (
                <div className="absolute top-0 bottom-0 border-l border-dashed"
                  style={{ left: `${Math.min(95, xPos / 10)}%`, borderColor: isInJourney ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)' }} />
              )}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-500 ${
                  isActive ? 'ring-2 ring-white/60 scale-125 z-10' : ''
                } ${isVisited && !isActive ? 'opacity-60' : ''} ${!isInJourney ? 'opacity-20' : ''}`}
                style={{ left: `${Math.min(95, xPos / 10)}%`, width: `${size}px`, height: `${size}px`, backgroundColor: vis.color,
                  boxShadow: isActive ? `0 0 16px ${vis.glow}` : undefined }}
              />
              {isInJourney && !hideLabels && (
                <span className={`absolute text-[10px] -translate-x-1/2 transition-opacity ${isActive ? 'text-white font-medium' : 'text-slate-500'}`}
                  style={{ left: `${Math.min(95, xPos / 10)}%`, top: `calc(50% + ${size / 2 + 10}px)` }}>
                  {nameOf(id)}
                </span>
              )}
            </React.Fragment>
          );
        })}

        {/* Progress dots */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {planets.map((planet, i) => {
            const vis = getPlanetVisual(planet.planetId);
            const isCurrent = !allVisited && i === currentPlanetIndex;
            const isDone = allVisited || i < currentPlanetIndex;
            return (
              <div key={planet.planetId}
                className={`w-3 h-3 rounded-full border transition-all ${isCurrent ? 'scale-125 animate-pulse border-white/80' : isDone ? 'border-white/40' : 'border-white/20'}`}
                style={{ backgroundColor: isDone || isCurrent ? vis.color : 'transparent' }}
                title={hideLabels ? undefined : planet.planetId} />
            );
          })}
          {hasQuiz && (
            <div className={`w-3 h-3 rounded-full border transition-all ${
              view === 'quiz' ? 'scale-125 animate-pulse border-amber-400/80 bg-amber-400' : view === 'summary' ? 'border-amber-400/40 bg-amber-400' : 'border-white/20'
            }`} title="Identification Quiz" />
          )}
        </div>

        {showScale && view === 'planet-info' && currentPlanet && (
          <div className="absolute bottom-2 right-3 text-[10px] text-slate-500">Sizes not to scale</div>
        )}
      </div>
    );
  };

  /** One stop's fact card; a button to tap on the reading view, a plain card inside a lever. */
  const renderStat = (stop: PlanetStop, stat: PlanetStat, i: number, tappable: boolean) => {
    const isTapped = tappedStats.has(`${stop.planetId}-${stat.label}`);
    const body = (
      <>
        <div className="text-slate-500 text-[10px] uppercase tracking-wider">{stat.label}</div>
        <div className="text-slate-100 text-sm font-medium">{stat.value}{stat.unit ? ` ${stat.unit}` : ''}</div>
        {/* L2 (support tier): at 'hard' the Earth-comparison caption is withdrawn; values are never changed. */}
        {stat.comparisonToEarth && supportTier !== 'hard' && (
          <div className="text-slate-500 text-[10px] mt-0.5">{stat.comparisonToEarth}</div>
        )}
      </>
    );
    return tappable ? (
      <button key={i} onClick={() => handleStatTap(stop.planetId, stat.label)}
        className={`text-left p-3 rounded-lg border transition-all ${isTapped ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15'}`}>
        {body}
      </button>
    ) : (
      <div key={i} className="text-left p-2 rounded-lg border bg-white/5 border-white/10">{body}</div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {renderSolarSystemCanvas()}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <p className="text-slate-400 text-sm">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-300 leading-relaxed">{introduction}</p>
          <div className="flex flex-wrap gap-2">
            {planets.map((planet) => (
              <Badge key={planet.planetId} variant="outline" className="border-white/20 text-slate-300 bg-white/5">
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: getPlanetVisual(planet.planetId).color }} />
                {nameOf(planet.planetId)}
              </Badge>
            ))}
          </div>
          <Button onClick={handleStartJourney} className="w-full bg-indigo-600/80 hover:bg-indigo-500/80 text-white border border-indigo-400/30">
            Begin Journey →
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlanetInfo = () => {
    if (!currentPlanet) return null;
    const vis = getPlanetVisual(currentPlanet.planetId);
    const planetName = nameOf(currentPlanet.planetId);
    // The scripted voice reads the card at K-1; on the workspace path the tutor reads it from the scene.
    const readAloudHere = isPreReader && !tutorOwned;
    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: vis.color, boxShadow: `0 0 12px ${vis.glow}` }} />
              <div>
                <CardTitle className="text-slate-100 text-lg">{planetName}</CardTitle>
                <Badge variant="outline" className="border-white/20 text-slate-400 text-xs bg-white/5">{currentPlanet.focusTheme}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tutorOwned && currentPlanetIndex > 0 && planets[currentPlanetIndex - 1]?.transition && (
              <p className="text-slate-400 text-sm italic">{planets[currentPlanetIndex - 1].transition}</p>
            )}
            <div className="flex items-center gap-3">
              <p className={`flex-1 text-slate-300 leading-relaxed ${isPreReader ? 'text-base' : 'text-sm'}`}>{currentPlanet.description}</p>
              {readAloudHere && (
                <LuminaReadAloud iconOnly size="sm" aria-label="Hear about this planet"
                  onClick={() => readAloud(`${planetName}. ${currentPlanet.description}`)} />
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {currentPlanet.keyStats.map((stat, i) => renderStat(currentPlanet, stat, i, true))}
            </div>
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-indigo-300 text-xs font-medium mb-1">Fun Fact</div>
                {readAloudHere && (
                  <LuminaReadAloud iconOnly size="sm" aria-label="Hear the fun fact" onClick={() => readAloud(currentPlanet.funFact)} />
                )}
              </div>
              <p className={`text-slate-300 ${isPreReader ? 'text-base' : 'text-sm'}`}>{currentPlanet.funFact}</p>
            </div>
            <Button onClick={handleStartQuestions} className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100">
              Ready for Questions →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  /** The help levers drawn beside the question (workspace path). */
  const renderLevers = (item: PlanetItem) => {
    const stop = item.kind === 'planet' ? planets[item.planetIndex] : undefined;
    return (
      <>
        {stop && leverOn(CARD_LEVER) && (
          <div data-lever="planet-card" className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {stop.keyStats.map((stat, i) => renderStat(stop, stat, i, false))}
          </div>
        )}
        {leverOn(VISITED_LEVER) && (
          <div data-lever="visited-cards" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, visitedStops(item, planets).length)}, minmax(0, 1fr))` }}>
            {visitedStops(item, planets).map((p) => (
              <div key={p.planetId} className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPlanetVisual(p.planetId).color }} />
                  {nameOf(p.planetId)}
                </div>
                {p.keyStats.map((stat, i) => renderStat(p, stat, i, false))}
              </div>
            ))}
          </div>
        )}
        {leverOn(FAMILY_LEVER) && (
          <div data-lever="family-model" className="flex justify-center items-end gap-8 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex flex-col items-center gap-1">
              <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="12" fill="#8a8a8a" />
                <circle cx="15" cy="16" r="2.5" fill="#6b6b6b" /><circle cx="24" cy="23" r="3" fill="#6b6b6b" /><circle cx="22" cy="13" r="1.5" fill="#6b6b6b" />
              </svg>
              <span className="text-[11px] text-slate-400">small, rocky</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                <defs><clipPath id="giant-model"><circle cx="48" cy="48" r="42" /></clipPath></defs>
                <g clipPath="url(#giant-model)">
                  {[0, 1, 2, 3, 4, 5, 6].map((b) => <rect key={b} x="0" y={6 + b * 12} width="96" height="12" fill={b % 2 ? '#d9b27c' : '#b98a55'} />)}
                </g>
              </svg>
              <span className="text-[11px] text-slate-400">giant, made of gas</span>
            </div>
          </div>
        )}
      </>
    );
  };

  /** The choices of a question, for a stop's question and a quiz question alike. */
  const renderChoices = (item: PlanetItem, quiz: boolean) => {
    const q = item.question;
    const letters = quiz || !isPreReader;
    return (
      <div className="space-y-2">
        {q.options.map((option, i) => {
          const dropped = lever.dropped.includes(i);
          let optionStyle = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200';
          if (showFeedback) {
            if (i === q.correctIndex) optionStyle = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200';
            else if (i === selectedOption) optionStyle = 'bg-red-500/20 border-red-400/40 text-red-200';
            else optionStyle = 'bg-white/3 border-white/5 text-slate-500';
          } else if (i === wrongPick) {
            optionStyle = 'bg-red-500/20 border-red-400/40 text-red-200';
          } else if (dropped) {
            optionStyle = 'bg-white/3 border-white/5 text-slate-600 line-through';
          } else if (i === selectedOption) {
            optionStyle = 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200';
          }
          return (
            <button key={i} aria-label={option} onClick={() => handleSelectOption(i)}
              disabled={showFeedback || dropped || wrongPick !== null}
              data-dropped={dropped || undefined}
              className={`w-full text-left rounded-lg border transition-all ${optionStyle} ${quiz ? 'p-3 flex items-center gap-2' : isPreReader ? 'p-4 text-lg' : 'p-3'}`}>
              {/* Quiz: a neutral marker at EVERY tier; a planet's signature colour here answers "the red planet". */}
              {quiz && <div className="w-4 h-4 rounded-full flex-shrink-0 bg-slate-600" />}
              {/* The "A." / "B." letter prefix only helps a reader; at K-1 it is one more glyph between the child and the choice. */}
              {letters && <span className={`text-slate-500 text-sm ${quiz ? 'mr-1' : 'mr-2'}`}>{String.fromCharCode(65 + i)}.</span>}
              {option}
            </button>
          );
        })}
      </div>
    );
  };

  const nextLabel = () => {
    if (currentItem?.kind === 'quiz') return quizIndex + 1 < quizQuestions.length ? 'Next Question →' : 'See Results →';
    return currentPlanetQuestionIndex + 1 < currentPlanetQuestions.length ? 'Next Question →'
      : currentPlanetIndex < planets.length - 1 ? 'Continue to Next Planet →'
        : hasQuiz ? 'Start Identification Quiz →' : 'See Results →';
  };

  /** Check, then (scripted path only) Next; the workspace path's Try again and Next are on the shell. */
  const renderActions = (quiz: boolean) => (
    !showFeedback ? (
      wrongPick === null && (
        <Button onClick={handleCheckAnswer} disabled={selectedOption === null}
          className={`w-full text-white disabled:opacity-40 ${quiz ? 'bg-amber-600/80 hover:bg-amber-500/80 border border-amber-400/30' : 'bg-indigo-600/80 hover:bg-indigo-500/80 border border-indigo-400/30'}`}>
          Check Answer
        </Button>
      )
    ) : !tutorOwned ? (
      <Button onClick={quiz ? handleQuizNext : handleNextQuestion} className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100">
        {nextLabel()}
      </Button>
    ) : null
  );

  const renderFeedback = (item: PlanetItem) => showFeedback && (
    <div className={`p-3 rounded-lg border ${solvedNow ? 'bg-emerald-500/10 border-emerald-400/20' : 'bg-amber-500/10 border-amber-400/20'}`}>
      <p className="text-slate-300 text-sm">{item.question.explanation}</p>
    </div>
  );

  const renderPlanetQuestions = () => {
    if (!currentItem || currentItem.kind !== 'planet' || !currentPlanet) return null;
    const q = currentItem.question;
    const vis = getPlanetVisual(currentPlanet.planetId);
    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: vis.color }} />
                <span className="text-slate-300 text-sm">{nameOf(currentPlanet.planetId)}</span>
              </div>
              {/* Band contract rule 7: "Q1/2" is a counter a pre-reader cannot use. Conditional render, never `hidden`. */}
              {!isPreReader && (
                <Badge variant="outline" className="border-white/20 text-slate-400 bg-white/5">
                  Q{currentPlanetQuestionIndex + 1}/{currentPlanetQuestions.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <p className={`flex-1 text-slate-100 font-medium leading-relaxed ${isPreReader ? 'text-lg' : 'text-base'}`}>{q.question}</p>
              {/* The replay a non-reader needs to hear the choices again before picking (scripted voice only). */}
              {isPreReader && !tutorOwned && (
                <LuminaReadAloud iconOnly size="sm" aria-label="Hear the question and choices"
                  onClick={() => speakQuestion(q, 'They asked to hear it again.')} />
              )}
            </div>
            {renderLevers(currentItem)}
            {renderChoices(currentItem, false)}
            {renderFeedback(currentItem)}
            {renderActions(false)}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTransition = () => {
    if (!currentPlanet) return null;
    const nextPlanet = planets[currentPlanetIndex + 1];
    const nextVis = nextPlanet ? getPlanetVisual(nextPlanet.planetId) : null;
    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-slate-300 leading-relaxed">{currentPlanet.transition}</p>
            {nextPlanet && nextVis && (
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: nextVis.color, boxShadow: `0 0 12px ${nextVis.glow}` }} />
                <span className="text-slate-100 font-medium">{nameOf(nextPlanet.planetId)}</span>
              </div>
            )}
            <Button onClick={handleNextPlanet} className="bg-indigo-600/80 hover:bg-indigo-500/80 text-white border border-indigo-400/30">
              Explore {nextPlanet ? nameOf(nextPlanet.planetId) : ''} →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!currentItem || currentItem.kind !== 'quiz') return null;
    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 bg-amber-400/80 flex items-center justify-center text-xs font-bold text-slate-900">?</div>
                <span className="text-amber-300 text-sm font-medium">Identification Quiz</span>
              </div>
              <Badge variant="outline" className="border-amber-400/30 text-amber-300 bg-amber-400/10">
                Q{quizIndex + 1}/{quizQuestions.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question — NO planet name shown */}
            <p className="text-slate-100 text-base font-medium leading-relaxed">{currentItem.question.question}</p>
            {renderLevers(currentItem)}
            {renderChoices(currentItem, true)}
            {renderFeedback(currentItem)}
            {renderActions(true)}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="space-y-4">
      {renderSolarSystemCanvas()}
      {phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={practiceScore(progress.practiceSummary) ?? submittedResult?.score ?? overallScore}
          durationMs={elapsedMs}
          heading="Journey Complete!"
          celebrationMessage={celebration}
          className="mb-4"
        />
      )}
    </div>
  );

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and the child's touches; Pip points only at
  // the workspace as a whole and never chooses, checks, or advances.
  const answering = view === 'planet-questions' || view === 'quiz';
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: answering ? currentItem?.id ?? null : null,
    label: 'The solar system and the question',
    solved: answering && solvedNow,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  // ── Main render ──
  return (
    <div className={`w-full max-w-3xl mx-auto space-y-2 ${className ?? ''}`}>
      {view === 'overview' && renderOverview()}
      {view === 'planet-info' && renderPlanetInfo()}
      {/* Pip's dock sits above the workspace, which it outlines as a region. */}
      {pip.store && answering && <div {...pip.dock} />}
      <div {...pip.workspace}>
        {view === 'planet-questions' && renderPlanetQuestions()}
        {view === 'transition' && renderTransition()}
        {view === 'quiz' && renderQuiz()}
      </div>
      {view === 'summary' && renderSummary()}
    </div>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const PlanetaryExplorer = withWorkspaceController<PlanetaryExplorerProps, ProgressOptions<PlanetItem>, Progress>(
  'planetary-explorer', PlanetaryExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('planetary-explorer'));

export default PlanetaryExplorer;
