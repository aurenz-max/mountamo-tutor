'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ImageIcon, Sparkles, X } from 'lucide-react';
import {
  LuminaActionButton,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaHintDisclosure,
  LuminaMicListener,
  LuminaPanel,
  LuminaProgress,
  LuminaPrompt,
  answerStateClass,
  type AnswerChoiceState,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { InteractiveBookMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useVoiceChoice } from '../../../hooks/useVoiceChoice';
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { generateConceptImage } from '../../../service/geminiClient-api';
import { SoundManager } from '../../../utils/SoundManager';

export type InteractiveBookMode = 'text-features' | 'focus-word-reading' | 'mixed';
export type InteractiveBookChallengeType = 'find-feature' | 'read-focus-word';
export type BookWordDifficulty = 'easy' | 'medium' | 'hard';
export type BookFeatureKind = 'title' | 'author' | 'heading' | 'caption' | 'page-number' | 'focus-word';
export type BookCoverColor = 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';

export interface InteractiveBookFocusWord {
  word: string;
  difficulty: BookWordDifficulty;
  definition: string;
  pictureCue: string;
}

export interface InteractiveBookPage {
  id: string;
  pageNumber: number;
  heading: string;
  paragraphs: string[];
  imagePrompt: string;
  imageAlt: string;
  imageUrl?: string | null;
  caption: string;
  focusWords: InteractiveBookFocusWord[];
}

export interface InteractiveBookVolume {
  id: string;
  bookTitle: string;
  author: string;
  coverColor: BookCoverColor;
  coverImagePrompt: string;
  coverImageAlt: string;
  coverImageUrl?: string | null;
  pages: InteractiveBookPage[];
}

export interface InteractiveBookChallenge {
  id: string;
  type: InteractiveBookChallengeType;
  prompt: string;
  targetPageId: string;
  targetFeature: BookFeatureKind;
  /** Literal visible text the student must locate. Lowercased before voice judging. */
  targetText: string;
  /** All short, sayable feature texts visible on the target page. */
  optionTexts: string[];
  hint: string;
  /** `read-focus-word`: exact text the tutor reads before stopping at the target. */
  readLead?: string;
  /** `read-focus-word`: visible continuation after the target word. */
  readTail?: string;
}

export interface InteractiveBookData {
  title: string;
  description: string;
  gradeLevel: string;
  mode: InteractiveBookMode;
  challengeType: InteractiveBookChallengeType | 'mixed';
  wordDifficulty: BookWordDifficulty;
  /** V1 contains one book. The array shape preserves the PRD's story/compare expansion seam. */
  books: [InteractiveBookVolume, ...InteractiveBookVolume[]];
  /** 4-6 required challenges, synthesized from the generated book. */
  challenges: InteractiveBookChallenge[];

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<InteractiveBookMetrics>) => void;
}

interface InteractiveBookProps {
  data: InteractiveBookData;
  className?: string;
}

interface BookHotspot {
  id: string;
  feature: BookFeatureKind;
  text: string;
}

interface BookView {
  id: string;
  kind: 'cover' | 'page';
  page?: InteractiveBookPage;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  'read-focus-word': { label: 'Read Together', icon: '🎙️', accentColor: 'amber' },
  'find-feature': { label: 'Book Detective', icon: '📖', accentColor: 'blue' },
};

const FEATURE_LABELS: Record<BookFeatureKind, string> = {
  title: 'title',
  author: 'author name',
  heading: 'heading',
  caption: 'picture caption',
  'page-number': 'page number',
  'focus-word': 'underlined focus word',
};

const DIFFICULTY_META: Record<BookWordDifficulty, { label: string; accent: LuminaAccent }> = {
  easy: { label: 'Easy picture words', accent: 'emerald' },
  medium: { label: 'Growing reader words', accent: 'amber' },
  hard: { label: 'Stretch words', accent: 'purple' },
};

const COVER_GRADIENTS: Record<BookCoverColor, string> = {
  blue: 'from-blue-950 via-blue-800 to-cyan-700',
  emerald: 'from-emerald-950 via-emerald-800 to-teal-600',
  amber: 'from-amber-950 via-orange-800 to-amber-600',
  purple: 'from-purple-950 via-violet-800 to-fuchsia-700',
  rose: 'from-rose-950 via-rose-800 to-pink-600',
};

const normalizeSpoken = (value: string) => value.trim().toLowerCase();

