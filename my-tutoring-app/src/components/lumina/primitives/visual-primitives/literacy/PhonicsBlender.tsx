'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaScoreRing,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhonicsBlenderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PhonicsBlenderData {
  title: string;
  gradeLevel: string;
  patternType: 'cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong';

  // Words to blend
  words: Array<{
    id: string;
    targetWord: string;               // The full word (e.g., "cat")
    phonemes: Array<{
      id: string;
      sound: string;                  // The phoneme display (e.g., "/k/", "/æ/", "/t/")
      letters: string;                // The letter(s) this phoneme maps to (e.g., "c", "a", "t")
    }>;
    emoji?: string;                    // Single emoji visual hint for the word (e.g., "🐱" for cat)
    imageDescription?: string;         // Description of the target word for visual context
  }>;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonicsBlenderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface PhonicsBlenderProps {
  data: PhonicsBlenderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type LearningPhase = 'listen' | 'build' | 'blend';

const PHASE_CONFIG: Record<LearningPhase, { label: string; description: string; icon: string }> = {
  listen: { label: 'Listen', description: 'Hear each sound', icon: '🔊' },
  build: { label: 'Build', description: 'Arrange the sounds', icon: '🧩' },
  blend: { label: 'Blend', description: 'Blend the word', icon: '✨' },
};

const PHASE_ACCENT: Record<LearningPhase, LuminaAccent> = {
  listen: 'blue',
  build: 'amber',
  blend: 'emerald',
};

const PATTERN_LABELS: Record<string, string> = {
  'cvc': 'CVC Words',
  'cvce': 'Silent-E Words',
  'blend': 'Consonant Blends',
  'digraph': 'Digraphs',
  'r-controlled': 'R-Controlled Vowels',
  'diphthong': 'Diphthongs',
};

// ============================================================================
// Component
// ============================================================================

const PhonicsBlender: React.FC<PhonicsBlenderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    patternType,
    words = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('listen');
  const [placedPhonemeIds, setPlacedPhonemeIds] = useState<string[]>([]);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [isBlended, setIsBlended] = useState(false);

  // Tracking
  const [attemptsPerWord, setAttemptsPerWord] = useState<Record<string, number>>({});
  const [correctOnFirstTry, setCorrectOnFirstTry] = useState<Set<string>>(new Set());
  const [listenedSounds, setListenedSounds] = useState<Set<string>>(new Set());
  const [startTimes, setStartTimes] = useState<Record<string, number>>({});
  const [blendTimes, setBlendTimes] = useState<Record<string, number>>({});

  // Stable fallback instance ID — must not change across renders
  const stableInstanceIdRef = useRef(instanceId || `phonics-blender-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PhonicsBlenderMetrics>({
    primitiveType: 'phonics-blender',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentWord = words[currentWordIndex];

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration — the AI tutor is the voice of this primitive.
  // All pronunciation (phoneme sounds, blended words) goes through Gemini Live
  // via sendText, replacing 20+ individual TTS calls with one persistent session.
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    patternType,
    gradeLevel,
    totalWords: words.length,
    currentWord: currentWord?.targetWord ?? '',
    currentPhase,
    targetPhonemes: currentWord?.phonemes.map(p => p.sound).join(' + ') ?? '',
    placedPhonemes: placedPhonemeIds
      .map(id => currentWord?.phonemes.find(p => p.id === id)?.sound)
      .filter(Boolean)
      .join(' + '),
    completedWords: completedWords.size,
    attempts: attemptsPerWord[currentWord?.id || ''] || 0,
  }), [
    patternType, gradeLevel, words.length,
    currentWord, currentPhase, placedPhonemeIds,
    completedWords, attemptsPerWord,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'phonics-blender',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ---------------------------------------------------------------------------
  // Activity introduction — fire once when the AI tutor connects
  // ---------------------------------------------------------------------------
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentWord) return;
    hasIntroducedRef.current = true;

    const patternLabel = PATTERN_LABELS[patternType] || patternType;
    const phonemeList = currentWord.phonemes.map(p => p.sound).join(', ');

    sendText(
      `[ACTIVITY_START] This is a phonics blending activity for Grade ${gradeLevel} (${patternLabel}). `
      + `There are ${words.length} words to blend. `
      + `Introduce the activity warmly: mention we're practicing phonics and blending sounds into words. `
      + `Then introduce the first word: "${currentWord.targetWord}" which has ${currentWord.phonemes.length} sounds (${phonemeList}). `
      + `Encourage the student to tap each sound tile to hear it. Keep it brief and enthusiastic — 2-3 sentences max.`,
      { silent: true }
    );
  }, [isConnected, currentWord, gradeLevel, patternType, words.length, sendText]);

  // Shuffled phonemes for the bank (build phase)
  const shuffledPhonemes = useMemo(() => {
    if (!currentWord) return [];
    const phonemes = [...currentWord.phonemes];
    for (let i = phonemes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [phonemes[i], phonemes[j]] = [phonemes[j], phonemes[i]];
    }
    return phonemes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWordIndex]);

  // Available phonemes in the bank (not yet placed)
  const availablePhonemes = useMemo(() => {
    if (!currentWord) return [];
    return shuffledPhonemes.filter(p => !placedPhonemeIds.includes(p.id));
  }, [currentWord, shuffledPhonemes, placedPhonemeIds]);

  // ---------------------------------------------------------------------------
  // Audio via AI Tutor — pronounce phonemes and words through Gemini Live
  // ---------------------------------------------------------------------------

  // Play a single phoneme sound via the AI tutor
  const handlePlaySound = useCallback((phonemeId: string) => {
    const phoneme = currentWord?.phonemes.find(p => p.id === phonemeId);
    if (!phoneme) return;

    setActiveSoundId(phonemeId);
    setListenedSounds(prev => new Set(Array.from(prev).concat(phonemeId)));

    // Ask the AI tutor to pronounce this sound — embed in a sentence so Gemini always speaks
    sendText(`[PRONOUNCE_SOUND] This sound is ${phoneme.sound}. ${phoneme.sound}.`, { silent: true });

    // Visual feedback timeout (AI audio playback is handled by the context provider)
    setTimeout(() => setActiveSoundId(null), 1200);
  }, [currentWord, sendText]);

  // Play the full blended word via the AI tutor
  const handlePlayBlendedWord = useCallback(() => {
    if (!currentWord) return;

    setActiveSoundId('blended');

    // Ask the AI tutor to say the whole word — embed in a sentence so Gemini always speaks
    sendText(`[PRONOUNCE_SOUND] The word is "${currentWord.targetWord}". ${currentWord.targetWord}.`, { silent: true });

    // Visual feedback timeout
    setTimeout(() => setActiveSoundId(null), 1500);
  }, [currentWord, sendText]);

  // Add phoneme to build area
  const handlePlacePhoneme = useCallback((phonemeId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'build') return;
    SoundManager.tap();
    setPlacedPhonemeIds(prev => [...prev, phonemeId]);
    setFeedback('');
    setFeedbackType('');

    // Record start time on first placement
    if (!currentWord) return;
    if (!startTimes[currentWord.id]) {
      setStartTimes(prev => ({ ...prev, [currentWord.id]: Date.now() }));
    }
  }, [hasSubmittedEvaluation, currentPhase, currentWord, startTimes]);

  // Remove phoneme from build area
  const handleRemovePhoneme = useCallback((phonemeId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'build') return;
    setPlacedPhonemeIds(prev => prev.filter(id => id !== phonemeId));
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, currentPhase]);

  // Clear all placed phonemes
  const handleClearAll = useCallback(() => {
    setPlacedPhonemeIds([]);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // Check the build order
  const handleCheckBuild = useCallback(() => {
    if (!currentWord) return;

    const wordId = currentWord.id;
    setAttemptsPerWord(prev => ({ ...prev, [wordId]: (prev[wordId] || 0) + 1 }));

    const correctOrder = currentWord.phonemes.map(p => p.id);
    const isCorrect =
      placedPhonemeIds.length === correctOrder.length &&
      placedPhonemeIds.every((id, i) => id === correctOrder[i]);

    if (isCorrect) {
      SoundManager.playCorrect();
      // Track first-try success
      if ((attemptsPerWord[wordId] || 0) === 0) {
        setCorrectOnFirstTry(prev => new Set(Array.from(prev).concat(wordId)));
      }
      // Record blend time
      if (startTimes[wordId]) {
        setBlendTimes(prev => ({
          ...prev,
          [wordId]: (Date.now() - startTimes[wordId]) / 1000,
        }));
      }

      setFeedback('Perfect! You built the word correctly!');
      setFeedbackType('success');
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      // Tell the AI the student built the word correctly
      sendText(
        `[BUILD_CORRECT] The student arranged the sounds for "${currentWord.targetWord}" in the correct order${(attemptsPerWord[wordId] || 0) === 0 ? ' on the first try!' : ` after ${(attemptsPerWord[wordId] || 0) + 1} attempts.`} Congratulate briefly and tell them to click the word to hear it blended together.`,
        { silent: true }
      );

      // Move to blend phase
      setTimeout(() => {
        setCurrentPhase('blend');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      SoundManager.playIncorrect();
      const placedSounds = placedPhonemeIds
        .map(id => currentWord.phonemes.find(p => p.id === id)?.sound)
        .filter(Boolean)
        .join(' + ');
      setFeedback('Not quite! Try rearranging the sounds.');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      // Tell the AI the student got it wrong so it can help
      sendText(
        `[BUILD_INCORRECT] The student tried to build "${currentWord.targetWord}" but placed the sounds as: ${placedSounds}. The correct order is: ${currentWord.phonemes.map(p => p.sound).join(' + ')}. This is attempt ${(attemptsPerWord[wordId] || 0) + 1}. Give a brief hint without giving the answer.`,
        { silent: true }
      );
    }
  }, [currentWord, placedPhonemeIds, attemptsPerWord, startTimes, sendText]);

  // Complete blending for current word
  const handleBlendComplete = useCallback(() => {
    if (!currentWord) return;
    setIsBlended(true);
    setCompletedWords(prev => new Set(Array.from(prev).concat(currentWord.id)));
    setIsCelebrating(true);
    setTimeout(() => setIsCelebrating(false), 1500);

    // Tell the AI the student blended successfully — triggers a spoken response
    sendText(
      `[STUDENT_BLENDED] The student successfully blended the word "${currentWord.targetWord}"! Celebrate briefly (one sentence).`,
      { silent: true }
    );
  }, [currentWord, sendText]);

  // Move to next word
  const handleNextWord = useCallback(() => {
    if (currentWordIndex < words.length - 1) {
      const nextWord = words[currentWordIndex + 1];
      setCurrentWordIndex(prev => prev + 1);
      setCurrentPhase('listen');
      setPlacedPhonemeIds([]);
      setFeedback('');
      setFeedbackType('');
      setIsBlended(false);
      setIsShaking(false);
      setIsCelebrating(false);

      // Tell the AI about the new word — triggers a spoken introduction
      if (nextWord) {
        const phonemeList = nextWord.phonemes.map(p => p.sound).join(' + ');
        sendText(
          `[NEXT_WORD] The student is moving to word ${currentWordIndex + 2} of ${words.length}: "${nextWord.targetWord}" (${phonemeList}). Briefly introduce the new word and encourage them to tap each sound.`,
          { silent: true }
        );
      }
    } else {
      // All words done - submit evaluation
      submitFinalEvaluation();
    }
  }, [currentWordIndex, words, sendText]);

  // Advance from listen to build phase
  const handleStartBuild = useCallback(() => {
    setCurrentPhase('build');
    setFeedback('');
    setFeedbackType('');

    // Tell the AI tutor we're moving to the build phase
    if (currentWord) {
      const phonemeList = currentWord.phonemes.map(p => p.sound).join(', ');
      sendText(
        `[PHASE_TO_BUILD] The student finished listening and is now in the Build phase for "${currentWord.targetWord}". `
        + `The sounds are: ${phonemeList}. `
        + `Briefly tell them to arrange the sound tiles in the right order to build the word. One sentence.`,
        { silent: true }
      );
    }
  }, [currentWord, sendText]);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const wordsBlended = completedWords.size + (currentWord && !completedWords.has(currentWord.id) ? 1 : 0);
    const wordsTotal = words.length;
    const totalSounds = words.reduce((sum, w) => sum + w.phonemes.length, 0);
    const soundsCorrectFirst = correctOnFirstTry.size;
    const totalAttempts = Object.values(attemptsPerWord).reduce((s, v) => s + v, 0);
    const avgBlendTime = Object.values(blendTimes).length > 0
      ? Object.values(blendTimes).reduce((s, v) => s + v, 0) / Object.values(blendTimes).length
      : 0;
    const accuracy = wordsTotal > 0 ? Math.round((wordsBlended / wordsTotal) * 100) : 0;

    const metrics: PhonicsBlenderMetrics = {
      type: 'phonics-blender',
      patternType,
      gradeLevel,
      wordsBlended,
      wordsTotal,
      phonemeAccuracy: accuracy,
      averageBlendingSpeed: Math.round(avgBlendTime * 10) / 10,
      soundsCorrectOnFirstTry: soundsCorrectFirst,
      soundsTotal: totalSounds,
      attemptsCount: totalAttempts,
    };

    submitEvaluation(
      accuracy >= 60,
      accuracy,
      metrics,
      {
        completedWords: Array.from(completedWords),
        blendTimes,
        attemptsPerWord,
      }
    );
  }, [
    hasSubmittedEvaluation,
    completedWords,
    currentWord,
    words,
    correctOnFirstTry,
    attemptsPerWord,
    blendTimes,
    patternType,
    gradeLevel,
    submitEvaluation,
  ]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderPhaseProgress = () => {
    const phases: LearningPhase[] = ['listen', 'build', 'blend'];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase === currentPhase;
          const isCompleted =
            (phase === 'listen' && (currentPhase === 'build' || currentPhase === 'blend')) ||
            (phase === 'build' && currentPhase === 'blend') ||
            (phase === 'blend' && isBlended);
          const config = PHASE_CONFIG[phase];
          return (
            <React.Fragment key={phase}>
              {index > 0 && (
                <div className={`h-0.5 w-8 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${isCompleted
                      ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                      : isActive
                        ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                        : 'bg-slate-700/30 border-slate-600/40 text-slate-500'
                    }
                  `}
                >
                  {isCompleted ? '✓' : config.icon}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {config.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render a phoneme tile
  const renderPhonemeTile = (
    phoneme: { id: string; sound: string; letters: string },
    onClick: () => void,
    isInBuildArea: boolean,
    showLetters: boolean
  ) => {
    const isActive = activeSoundId === phoneme.id;
    return (
      <button
        key={phoneme.id}
        onClick={onClick}
        className={`
          relative px-4 py-3 rounded-xl border-2 font-bold text-lg
          transition-all duration-200 cursor-pointer select-none
          ${isActive
            ? 'bg-amber-500/30 border-amber-400/60 text-amber-200 scale-110 shadow-lg shadow-amber-500/20'
            : isInBuildArea
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-200 hover:opacity-70'
              : 'bg-slate-700/40 border-slate-500/30 text-slate-200 hover:scale-105 hover:bg-slate-600/40'
          }
          ${isCelebrating && isInBuildArea ? 'animate-bounce' : ''}
        `}
      >
        <span className="text-xl">{phoneme.sound}</span>
        {showLetters && (
          <span className="block text-xs text-slate-400 mt-0.5">{phoneme.letters}</span>
        )}
      </button>
    );
  };

  // Listen phase: tap phonemes to hear sounds
  const renderListenPhase = () => {
    if (!currentWord) return null;
    return (
      <div className="space-y-4">
        {/* Word visual hint */}
        {currentWord.emoji && (
          <LuminaPanel className="flex items-center justify-center px-5 py-4">
            <span className="text-6xl" role="img" aria-label={currentWord.imageDescription || currentWord.targetWord}>
              {currentWord.emoji}
            </span>
          </LuminaPanel>
        )}

        <LuminaPanel className="text-center">
          <p className="text-slate-400 text-sm mb-3">Tap each sound to hear it:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {currentWord.phonemes.map(phoneme =>
              renderPhonemeTile(
                phoneme,
                () => handlePlaySound(phoneme.id),
                false,
                true
              )
            )}
          </div>
        </LuminaPanel>

        {/* Slow blend display */}
        <LuminaPanel className="text-center">
          <p className="text-slate-500 text-xs mb-2">Blended together:</p>
          <div className="flex items-center justify-center gap-1">
            {currentWord.phonemes.map((phoneme, i) => (
              <React.Fragment key={phoneme.id}>
                <span className="text-2xl font-bold text-slate-200">{phoneme.letters}</span>
                {i < currentWord.phonemes.length - 1 && (
                  <span className="text-slate-600 text-lg mx-0.5">{'·'}</span>
                )}
              </React.Fragment>
            ))}
            <span className="text-slate-500 mx-2">{'→'}</span>
            <span className="text-2xl font-bold text-emerald-300">{currentWord.targetWord}</span>
          </div>
        </LuminaPanel>

        <div className="flex justify-center">
          <LuminaButton tone="primary" onClick={handleStartBuild}>
            Ready to Build!
          </LuminaButton>
        </div>
      </div>
    );
  };

  // Build phase: arrange phonemes in correct order
  const renderBuildPhase = () => {
    if (!currentWord) return null;
    const totalSlots = currentWord.phonemes.length;
    const emptySlots = Math.max(0, totalSlots - placedPhonemeIds.length);

    return (
      <div className="space-y-4">
        {/* Word visual hint */}
        {currentWord.emoji && (
          <LuminaPanel className="flex items-center justify-center gap-3 px-4 py-2">
            <span className="text-3xl" role="img" aria-label={currentWord.imageDescription || currentWord.targetWord}>
              {currentWord.emoji}
            </span>
            <span className="text-slate-400 text-xs italic">Build this word</span>
          </LuminaPanel>
        )}

        {/* Build area */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Arrange the sounds to build the word:</p>
          <div
            className={`
              flex flex-wrap items-center gap-2 min-h-[64px] p-4 rounded-xl
              border border-dashed border-white/20 bg-white/5
              ${isShaking ? 'animate-shake' : ''}
            `}
          >
            {placedPhonemeIds.map(pId => {
              const phoneme = currentWord.phonemes.find(p => p.id === pId);
              if (!phoneme) return null;
              return renderPhonemeTile(
                phoneme,
                () => handleRemovePhoneme(pId),
                true,
                false
              );
            })}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="px-4 py-3 rounded-xl border-2 border-dashed border-slate-600/40 bg-slate-800/20 min-w-[56px] min-h-[48px] flex items-center justify-center"
              >
                <span className="text-slate-600 text-sm">?</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Sound bank */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Sound Bank:</p>
          <LuminaPanel>
            {availablePhonemes.length > 0 ? (
              <div className="flex flex-wrap gap-3 justify-center">
                {availablePhonemes.map(phoneme =>
                  renderPhonemeTile(
                    phoneme,
                    () => handlePlacePhoneme(phoneme.id),
                    false,
                    true
                  )
                )}
              </div>
            ) : (
              <p className="text-center text-slate-500 text-sm">
                All sounds placed! Check your answer.
              </p>
            )}
          </LuminaPanel>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LuminaButton
            onClick={handleClearAll}
            disabled={placedPhonemeIds.length === 0}
          >
            Clear
          </LuminaButton>
          <LuminaActionButton
            action="check"
            onClick={handleCheckBuild}
            disabled={placedPhonemeIds.length !== currentWord.phonemes.length}
            className="ml-auto"
          >
            Check
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  // Blend phase: see the completed word
  const renderBlendPhase = () => {
    if (!currentWord) return null;
    return (
      <div className="space-y-4">
        {/* Blended word display */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 p-6 text-center space-y-3">
          {/* Phoneme breakdown */}
          <div className="flex items-center justify-center gap-2">
            {currentWord.phonemes.map((phoneme, i) => (
              <React.Fragment key={phoneme.id}>
                <button
                  onClick={() => handlePlaySound(phoneme.id)}
                  className={`
                    px-3 py-2 rounded-lg border transition-all cursor-pointer
                    ${activeSoundId === phoneme.id
                      ? 'bg-amber-500/30 border-amber-400/50 text-amber-200 scale-110'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }
                  `}
                >
                  <span className="text-lg font-bold">{phoneme.sound}</span>
                </button>
                {i < currentWord.phonemes.length - 1 && (
                  <span className="text-slate-600">+</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Arrow */}
          <div className="text-slate-500 text-2xl">{'↓'}</div>

          {/* The blended word */}
          <button
            onClick={handlePlayBlendedWord}
            className={`
              inline-block px-8 py-4 rounded-2xl border-2 transition-all cursor-pointer
              ${isBlended
                ? 'bg-emerald-500/20 border-emerald-400/40 shadow-lg shadow-emerald-500/10'
                : activeSoundId === 'blended'
                  ? 'bg-amber-500/20 border-amber-400/40 scale-105'
                  : 'bg-blue-500/20 border-blue-400/30 hover:scale-105'
              }
              ${isCelebrating ? 'animate-bounce' : ''}
            `}
          >
            <span className="text-3xl font-bold text-slate-100">
              {currentWord.targetWord}
            </span>
          </button>

          {(currentWord.emoji || currentWord.imageDescription) && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {currentWord.emoji && (
                <span className="text-4xl" role="img" aria-label={currentWord.imageDescription || currentWord.targetWord}>
                  {currentWord.emoji}
                </span>
              )}
              {currentWord.imageDescription && (
                <p className="text-slate-400 text-sm italic">{currentWord.imageDescription}</p>
              )}
            </div>
          )}
        </div>

        {/* Blend button or next */}
        <div className="flex justify-center gap-3">
          {!isBlended ? (
            <LuminaButton
              tone="primary"
              onClick={handleBlendComplete}
              className="text-lg px-8 py-3"
            >
              Blend!
            </LuminaButton>
          ) : (
            <LuminaActionButton action="next" onClick={handleNextWord}>
              {currentWordIndex < words.length - 1 ? 'Next Word' : 'Finish'}
            </LuminaActionButton>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!currentWord) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No words available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">
                Grade {gradeLevel}
              </LuminaBadge>
              <LuminaBadge className="text-xs">
                {PATTERN_LABELS[patternType] || patternType}
              </LuminaBadge>
            </div>
          </div>
          <LuminaBadge accent={PHASE_ACCENT[currentPhase]} className="text-xs">
            {PHASE_CONFIG[currentPhase].description}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        {renderPhaseProgress()}

        {/* Word Counter */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Word {currentWordIndex + 1} of {words.length}
          </span>
          <span className="text-slate-500 text-xs">
            {completedWords.size} completed
          </span>
        </div>

        {/* Phase Content */}
        {currentPhase === 'listen' && renderListenPhase()}
        {currentPhase === 'build' && renderBuildPhase()}
        {currentPhase === 'blend' && renderBlendPhase()}

        {/* Final Results */}
        {hasSubmittedEvaluation && (
          <LuminaPanel accent="emerald" className="flex flex-col items-center text-center gap-3">
            <LuminaScoreRing
              score={words.length > 0 ? Math.round((completedWords.size / words.length) * 100) : 0}
            />
            <div className="space-y-1">
              <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
              <p className="text-slate-400 text-sm">
                You blended {completedWords.size} out of {words.length} words!
              </p>
            </div>
            <div className="flex justify-center gap-4 text-xs text-slate-500">
              <span>
                Attempts: {Object.values(attemptsPerWord).reduce((s, v) => s + v, 0)}
              </span>
              <span>
                First try: {correctOnFirstTry.size}
              </span>
            </div>
          </LuminaPanel>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PhonicsBlender;
