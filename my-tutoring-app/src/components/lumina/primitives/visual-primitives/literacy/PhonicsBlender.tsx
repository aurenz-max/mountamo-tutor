'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhonicsBlenderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

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
  listen: { label: 'Listen', description: 'Hear each sound', icon: '\uD83D\uDD0A' },
  build: { label: 'Build', description: 'Arrange the sounds', icon: '\uD83E\uDDE9' },
  blend: { label: 'Blend', description: 'Blend the word', icon: '\u2728' },
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

  const { sendText } = useLuminaAI({
    primitiveType: 'phonics-blender',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

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

    // Ask the AI tutor to pronounce just this sound (silent: no UI state change)
    sendText(`[PRONOUNCE] Say the sound ${phoneme.sound} clearly. Just the sound, nothing else.`, { silent: true });

    // Visual feedback timeout (AI audio playback is handled by the context provider)
    setTimeout(() => setActiveSoundId(null), 1200);
  }, [currentWord, sendText]);

  // Play the full blended word via the AI tutor
  const handlePlayBlendedWord = useCallback(() => {
    if (!currentWord) return;

    setActiveSoundId('blended');

    // Ask the AI tutor to say the whole word (silent: no UI state change)
    sendText(`[PRONOUNCE] Say the word "${currentWord.targetWord}" clearly. Just the word, nothing else.`, { silent: true });

    // Visual feedback timeout
    setTimeout(() => setActiveSoundId(null), 1500);
  }, [currentWord, sendText]);

  // Add phoneme to build area
  const handlePlacePhoneme = useCallback((phonemeId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'build') return;
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

      // Move to blend phase
      setTimeout(() => {
        setCurrentPhase('blend');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      setFeedback('Not quite! Try rearranging the sounds.');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [currentWord, placedPhonemeIds, attemptsPerWord, startTimes]);

  // Complete blending for current word
  const handleBlendComplete = useCallback(() => {
    if (!currentWord) return;
    setIsBlended(true);
    setCompletedWords(prev => new Set(Array.from(prev).concat(currentWord.id)));
    setIsCelebrating(true);
    setTimeout(() => setIsCelebrating(false), 1500);
  }, [currentWord]);

  // Move to next word
  const handleNextWord = useCallback(() => {
    if (currentWordIndex < words.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setCurrentPhase('listen');
      setPlacedPhonemeIds([]);
      setFeedback('');
      setFeedbackType('');
      setIsBlended(false);
      setIsShaking(false);
      setIsCelebrating(false);
    } else {
      // All words done - submit evaluation
      submitFinalEvaluation();
    }
  }, [currentWordIndex, words.length]);

  // Advance from listen to build phase
  const handleStartBuild = useCallback(() => {
    setCurrentPhase('build');
    setFeedback('');
    setFeedbackType('');
  }, []);

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
                  {isCompleted ? '\u2713' : config.icon}
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
        <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
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
        </div>

        {/* Slow blend display */}
        <div className="rounded-lg bg-slate-800/40 border border-white/5 p-4 text-center">
          <p className="text-slate-500 text-xs mb-2">Blended together:</p>
          <div className="flex items-center justify-center gap-1">
            {currentWord.phonemes.map((phoneme, i) => (
              <React.Fragment key={phoneme.id}>
                <span className="text-2xl font-bold text-slate-200">{phoneme.letters}</span>
                {i < currentWord.phonemes.length - 1 && (
                  <span className="text-slate-600 text-lg mx-0.5">{'\u00B7'}</span>
                )}
              </React.Fragment>
            ))}
            <span className="text-slate-500 mx-2">{'\u2192'}</span>
            <span className="text-2xl font-bold text-emerald-300">{currentWord.targetWord}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={handleStartBuild}
            className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
          >
            Ready to Build!
          </Button>
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
          <div
            className={`
              px-4 py-2 rounded-lg text-sm font-medium text-center
              ${feedbackType === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : feedbackType === 'error'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* Sound bank */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Sound Bank:</p>
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
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
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleClearAll}
            disabled={placedPhonemeIds.length === 0}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            onClick={handleCheckBuild}
            disabled={placedPhonemeIds.length !== currentWord.phonemes.length}
            className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
          >
            Check
          </Button>
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
          <div className="text-slate-500 text-2xl">{'\u2193'}</div>

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

          {currentWord.imageDescription && (
            <p className="text-slate-400 text-sm italic">{currentWord.imageDescription}</p>
          )}
        </div>

        {/* Blend button or next */}
        <div className="flex justify-center gap-3">
          {!isBlended ? (
            <Button
              variant="ghost"
              onClick={handleBlendComplete}
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-lg px-8 py-3"
            >
              Blend!
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleNextWord}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
            >
              {currentWordIndex < words.length - 1 ? 'Next Word' : 'Finish'}
            </Button>
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
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No words available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                Grade {gradeLevel}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">
                {PATTERN_LABELS[patternType] || patternType}
              </Badge>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentPhase === 'listen'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : currentPhase === 'build'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {PHASE_CONFIG[currentPhase].description}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center space-y-2">
            <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
            <p className="text-slate-400 text-sm">
              You blended {completedWords.size} out of {words.length} words!
            </p>
            <div className="flex justify-center gap-4 text-xs text-slate-500">
              <span>
                Attempts: {Object.values(attemptsPerWord).reduce((s, v) => s + v, 0)}
              </span>
              <span>
                First try: {correctOnFirstTry.size}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhonicsBlender;
