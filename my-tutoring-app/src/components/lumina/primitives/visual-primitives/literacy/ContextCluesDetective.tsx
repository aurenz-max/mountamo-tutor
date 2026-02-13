'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ContextCluesDetectiveMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ContextCluesDetectiveData {
  title: string;
  gradeLevel: string;

  // Words to investigate
  challenges: Array<{
    id: string;

    // The passage containing the target word
    passage: {
      sentences: Array<{
        id: string;
        text: string;
        isClue: boolean;                     // Whether this sentence contains a context clue
      }>;
    };

    // The target word
    targetWord: string;
    targetWordSentenceId: string;            // Which sentence contains the target word

    // Clue information
    clueType: 'definition' | 'synonym' | 'antonym' | 'example' | 'inference';
    clueSentenceIds: string[];               // Sentence IDs that contain context clues

    // Meaning
    correctMeaning: string;                  // The correct definition/meaning
    meaningOptions?: string[];               // Multiple-choice options (if provided)
    acceptableMeanings?: string[];           // Alternative acceptable answers

    // Dictionary definition for comparison
    dictionaryDefinition: string;
  }>;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ContextCluesDetectiveMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface ContextCluesDetectiveProps {
  data: ContextCluesDetectiveData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type DetectivePhase = 'find' | 'classify' | 'define';

const PHASE_CONFIG: Record<DetectivePhase, { label: string; description: string }> = {
  find: { label: 'Find', description: 'Find the context clue' },
  classify: { label: 'Classify', description: 'What type of clue is it?' },
  define: { label: 'Define', description: 'What does the word mean?' },
};

const CLUE_TYPE_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  definition: { label: 'Definition', icon: '=', description: 'The word is defined in the text' },
  synonym: { label: 'Synonym', icon: '\u2194', description: 'A similar word is nearby' },
  antonym: { label: 'Antonym', icon: '\u2260', description: 'An opposite word shows the contrast' },
  example: { label: 'Example', icon: '\u2022', description: 'Examples help explain the meaning' },
  inference: { label: 'Inference', icon: '\uD83D\uDD0D', description: 'Figure it out from the broader context' },
};

// ============================================================================
// Component
// ============================================================================

