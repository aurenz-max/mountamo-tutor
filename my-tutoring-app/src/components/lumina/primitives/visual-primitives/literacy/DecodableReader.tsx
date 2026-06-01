'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaInput,
  LuminaStat,
  type AnswerChoiceState,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { DecodableReaderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

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
    options?: Array<{ id: string; text: string }>;  // MC options with stable IDs
    correctOptionId?: string;                        // MC: matches one option.id
    correctAnswer?: string;                          // Short-answer: the correct text
    acceptableAnswers?: string[];                    // Short-answer: alternatives
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

// Pattern colors are part of the decodable-text INTERACTION SURFACE — they tint
// each word in the passage body by phonics pattern. Kept bespoke.
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

// Pattern → kit accent for the legend badges (chrome). Maps off-union colors.
const PATTERN_ACCENTS: Record<string, LuminaAccent> = {
  cvc: 'blue',
  cvce: 'purple',
  sight: 'amber',
  blend: 'cyan',
  digraph: 'emerald',
  'r-controlled': 'rose',
  diphthong: 'orange',
  other: 'cyan',
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

  // Stable instance ID for AI context
  const resolvedInstanceId = useMemo(
    () => instanceId || `decodable-reader-${Date.now()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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

  // AI tutoring context
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel,
    currentPhase,
    totalWords,
    wordsTapped: tappedWordIds.size,
    wordsReadIndependently: totalWords - tappedWordIds.size,
    phonicsPatternsInPassage: phonicsPatternsInPassage.join(', '),
    comprehensionQuestion: comprehensionQuestion.question,
    comprehensionAttempts,
    comprehensionCorrect,
  }), [
    title, gradeLevel, currentPhase, totalWords,
    tappedWordIds.size, phonicsPatternsInPassage,
    comprehensionQuestion.question, comprehensionAttempts,
    comprehensionCorrect,
  ]);

  const { sendText } = useLuminaAI({
    primitiveType: 'decodable-reader',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Handle tapping a word
  const handleTapWord = useCallback((wordId: string, wordText: string) => {
    setTappedWordIds(prev => new Set(Array.from(prev).concat(wordId)));
    setActiveWordId(wordId);
    // Pronounce the word via AI
    sendText(`[PRONOUNCE_SOUND] The word is "${wordText}". ${wordText}.`, { silent: true });
    // Show "playing" state briefly
    setTimeout(() => {
      if (activeWordId === wordId) setActiveWordId(null);
    }, 800);
  }, [activeWordId, sendText]);

  // Toggle phoneme breakdown for a word
  const handleTogglePhonemes = useCallback((wordId: string) => {
    setShowPhonemes(prev => prev === wordId ? null : wordId);
  }, []);

  // Move to comprehension
  const handleDoneReading = useCallback(() => {
    SoundManager.navigate();
    setReadingEndTime(Date.now());
    setCurrentPhase('comprehension');
    sendText(
      `[READING_DONE] The student finished reading "${title}". `
      + `They tapped ${tappedWordIds.size} of ${totalWords} words for help and read ${totalWords - tappedWordIds.size} independently. `
      + `Now ask the comprehension question: "${comprehensionQuestion.question}"`,
      { silent: true }
    );
  }, [sendText, title, tappedWordIds.size, totalWords, comprehensionQuestion.question]);

  // Check comprehension answer
  const handleCheckComprehension = useCallback(() => {
    setComprehensionAttempts(prev => prev + 1);

    let isCorrect: boolean;

    if (comprehensionQuestion.type === 'multiple-choice') {
      // Compare stable option IDs — no case sensitivity issues
      isCorrect = selectedAnswer === comprehensionQuestion.correctOptionId;
    } else {
      const answer = shortAnswer.trim().toLowerCase();
      const correct = (comprehensionQuestion.correctAnswer ?? '').toLowerCase();
      const acceptable = comprehensionQuestion.acceptableAnswers?.map(a => a.toLowerCase()) || [];
      isCorrect = answer === correct || acceptable.includes(answer);
    }
    setComprehensionCorrect(isCorrect);

    if (isCorrect) {
      SoundManager.playCorrect();
      sendText(
        `[COMPREHENSION_CORRECT] The student answered the comprehension question correctly`
        + `${comprehensionAttempts > 0 ? ` after ${comprehensionAttempts + 1} attempts` : ' on the first try'}! `
        + `Celebrate briefly and let them know we're moving to the review.`,
        { silent: true }
      );
      // Move to review after short delay
      setTimeout(() => setCurrentPhase('review'), 1200);
    } else {
      SoundManager.playIncorrect();
      const studentAnswer = comprehensionQuestion.type === 'multiple-choice'
        ? comprehensionQuestion.options?.find(o => o.id === selectedAnswer)?.text ?? selectedAnswer
        : shortAnswer.trim();
      sendText(
        `[COMPREHENSION_INCORRECT] The student answered "${studentAnswer}" but that's not correct. `
        + `The question was: "${comprehensionQuestion.question}". `
        + `This is attempt ${comprehensionAttempts + 1}. Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [comprehensionQuestion, selectedAnswer, shortAnswer, comprehensionAttempts, sendText]);

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

    sendText(
      `[SESSION_COMPLETE] The student finished reading "${title}"! `
      + `They read ${totalWords - wordsTapped} of ${totalWords} words independently. `
      + `Comprehension: ${comprehensionCorrect ? 'correct' : 'incorrect'}. `
      + `Score: ${score}%. Celebrate their reading accomplishment!`,
      { silent: true }
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
    sendText,
    title,
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
                  {isCompleted ? '✓' : index + 1}
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
          <LuminaBadge
            key={pattern}
            accent={PATTERN_ACCENTS[pattern]}
            className="text-xs"
          >
            {PATTERN_LABELS[pattern] || pattern}
          </LuminaBadge>
        ))}
      </div>
    );
  };

  // Render a single word — part of the decodable-text interaction surface.
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
              handleTapWord(word.id, word.text);
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
      <LuminaPanel>
        <p className="text-slate-400 text-sm">
          Read the passage below. <span className="text-amber-300">Tap any word</span> to hear it pronounced.
        </p>
      </LuminaPanel>

      {/* Pattern legend */}
      {showPatternColors && renderPatternLegend()}

      {/* Passage — the decodable-text interaction surface (bespoke) */}
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
        <LuminaButton
          size="sm"
          onClick={() => setShowPatternColors(prev => !prev)}
          className="text-slate-400 text-xs h-7 px-2"
        >
          {showPatternColors ? 'Hide Colors' : 'Show Colors'}
        </LuminaButton>
      </div>

      {/* Done reading button */}
      <div className="flex justify-center pt-2">
        <LuminaActionButton action="next" onClick={handleDoneReading}>
          Done Reading
        </LuminaActionButton>
      </div>
    </div>
  );

  // Comprehension phase
  const renderComprehensionPhase = () => (
    <div className="space-y-4">
      <LuminaPanel accent="blue" className="space-y-4">
        <p className="text-slate-200 font-medium">{comprehensionQuestion.question}</p>

        {comprehensionQuestion.type === 'multiple-choice' && comprehensionQuestion.options ? (
          <div className="space-y-2">
            {comprehensionQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              let state: AnswerChoiceState = 'idle';
              if (isSelected) {
                if (comprehensionCorrect === true) state = 'correct';
                else if (comprehensionCorrect === false && comprehensionAttempts > 0) state = 'incorrect';
                else state = 'selected';
              }
              return (
                <LuminaAnswerChoice
                  key={option.id}
                  state={state}
                  onClick={() => setSelectedAnswer(option.id)}
                  disabled={comprehensionCorrect === true}
                  className="p-4"
                >
                  <span className="text-sm">{option.id}. {option.text}</span>
                </LuminaAnswerChoice>
              );
            })}
          </div>
        ) : (
          <LuminaInput
            type="text"
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            disabled={comprehensionCorrect === true}
            placeholder="Type your answer..."
            className="w-full py-3 text-sm"
          />
        )}

        {/* Feedback */}
        {comprehensionCorrect === true && (
          <LuminaFeedbackCard status="correct" label="Correct! Great comprehension!">
            You answered the question correctly.
          </LuminaFeedbackCard>
        )}
        {comprehensionCorrect === false && (
          <LuminaFeedbackCard status="incorrect">
            Not quite. Try again or continue to review.
          </LuminaFeedbackCard>
        )}
      </LuminaPanel>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {comprehensionCorrect !== true && (
          <>
            <LuminaActionButton
              action="check"
              onClick={handleCheckComprehension}
              disabled={
                (comprehensionQuestion.type === 'multiple-choice' && !selectedAnswer) ||
                (comprehensionQuestion.type === 'short-answer' && !shortAnswer.trim())
              }
              className="ml-auto"
            >
              Check
            </LuminaActionButton>
            {comprehensionAttempts > 0 && (
              <LuminaButton onClick={handleContinueToReview} className="text-slate-400">
                Skip to Review
              </LuminaButton>
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
        <LuminaStat label="Words Tapped" value={tappedWordIds.size} />
        <LuminaStat label="Read Independently" value={totalWords - tappedWordIds.size} />
      </div>

      {/* Tapped words indicator */}
      <LuminaPanel>
        <p className="text-xs text-slate-500 mb-2">
          Words you tapped for help (these are your practice words):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tappedWordIds.size > 0 ? (
            passage.sentences.flatMap(s =>
              s.words.filter(w => tappedWordIds.has(w.id))
            ).map(word => (
              <LuminaBadge
                key={word.id}
                accent={PATTERN_ACCENTS[word.phonicsPattern]}
                className="text-xs"
              >
                {word.text}
              </LuminaBadge>
            ))
          ) : (
            <span className="text-emerald-400 text-sm">
              Amazing! You read every word independently!
            </span>
          )}
        </div>
      </LuminaPanel>

      {/* Show passage in review if desired — the decodable text (bespoke) */}
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
      <LuminaPanel accent={comprehensionCorrect ? 'emerald' : 'amber'}>
        <p className="text-xs text-slate-500 mb-1">Comprehension:</p>
        <p className={`text-sm ${comprehensionCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
          {comprehensionCorrect ? 'Answered correctly' : `Answer: ${
            comprehensionQuestion.type === 'multiple-choice'
              ? comprehensionQuestion.options?.find(o => o.id === comprehensionQuestion.correctOptionId)?.text ?? comprehensionQuestion.correctAnswer
              : comprehensionQuestion.correctAnswer
          }`}
          {comprehensionAttempts > 1 && ` (${comprehensionAttempts} attempts)`}
        </p>
      </LuminaPanel>

      {/* Finish button */}
      <div className="flex justify-center">
        {!hasSubmittedEvaluation ? (
          <LuminaActionButton action="next" onClick={handleFinish}>
            Finish
          </LuminaActionButton>
        ) : (
          <LuminaPanel accent="emerald" className="text-center space-y-2 w-full">
            <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
            <p className="text-slate-400 text-sm">
              You read {totalWords - tappedWordIds.size} of {totalWords} words independently.
            </p>
          </LuminaPanel>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!passage || passage.sentences.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No passage available.</p>
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
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge className="text-xs">{totalWords} words</LuminaBadge>
            </div>
          </div>
          <LuminaBadge
            accent={
              currentPhase === 'reading'
                ? 'blue'
                : currentPhase === 'comprehension'
                  ? 'purple'
                  : 'emerald'
            }
            className="text-xs"
          >
            {currentPhase === 'reading' ? 'Reading' : currentPhase === 'comprehension' ? 'Comprehension' : 'Review'}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderPhaseIndicator()}

        {currentPhase === 'reading' && renderReadingPhase()}
        {currentPhase === 'comprehension' && renderComprehensionPhase()}
        {currentPhase === 'review' && renderReviewPhase()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DecodableReader;
