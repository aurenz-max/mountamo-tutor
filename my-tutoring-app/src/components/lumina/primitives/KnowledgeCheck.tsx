'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { KnowledgeCheckData, ProblemData } from '../types';
import { ProblemRenderer } from '../config/problemTypeRegistry';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';

/**
 * KnowledgeCheck Component
 *
 * Supports two modes:
 * 1. Legacy mode: Single multiple-choice question (backwards compatible)
 * 2. Problem Registry mode: Single or multiple problems of various types
 *
 * AI TUTORING INTEGRATION:
 * - Sends pedagogical triggers at key moments (problem shown, correct/incorrect, completion)
 * - Optional AI Helper card provides progressive hints without revealing answers
 * - Tracks attempt counts and scores for context-aware AI scaffolding
 *
 * EVALUATION INTEGRATION:
 * - Delegates evaluation to individual problem primitives
 * - Each problem type (MultipleChoiceProblem, etc.) handles its own evaluation
 * - Intercepts evaluation results to trigger AI tutoring responses
 * - Supports competency tracking via skillId/subskillId/objectiveId passed to problems
 *
 * The component automatically detects which mode to use based on the data structure.
 */

interface KnowledgeCheckProps {
  data: KnowledgeCheckData | {
    problems: ProblemData[];
    instanceId?: string;
    skillId?: string;
    subskillId?: string;
    objectiveId?: string;
    exhibitId?: string;
    onEvaluationSubmit?: (result: any) => void;
  };
}

// Type guard to check if using legacy format
function isLegacyKnowledgeCheck(data: any): data is KnowledgeCheckData {
  return 'question' in data && 'options' in data && 'correctAnswerId' in data;
}

// Type guard to check if using problem registry format
function isProblemRegistryFormat(data: any): data is { problems: ProblemData[] } {
  return 'problems' in data && Array.isArray(data.problems);
}

// ─── AI Helper Hint Card ─────────────────────────────────────────────────────

interface AIHelperCardProps {
  sendText: (text: string, options?: { silent?: boolean }) => void;
  requestHint: (level: 1 | 2 | 3, currentState?: any) => void;
  isAIResponding: boolean;
  conversation: Array<{ role: string; content: string }>;
  currentQuestion: string;
  problemType: string;
  problemIndex: number;
  totalProblems: number;
}

