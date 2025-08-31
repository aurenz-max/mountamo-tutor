'use client';

import React, { useImperativeHandle, forwardRef } from 'react';
import ComposableProblemComponent from './ComposableProblemComponent';
import DrawingProblemComponent from './DrawingProblemComponent';
import { authApi } from '@/lib/authApiClient';

interface Problem {
  problem_id?: string;
  problem_type?: string;
  prompt?: string;
  problem?: string;
  answer?: string;
  interaction?: {
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
  // MCQ fields
  id?: string;
  subject?: string;
  unit_id?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty?: string;
  question?: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  correct_option_id?: string;
  rationale?: string;
  // Fill-in-the-blank fields
  text_with_blanks?: string;
  blanks?: Array<{
    id: string;
    correct_answers: string[];
    case_sensitive: boolean;
    tolerance?: number;
    hint?: string;
  }>;
}

type ProblemType = 'mcq' | 'fillInBlank' | 'composable' | 'drawing';

interface ProblemRendererProps {
  problem: Problem;
  isSubmitted: boolean;
  onSubmit: (submission: any) => Promise<void>;
  onUpdate?: (value: any) => void;
  currentResponse?: any;
  feedback?: any;
  submitting?: boolean;
}

interface ProblemRendererRef {
  submitProblem: () => Promise<void>;
}

// Clean problem type detection
const getProblemType = (problem: Problem): ProblemType => {
  if (problem.question && problem.options) return 'mcq';
  if (problem.text_with_blanks && problem.blanks) return 'fillInBlank';
  if (problem.interaction) return 'composable';
  return 'drawing'; // fallback
};

const ProblemRenderer = forwardRef<ProblemRendererRef, ProblemRendererProps>((
  {
    problem,
    isSubmitted,
    onSubmit,
    onUpdate,
    currentResponse,
    feedback,
    submitting = false
  },
  ref
) => {
  const problemType = getProblemType(problem);

  const handleSubmission = async () => {
    // For MCQ problems
    if (problemType === 'mcq' && currentResponse?.selected_option_id) {
      const mcqSubmission = {
        mcq: problem,
        selected_option_id: currentResponse.selected_option_id
      };
      
      console.log('=== MCQ SUBMISSION ===');
      console.log('Submitting MCQ:', mcqSubmission);
      
      const mcqReview = await authApi.submitMCQ(mcqSubmission);
      
      // Convert MCQ review to standard feedback format
      const review = {
        evaluation: { score: mcqReview.is_correct ? 10 : 0 },
        feedback: {
          praise: mcqReview.is_correct ? "Correct! Well done!" : "Not quite right, but good try!",
          guidance: mcqReview.explanation || problem.rationale,
          encouragement: mcqReview.is_correct ? "Keep up the great work!" : "Review the explanation and try similar problems."
        },
        correct: mcqReview.is_correct,
        score: mcqReview.is_correct ? 10 : 0,
        accuracy_percentage: mcqReview.is_correct ? 100 : 0
      };
      
      await onSubmit({ review, mcqReview });
      return;
    }
    
    // For Fill-in-the-Blank problems
    if (problemType === 'fillInBlank' && currentResponse?.student_answers) {
      const fibSubmission = {
        fill_in_blank: problem,
        student_answers: currentResponse.student_answers
      };
      
      console.log('=== FILL-IN-THE-BLANK SUBMISSION ===');
      console.log('Submitting Fill-in-the-Blank:', fibSubmission);
      
      const fibReview = await authApi.submitFillInBlank(fibSubmission);
      
      // Convert Fill-in-the-Blank review to standard feedback format
      const review = {
        evaluation: { score: fibReview.total_score },
        feedback: {
          praise: fibReview.overall_correct ? "Excellent! All blanks correct!" : "Good effort! Some answers need work.",
          guidance: fibReview.explanation,
          encouragement: fibReview.overall_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar problems."
        },
        correct: fibReview.overall_correct,
        score: fibReview.total_score,
        accuracy_percentage: fibReview.percentage_correct
      };
      
      await onSubmit({ review, fibReview });
      return;
    }
    
    // For other problem types (composable, drawing)
    await onSubmit({
      primitive_response: currentResponse,
      student_answer: JSON.stringify(currentResponse || '')
    });
  };

  // Expose the submit function to parent via ref
  useImperativeHandle(ref, () => ({
    submitProblem: handleSubmission
  }));

  switch (problemType) {
    case 'mcq':
      return (
        <div className="space-y-4">
          {/* MCQ Options */}
          <div className="space-y-3">
            {problem.options?.map((option, index) => {
              const isSelected = currentResponse?.selected_option_id === option.id;
              const isCorrect = isSubmitted && option.id === problem.correct_option_id;
              const isIncorrectSelection = isSubmitted && isSelected && option.id !== problem.correct_option_id;
              
              return (
                <div key={option.id} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={option.id}
                    name="mcq-option"
                    value={option.id}
                    checked={isSelected}
                    disabled={isSubmitted}
                    onChange={(e) => {
                      if (e.target.checked && onUpdate) {
                        onUpdate({ selected_option_id: option.id });
                      }
                    }}
                    className={`w-4 h-4 ${
                      isCorrect
                        ? 'text-green-600'
                        : isIncorrectSelection
                          ? 'text-red-600'
                          : 'text-blue-600'
                    }`}
                  />
                  <label
                    htmlFor={option.id}
                    className={`flex-1 cursor-pointer text-base leading-relaxed p-3 rounded border ${
                      isCorrect
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : isIncorrectSelection
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : isSubmitted
                            ? 'text-gray-600 bg-gray-50 border-gray-200'
                            : 'hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                    {option.text}
                    {isSubmitted && (
                      <span className="ml-2">
                        {isCorrect && <span className="text-green-600">✓</span>}
                        {isIncorrectSelection && <span className="text-red-600">✗</span>}
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
          
          {/* Show rationale after submission */}
          {isSubmitted && problem.rationale && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
              <p className="text-blue-700">{problem.rationale}</p>
            </div>
          )}
        </div>
      );

    case 'fillInBlank':
      return (
        <div className="space-y-4">
          {/* Fill-in-the-Blank interactive text */}
          <div className="text-lg font-medium p-4 bg-white rounded-lg border border-gray-200">
            {(() => {
              const text = problem.text_with_blanks;
              const parts = text.split(/(\{\{[^}]+\}\})/);
              
              return parts.map((part, partIndex) => {
                const blankMatch = part.match(/\{\{([^}]+)\}\}/);
                if (blankMatch) {
                  const blankId = blankMatch[1];
                  const studentAnswersArray = currentResponse?.student_answers || [];
                  const currentAnswers = studentAnswersArray.reduce((acc, item) => {
                    acc[item.blank_id] = item.answer;
                    return acc;
                  }, {});
                  const evaluation = isSubmitted && feedback?.fibReview?.blank_evaluations?.find(e => e.blank_id === blankId);
                  const isCorrect = evaluation?.is_correct;
                  const isIncorrect = evaluation && !evaluation.is_correct;
                  
                  return (
                    <span key={partIndex} className="inline-flex items-center mx-1">
                      <input
                        type="text"
                        value={currentAnswers[blankId] || ''}
                        onChange={(e) => {
                          const newAnswers = { ...currentAnswers, [blankId]: e.target.value };
                          const studentAnswers = Object.entries(newAnswers).map(([blank_id, answer]) => ({
                            blank_id,
                            answer: answer || ''
                          }));
                          if (onUpdate) {
                            onUpdate({ student_answers: studentAnswers });
                          }
                        }}
                        disabled={isSubmitted}
                        placeholder={`___`}
                        className={`inline-block w-20 h-8 text-center text-sm border rounded px-2 ${
                          isCorrect 
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : isIncorrect
                              ? 'border-red-500 bg-red-50 text-red-800'
                              : 'border-gray-300'
                        }`}
                      />
                      {isSubmitted && (
                        <span className="ml-1">
                          {isCorrect && <span className="w-4 h-4 text-green-600">✓</span>}
                          {isIncorrect && <span className="text-red-600 text-sm">✗</span>}
                        </span>
                      )}
                    </span>
                  );
                }
                return <span key={partIndex}>{part}</span>;
              });
            })()} 
          </div>
          
          {/* Show detailed feedback after submission */}
          {isSubmitted && feedback?.fibReview && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-800">Answer Details:</h4>
              {feedback.fibReview.blank_evaluations.map(evaluation => (
                <div key={evaluation.blank_id} className={`p-3 rounded-lg border ${
                  evaluation.is_correct 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start">
                    {evaluation.is_correct ? (
                      <span className="w-4 h-4 text-green-600 mr-2 mt-0.5">✓</span>
                    ) : (
                      <span className="w-4 h-4 text-red-600 mr-2 mt-0.5">✗</span>
                    )}
                    <div>
                      <p className={`font-semibold ${evaluation.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                        Blank {evaluation.blank_id}: 
                        <span className="font-normal ml-1">"{evaluation.student_answer}"</span>
                      </p>
                      <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                        {evaluation.feedback}
                      </p>
                      {!evaluation.is_correct && (
                        <p className="text-sm text-gray-600 mt-1">
                          Expected: {evaluation.correct_answers.join(' or ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show rationale after submission */}
              {problem.rationale && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
                  <p className="text-blue-700">{problem.rationale}</p>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 'composable':
      return (
        <ComposableProblemComponent
          problem={problem}
          isSubmitted={isSubmitted}
          onSubmit={handleSubmission}
          onUpdate={onUpdate}
          currentResponse={currentResponse}
          feedback={feedback}
          submitting={submitting}
        />
      );

    case 'drawing':
    default:
      return (
        <DrawingProblemComponent
          problem={problem}
          isSubmitted={isSubmitted}
          onSubmit={handleSubmission}
          feedback={feedback}
          submitting={submitting}
        />
      );
  }
});

ProblemRenderer.displayName = 'ProblemRenderer';

export { ProblemRenderer as default, type ProblemRendererProps, type ProblemRendererRef };