'use client';

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle2, ThumbsUp, Lightbulb, ArrowRight } from 'lucide-react';
import DynamicPrimitiveRenderer from '../primitives/DynamicPrimitiveRenderer';

interface Problem {
  prompt?: string;
  problem?: string;
  interaction: {
    type: string;
    parameters: any;
  };
  success_criteria?: string[];
  teaching_note?: string;
  learning_objective?: string;
  metadata?: {
    skill?: {
      id?: string;
      description?: string;
    };
    subskill?: {
      id?: string;
      description?: string;
    };
    difficulty?: number;
    concept_group?: string;
  };
}

interface ComposableProblemComponentProps {
  problem: Problem;
  isSubmitted: boolean;
  onSubmit: (submission: any) => Promise<void>;
  onUpdate?: (value: any) => void;
  currentResponse?: any;
  feedback?: any;
  submitting?: boolean;
}

// Helper function to extract feedback content
const getFeedbackContent = (feedback: any) => {
  if (!feedback || !feedback.review) return null;
  
  const reviewData = feedback.review;
  
  // Extract praise
  let praise = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.praise) {
    praise = reviewData.feedback.praise;
  } else if (typeof reviewData.feedback === 'string') {
    praise = reviewData.feedback;
  }
  
  // Extract guidance
  let guidance = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.guidance) {
    guidance = reviewData.feedback.guidance;
  }
  
  // Extract encouragement
  let encouragement = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.encouragement) {
    encouragement = reviewData.feedback.encouragement;
  }
  
  // Extract next steps
  let nextSteps = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.next_steps) {
    nextSteps = reviewData.feedback.next_steps;
  }
  
  // Extract score
  let score = 0;
  if (typeof reviewData.evaluation === 'object' && reviewData.evaluation.score) {
    score = reviewData.evaluation.score;
  } else if (typeof reviewData.evaluation === 'number') {
    score = reviewData.evaluation;
  } else if (typeof reviewData.evaluation === 'string') {
    score = parseFloat(reviewData.evaluation);
  }
  
  return { praise, guidance, encouragement, nextSteps, score };
};

const ComposableProblemComponent: React.FC<ComposableProblemComponentProps> = ({
  problem,
  isSubmitted,
  onSubmit,
  onUpdate,
  currentResponse,
  feedback,
  submitting = false
}) => {
  const handleSubmit = async () => {
    if (!currentResponse) {
      throw new Error('Please complete the interactive question before submitting.');
    }
    
    await onSubmit({
      primitive_response: currentResponse,
      student_answer: JSON.stringify(currentResponse)
    });
  };

  const renderFeedback = () => {
    if (!feedback) return null;
    
    const feedbackContent = getFeedbackContent(feedback);
    if (!feedbackContent) return null;
    
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
          <h3 className="text-sm font-medium flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
            Feedback
          </h3>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {feedbackContent.praise && (
            <div className="flex items-start">
              <ThumbsUp className="w-4 h-4 mr-2 text-green-500 mt-0.5" />
              <p className="text-green-700">{feedbackContent.praise}</p>
            </div>
          )}
          
          {feedbackContent.guidance && (
            <div className="flex items-start">
              <Lightbulb className="w-4 h-4 mr-2 text-blue-500 mt-0.5" />
              <p className="text-blue-700">{feedbackContent.guidance}</p>
            </div>
          )}
          
          {feedbackContent.encouragement && (
            <div className="flex items-start">
              <ArrowRight className="w-4 h-4 mr-2 text-purple-500 mt-0.5" />
              <p className="text-purple-700">{feedbackContent.encouragement}</p>
            </div>
          )}
          
          {feedbackContent.nextSteps && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                {feedbackContent.nextSteps}
              </p>
            </div>
          )}
          
          {feedbackContent.score > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Score:</span>
                <span className="text-sm font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {feedbackContent.score}/10
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Problem display */}
      <div className="text-lg font-medium p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {problem.metadata?.subskill?.description && (
              <span className="text-sm px-2 py-1 rounded bg-purple-100 text-purple-800">
                {problem.metadata.subskill.description}
              </span>
            )}
            {problem.metadata?.difficulty && (
              <span className="text-sm px-2 py-1 rounded bg-blue-100 text-blue-800">
                Difficulty: {problem.metadata.difficulty.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2">
          {problem.prompt || problem.problem}
        </div>
      </div>
      
      {/* Interactive component */}
      <DynamicPrimitiveRenderer
        interaction={problem.interaction}
        disabled={isSubmitted}
        onUpdate={onUpdate}
        showValidation={isSubmitted}
        initialValue={currentResponse}
      />

      {/* Submit button or feedback */}
      {!isSubmitted ? (
        <Button 
          onClick={handleSubmit}
          disabled={submitting}
          size="lg"
          className="w-full"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : 'Submit Answer'}
        </Button>
      ) : (
        renderFeedback()
      )}
    </div>
  );
};

export default ComposableProblemComponent;