const AIHelperCard: React.FC<AIHelperCardProps> = ({
  sendText,
  isAIResponding,
  conversation,
  currentQuestion,
  problemType,
  problemIndex,
  totalProblems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintMessages, setHintMessages] = useState<string[]>([]);
  const conversationLengthAtHintRef = useRef(0);
  const maxHintLevel = 3;

  // Watch conversation for new AI responses after hint request
  useEffect(() => {
    if (hintLevel === 0) return;

    const newMessages = conversation.slice(conversationLengthAtHintRef.current);
    const aiResponses = newMessages
      .filter((msg) => msg.role === 'assistant' || msg.role === 'model')
      .map((msg) => msg.content);

    if (aiResponses.length > 0) {
      setHintMessages((prev) => {
        const updated = [...prev];
        // Replace or add the hint for the current level
        updated[hintLevel - 1] = aiResponses[aiResponses.length - 1];
        return updated;
      });
    }
  }, [conversation, hintLevel]);

  const handleRequestHint = useCallback(() => {
    const nextLevel = Math.min(hintLevel + 1, maxHintLevel) as 1 | 2 | 3;
    setHintLevel(nextLevel);
    conversationLengthAtHintRef.current = conversation.length;

    sendText(
      `[HINT_REQUESTED] The student is asking for help on problem ${problemIndex + 1} of ${totalProblems}. ` +
      `Problem type: ${problemType}. Question: "${currentQuestion}". ` +
      `This is hint level ${nextLevel} of ${maxHintLevel}. ` +
      `Provide a level-${nextLevel} hint: ${
        nextLevel === 1
          ? 'Ask a guiding question to redirect their thinking.'
          : nextLevel === 2
            ? 'Break the problem into smaller parts and point to key details.'
            : 'Walk through the reasoning step by step, stopping just short of the answer.'
      } NEVER reveal the correct answer.`,
      { silent: true }
    );
  }, [hintLevel, sendText, currentQuestion, problemType, problemIndex, totalProblems, conversation.length]);

  // Reset hints when question changes
  useEffect(() => {
    setHintLevel(0);
    setHintMessages([]);
  }, [currentQuestion]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30 rounded-xl transition-all"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">
              {hintLevel === 0 ? 'Need help?' : `Hints (${hintLevel}/${maxHintLevel})`}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-400" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="mt-2 backdrop-blur-xl bg-slate-900/40 border-amber-500/10">
          <CardContent className="pt-4 pb-4 space-y-3">
            {/* Existing hints */}
            {hintMessages.map((hint, i) => (
              hint && (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-mono text-amber-500/60 mb-1">
                      Hint {i + 1}
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {hint}
                    </p>
                  </div>
                </div>
              )
            ))}

            {/* Loading state */}
            {isAIResponding && hintLevel > 0 && !hintMessages[hintLevel - 1] && (
              <div className="flex items-center gap-2 text-amber-400/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            {/* Request hint button */}
            {hintLevel < maxHintLevel ? (
              <Button
                onClick={handleRequestHint}
                disabled={isAIResponding}
                variant="ghost"
                className="w-full bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 text-amber-300 text-sm rounded-lg"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                {hintLevel === 0
                  ? 'Get a hint'
                  : hintLevel === 1
                    ? 'I need more help'
                    : 'Walk me through it'}
              </Button>
            ) : (
              <p className="text-xs text-slate-500 text-center italic">
                All hints used. Give it your best try!
              </p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ─── Main KnowledgeCheck Component ───────────────────────────────────────────

export const KnowledgeCheck: React.FC<KnowledgeCheckProps> = ({ data }) => {
  // ── Evaluation tracking state ──────────────────────────────────────────────
  const [evaluationResults, setEvaluationResults] = useState<Map<string, { isCorrect: boolean; attempts: number }>>(new Map());
  const hasTriggeredProblemShownRef = useRef<Set<string>>(new Set());
  const hasTriggeredAllCompleteRef = useRef(false);

  // ── Normalize data to problems array ───────────────────────────────────────
  const problems: ProblemData[] = useMemo(() => {
    if (isLegacyKnowledgeCheck(data)) {
      return [{
        type: 'multiple_choice' as const,
        id: 'legacy_mc_1',
        difficulty: 'medium' as const,
        gradeLevel: 'elementary',
        question: data.question,
        visual: data.visual,
        options: data.options,
        correctOptionId: data.correctAnswerId,
        rationale: data.explanation,
        teachingNote: '',
        successCriteria: [],
      }];
    }
    if (isProblemRegistryFormat(data)) {
      return data.problems;
    }
    return [];
  }, [data]);

  // Extract common props
  const instanceId = ('instanceId' in data ? data.instanceId : undefined) || `knowledge-check-${Date.now()}`;
  const exhibitId = 'exhibitId' in data ? data.exhibitId : undefined;

  // ── AI Tutoring Hook ───────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    problemCount: problems.length,
    currentProblemIndex: 0,
    currentProblemType: problems[0]?.type || 'unknown',
    currentQuestion: getQuestionText(problems[0]),
    attemptNumber: 1,
    lastAnswerCorrect: null,
    completedCount: evaluationResults.size,
    correctCount: Array.from(evaluationResults.values()).filter((r) => r.isCorrect).length,
  }), [problems, evaluationResults]);

  const {
    sendText,
    requestHint,
    isAIResponding,
    conversation,
  } = useLuminaAI({
    primitiveType: 'knowledge-check',
    instanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
  });

  // ── Pedagogical trigger: Problem shown ─────────────────────────────────────
  useEffect(() => {
    if (problems.length === 0) return;

    // Trigger for the first problem on mount
    const firstProblem = problems[0];
    const firstId = firstProblem.id;
    if (!hasTriggeredProblemShownRef.current.has(firstId)) {
      hasTriggeredProblemShownRef.current.add(firstId);

      const questionText = getQuestionText(firstProblem);
      sendText(
        `[PROBLEM_SHOWN] A ${firstProblem.type.replace(/_/g, ' ')} problem has appeared. ` +
        `Question: "${questionText}". ` +
        (problems.length > 1
          ? `This is problem 1 of ${problems.length}. `
          : '') +
        `Briefly introduce the question in an encouraging way. Do NOT hint at the answer.`,
        { silent: true }
      );
    }
  }, [problems, sendText]);

  // ── Pedagogical trigger: All complete ──────────────────────────────────────
  useEffect(() => {
    if (problems.length === 0 || hasTriggeredAllCompleteRef.current) return;
    if (evaluationResults.size < problems.length) return;

    hasTriggeredAllCompleteRef.current = true;
    const correctCount = Array.from(evaluationResults.values()).filter((r) => r.isCorrect).length;

    sendText(
      `[ALL_COMPLETE] The student finished all ${problems.length} problems! ` +
      `Score: ${correctCount} out of ${problems.length} correct. ` +
      `Celebrate their effort and mention how many they got right.`,
      { silent: true }
    );
  }, [evaluationResults, problems, sendText]);

  // ── Evaluation callback (wired into each problem) ─────────────────────────
  const handleEvaluationSubmit = useCallback((problemId: string, problemIndex: number, result: any) => {
    const isCorrect = result?.success ?? result?.isCorrect ?? false;
    const problem = problems[problemIndex];
    const questionText = getQuestionText(problem);

    setEvaluationResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(problemId);
      const attemptNumber = (existing?.attempts || 0) + 1;
      next.set(problemId, { isCorrect, attempts: attemptNumber });

      // Send AI trigger based on result
      if (isCorrect) {
        sendText(
          `[ANSWER_CORRECT] Problem ${problemIndex + 1} of ${problems.length}: ` +
          `The student answered correctly on attempt ${attemptNumber}. ` +
          `Question: "${questionText}". ` +
          `Briefly celebrate and reinforce why this is correct. ` +
          (problemIndex < problems.length - 1
            ? `Smoothly encourage them for the next problem.`
            : `This was the last problem!`),
          { silent: true }
        );
      } else {
        sendText(
          `[ANSWER_INCORRECT] Problem ${problemIndex + 1} of ${problems.length}: ` +
          `The student answered incorrectly on attempt ${attemptNumber}. ` +
          `Question: "${questionText}". ` +
          `Give brief encouragement and a gentle hint without revealing the answer. ` +
          `They can try again.`,
          { silent: true }
        );
      }

      return next;
    });

    // Also forward to the parent's onEvaluationSubmit if provided
    if ('onEvaluationSubmit' in data && data.onEvaluationSubmit) {
      data.onEvaluationSubmit(result);
    }
  }, [problems, sendText, data]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (problems.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto my-12">
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
          Invalid KnowledgeCheck data format
        </div>
      </div>
    );
  }

  const problemCount = problems.length;
  const isLegacy = isLegacyKnowledgeCheck(data);

  return (
    <div className="w-full max-w-4xl mx-auto my-12 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20 relative">
        {/* Header */}
        <div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse"></span>
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
              {isLegacy ? 'Concept Verification Terminal' : 'Knowledge Assessment Terminal'}
            </span>
          </div>
          {problemCount > 1 && (
            <div className="text-xs text-slate-500 font-mono">
              {problemCount} {problemCount === 1 ? 'PROBLEM' : 'PROBLEMS'}
            </div>
          )}
        </div>

        <div className="p-8 md:p-12">
          {/* Problem Collection */}
          <div className="space-y-16">
            {problems.map((problem, index) => (
              <div key={problem.id} className="relative">
                {/* Problem Number Badge */}
                {problemCount > 1 && (
                  <div className="absolute -left-6 md:-left-8 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-mono text-sm">
                    {index + 1}
                  </div>
                )}

                {/* Problem Content */}
                <div className={problemCount > 1 ? 'ml-4 md:ml-6' : ''}>
                  <ProblemRenderer
                    problemData={{
                      ...problem,
                      onEvaluationSubmit: (result: any) => handleEvaluationSubmit(problem.id, index, result),
                    }}
                  />

                  {/* AI Helper Card - appears below each problem */}
                  <div className="mt-6">
                    <AIHelperCard
                      sendText={sendText}
                      requestHint={requestHint}
                      isAIResponding={isAIResponding}
                      conversation={conversation as Array<{ role: string; content: string }>}
                      currentQuestion={getQuestionText(problem)}
                      problemType={problem.type.replace(/_/g, ' ')}
                      problemIndex={index}
                      totalProblems={problemCount}
                    />
                  </div>
                </div>

                {/* Divider between problems */}
                {index < problemCount - 1 && (
                  <div className="mt-16 mb-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the question text from any problem type for AI context */
function getQuestionText(problem: ProblemData | undefined): string {
  if (!problem) return '';
  switch (problem.type) {
    case 'multiple_choice':
      return problem.question;
    case 'true_false':
      return problem.statement;
    case 'fill_in_blanks':
      return problem.textWithBlanks;
    case 'matching_activity':
      return problem.prompt;
    case 'sequencing_activity':
      return problem.instruction;
    case 'categorization_activity':
      return problem.instruction;
    case 'scenario_question':
      return problem.scenarioQuestion;
    case 'short_answer':
      return problem.question;
    default:
      return '';
  }
}
