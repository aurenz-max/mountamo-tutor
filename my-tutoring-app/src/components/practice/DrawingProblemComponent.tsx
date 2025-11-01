'use client';

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, ThumbsUp, Lightbulb, ArrowRight } from 'lucide-react';
import DrawingWorkspace from './DrawingWorkspace';

interface Problem {
  prompt?: string;
  problem?: string;
  answer?: string;
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

interface DrawingProblemComponentProps {
  problem: Problem;
  isSubmitted: boolean;
  onSubmit: (submission: any) => Promise<void>;
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

const DrawingProblemComponent: React.FC<DrawingProblemComponentProps> = ({
  problem,
  isSubmitted,
  onSubmit,
  feedback,
  submitting = false
}) => {
  const drawingRef = useRef<any>(null);

  const handleSubmit = async () => {
    if (!drawingRef.current) {
      throw new Error('Drawing workspace not available.');
    }
    
    const canvasData = await drawingRef.current.getCanvasData();
   
    if (!canvasData) {
      throw new Error('No drawing found. Please draw your answer before submitting.');
    }
    
    await onSubmit({
      solution_image: canvasData,
      student_answer: '',
      canvas_used: true
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
          {(typeof problem.prompt === 'object' && problem.prompt !== null
            ? (problem.prompt as any)?.instruction
            : problem.prompt) || problem.problem}
        </div>
      </div>
      
      {/* Drawing workspace */}
      <DrawingWorkspace 
        ref={drawingRef}
        loading={submitting}
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

export default DrawingProblemComponent;