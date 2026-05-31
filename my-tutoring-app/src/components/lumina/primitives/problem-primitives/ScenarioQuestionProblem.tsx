'use client';

import React, { useState } from 'react';
import { ScenarioQuestionProblemData } from '../../types';
import { InsetRenderer } from './insets';
import {
  usePrimitiveEvaluation,
  type ShortAnswerMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import { LuminaFeedbackCard, LuminaActionButton } from '../../ui';

/**
 * Scenario Question Problem Component
 *
 * INTERACTION-BASED: the answer is a free-form textarea (the bespoke "painting"),
 * which stays fully custom. Only the eval-loop chrome — the feedback banners and
 * the submit / try-again buttons — comes from the Lumina UI kit
 * (LuminaFeedbackCard / LuminaActionButton).
 */

interface ScenarioQuestionProblemProps {
  data: ScenarioQuestionProblemData;
}

export const ScenarioQuestionProblem: React.FC<ScenarioQuestionProblemProps> = ({ data }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Destructure evaluation props (injected by KnowledgeCheck/ProblemRenderer)
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data as any;

  // Initialize evaluation hook — uses short-answer metrics since it's a free-form text response
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<ShortAnswerMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `scenario-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSubmit = () => {
    if (!userAnswer.trim() || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const wordCount = userAnswer.trim().split(/\s+/).length;

    // Scenario questions are submitted for AI evaluation on the backend
    const metrics: ShortAnswerMetrics = {
      type: 'short-answer',
      studentResponse: userAnswer.trim(),
      wordCount,
    };

    submitEvaluation(
      true, // Submitted successfully (AI scores on backend)
      50,   // Neutral score — backend AI will override
      metrics,
      {
        studentWork: {
          answer: userAnswer.trim(),
          scenario: data.scenario,
          question: data.scenarioQuestion,
          modelAnswer: data.scenarioAnswer,
        },
      }
    );
  };

  const handleReset = () => {
    setUserAnswer('');
    setIsSubmitted(false);
    resetEvaluationAttempt();
  };

  return (
    <div className="w-full">
      {/* Scenario */}
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400 mb-3">Scenario</div>
        <p className="text-lg text-slate-200 leading-relaxed font-light">
          {data.scenario}
        </p>
      </div>

      {/* Question */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.scenarioQuestion}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {/* Answer Input — bespoke free-text painting, stays custom */}
      <div className="mb-8">
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={isSubmitted}
          rows={5}
          placeholder="Type your answer here..."
          className="w-full p-4 rounded-xl border-2 border-white/20 bg-white/5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <LuminaActionButton
            action="check"
            disabled={!userAnswer.trim()}
            onClick={handleSubmit}
          >
            Submit Answer
          </LuminaActionButton>
        ) : (
          <div className="w-full space-y-4">
            {/* User's Answer */}
            <LuminaFeedbackCard status="insight" label="Your Response">
              {userAnswer}
            </LuminaFeedbackCard>

            {/* Model Answer */}
            <LuminaFeedbackCard
              status="correct"
              label="Model Answer"
              teachingNote={data.teachingNote}
            >
              <p className="mb-4">{data.scenarioAnswer}</p>
              <p className="border-t border-white/5 pt-4 text-sm text-slate-400">
                {data.rationale}
              </p>
            </LuminaFeedbackCard>

            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        )}
      </div>
    </div>
  );
};
