'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { DecodableReaderMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface DecodableReaderData {
  title: string;
  gradeLevel: string;

  // The passage
  passage: {
    sentences: Array<{
      id: string;
      words: Array<{
        id: string;
        text: string;                         // The word as displayed
        phonicsPattern: 'cvc' | 'cvce' | 'sight' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong' | 'other';
        phonemes?: string[];                  // Optional phoneme breakdown (e.g., ["/k/", "/a/", "/t/"])
      }>;
    }>;
    imageDescription?: string;                // AI image prompt for the passage scene
  };

  // Phonics patterns present in this passage
  phonicsPatternsInPassage: string[];

  // Comprehension question after reading
  comprehensionQuestion: {
    question: string;
    type: 'multiple-choice' | 'short-answer';
    options?: string[];                       // For multiple-choice
    correctAnswer: string;                    // The correct answer text
    acceptableAnswers?: string[];             // Alternative acceptable answers
  };

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DecodableReaderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface DecodableReaderProps {
  data: DecodableReaderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type ReadingPhase = 'reading' | 'comprehension' | 'review';

const PATTERN_COLORS: Record<string, string> = {
  cvc: 'text-blue-300',
  cvce: 'text-violet-300',
  sight: 'text-amber-300',
  blend: 'text-cyan-300',
  digraph: 'text-emerald-300',
  'r-controlled': 'text-rose-300',
  diphthong: 'text-orange-300',
  other: 'text-slate-300',
};

const PATTERN_BG: Record<string, string> = {
  cvc: 'bg-blue-500/10',
  cvce: 'bg-violet-500/10',
  sight: 'bg-amber-500/10',
  blend: 'bg-cyan-500/10',
  digraph: 'bg-emerald-500/10',
  'r-controlled': 'bg-rose-500/10',
  diphthong: 'bg-orange-500/10',
  other: '',
};

const PATTERN_LABELS: Record<string, string> = {
  cvc: 'CVC',
  cvce: 'Silent-E',
  sight: 'Sight Word',
  blend: 'Blend',
  digraph: 'Digraph',
  'r-controlled': 'R-Controlled',
  diphthong: 'Diphthong',
  other: 'Other',
};

// ============================================================================
// Component
// ============================================================================

const DecodableReader: React.FC<DecodableReaderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    passage,
    phonicsPatternsInPassage = [],
    comprehensionQuestion,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Phase state
  const [currentPhase, setCurrentPhase] = useState<ReadingPhase>('reading');

  // Reading tracking
  const [tappedWordIds, setTappedWordIds] = useState<Set<string>>(new Set());
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [showPhonemes, setShowPhonemes] = useState<string | null>(null);
  const [readingStartTime] = useState(Date.now());
  const [readingEndTime, setReadingEndTime] = useState<number | null>(null);
  const [showPatternColors, setShowPatternColors] = useState(true);

  // Comprehension state
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [comprehensionAttempts, setComprehensionAttempts] = useState(0);
  const [comprehensionCorrect, setComprehensionCorrect] = useState<boolean | null>(null);
  const [showTextInReview, setShowTextInReview] = useState(true);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<DecodableReaderMetrics>({
    primitiveType: 'decodable-reader',
    instanceId: instanceId || `decodable-reader-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Total words in passage
  const totalWords = useMemo(() => {
    return passage.sentences.reduce((sum, s) => sum + s.words.length, 0);
  }, [passage]);

  // Sight words count
  const sightWordCount = useMemo(() => {
    return passage.sentences.reduce(
      (sum, s) => sum + s.words.filter(w => w.phonicsPattern === 'sight').length,
      0
    );
  }, [passage]);

  // Sight words not tapped (read independently)
  const sightWordsIndependent = useMemo(() => {
    let count = 0;
    passage.sentences.forEach(s => {
      s.words.forEach(w => {
        if (w.phonicsPattern === 'sight' && !tappedWordIds.has(w.id)) {
          count++;
        }
      });
    });
    return count;
  }, [passage, tappedWordIds]);

  // Handle tapping a word
  const handleTapWord = useCallback((wordId: string) => {
    setTappedWordIds(prev => new Set(Array.from(prev).concat(wordId)));
    setActiveWordId(wordId);
    // Show "playing" state briefly
    setTimeout(() => {
      if (activeWordId === wordId) setActiveWordId(null);
    }, 800);
  }, [activeWordId]);

  // Toggle phoneme breakdown for a word
  const handleTogglePhonemes = useCallback((wordId: string) => {
    setShowPhonemes(prev => prev === wordId ? null : wordId);
  }, []);

  // Move to comprehension
  const handleDoneReading = useCallback(() => {
    setReadingEndTime(Date.now());
    setCurrentPhase('comprehension');
  }, []);

  // Check comprehension answer
  const handleCheckComprehension = useCallback(() => {
    setComprehensionAttempts(prev => prev + 1);

    const answer = comprehensionQuestion.type === 'multiple-choice'
      ? selectedAnswer
      : shortAnswer.trim().toLowerCase();

    const correct = comprehensionQuestion.correctAnswer.toLowerCase();
    const acceptable = comprehensionQuestion.acceptableAnswers?.map(a => a.toLowerCase()) || [];

    const isCorrect = answer === correct || acceptable.includes(answer);
    setComprehensionCorrect(isCorrect);

    if (isCorrect) {
      // Move to review after short delay
      setTimeout(() => setCurrentPhase('review'), 1200);
    }
  }, [comprehensionQuestion, selectedAnswer, shortAnswer]);

  // Skip to review (if they want to move on after wrong answer)
  const handleContinueToReview = useCallback(() => {
    setCurrentPhase('review');
  }, []);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const endTime = readingEndTime || Date.now();
    const readingTimeSeconds = Math.round((endTime - readingStartTime) / 1000);
    const wordsTapped = tappedWordIds.size;
    const accuracy = totalWords > 0
      ? Math.round(((totalWords - wordsTapped) / totalWords) * 100)
      : 100;

    const metrics: DecodableReaderMetrics = {
      type: 'decodable-reader',
      gradeLevel,
      wordsTapped,
      wordsTotal: totalWords,
      comprehensionCorrect: comprehensionCorrect === true,
      phonicsPatternsInPassage,
      sightWordsIdentified: sightWordsIndependent,
      readingTimeSeconds,
      attemptsOnComprehension: comprehensionAttempts,
    };

    // Score: blend of independent reading (70%) + comprehension (30%)
    const readingScore = totalWords > 0 ? ((totalWords - wordsTapped) / totalWords) * 70 : 70;
    const compScore = comprehensionCorrect ? 30 : 0;
    const score = Math.round(readingScore + compScore);

    submitEvaluation(
      score >= 50,
      score,
      metrics,
      {
        tappedWordIds: Array.from(tappedWordIds),
        readingTimeSeconds,
        selectedAnswer: selectedAnswer || shortAnswer,
      }
    );
  }, [
    hasSubmittedEvaluation,
    readingEndTime,
    readingStartTime,
    tappedWordIds,
    totalWords,
    comprehensionCorrect,
    comprehensionAttempts,
    phonicsPatternsInPassage,
    sightWordsIndependent,
    gradeLevel,
    selectedAnswer,
    shortAnswer,
    submitEvaluation,
  ]);

  // Auto-submit when entering review phase
  const handleFinish = useCallback(() => {
    submitFinalEvaluation();
  }, [submitFinalEvaluation]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase indicator
  const renderPhaseIndicator = () => {
    const phases: { key: ReadingPhase; label: string }[] = [
      { key: 'reading', label: 'Read' },
      { key: 'comprehension', label: 'Answer' },
      { key: 'review', label: 'Review' },
    ];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase.key === currentPhase;
          const isCompleted =
            (phase.key === 'reading' && currentPhase !== 'reading') ||
            (phase.key === 'comprehension' && currentPhase === 'review');
          return (
            <React.Fragment key={phase.key}>
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
                  {isCompleted ? '\u2713' : index + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Pattern legend
  const renderPatternLegend = () => {
    const patterns = Array.from(new Set(
      passage.sentences.flatMap(s => s.words.map(w => w.phonicsPattern))
    ));
    return (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {patterns.map(pattern => (
          <Badge
            key={pattern}
            variant="outline"
            className={`text-xs ${PATTERN_COLORS[pattern]} bg-white/5 border-white/10`}
          >
            {PATTERN_LABELS[pattern] || pattern}
          </Badge>
        ))}
      </div>
    );
  };

  // Render a single word
  const renderWord = (
    word: { id: string; text: string; phonicsPattern: string; phonemes?: string[] },
    isInteractive: boolean
  ) => {
    const isTapped = tappedWordIds.has(word.id);
    const isActive = activeWordId === word.id;
    const isShowingPhonemes = showPhonemes === word.id;
    const colorClass = showPatternColors ? PATTERN_COLORS[word.phonicsPattern] || 'text-slate-200' : 'text-slate-200';
    const bgClass = showPatternColors ? PATTERN_BG[word.phonicsPattern] || '' : '';

    return (
      <span key={word.id} className="inline-block relative">
        <button
          onClick={() => {
            if (isInteractive) {
              handleTapWord(word.id);
              if (word.phonemes && word.phonemes.length > 0) {
                handleTogglePhonemes(word.id);
              }
            }
          }}
          disabled={!isInteractive}
          className={`
            inline-block px-1 py-0.5 rounded transition-all text-lg leading-relaxed
            ${isInteractive ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}
            ${isActive ? 'bg-amber-500/20 scale-105' : ''}
            ${isTapped && !isActive ? 'underline decoration-dotted decoration-slate-500 underline-offset-4' : ''}
            ${bgClass}
            ${colorClass}
          `}
        >
          {word.text}
        </button>
        {/* Phoneme popup */}
        {isShowingPhonemes && word.phonemes && word.phonemes.length > 0 && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10">
            <div className="bg-slate-800 border border-white/20 rounded-lg px-2 py-1 flex gap-1 shadow-xl whitespace-nowrap">
              {word.phonemes.map((p, i) => (
                <span key={i} className="text-amber-300 text-sm font-mono">{p}</span>
              ))}
            </div>
          </div>
        )}
      </span>
    );
  };

  // Reading phase
  const renderReadingPhase = () => (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-slate-400 text-sm">
          Read the passage below. <span className="text-amber-300">Tap any word</span> to hear it pronounced.
        </p>
      </div>

      {/* Pattern legend */}
      {showPatternColors && renderPatternLegend()}

      {/* Passage */}
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5 space-y-3">
        {passage.sentences.map(sentence => (
          <p key={sentence.id} className="leading-loose">
            {sentence.words.map((word, i) => (
              <React.Fragment key={word.id}>
                {renderWord(word, true)}
                {i < sentence.words.length - 1 && <span className="text-slate-200"> </span>}
              </React.Fragment>
            ))}
          </p>
        ))}
      </div>

      {/* Reading stats */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Words tapped: {tappedWordIds.size} / {totalWords}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPatternColors(prev => !prev)}
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 text-xs h-7 px-2"
        >
          {showPatternColors ? 'Hide Colors' : 'Show Colors'}
        </Button>
      </div>

      {/* Done reading button */}
      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          onClick={handleDoneReading}
          className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
        >
          Done Reading
        </Button>
      </div>
    </div>
  );

  // Comprehension phase
  const renderComprehensionPhase = () => (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 p-5 space-y-4">
        <p className="text-slate-200 font-medium">{comprehensionQuestion.question}</p>

        {comprehensionQuestion.type === 'multiple-choice' && comprehensionQuestion.options ? (
          <div className="space-y-2">
            {comprehensionQuestion.options.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(option)}
                disabled={comprehensionCorrect === true}
                className={`
                  w-full text-left px-4 py-3 rounded-lg border transition-all
                  ${selectedAnswer === option
                    ? comprehensionCorrect === true
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : comprehensionCorrect === false && comprehensionAttempts > 0
                        ? 'bg-red-500/20 border-red-500/40 text-red-300'
                        : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }
                `}
              >
                <span className="text-sm">{option}</span>
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            disabled={comprehensionCorrect === true}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40"
          />
        )}

        {/* Feedback */}
        {comprehensionCorrect === true && (
          <div className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm text-center">
            Correct! Great comprehension!
          </div>
        )}
        {comprehensionCorrect === false && (
          <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm text-center">
            Not quite. Try again or continue to review.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {comprehensionCorrect !== true && (
          <>
            <Button
              variant="ghost"
              onClick={handleCheckComprehension}
              disabled={
                (comprehensionQuestion.type === 'multiple-choice' && !selectedAnswer) ||
                (comprehensionQuestion.type === 'short-answer' && !shortAnswer.trim())
              }
              className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 ml-auto"
            >
              Check
            </Button>
            {comprehensionAttempts > 0 && (
              <Button
                variant="ghost"
                onClick={handleContinueToReview}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
              >
                Skip to Review
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Review phase
  const renderReviewPhase = () => (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">{tappedWordIds.size}</p>
          <p className="text-xs text-slate-500">Words Tapped</p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
          <p className="text-2xl font-bold text-slate-100">{totalWords - tappedWordIds.size}</p>
          <p className="text-xs text-slate-500">Read Independently</p>
        </div>
      </div>

      {/* Tapped words indicator */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-xs text-slate-500 mb-2">
          Words you tapped for help (these are your practice words):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tappedWordIds.size > 0 ? (
            passage.sentences.flatMap(s =>
              s.words.filter(w => tappedWordIds.has(w.id))
            ).map(word => (
              <Badge
                key={word.id}
                variant="outline"
                className={`text-xs ${PATTERN_COLORS[word.phonicsPattern]} bg-white/5 border-white/10`}
              >
                {word.text}
              </Badge>
            ))
          ) : (
            <span className="text-emerald-400 text-sm">
              Amazing! You read every word independently!
            </span>
          )}
        </div>
      </div>

      {/* Show passage in review if desired */}
      {showTextInReview && (
        <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
          <p className="text-xs text-slate-500 mb-2">Passage text:</p>
          {passage.sentences.map(sentence => (
            <p key={sentence.id} className="leading-relaxed text-sm text-slate-300">
              {sentence.words.map((word, i) => (
                <React.Fragment key={word.id}>
                  <span className={tappedWordIds.has(word.id) ? 'text-amber-300 underline underline-offset-2' : ''}>
                    {word.text}
                  </span>
                  {i < sentence.words.length - 1 && ' '}
                </React.Fragment>
              ))}
            </p>
          ))}
        </div>
      )}

      {/* Comprehension result */}
      <div className={`rounded-lg p-3 border ${
        comprehensionCorrect
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <p className="text-xs text-slate-500 mb-1">Comprehension:</p>
        <p className={`text-sm ${comprehensionCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
          {comprehensionCorrect ? 'Answered correctly' : `Answer: ${comprehensionQuestion.correctAnswer}`}
          {comprehensionAttempts > 1 && ` (${comprehensionAttempts} attempts)`}
        </p>
      </div>

      {/* Finish button */}
      <div className="flex justify-center">
        {!hasSubmittedEvaluation ? (
          <Button
            variant="ghost"
            onClick={handleFinish}
            className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
          >
            Finish
          </Button>
        ) : (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center space-y-2 w-full">
            <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
            <p className="text-slate-400 text-sm">
              You read {totalWords - tappedWordIds.size} of {totalWords} words independently.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!passage || passage.sentences.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No passage available.</p>
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
                {totalWords} words
              </Badge>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentPhase === 'reading'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : currentPhase === 'comprehension'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {currentPhase === 'reading' ? 'Reading' : currentPhase === 'comprehension' ? 'Comprehension' : 'Review'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderPhaseIndicator()}

        {currentPhase === 'reading' && renderReadingPhase()}
        {currentPhase === 'comprehension' && renderComprehensionPhase()}
        {currentPhase === 'review' && renderReviewPhase()}
      </CardContent>
    </Card>
  );
};

export default DecodableReader;
