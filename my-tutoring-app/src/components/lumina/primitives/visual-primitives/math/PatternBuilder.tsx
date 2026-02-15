'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PatternBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PatternBuilderChallenge {
  id: string;
  type: 'extend' | 'identify_core' | 'create' | 'translate' | 'find_rule';
  instruction: string;
  answer: string[] | string;
  hint: string;
  narration: string;
}

export interface PatternBuilderData {
  title: string;
  description?: string;
  patternType: 'repeating' | 'growing' | 'number';
  sequence: {
    given: string[];
    hidden: string[];
    core: string[];
    rule: string | null;
  };
  tokens: {
    available: string[];
    type: 'colors' | 'shapes' | 'numbers' | 'emoji' | 'mixed';
    customIcons?: boolean;
  };
  challenges: PatternBuilderChallenge[];
  showOptions?: {
    showCore?: boolean;
    showStepNumbers?: boolean;
    showRule?: boolean;
    audioMode?: boolean;
  };
  translationTarget?: {
    enabled?: boolean;
    sourceType?: string;
    targetType?: string;
    mapping?: Record<string, string>;
  };
  imagePrompt?: string | null;
  gradeBand?: 'K-1' | '2-3';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PatternBuilderMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'copy' | 'identify' | 'create' | 'translate';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  copy: { label: 'Extend', description: 'Continue the pattern' },
  identify: { label: 'Identify', description: 'Find the repeating core' },
  create: { label: 'Create', description: 'Build your own pattern' },
  translate: { label: 'Translate', description: 'Same pattern, new look' },
};

// Visual representations for token types
const TOKEN_DISPLAY: Record<string, { bg: string; border: string; text: string }> = {
  // Colors
  red: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  blue: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
  green: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  yellow: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  purple: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  orange: { bg: '#f97316', border: '#ea580c', text: '#fff' },
  pink: { bg: '#ec4899', border: '#db2777', text: '#fff' },
  // Shapes
  circle: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
  square: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  triangle: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
  star: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  diamond: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  heart: { bg: '#ec4899', border: '#db2777', text: '#fff' },
};

const SHAPE_SYMBOLS: Record<string, string> = {
  circle: '●',
  square: '■',
  triangle: '▲',
  star: '★',
  diamond: '◆',
  heart: '♥',
};

function getTokenDisplay(token: string): { bg: string; border: string; text: string; label: string } {
  const lower = token.toLowerCase();
  const display = TOKEN_DISPLAY[lower];
  if (display) {
    const symbol = SHAPE_SYMBOLS[lower];
    return { ...display, label: symbol || token.charAt(0).toUpperCase() };
  }
  // Fallback: use token text directly (numbers, emoji, etc.)
  return { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.3)', text: '#e2e8f0', label: token };
}

const CELL_SIZE = 52;
const CELL_GAP = 6;

// ============================================================================
// Props
// ============================================================================

interface PatternBuilderProps {
  data: PatternBuilderData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const PatternBuilder: React.FC<PatternBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    patternType,
    sequence,
    tokens,
    challenges = [],
    showOptions = {},
    translationTarget,
    gradeBand = 'K-1',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showCore = false,
    showStepNumbers = false,
    showRule = false,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<Phase>(() => {
    if (challenges.length === 0) return 'copy';
    const firstType = challenges[0].type;
    if (firstType === 'identify_core') return 'identify';
    if (firstType === 'create') return 'create';
    if (firstType === 'translate') return 'translate';
    return 'copy';
  });

  // Extension answers (user-placed tokens for hidden positions)
  const [extensionAnswers, setExtensionAnswers] = useState<string[]>([]);

  // Core identification: which indices the student has selected as core
  const [selectedCoreIndices, setSelectedCoreIndices] = useState<Set<number>>(new Set());

  // Create mode: user-built pattern
  const [createdPattern, setCreatedPattern] = useState<string[]>([]);

  // Translation mode: user-built translated pattern
  const [translatedPattern, setTranslatedPattern] = useState<string[]>([]);

