'use client';

import React, { useState } from 'react';
import { ShortAnswerProblemData } from '../../types';
import { InsetRenderer } from './insets';
import {
  usePrimitiveEvaluation,
  type ShortAnswerMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Eval-loop chrome from the Lumina UI kit (see lumina/ui/index.ts for the full list).
import {
  LuminaCard,
  LuminaCardContent,
  LuminaFeedbackCard,
  LuminaActionButton,
} from '../../ui';

/**
 * Short Answer Problem Component
 *
 * EVALUATION INTEGRATION:
 * - Captures a free-text response and submits it for backend AI scoring
 * - Submits a neutral score; the backend AI overrides it
 * - Supports competency tracking via skillId/subskillId/objectiveId
 * - Enables retry mechanism with resetAttempt
 *
 * UI: the free-text answer surface (textarea) is the bespoke "painting" and
 * stays custom. The response echo card, guidance banner, and action buttons
 * come from the Lumina UI kit (LuminaCard / LuminaFeedbackCard /
 * LuminaActionButton).
 */

interface ShortAnswerProblemProps {
  data: ShortAnswerProblemData;
}

export const ShortAnswerProblem: React.FC<ShortAnswerProblemProps> = ({ data }) => {
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

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<ShortAnswerMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `short-answer-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleSubmit = () => {
    if (!userAnswer.trim() || hasSubmittedEvaluation) return;

    setIsSubmitted(true);

    const wordCount = userAnswer.trim().split(/\s+/).length;

    // Short answers are submitted for AI evaluation on the backend
    // We mark success=true (submitted) with a neutral score; backend AI will score it
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
          question: data.question,
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
      {/* Question */}
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
        {data.question}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {/* Answer Input — bespoke free-text surface (the "painting"), left untouched */}
      <div className="mb-8">
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={isSubmitted}
          rows={4}
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
            {/* User's Answer echo */}
            <LuminaCard surface="nested" className="animate-fade-in">
              <LuminaCardContent className="p-6">
                <div className="flex items-center gap-3 mb-3 font-bold uppercase tracking-wider text-blue-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                  <span>Your Response</span>
                </div>
                <p className="text-slate-300 leading-relaxed font-light">
                  {userAnswer}
                </p>
              </LuminaCardContent>
            </LuminaCard>

            {/* Guidance — short answers are AI-scored on the backend, so this is
                always the softer "insight" banner rather than correct/incorrect. */}
            <LuminaFeedbackCard
              status="insight"
              label="Guidance"
              teachingNote={data.teachingNote}
            >
              <p className="mb-3">{data.rationale}</p>
              {data.successCriteria && data.successCriteria.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Success Criteria</div>
                  <ul className="space-y-1">
                    {data.successCriteria.map((criterion, idx) => (
                      <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </LuminaFeedbackCard>

            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        )}
      </div>
    </div>
  );
};