function getHotspots(book: InteractiveBookVolume, view: BookView): BookHotspot[] {
  if (view.kind === 'cover') {
    return [
      { id: 'cover-title', feature: 'title', text: book.bookTitle },
      { id: 'cover-author', feature: 'author', text: book.author },
    ];
  }
  const page = view.page;
  if (!page) return [];
  return [
    { id: `${page.id}-heading`, feature: 'heading', text: page.heading },
    { id: `${page.id}-caption`, feature: 'caption', text: page.caption },
    { id: `${page.id}-number`, feature: 'page-number', text: `Page ${page.pageNumber}` },
  ];
}

const InteractiveBook: React.FC<InteractiveBookProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel,
    wordDifficulty,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const book = data.books[0];

  const [hasStarted, setHasStarted] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'auto' | 'off'>('off');
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [lastAttemptText, setLastAttemptText] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintsViewed, setHintsViewed] = useState(0);
  const [voiceAnswers, setVoiceAnswers] = useState(0);
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [spokenMisses, setSpokenMisses] = useState(0);
  const [readAdvanceDelay, setReadAdvanceDelay] = useState<number | null>(null);
  const [pagesVisited, setPagesVisited] = useState<Set<string>>(new Set(['cover']));
  const [focusWordsExplored, setFocusWordsExplored] = useState<Set<string>>(new Set());
  const [selectedFocusWord, setSelectedFocusWord] = useState<InteractiveBookFocusWord | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const recordedRef = useRef(false);
  const tappedChoiceRef = useRef(false);
  const introducedRef = useRef(false);
  const readCueChallengeRef = useRef<string | null>(null);
  const readMissesRef = useRef(0);
  const readAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRequestsRef = useRef(new Set<string>());
  const stableInstanceIdRef = useRef(instanceId || `interactive-book-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  useEffect(() => () => {
    if (readAdvanceTimerRef.current) clearTimeout(readAdvanceTimerRef.current);
  }, []);

  const views = useMemo<BookView[]>(() => [
    { id: 'cover', kind: 'cover' },
    ...book.pages.map((page) => ({ id: page.id, kind: 'page' as const, page })),
  ], [book.pages]);

  const currentView = views[currentViewIndex] ?? views[0];
  const currentHotspots = useMemo(
    () => getHotspots(book, currentView),
    [book, currentView],
  );

  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (challenge) => challenge.id });

  const currentChallenge = challenges[currentIndex];
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (challenge) => challenge.type,
    phaseConfig: PHASE_CONFIG,
    getScore: (results) => Math.round(
      results.reduce((sum, result) => sum + (result.score ?? (result.correct ? 100 : 0)), 0)
      / Math.max(1, results.length),
    ),
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<InteractiveBookMetrics>({
    primitiveType: 'interactive-book',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const aiPrimitiveData = useMemo(() => ({
    mode: data.mode,
    gradeLevel,
    wordDifficulty,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    currentTask: currentChallenge?.type ?? '',
    currentFeature: currentChallenge ? FEATURE_LABELS[currentChallenge.targetFeature] : '',
    currentPageLabel: currentView.kind === 'cover' ? 'cover' : `page ${currentView.page?.pageNumber ?? ''}`,
    attempts: currentAttempts,
    pagesVisited: pagesVisited.size,
    focusWordsExplored: focusWordsExplored.size,
    selectedFocusWord: currentChallenge?.type === 'read-focus-word' ? '' : selectedFocusWord?.word ?? '',
    spokenWords: spokenWords.size,
    voiceMode,
  }), [
    data.mode, gradeLevel, wordDifficulty, currentIndex, challenges.length,
    currentChallenge, currentView, currentAttempts, pagesVisited.size,
    focusWordsExplored.size, selectedFocusWord, spokenWords.size, voiceMode,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'interactive-book',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  useEffect(() => {
    if (!hasStarted || !isConnected || introducedRef.current || !currentChallenge) return;
    introducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Interactive Book for Grade ${gradeLevel}. Mode: ${data.mode}. The student will inspect a picture book across ${challenges.length} challenges. `
      + `Frame the activity once in two short sentences. In read-focus-word tasks, you will read only the supplied lead-in and stop for the child at the underlined word. Do not name any challenge answer.`,
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, gradeLevel, challenges.length, data.mode, sendText]);

  useEffect(() => {
    if (
      !hasStarted
      || !isConnected
      || currentChallenge?.type !== 'read-focus-word'
      || !currentChallenge.readLead
      || readCueChallengeRef.current === currentChallenge.id
    ) return;
    readCueChallengeRef.current = currentChallenge.id;
    const timer = setTimeout(() => {
      sendText(
        `[FOCUS_WORD_READY] Read this exact sentence lead-in slowly: "${currentChallenge.readLead}". `
        + `Then STOP completely and wait for the child to say the glowing underlined word. Never continue into or name the missing word.`,
        { silent: true },
      );
    }, currentIndex === 0 ? 900 : 250);
    return () => clearTimeout(timer);
  }, [hasStarted, isConnected, currentChallenge, currentIndex, sendText]);

  const ensureImage = useCallback(async (key: string, prompt: string) => {
    if (!prompt || imageRequestsRef.current.has(key)) return;
    imageRequestsRef.current.add(key);
    setImageLoading((current) => new Set(current).add(key));
    try {
      const imageUrl = await generateConceptImage(
        `${prompt}. Early-literacy picture-book illustration, warm expressive shapes, high visual clarity, child-safe, no printed words, no letters, no labels.`,
        '4:3',
      );
      if (imageUrl) {
        setGeneratedImages((current) => ({ ...current, [key]: imageUrl }));
      } else {
        setImageErrors((current) => new Set(current).add(key));
      }
    } catch (error) {
      console.warn('[InteractiveBook] image generation failed:', error);
      setImageErrors((current) => new Set(current).add(key));
    } finally {
      setImageLoading((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const currentImage = useMemo(() => {
    if (currentView.kind === 'cover') {
      return {
        key: 'cover',
        prompt: book.coverImagePrompt,
        alt: book.coverImageAlt,
        providedUrl: book.coverImageUrl ?? null,
      };
    }
    const page = currentView.page;
    return {
      key: page?.id ?? 'page',
      prompt: page?.imagePrompt ?? '',
      alt: page?.imageAlt ?? 'Picture-book illustration',
      providedUrl: page?.imageUrl ?? null,
    };
  }, [book, currentView]);

  useEffect(() => {
    if (!currentImage.providedUrl && currentImage.prompt) {
      void ensureImage(currentImage.key, currentImage.prompt);
    }
  }, [currentImage, ensureImage]);

  useEffect(() => {
    if (!currentView) return;
    setPagesVisited((current) => new Set(current).add(currentView.id));
    setSelectedFocusWord(null);
  }, [currentView]);

  const completeCurrentChallenge = useCallback((correct: boolean, viaVoice: boolean, scoreOverride?: number) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    const attempts = currentAttempts + 1;
    const score = scoreOverride ?? (correct ? Math.max(40, 100 - currentAttempts * 20) : 0);
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts,
      score,
      viaVoice,
      feature: currentChallenge.targetFeature,
      targetPageId: currentChallenge.targetPageId,
    });
  }, [currentChallenge, currentAttempts, recordResult]);

  const handleFeatureAttempt = useCallback((word: string, correct: boolean, viaVoice: boolean) => {
    if (!currentChallenge || currentChallenge.type !== 'find-feature' || showResult || recordedRef.current) return;
    setLastAttemptText(word);
    if (correct) {
      setShowResult(true);
      setFeedback(`You found the ${FEATURE_LABELS[currentChallenge.targetFeature]}!`);
      setFeedbackType('success');
      completeCurrentChallenge(true, viaVoice);
      if (viaVoice) {
        setVoiceAnswers((count) => count + 1);
        if (voiceAnswers === 0) {
          sendText(
            `[FIRST_VOICE_SUCCESS] The student used their voice to locate a book feature for the first time. Celebrate in one short sentence, then stop.`,
            { silent: true },
          );
        }
      }
      return;
    }

    const attemptNumber = currentAttempts + 1;
    incrementAttempts();
    setFeedback(`That is not the ${FEATURE_LABELS[currentChallenge.targetFeature]}. Look at how each part is placed.`);
    setFeedbackType('error');
    if (voiceMode === 'off') {
      sendText(
        `[CHALLENGE_INCORRECT] The student selected another printed feature on attempt ${attemptNumber}. Give one positional clue without naming or quoting the answer.`,
        { silent: true },
      );
    }
    if (attemptNumber >= 3) {
      setShowResult(true);
      setFeedback(`Here it is: the ${FEATURE_LABELS[currentChallenge.targetFeature]} is “${currentChallenge.targetText}.”`);
      completeCurrentChallenge(false, viaVoice);
    }
  }, [
    currentChallenge, showResult, currentAttempts, voiceMode, voiceAnswers,
    incrementAttempts, completeCurrentChallenge, sendText,
  ]);

  const voiceItems = useMemo(() => currentChallenge?.type === 'find-feature' ? [{
    answer: normalizeSpoken(currentChallenge.targetText),
    options: currentChallenge.optionTexts.map(normalizeSpoken),
  }] : [], [currentChallenge]);

  const targetPageVisible = currentView.id === currentChallenge?.targetPageId;
  const voiceActive = hasStarted
    && voiceMode === 'auto'
    && currentChallenge?.type === 'find-feature'
    && targetPageVisible
    && !showResult
    && !showSummary
    && !hintOpen
    && !selectedFocusWord;

  const voiceChoice = useVoiceChoice({
    items: voiceItems,
    gradeLevel,
    active: voiceActive,
    onSubmit: (_index, word, correct) => {
      const viaVoice = !tappedChoiceRef.current;
      tappedChoiceRef.current = false;
      handleFeatureAttempt(word, correct, viaVoice);
    },
  });

  const completeFocusWord = useCallback((viaVoice: boolean) => {
    if (
      !currentChallenge
      || currentChallenge.type !== 'read-focus-word'
      || showResult
      || recordedRef.current
    ) return;
    const firstSpokenWord = viaVoice && spokenWords.size === 0;
    const recovered = viaVoice && readMissesRef.current > 0;
    if (viaVoice) {
      SoundManager.playCorrect();
      setVoiceAnswers((count) => count + 1);
      setSpokenWords((current) => new Set(current).add(currentChallenge.id));
    } else {
      setFocusWordsExplored((current) => new Set(current).add(currentChallenge.targetText.toLowerCase()));
    }
    setShowResult(true);
    setFeedback(viaVoice ? 'You read the underlined word!' : 'You found the word. Let’s keep reading!');
    setFeedbackType('success');
    completeCurrentChallenge(true, viaVoice, viaVoice ? 100 : 60);
    sendText(
      `[FOCUS_WORD_CONFIRMED] The child ${viaVoice ? 'said' : 'tapped'} the underlined word correctly. `
      + (firstSpokenWord || recovered
        ? 'Give one very short celebration, then stop. The component will move to the next sentence.'
        : 'Stay silent. The component will move to the next sentence.'),
      { silent: true },
    );
    setReadAdvanceDelay(firstSpokenWord || recovered ? 1500 : 650);
  }, [currentChallenge, showResult, spokenWords.size, completeCurrentChallenge, sendText]);

  const handleSpokenFocusResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || currentChallenge.type !== 'read-focus-word' || showResult) return;
    if (result.outcome === 'match') {
      completeFocusWord(true);
      return;
    }
    readMissesRef.current += 1;
    setSpokenMisses((count) => count + 1);
    setFeedback(
      result.outcome === 'no-match'
        ? 'Keep the sentence going. Try that underlined word once more, or tap it.'
        : 'I didn’t catch that clearly. Try again, or tap the underlined word.',
    );
    setFeedbackType('');
    if (result.outcome === 'no-match' && currentChallenge.readLead) {
      sendText(
        `[FOCUS_WORD_RETRY] Repeat only this lead-in slowly: "${currentChallenge.readLead}". `
        + 'Stop before the underlined word and wait. Do not model or name the missing word.',
        { silent: true },
      );
    }
  }, [currentChallenge, showResult, completeFocusWord, sendText]);

  const spokenCapture = useSpokenWordCapture({
    targetWord: currentChallenge?.type === 'read-focus-word' ? currentChallenge.targetText : '',
    gradeLevel,
    onResult: handleSpokenFocusResult,
    onNoSpeech: () => {
      if (currentChallenge?.type !== 'read-focus-word' || showResult) return;
      readMissesRef.current += 1;
      setSpokenMisses((count) => count + 1);
      setFeedback('I didn’t hear a word. Tap the mic to try again, or tap the glowing word.');
      setFeedbackType('');
    },
  });

  const handleHotspotTap = useCallback((hotspot: BookHotspot) => {
    if (!currentChallenge || currentChallenge.type !== 'find-feature' || showResult) return;
    if (targetPageVisible) {
      tappedChoiceRef.current = true;
      voiceChoice.tapOption(0, normalizeSpoken(hotspot.text));
      return;
    }
    handleFeatureAttempt(hotspot.text, false, false);
  }, [currentChallenge, showResult, targetPageVisible, voiceChoice, handleFeatureAttempt]);

  const handleHintChange = useCallback((open: boolean) => {
    setHintOpen(open);
    if (!open || !currentChallenge) return;
    setHintsViewed((count) => count + 1);
    sendText(
      currentChallenge.type === 'read-focus-word'
        ? `[HINT_REQUESTED] The student asked for help reading the underlined word. Safe picture cue: "${currentChallenge.hint}". `
          + `Repeat the lead-in "${currentChallenge.readLead ?? ''}" and then give the picture cue. Stop before the missing word.`
        : `[HINT_REQUESTED] The student asked for help finding the ${FEATURE_LABELS[currentChallenge.targetFeature]} after ${currentAttempts} attempts. Give one brief location or typography clue. Do not quote the target text.`,
      { silent: true },
    );
  }, [currentChallenge, currentAttempts, sendText]);

  const selectFocusWord = useCallback((word: InteractiveBookFocusWord) => {
    setSelectedFocusWord(word);
    setFocusWordsExplored((current) => new Set(current).add(word.word.toLowerCase()));
  }, []);

  useEffect(() => {
    if (!currentChallenge) return;
    spokenCapture.cancel();
    readMissesRef.current = 0;
    setReadAdvanceDelay(null);
    const targetIndex = views.findIndex((view) => view.id === currentChallenge.targetPageId);
    if (targetIndex >= 0) setCurrentViewIndex(targetIndex);
    setShowResult(false);
    setFeedback('');
    setFeedbackType('');
    setLastAttemptText(null);
    setHintOpen(false);
    setSelectedFocusWord(null);
    recordedRef.current = false;
    tappedChoiceRef.current = false;
    // `spokenCapture.cancel` is stable; the challenge id is the lifecycle key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id, views]);

  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter((result) => result.correct).length;
    const attemptsCount = challengeResults.reduce((sum, result) => sum + result.attempts, 0);
    const firstTryCount = challengeResults.filter((result) => result.correct && result.attempts === 1).length;
    const overallAccuracy = Math.round(
      challengeResults.reduce((sum, result) => sum + (result.score ?? (result.correct ? 100 : 0)), 0)
      / Math.max(1, total),
    );
    const metrics: InteractiveBookMetrics = {
      type: 'interactive-book',
      challengeType: data.challengeType,
      totalChallenges: total,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge: total > 0 ? attemptsCount / total : 0,
      pagesVisited: pagesVisited.size,
      focusWordsExplored: focusWordsExplored.size,
      voiceAnswers,
      spokenWords: spokenWords.size,
      spokenMisses,
    };
    submitEvaluation(overallAccuracy >= 60, overallAccuracy, metrics, {
      challengeResults,
      pagesVisited: Array.from(pagesVisited),
      focusWordsExplored: Array.from(focusWordsExplored),
      spokenWords: Array.from(spokenWords),
      spokenMisses,
      voiceMode,
      wordDifficulty,
    });
    sendText(
      `[ALL_COMPLETE] The student finished all ${total} Interactive Book challenges with ${overallAccuracy}% accuracy, explored ${focusWordsExplored.size} underlined words, and supplied ${spokenWords.size} words by voice. Celebrate in one short sentence, then stop.`,
      { silent: true },
    );
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges.length, challengeResults,
    hintsViewed, pagesVisited, focusWordsExplored, voiceAnswers, spokenWords,
    spokenMisses, voiceMode, wordDifficulty, data.challengeType, submitEvaluation, sendText,
  ]);

  const handleNext = useCallback(() => {
    spokenCapture.cancel();
    if (!advanceProgress()) setShowSummary(true);
  }, [advanceProgress, spokenCapture.cancel]);

  useEffect(() => {
    if (
      readAdvanceDelay === null
      || !showResult
      || currentChallenge?.type !== 'read-focus-word'
    ) return;
    if (readAdvanceTimerRef.current) clearTimeout(readAdvanceTimerRef.current);
    readAdvanceTimerRef.current = setTimeout(() => {
      readAdvanceTimerRef.current = null;
      handleNext();
    }, readAdvanceDelay);
    return () => {
      if (readAdvanceTimerRef.current) clearTimeout(readAdvanceTimerRef.current);
      readAdvanceTimerRef.current = null;
    };
  }, [readAdvanceDelay, showResult, currentChallenge?.type, handleNext]);

  const goToView = useCallback((index: number) => {
    if (index < 0 || index >= views.length) return;
    setCurrentViewIndex(index);
  }, [views.length]);

  const renderedImageUrl = currentImage.providedUrl || generatedImages[currentImage.key];
  const imageIsLoading = imageLoading.has(currentImage.key);
  const imageHasError = imageErrors.has(currentImage.key);
  const difficultyMeta = DIFFICULTY_META[wordDifficulty];
  const sessionHasFindFeature = challenges.some((challenge) => challenge.type === 'find-feature');
  const sessionHasReadFocusWord = challenges.some((challenge) => challenge.type === 'read-focus-word');
  const voiceSupported = (sessionHasFindFeature && voiceChoice.voice.isSupported)
    || (sessionHasReadFocusWord && spokenCapture.isSupported);

  const hotspotState = (hotspot: BookHotspot): AnswerChoiceState => {
    const normalized = normalizeSpoken(hotspot.text);
    const isTarget = targetPageVisible && normalized === normalizeSpoken(currentChallenge?.targetText ?? '');
    const isLastAttempt = normalized === normalizeSpoken(lastAttemptText ?? '');
    const isVoiceHighlight = voiceChoice.highlight?.idx === 0 && voiceChoice.highlight.word === normalized;
    if (showResult) {
      if (isTarget) return 'correct';
      if (isLastAttempt) return 'incorrect';
      return 'dimmed';
    }
    if (isVoiceHighlight) return 'selected';
    if (isLastAttempt && feedbackType === 'error') return 'incorrect';
    return 'idle';
  };

  const renderImage = () => (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
      {renderedImageUrl && !imageHasError ? (
        <img
          src={renderedImageUrl}
          alt={currentImage.alt}
          className="h-full w-full object-cover"
          onError={() => setImageErrors((current) => new Set(current).add(currentImage.key))}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
          {imageIsLoading ? (
            <Sparkles className="h-10 w-10 animate-pulse text-cyan-300" />
          ) : (
            <ImageIcon className="h-10 w-10 text-slate-500" />
          )}
          <p className="max-w-sm text-sm leading-relaxed">
            {imageIsLoading ? 'Painting this page…' : currentImage.alt}
          </p>
          {imageHasError && currentImage.prompt && (
            <LuminaButton
              tone="ghost"
              onClick={() => {
                imageRequestsRef.current.delete(currentImage.key);
                setImageErrors((current) => {
                  const next = new Set(current);
                  next.delete(currentImage.key);
                  return next;
                });
                void ensureImage(currentImage.key, currentImage.prompt);
              }}
            >
              Try picture again
            </LuminaButton>
          )}
        </div>
      )}
      <div className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] text-slate-300">
        Gemini picture
      </div>
    </div>
  );

  const renderHotspot = (hotspot: BookHotspot, className = '') => (
    <button
      key={hotspot.id}
      type="button"
      onClick={() => handleHotspotTap(hotspot)}
      disabled={showResult || currentChallenge?.type === 'read-focus-word'}
      aria-label={`Book feature: ${hotspot.text}`}
      className={`rounded-xl border px-3 py-2 text-left transition-all ${answerStateClass(hotspotState(hotspot))} ${className}`}
    >
      {hotspot.text}
    </button>
  );

  const renderParagraph = (paragraph: string, page: InteractiveBookPage, paragraphIndex: number) => {
    const words = new Map(page.focusWords.map((word) => [word.word.toLowerCase(), word]));
    return (
      <p key={`${page.id}-paragraph-${paragraphIndex}`} className="text-lg leading-9 text-slate-100">
        {paragraph.split(/([A-Za-z][A-Za-z'-]*)/g).map((token, tokenIndex) => {
          const focusWord = words.get(token.toLowerCase());
          if (!focusWord) return <React.Fragment key={tokenIndex}>{token}</React.Fragment>;
          const isReadTarget = currentChallenge?.type === 'read-focus-word'
            && page.id === currentChallenge.targetPageId
            && normalizeSpoken(focusWord.word) === normalizeSpoken(currentChallenge.targetText);
          return (
            <button
              key={tokenIndex}
              type="button"
              onClick={() => isReadTarget ? completeFocusWord(false) : selectFocusWord(focusWord)}
              className={`rounded px-0.5 font-semibold text-amber-100 underline decoration-amber-400 decoration-2 underline-offset-4 transition-all hover:bg-amber-400/15 ${
                isReadTarget ? 'animate-pulse bg-amber-400/15 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-900' : ''
              }`}
              aria-label={isReadTarget ? 'Tap the glowing underlined word' : `Explore the word ${focusWord.word}`}
            >
              {token}
            </button>
          );
        })}
      </p>
    );
  };

  if (!book || challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This book is still being made. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  if (!hasStarted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <div className={`flex h-24 w-20 items-center justify-center rounded-r-2xl rounded-l-md bg-gradient-to-br ${COVER_GRADIENTS[book.coverColor]} shadow-2xl`}>
            <BookOpen className="h-10 w-10 text-white" />
          </div>
          <div>
            <LuminaCardTitle>{title}</LuminaCardTitle>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <LuminaBadge accent="blue">K–2 book skills</LuminaBadge>
            <LuminaBadge accent={difficultyMeta.accent}>{difficultyMeta.label}</LuminaBadge>
            <LuminaBadge accent="purple">Picture-rich</LuminaBadge>
          </div>
          <div className="flex flex-col items-center gap-2">
            {voiceSupported && (
              <LuminaButton
                tone="primary"
                className="px-8 py-3 text-lg"
                onClick={() => {
                  setVoiceMode('auto');
                  setHasStarted(true);
                }}
              >
                🎙️ Start with voice
              </LuminaButton>
            )}
            <LuminaButton
              tone={voiceSupported ? 'ghost' : 'primary'}
              onClick={() => {
                setVoiceMode('off');
                setHasStarted(true);
              }}
            >
              Start with taps
            </LuminaButton>
          </div>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan-300" />
              {title}
            </LuminaCardTitle>
            <LuminaCardDescription>{description}</LuminaCardDescription>
          </div>
          <div className="flex items-center gap-2">
            <LuminaBadge accent={difficultyMeta.accent}>{difficultyMeta.label}</LuminaBadge>
            {voiceMode === 'auto' && !showSummary && (
              <LuminaButton
                tone="ghost"
                className="px-3 py-1 text-xs"
                onClick={() => {
                  voiceChoice.voice.stop();
                  spokenCapture.cancel();
                  setVoiceMode('off');
                }}
              >
                🎙️ Voice on
              </LuminaButton>
            )}
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!showSummary && currentChallenge && (
          <>
            <div className="flex items-center justify-between gap-3">
              <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} />
              <span className="text-xs text-slate-500">
                {pagesVisited.size} pages explored · {focusWordsExplored.size} words opened
              </span>
            </div>
            <LuminaProgress
              value={((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
              accent="blue"
            />
            <LuminaPrompt>{currentChallenge.prompt}</LuminaPrompt>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
              <section className="min-w-0">
                {currentView.kind === 'cover' ? (
                  <div className={`mx-auto max-w-xl rounded-r-[2rem] rounded-l-lg bg-gradient-to-br ${COVER_GRADIENTS[book.coverColor]} p-5 shadow-2xl ring-1 ring-white/15`}>
                    {renderImage()}
                    <div className="mt-5 space-y-3 text-white">
                      {renderHotspot(currentHotspots[0], 'w-full text-3xl font-black tracking-tight')}
                      {renderHotspot(currentHotspots[1], 'text-sm font-semibold')}
                    </div>
                  </div>
                ) : currentView.page ? (
                  <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      {renderHotspot(currentHotspots[0], 'text-2xl font-black text-cyan-50')}
                      {renderHotspot(currentHotspots[2], 'shrink-0 text-sm font-bold')}
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        {renderImage()}
                        <div className="mt-2 text-sm italic text-slate-300">
                          {renderHotspot(currentHotspots[1], 'w-full text-center italic')}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {currentView.page.paragraphs.map((paragraph, index) => renderParagraph(paragraph, currentView.page!, index))}
                        <p className="text-xs text-amber-200/80">Tap any underlined word for a picture clue.</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-center gap-3">
                  <LuminaButton
                    tone="ghost"
                    onClick={() => goToView(currentViewIndex - 1)}
                    disabled={currentViewIndex === 0}
                    aria-label="Previous book page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </LuminaButton>
                  <div className="min-w-32 text-center">
                    <div className="text-sm font-semibold text-slate-200">
                      {currentView.kind === 'cover'
                        ? 'Cover'
                        : targetPageVisible
                          && currentChallenge.targetFeature === 'page-number'
                          && !showResult
                          ? 'Book page'
                          : `Page ${currentView.page?.pageNumber}`}
                    </div>
                    <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
                      {views.map((view, index) => (
                        <span
                          key={view.id}
                          className={`h-2 rounded-full transition-all ${index === currentViewIndex ? 'w-5 bg-cyan-300' : 'w-2 bg-slate-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <LuminaButton
                    tone="ghost"
                    onClick={() => goToView(currentViewIndex + 1)}
                    disabled={currentViewIndex === views.length - 1}
                    aria-label="Next book page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </LuminaButton>
                </div>
              </section>

              <aside className="space-y-4">
                {voiceMode === 'auto'
                  && currentChallenge.type === 'find-feature'
                  && targetPageVisible
                  && !showResult && (
                  <LuminaPanel className="flex flex-col items-center gap-3 p-4 text-center">
                    <p className="text-sm text-slate-300">Say the short printed words you found.</p>
                    <LuminaMicListener
                      state={voiceChoice.voice.state}
                      level={voiceChoice.voice.level}
                      isSupported={voiceChoice.voice.isSupported}
                      dormant={voiceChoice.voice.dormant}
                      onStart={voiceChoice.voice.start}
                      onCancel={voiceChoice.voice.stop}
                      accent="blue"
                      idleLabel="Say the words"
                      listeningLabel="Your turn — say it!"
                    />
                    {voiceChoice.note && <p className="text-sm text-amber-200">{voiceChoice.note}</p>}
                  </LuminaPanel>
                )}

                {currentChallenge.type === 'read-focus-word' && targetPageVisible && !showResult && (
                  <LuminaPanel accent="amber" className="space-y-4 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Read together</p>
                      <p className="mt-2 text-lg leading-8 text-slate-100">
                        <span>{currentChallenge.readLead}</span>{' '}
                        <span className="inline-block min-w-20 border-b-2 border-amber-300 text-center text-amber-200">your word</span>{' '}
                        <span className="text-slate-400">{currentChallenge.readTail}</span>
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        The tutor stops at the line. You read the glowing underlined word.
                      </p>
                    </div>
                    {voiceMode === 'auto' && (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <LuminaMicListener
                          state={spokenCapture.state}
                          level={spokenCapture.level}
                          isSupported={spokenCapture.isSupported}
                          onStart={() => void spokenCapture.start()}
                          onCancel={spokenCapture.cancel}
                          accent="amber"
                          idleLabel="Say the word"
                          listeningLabel="Your turn — read it!"
                        />
                        <p className="text-xs text-slate-500">Or tap the glowing word on the page.</p>
                      </div>
                    )}
                    {voiceMode === 'off' && (
                      <p className="text-sm font-medium text-amber-100">Tap the glowing word on the page to continue.</p>
                    )}
                  </LuminaPanel>
                )}

                {selectedFocusWord && (
                  <LuminaPanel accent="amber" className="relative p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedFocusWord(null)}
                      className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                      aria-label="Close word clue"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="pr-8">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Picture word</p>
                      <h3 className="mt-1 text-2xl font-black text-white">{selectedFocusWord.word}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-200">{selectedFocusWord.definition}</p>
                      <p className="mt-3 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-100">
                        👀 {selectedFocusWord.pictureCue}
                      </p>
                    </div>
                  </LuminaPanel>
                )}

                <LuminaHintDisclosure
                  label="Give me a clue"
                  accent="amber"
                  onOpenChange={handleHintChange}
                >
                  {currentChallenge.hint}
                </LuminaHintDisclosure>

                {feedback && (
                  <LuminaFeedbackCard status={
                    feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'
                  }>
                    {feedback}
                  </LuminaFeedbackCard>
                )}

                {showResult && currentChallenge.type === 'find-feature' && (
                  <LuminaActionButton action="next" onClick={handleNext} className="w-full">
                    {currentIndex < challenges.length - 1 ? 'Next page clue' : 'Finish book'}
                  </LuminaActionButton>
                )}
              </aside>
            </div>
          </>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading={data.mode === 'focus-word-reading' ? 'Read Together Complete!' : 'Interactive Book Complete!'}
            celebrationMessage={
              spokenWords.size > 0
                ? `You read ${spokenWords.size} underlined word${spokenWords.size === 1 ? '' : 's'} aloud!`
                : focusWordsExplored.size > 0
                  ? `You explored ${focusWordsExplored.size} underlined word${focusWordsExplored.size === 1 ? '' : 's'} along the way!`
                : 'You used the parts of a book to find information!'
            }
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default InteractiveBook;