  // Rule input
  const [ruleInput, setRuleInput] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Tracking
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    type: string;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [coreIdentifiedCorrectly, setCoreIdentifiedCorrectly] = useState(false);
  const [ruleArticulated, setRuleArticulated] = useState(false);
  const [patternCreated, setPatternCreated] = useState(false);
  const [translationCorrect, setTranslationCorrect] = useState(false);
  const [patternTypesExplored] = useState(new Set<string>([patternType]));

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `pattern-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PatternBuilderMetrics>({
    primitiveType: 'pattern-builder',
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
    patternType,
    gradeBand,
    givenSequence: sequence.given.join(', '),
    hiddenSequence: sequence.hidden.join(', '),
    coreUnit: sequence.core.join(', '),
    rule: sequence.rule || 'none',
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? 'Free exploration',
    challengeType: currentChallenge?.type ?? 'extend',
    attemptNumber: currentAttempts + 1,
    currentPhase,
    studentExtension: extensionAnswers.join(', '),
    studentCreation: createdPattern.join(', '),
  }), [
    patternType, gradeBand, sequence, challenges.length,
    currentChallengeIndex, currentChallenge, currentAttempts,
    currentPhase, extensionAnswers, createdPattern,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'pattern-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-1' ? 'Kindergarten-Grade 1' : 'Grade 2-3',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a pattern builder activity for ${gradeBand === 'K-1' ? 'Kindergarten to Grade 1' : 'Grades 2-3'}. `
      + `Pattern type: ${patternType}. The sequence shown is: ${sequence.given.join(', ')}. `
      + `The core/repeating unit is: ${sequence.core.join(', ')}. `
      + `There are ${challenges.length} challenges. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce the activity warmly: mention we're going to explore patterns and discover what comes next. `
      + `Then read the first instruction to the student.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, patternType, sequence, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------

  // Add token to extension answer
  const handleAddExtensionToken = useCallback((token: string) => {
    if (hasSubmittedEvaluation) return;
    setExtensionAnswers(prev => {
      if (prev.length >= sequence.hidden.length) return prev;
      return [...prev, token];
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, sequence.hidden.length]);

  // Remove last extension token
  const handleRemoveLastExtension = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setExtensionAnswers(prev => prev.slice(0, -1));
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // Toggle core index selection
  const handleToggleCoreIndex = useCallback((index: number) => {
    if (hasSubmittedEvaluation) return;
    setSelectedCoreIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // Add token to created pattern
  const handleAddCreatedToken = useCallback((token: string) => {
    if (hasSubmittedEvaluation) return;
    setCreatedPattern(prev => [...prev, token]);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // Remove last created token
  const handleRemoveLastCreated = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setCreatedPattern(prev => prev.slice(0, -1));
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // Add token to translated pattern
  const handleAddTranslatedToken = useCallback((token: string) => {
    if (hasSubmittedEvaluation) return;
    setTranslatedPattern(prev => [...prev, token]);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // Remove last translated token
  const handleRemoveLastTranslated = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setTranslatedPattern(prev => prev.slice(0, -1));
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const checkExtendChallenge = useCallback(() => {
    if (!currentChallenge) return false;
    const expected = Array.isArray(currentChallenge.answer)
      ? currentChallenge.answer
      : [currentChallenge.answer];
    const correct = extensionAnswers.length === expected.length
      && extensionAnswers.every((a, i) => a.toLowerCase() === expected[i].toLowerCase());
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setFeedback('Great job! You extended the pattern correctly!');
      setFeedbackType('success');
      sendText(
        `[EXTEND_CORRECT] Student correctly extended the pattern with: ${extensionAnswers.join(', ')}. `
        + `Expected: ${expected.join(', ')}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Celebrate and ask: "What do you notice about the pattern? What comes next?"`,
        { silent: true }
      );
    } else {
      setFeedback('Not quite! Look at the pattern again. What repeats?');
      setFeedbackType('error');
      sendText(
        `[EXTEND_INCORRECT] Student placed: ${extensionAnswers.join(', ')} but expected: ${expected.join(', ')}. `
        + `The given pattern is: ${sequence.given.join(', ')}. Core: ${sequence.core.join(', ')}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Guide pattern finding: "Look at the pattern: ${sequence.given.join(', ')}... what part keeps repeating?"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, extensionAnswers, currentAttempts, sendText, sequence]);

  const checkIdentifyCoreChallenge = useCallback(() => {
    if (!currentChallenge) return false;
    // Build the selected tokens from the indices
    const fullSequence = [...sequence.given, ...sequence.hidden];
    const selectedTokens = Array.from(selectedCoreIndices)
      .sort((a, b) => a - b)
      .map(i => fullSequence[i]);

    // Check if selected tokens match the core (must be contiguous and match)
    const correct = selectedTokens.length === sequence.core.length
      && selectedTokens.every((t, i) => t.toLowerCase() === sequence.core[i].toLowerCase());
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setCoreIdentifiedCorrectly(true);
      setFeedback('You found the repeating core!');
      setFeedbackType('success');
      sendText(
        `[CORE_CORRECT] Student correctly identified the repeating core: ${sequence.core.join(', ')}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Celebrate: "You found it! The part that keeps repeating is ${sequence.core.join(', ')}!"`,
        { silent: true }
      );
    } else {
      setFeedback('That\'s not quite the repeating unit. Try selecting the smallest group that repeats.');
      setFeedbackType('error');
      sendText(
        `[CORE_INCORRECT] Student selected: ${selectedTokens.join(', ')} but the core is: ${sequence.core.join(', ')}. `
        + `Attempt ${currentAttempts + 1}. `
        + `Hint: "The core is the smallest part that keeps repeating. Look for where the pattern starts over."`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, selectedCoreIndices, sequence, currentAttempts, sendText]);

  const checkCreateChallenge = useCallback(() => {
    if (!currentChallenge) return false;
    // A valid created pattern must have at least one full repetition of a core
    const len = createdPattern.length;
    const correct = len >= 4; // At least 4 elements shows a repeating pattern

    // Check if there's a repeating structure
    let hasRepetition = false;
    if (len >= 4) {
      for (let coreLen = 1; coreLen <= Math.floor(len / 2); coreLen++) {
        const candidateCore = createdPattern.slice(0, coreLen);
        let matches = true;
        for (let i = 0; i < len; i++) {
          if (createdPattern[i].toLowerCase() !== candidateCore[i % coreLen].toLowerCase()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          hasRepetition = true;
          break;
        }
      }
    }

    setCurrentAttempts(a => a + 1);

    if (hasRepetition) {
      setPatternCreated(true);
      setFeedback('Wonderful! You created a valid pattern!');
      setFeedbackType('success');
      sendText(
        `[CREATE_CORRECT] Student created a valid pattern: ${createdPattern.join(', ')}. `
        + `Celebrate: "You made your own pattern! Can you describe its rule?"`,
        { silent: true }
      );
    } else if (correct && !hasRepetition) {
      setFeedback('You placed tokens, but I can\'t see a repeating pattern. Try making something that repeats!');
      setFeedbackType('error');
      sendText(
        `[CREATE_NEEDS_WORK] Student placed: ${createdPattern.join(', ')} but no clear repetition detected. `
        + `Guide: "A pattern has a part that repeats. Try something like: red, blue, red, blue..."`,
        { silent: true }
      );
    } else {
      setFeedback('Add more tokens to show your pattern. A pattern needs to repeat at least twice!');
      setFeedbackType('error');
      sendText(
        `[CREATE_TOO_SHORT] Student only placed ${len} tokens. Need at least 4 for a visible pattern. `
        + `Encourage: "Keep going! Add more tokens so we can see the pattern repeat."`,
        { silent: true }
      );
    }
    return hasRepetition;
  }, [currentChallenge, createdPattern, currentAttempts, sendText]);

  const checkTranslateChallenge = useCallback(() => {
    if (!currentChallenge || !translationTarget?.mapping) return false;
    const mapping = translationTarget.mapping;

    // Build expected translation from the given sequence
    const expected = sequence.given.map(t => mapping[t.toLowerCase()] || mapping[t] || t);
    const correct = translatedPattern.length === expected.length
      && translatedPattern.every((t, i) => t.toLowerCase() === expected[i].toLowerCase());
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setTranslationCorrect(true);
      setFeedback('Perfect translation! Same pattern, different look!');
      setFeedbackType('success');
      sendText(
        `[TRANSLATE_CORRECT] Student correctly translated the pattern. `
        + `Original: ${sequence.given.join(', ')}. Translated: ${translatedPattern.join(', ')}. `
        + `Celebrate: "Amazing! The pattern is the same even though it looks different!"`,
        { silent: true }
      );
    } else {
      setFeedback('Not quite. Each token maps to a specific new token. Check the mapping!');
      setFeedbackType('error');
      sendText(
        `[TRANSLATE_INCORRECT] Student translated: ${translatedPattern.join(', ')} but expected: ${expected.join(', ')}. `
        + `Mapping: ${Object.entries(mapping).map(([k, v]) => `${k}→${v}`).join(', ')}. `
        + `Hint: "Look at the mapping: each ${translationTarget.sourceType} becomes a ${translationTarget.targetType}."`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, translationTarget, sequence.given, translatedPattern, currentAttempts, sendText]);

  const checkFindRuleChallenge = useCallback(() => {
    if (!currentChallenge || !sequence.rule) return false;
    // Simple check: does the student's rule contain key words from the actual rule
    const ruleWords = sequence.rule.toLowerCase().split(/\s+/);
    const inputWords = ruleInput.toLowerCase().split(/\s+/);
    // Check for keyword overlap (number mentions, operation words)
    const keyNumbers = ruleWords.filter(w => /\d+/.test(w));
    const hasNumberMatch = keyNumbers.some(n => inputWords.some(w => w.includes(n)));
    const operationWords = ['add', 'plus', 'subtract', 'minus', 'multiply', 'times', 'double', 'skip', 'count'];
    const hasOperationMatch = operationWords.some(op =>
      ruleWords.some(rw => rw.includes(op)) && inputWords.some(iw => iw.includes(op))
    );
    const correct = ruleInput.trim().length > 3 && (hasNumberMatch || hasOperationMatch);
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setRuleArticulated(true);
      setFeedback(`Great thinking! The rule is: "${sequence.rule}"`);
      setFeedbackType('success');
      sendText(
        `[RULE_CORRECT] Student described the rule: "${ruleInput}". Actual rule: "${sequence.rule}". `
        + `Celebrate their rule discovery and connect to math: "You figured out the pattern rule!"`,
        { silent: true }
      );
    } else {
      setFeedback('Think about what happens to each number to get the next one.');
      setFeedbackType('error');
      sendText(
        `[RULE_INCORRECT] Student wrote: "${ruleInput}" but the rule is: "${sequence.rule}". `
        + `Hint: "Look at the numbers: ${sequence.given.join(', ')}. What do you do to each number to get the next?"`,
        { silent: true }
      );
    }
    return correct;
  }, [currentChallenge, sequence.rule, sequence.given, ruleInput, currentAttempts, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;

    switch (currentChallenge.type) {
      case 'extend':
        correct = checkExtendChallenge();
        break;
      case 'identify_core':
        correct = checkIdentifyCoreChallenge();
        break;
      case 'create':
        correct = checkCreateChallenge();
        break;
      case 'translate':
        correct = checkTranslateChallenge();
        break;
      case 'find_rule':
        correct = checkFindRuleChallenge();
        break;
    }

    if (correct) {
      setChallengeResults(prev => [
        ...prev,
        {
          challengeId: currentChallenge.id,
          correct: true,
          type: currentChallenge.type,
          attempts: currentAttempts + 1,
        },
      ]);
    }
  }, [
    currentChallenge, currentAttempts,
    checkExtendChallenge, checkIdentifyCoreChallenge,
    checkCreateChallenge, checkTranslateChallenge, checkFindRuleChallenge,
  ]);

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      // All challenges complete
      sendText(
        `[CHALLENGE_COMPLETE] The student completed all ${challenges.length} pattern challenges! `
        + `Pattern type: ${patternType}. `
        + `Celebrate and summarize what they learned about patterns.`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const extendResults = challengeResults.filter(r => r.type === 'extend');
        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((totalCorrect / challenges.length) * 100)
          : 0;

        const metrics: PatternBuilderMetrics = {
          type: 'pattern-builder',
          extensionsCorrect: extendResults.filter(r => r.correct).length,
          extensionsTotal: extendResults.length,
          coreIdentifiedCorrectly,
          ruleArticulated,
          patternCreated,
          translationCorrect,
          patternTypesExplored: patternTypesExplored.size,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Move to next challenge
    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setExtensionAnswers([]);
    setSelectedCoreIndices(new Set());
    setCreatedPattern([]);
    setTranslatedPattern([]);
    setRuleInput('');

    const nextChallenge = challenges[nextIndex];

    // Set phase
    if (nextChallenge.type === 'identify_core') setCurrentPhase('identify');
    else if (nextChallenge.type === 'create') setCurrentPhase('create');
    else if (nextChallenge.type === 'translate') setCurrentPhase('translate');
    else setCurrentPhase('copy');

    sendText(
      `[PHASE_TRANSITION] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). `
      + `Read the instruction to the student and encourage them.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText, patternType,
    hasSubmittedEvaluation, coreIdentifiedCorrectly, ruleArticulated,
    patternCreated, translationCorrect, patternTypesExplored, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const fullSequence = [...sequence.given, ...sequence.hidden];

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );
  const allChallengesComplete = challenges.length > 0
    && challengeResults.filter(r => r.correct).length >= challenges.length;

  // Determine available tokens for the current challenge
  const availableTokens = useMemo(() => {
    if (currentPhase === 'translate' && translationTarget?.mapping) {
      return Object.values(translationTarget.mapping);
    }
    return tokens.available;
  }, [currentPhase, translationTarget, tokens.available]);

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------

  // Render a single token cell
  const renderToken = useCallback((token: string, index: number, opts?: {
    onClick?: () => void;
    isHidden?: boolean;
    isSelected?: boolean;
    isCoreHighlight?: boolean;
    size?: number;
  }) => {
    const {
      onClick,
      isHidden = false,
      isSelected = false,
      isCoreHighlight = false,
      size = CELL_SIZE,
    } = opts || {};

    const display = getTokenDisplay(token);
    const isClickable = !!onClick;

    return (
      <div
        key={`${token}-${index}`}
        onClick={onClick}
        className={`
          inline-flex items-center justify-center rounded-lg font-bold text-lg
          transition-all duration-200 select-none
          ${isClickable ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}
          ${isHidden ? 'opacity-30 border-dashed' : ''}
          ${isSelected ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900' : ''}
          ${isCoreHighlight ? 'ring-2 ring-emerald-400/60' : ''}
        `}
        style={{
          width: size,
          height: size,
          backgroundColor: isHidden ? 'rgba(255,255,255,0.03)' : display.bg,
          borderColor: isHidden ? 'rgba(255,255,255,0.2)' : display.border,
          borderWidth: 2,
          borderStyle: isHidden ? 'dashed' : 'solid',
          color: isHidden ? 'rgba(255,255,255,0.3)' : display.text,
          fontSize: size > 40 ? '1.25rem' : '0.875rem',
        }}
      >
        {isHidden ? '?' : display.label}
      </div>
    );
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === 'K-1' ? 'Grades K-1' : 'Grades 2-3'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs capitalize">
              {patternType} Pattern
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PHASE_CONFIG).map(([phase, config]) => (
              <Badge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </Badge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Pattern Display */}
        {(currentPhase === 'copy' || currentPhase === 'identify') && (
          <div className="space-y-3">
            {/* Given sequence + hidden slots */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {showStepNumbers && (
                <div className="w-full flex justify-center gap-1.5 mb-1">
                  {fullSequence.map((_, i) => (
                    <div
                      key={`step-${i}`}
                      className="text-slate-600 text-[10px] text-center"
                      style={{ width: CELL_SIZE }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {sequence.given.map((token, i) => {
                  const isCorePos = showCore && i < sequence.core.length;
                  const isIdentifyMode = currentPhase === 'identify';
                  return renderToken(token, i, {
                    onClick: isIdentifyMode && !isCurrentChallengeComplete
                      ? () => handleToggleCoreIndex(i)
                      : undefined,
                    isSelected: isIdentifyMode && selectedCoreIndices.has(i),
                    isCoreHighlight: isCorePos && !isIdentifyMode,
                  });
                })}

                {/* Separator */}
                {currentPhase === 'copy' && sequence.hidden.length > 0 && (
                  <div className="text-slate-600 text-xl mx-1">→</div>
                )}

                {/* Hidden slots / extension answers */}
                {currentPhase === 'copy' && sequence.hidden.map((token, i) => {
                  const answered = extensionAnswers[i];
                  if (answered) {
                    return renderToken(answered, sequence.given.length + i, {
                      onClick: !isCurrentChallengeComplete
                        ? () => {
                          if (i === extensionAnswers.length - 1) handleRemoveLastExtension();
                        }
                        : undefined,
                    });
                  }
                  return renderToken(token, sequence.given.length + i, { isHidden: true });
                })}
              </div>
            </div>

            {/* Core highlight label */}
            {showCore && currentPhase !== 'identify' && (
              <div className="text-center">
                <span className="text-emerald-400/60 text-xs">
                  Core: {sequence.core.join(' ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Create Mode */}
        {currentPhase === 'create' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-[60px] bg-slate-800/20 rounded-lg p-3 border border-white/5">
              {createdPattern.length === 0 ? (
                <p className="text-slate-500 text-sm">Tap tokens below to build your pattern</p>
              ) : (
                createdPattern.map((token, i) =>
                  renderToken(token, i, {
                    onClick: !isCurrentChallengeComplete && i === createdPattern.length - 1
                      ? handleRemoveLastCreated
                      : undefined,
                  })
                )
              )}
            </div>
          </div>
        )}

        {/* Translate Mode */}
        {currentPhase === 'translate' && (
          <div className="space-y-3">
            {/* Source pattern */}
            <div className="space-y-1">
              <p className="text-slate-400 text-xs text-center">
                Original ({translationTarget?.sourceType || 'source'}):
              </p>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {sequence.given.map((token, i) =>
                  renderToken(token, i)
                )}
              </div>
            </div>

            {/* Translation mapping hint */}
            {translationTarget?.mapping && (
              <div className="flex items-center justify-center gap-3 text-xs">
                {Object.entries(translationTarget.mapping).map(([from, to]) => {
                  const fromDisplay = getTokenDisplay(from);
                  const toDisplay = getTokenDisplay(to);
                  return (
                    <span key={from} className="flex items-center gap-1 text-slate-400">
                      <span
                        className="inline-block w-5 h-5 rounded"
                        style={{ backgroundColor: fromDisplay.bg }}
                      />
                      →
                      <span
                        className="inline-block w-5 h-5 rounded"
                        style={{ backgroundColor: toDisplay.bg }}
                      />
                    </span>
                  );
                })}
              </div>
            )}

            {/* Translation zone */}
            <div className="space-y-1">
              <p className="text-slate-400 text-xs text-center">
                Your translation ({translationTarget?.targetType || 'target'}):
              </p>
              <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-[60px] bg-slate-800/20 rounded-lg p-3 border border-white/5">
                {translatedPattern.length === 0 ? (
                  <p className="text-slate-500 text-sm">Tap tokens below to translate</p>
                ) : (
                  translatedPattern.map((token, i) =>
                    renderToken(token, i, {
                      onClick: !isCurrentChallengeComplete && i === translatedPattern.length - 1
                        ? handleRemoveLastTranslated
                        : undefined,
                    })
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rule Input (for find_rule challenges) */}
        {currentChallenge?.type === 'find_rule' && !isCurrentChallengeComplete && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {sequence.given.map((token, i) =>
                renderToken(token, i)
              )}
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-slate-300 text-sm">The rule is:</span>
              <input
                type="text"
                value={ruleInput}
                onChange={e => setRuleInput(e.target.value)}
                placeholder='e.g., "add 3 each time"'
                className="w-64 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-orange-400/50"
                onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              />
            </div>
          </div>
        )}

        {/* Rule Display */}
        {showRule && sequence.rule && isCurrentChallengeComplete && (
          <div className="text-center">
            <Badge className="bg-emerald-500/10 border-emerald-400/30 text-emerald-300 text-xs">
              Rule: {sequence.rule}
            </Badge>
          </div>
        )}

        {/* Token Palette */}
        {!allChallengesComplete && !isCurrentChallengeComplete && currentChallenge?.type !== 'find_rule' && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs text-center">Available tokens:</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {availableTokens.map((token, i) =>
                renderToken(token, i, {
                  onClick: () => {
                    if (currentPhase === 'copy') handleAddExtensionToken(token);
                    else if (currentPhase === 'create') handleAddCreatedToken(token);
                    else if (currentPhase === 'translate') handleAddTranslatedToken(token);
                  },
                  size: 44,
                })
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <>
                {/* Undo button */}
                {(extensionAnswers.length > 0 || createdPattern.length > 0 || translatedPattern.length > 0) && (
                  <Button
                    variant="ghost"
                    className="bg-slate-800/30 border border-white/10 hover:bg-slate-800/50 text-slate-400 text-xs"
                    onClick={() => {
                      if (currentPhase === 'copy') handleRemoveLastExtension();
                      else if (currentPhase === 'create') handleRemoveLastCreated();
                      else if (currentPhase === 'translate') handleRemoveLastTranslated();
                    }}
                  >
                    Undo
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleCheckAnswer}
                  disabled={hasSubmittedEvaluation}
                >
                  Check Answer
                </Button>
              </>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PatternBuilder;