const ContextCluesDetective: React.FC<ContextCluesDetectiveProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<DetectivePhase>('find');

  // Find phase: which sentences the user highlighted as clues
  const [highlightedSentenceIds, setHighlightedSentenceIds] = useState<Set<string>>(new Set());

  // Classify phase: user's selected clue type
  const [selectedClueType, setSelectedClueType] = useState<string>('');

  // Define phase: user's meaning answer
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [typedMeaning, setTypedMeaning] = useState('');

  // Results tracking per challenge
  const [challengeResults, setChallengeResults] = useState<Array<{
    clueCorrect: boolean;
    typeCorrect: boolean;
    meaningCorrect: boolean;
  }>>([]);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showDictionary, setShowDictionary] = useState(false);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ContextCluesDetectiveMetrics>({
    primitiveType: 'context-clues-detective',
    instanceId: instanceId || `context-clues-detective-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentChallenge = challenges[currentChallengeIndex];

  // Toggle sentence highlight
  const handleToggleSentence = useCallback((sentenceId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'find') return;
    setHighlightedSentenceIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(sentenceId)) {
        next.delete(sentenceId);
      } else {
        next.add(sentenceId);
      }
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, currentPhase]);

  // Check find phase and advance
  const handleCheckFind = useCallback(() => {
    if (!currentChallenge) return;

    const highlighted = Array.from(highlightedSentenceIds);
    if (highlighted.length === 0) {
      setFeedback('Click on a sentence that gives you a clue about the word\'s meaning.');
      setFeedbackType('info');
      return;
    }

    // Check if any highlighted sentence is a correct clue
    const correctClues = highlighted.filter(id => currentChallenge.clueSentenceIds.includes(id));
    const isCorrect = correctClues.length > 0;

    if (isCorrect) {
      setFeedback('Great detective work! You found a context clue!');
      setFeedbackType('success');
      setTimeout(() => {
        setCurrentPhase('classify');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      setFeedback('That sentence doesn\'t contain a clue. Look for a sentence that helps explain the highlighted word.');
      setFeedbackType('error');
    }
  }, [currentChallenge, highlightedSentenceIds]);

  // Check classify phase and advance
  const handleCheckClassify = useCallback(() => {
    if (!currentChallenge || !selectedClueType) return;

    const isCorrect = selectedClueType === currentChallenge.clueType;

    if (isCorrect) {
      setFeedback('Correct! You identified the clue type!');
      setFeedbackType('success');
      setTimeout(() => {
        setCurrentPhase('define');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      setFeedback(`Not quite. Think about what the clue sentence does — does it define, give a synonym, show an opposite, provide an example, or require inference?`);
      setFeedbackType('error');
    }
  }, [currentChallenge, selectedClueType]);

  // Check define phase and finish challenge
  const handleCheckDefine = useCallback(() => {
    if (!currentChallenge) return;

    const userAnswer = currentChallenge.meaningOptions
      ? selectedMeaning
      : typedMeaning.trim().toLowerCase();

    const correct = currentChallenge.correctMeaning.toLowerCase();
    const acceptable = currentChallenge.acceptableMeanings?.map(a => a.toLowerCase()) || [];

    const isCorrect = userAnswer === correct ||
      acceptable.includes(userAnswer) ||
      (!!currentChallenge.meaningOptions && userAnswer === currentChallenge.correctMeaning);

    // Record results for this challenge
    const clueCorrect = Array.from(highlightedSentenceIds).some(id =>
      currentChallenge.clueSentenceIds.includes(id)
    );
    const typeCorrect = selectedClueType === currentChallenge.clueType;

    setChallengeResults(prev => [
      ...prev,
      { clueCorrect, typeCorrect, meaningCorrect: isCorrect },
    ]);

    if (isCorrect) {
      setFeedback('Excellent! You figured out the meaning from context!');
      setFeedbackType('success');
    } else {
      setFeedback(`The meaning is: "${currentChallenge.correctMeaning}"`);
      setFeedbackType('info');
    }

    // Show dictionary comparison
    setShowDictionary(true);
  }, [currentChallenge, selectedMeaning, typedMeaning, highlightedSentenceIds, selectedClueType]);

  // Move to next challenge or finish
  const handleNext = useCallback(() => {
    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(prev => prev + 1);
      setCurrentPhase('find');
      setHighlightedSentenceIds(new Set());
      setSelectedClueType('');
      setSelectedMeaning('');
      setTypedMeaning('');
      setFeedback('');
      setFeedbackType('');
      setShowDictionary(false);
    } else {
      submitFinalEvaluation();
    }
  }, [currentChallengeIndex, challenges.length]);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const results = challengeResults;
    const clueCorrectCount = results.filter(r => r.clueCorrect).length;
    const typeCorrectCount = results.filter(r => r.typeCorrect).length;
    const meaningCorrectCount = results.filter(r => r.meaningCorrect).length;
    const total = results.length;

    // Weighted score: clue finding (30%) + type classification (30%) + meaning (40%)
    const clueScore = total > 0 ? (clueCorrectCount / total) * 30 : 0;
    const typeScore = total > 0 ? (typeCorrectCount / total) * 30 : 0;
    const meaningScore = total > 0 ? (meaningCorrectCount / total) * 40 : 0;
    const score = Math.round(clueScore + typeScore + meaningScore);

    const lastClueType = currentChallenge?.clueType || 'inference';

    const metrics: ContextCluesDetectiveMetrics = {
      type: 'context-clues-detective',
      gradeLevel,
      clueHighlightedCorrectly: clueCorrectCount > 0,
      clueTypeIdentified: typeCorrectCount > 0,
      meaningCorrect: meaningCorrectCount > 0,
      clueType: lastClueType,
      dictionaryComparisonViewed: showDictionary,
      attemptsCount: total,
      totalChallenges: challenges.length,
      challengesCorrect: meaningCorrectCount,
    };

    submitEvaluation(
      score >= 50,
      score,
      metrics,
      {
        challengeResults: results,
      }
    );
  }, [
    hasSubmittedEvaluation,
    challengeResults,
    currentChallenge,
    gradeLevel,
    showDictionary,
    challenges.length,
    submitEvaluation,
  ]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase progress
  const renderPhaseProgress = () => {
    const phases: DetectivePhase[] = ['find', 'classify', 'define'];
    const phaseOrder = phases.indexOf(currentPhase);
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase === currentPhase;
          const isCompleted = index < phaseOrder || (showDictionary && phase === 'define');
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
                  {isCompleted ? '\u2713' : index + 1}
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

  // Render the passage with highlighted target word and clickable sentences
  const renderPassage = () => {
    if (!currentChallenge) return null;
    return (
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5 space-y-1">
        {currentChallenge.passage.sentences.map(sentence => {
          const isTargetSentence = sentence.id === currentChallenge.targetWordSentenceId;
          const isHighlighted = highlightedSentenceIds.has(sentence.id);
          const isClueRevealed = currentPhase !== 'find' && currentChallenge.clueSentenceIds.includes(sentence.id);
          const isClickable = currentPhase === 'find' && !isTargetSentence;

          // Highlight the target word within the target sentence
          let sentenceContent: React.ReactNode = sentence.text;
          if (isTargetSentence) {
            const regex = new RegExp(`(${currentChallenge.targetWord})`, 'gi');
            const parts = sentence.text.split(regex);
            sentenceContent = parts.map((part, i) =>
              regex.test(part) ? (
                <span key={i} className="font-bold text-amber-300 bg-amber-500/20 px-1 rounded">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            );
          }

          return (
            <span
              key={sentence.id}
              onClick={() => isClickable && handleToggleSentence(sentence.id)}
              className={`
                inline leading-relaxed text-base transition-all
                ${isClickable ? 'cursor-pointer hover:bg-white/5 rounded px-0.5' : ''}
                ${isTargetSentence ? 'text-slate-100' : 'text-slate-300'}
                ${isHighlighted ? 'bg-blue-500/20 rounded px-1 py-0.5' : ''}
                ${isClueRevealed ? 'bg-emerald-500/10 rounded px-1 py-0.5' : ''}
              `}
            >
              {sentenceContent}{' '}
            </span>
          );
        })}
      </div>
    );
  };

  // Find phase
  const renderFindPhase = () => (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-slate-400 text-sm">
          The word <span className="font-bold text-amber-300">&ldquo;{currentChallenge?.targetWord}&rdquo;</span> is
          highlighted in the passage. <span className="text-blue-300">Click on a sentence</span> that gives you a clue about what it means.
        </p>
      </div>

      {renderPassage()}

      {feedback && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium text-center ${
          feedbackType === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : feedbackType === 'error' ? 'bg-red-500/20 border border-red-500/40 text-red-300'
              : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
        }`}>
          {feedback}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={handleCheckFind}
          disabled={highlightedSentenceIds.size === 0}
          className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
        >
          Check Clue
        </Button>
      </div>
    </div>
  );

  // Classify phase
  const renderClassifyPhase = () => (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-slate-400 text-sm">
          What <span className="text-amber-300">type</span> of context clue helps you understand
          <span className="font-bold text-amber-300"> &ldquo;{currentChallenge?.targetWord}&rdquo;</span>?
        </p>
      </div>

      {renderPassage()}

      {/* Clue type options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(CLUE_TYPE_CONFIG).map(([type, config]) => {
          const isSelected = selectedClueType === type;
          return (
            <button
              key={type}
              onClick={() => setSelectedClueType(type)}
              className={`
                text-left px-3 py-2.5 rounded-lg border transition-all
                ${isSelected
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg w-6 text-center">{config.icon}</span>
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-slate-500">{config.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium text-center ${
          feedbackType === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : feedbackType === 'error' ? 'bg-red-500/20 border border-red-500/40 text-red-300'
              : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
        }`}>
          {feedback}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={handleCheckClassify}
          disabled={!selectedClueType}
          className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
        >
          Check Type
        </Button>
      </div>
    </div>
  );

  // Define phase
  const renderDefinePhase = () => (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-slate-400 text-sm">
          Based on the context clues, what does
          <span className="font-bold text-amber-300"> &ldquo;{currentChallenge?.targetWord}&rdquo;</span> mean?
        </p>
      </div>

      {renderPassage()}

      {/* Answer input */}
      {currentChallenge?.meaningOptions ? (
        <div className="space-y-2">
          {currentChallenge.meaningOptions.map((option, i) => (
            <button
              key={i}
              onClick={() => !showDictionary && setSelectedMeaning(option)}
              disabled={showDictionary}
              className={`
                w-full text-left px-4 py-3 rounded-lg border transition-all
                ${selectedMeaning === option
                  ? showDictionary
                    ? option === currentChallenge.correctMeaning
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
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
          value={typedMeaning}
          onChange={(e) => setTypedMeaning(e.target.value)}
          disabled={showDictionary}
          placeholder="Type the meaning..."
          className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40"
        />
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium text-center ${
          feedbackType === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : feedbackType === 'error' ? 'bg-red-500/20 border border-red-500/40 text-red-300'
              : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
        }`}>
          {feedback}
        </div>
      )}

      {/* Dictionary comparison */}
      {showDictionary && currentChallenge && (
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-3 space-y-1">
          <p className="text-xs text-violet-400 uppercase tracking-wide">Dictionary Definition</p>
          <p className="text-sm text-slate-200">
            <span className="font-bold">{currentChallenge.targetWord}</span>: {currentChallenge.dictionaryDefinition}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {!showDictionary ? (
          <Button
            variant="ghost"
            onClick={handleCheckDefine}
            disabled={!selectedMeaning && !typedMeaning.trim()}
            className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300"
          >
            Check Meaning
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={handleNext}
            className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300"
          >
            {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
          </Button>
        )}
      </div>

      {/* Final results */}
      {hasSubmittedEvaluation && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center space-y-2">
          <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
          <p className="text-slate-400 text-sm">
            You defined {challengeResults.filter(r => r.meaningCorrect).length} of {challenges.length} words correctly from context.
          </p>
          <div className="flex justify-center gap-4 text-xs text-slate-500">
            <span>Clues found: {challengeResults.filter(r => r.clueCorrect).length}</span>
            <span>Types correct: {challengeResults.filter(r => r.typeCorrect).length}</span>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
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
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs">
                Word {currentChallengeIndex + 1} of {challenges.length}
              </Badge>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              currentPhase === 'find'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : currentPhase === 'classify'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {PHASE_CONFIG[currentPhase].description}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderPhaseProgress()}

        {currentPhase === 'find' && renderFindPhase()}
        {currentPhase === 'classify' && renderClassifyPhase()}
        {currentPhase === 'define' && renderDefinePhase()}
      </CardContent>
    </Card>
  );
};

export default ContextCluesDetective;
