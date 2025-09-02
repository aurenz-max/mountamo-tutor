'use client';

import React, { useImperativeHandle, forwardRef } from 'react';
import ComposableProblemComponent from './ComposableProblemComponent';
import DrawingProblemComponent from './DrawingProblemComponent';
import MatchingComponent from './MatchingComponent';
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
  // Matching fields
  prompt?: string;
  left_items?: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  right_items?: Array<{
    id: string;
    text: string;
    image_url?: string;
    metadata?: any;
  }>;
  mappings?: Array<{
    left_id: string;
    right_ids: string[];
    rationale?: string;
  }>;
  allow_many_to_one?: boolean;
  include_distractors?: boolean;
  rationale_global?: string;
  // True/False fields
  statement?: string;
  correct?: boolean;
  allow_explain_why?: boolean;
  trickiness?: string;
}

type ProblemType = 'mcq' | 'fillInBlank' | 'matching' | 'trueFalse' | 'composable' | 'drawing';

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
  if (problem.prompt && problem.left_items && problem.right_items) return 'matching';
  if (problem.statement && problem.correct !== undefined) return 'trueFalse';
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
    
    // For True/False problems
    if (problemType === 'trueFalse' && currentResponse?.selected_answer !== undefined) {
      const trueFalseSubmission = {
        true_false: problem,
        selected_answer: currentResponse.selected_answer,
        ...(problem.allow_explain_why && currentResponse.explanation && { explanation: currentResponse.explanation })
      };
      
      console.log('=== TRUE/FALSE SUBMISSION ===');
      console.log('Submitting True/False:', trueFalseSubmission);
      
      const trueFalseReview = await authApi.submitTrueFalse(trueFalseSubmission);
      
      // Convert True/False review to standard feedback format
      const review = {
        evaluation: { score: trueFalseReview.is_correct ? 10 : 0 },
        feedback: {
          praise: trueFalseReview.is_correct ? "Correct! Well done!" : "Not quite right, but good effort!",
          guidance: trueFalseReview.explanation,
          encouragement: trueFalseReview.is_correct ? "Keep up the great work!" : "Review the explanation and try similar problems."
        },
        correct: trueFalseReview.is_correct,
        score: trueFalseReview.is_correct ? 10 : 0,
        accuracy_percentage: trueFalseReview.is_correct ? 100 : 0
      };
      
      await onSubmit({ review, trueFalseReview });
      return;
    }
    
    // For Matching problems
    if (problemType === 'matching' && currentResponse?.student_matches) {
      const matchingSubmission = {
        matching: problem,
        student_matches: currentResponse.student_matches
      };
      
      console.log('=== MATCHING SUBMISSION ===');
      console.log('Submitting Matching:', matchingSubmission);
      
      const matchingReview = await authApi.submitMatching(matchingSubmission);
      
      // Convert Matching review to standard feedback format
      const review = {
        evaluation: { score: matchingReview.total_score },
        feedback: {
          praise: matchingReview.overall_correct ? "Perfect Match! All correct!" : "Good effort! Some matches need work.",
          guidance: matchingReview.explanation,
          encouragement: matchingReview.overall_correct ? "Keep up the fantastic work!" : "Review the explanations and try similar matching problems."
        },
        correct: matchingReview.overall_correct,
        score: matchingReview.total_score,
        accuracy_percentage: matchingReview.percentage_correct
      };
      
      await onSubmit({ review, matchingReview });
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
          
          {/* Show general feedback after submission */}
          {isSubmitted && feedback?.review && (
            <div className="mt-4 space-y-3">
              {feedback.review.feedback?.praise && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">{feedback.review.feedback.praise}</p>
                </div>
              )}
              {feedback.review.feedback?.guidance && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-1">Guidance:</h4>
                  <p className="text-blue-700">{feedback.review.feedback.guidance}</p>
                </div>
              )}
              {feedback.review.feedback?.encouragement && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 font-medium">{feedback.review.feedback.encouragement}</p>
                </div>
              )}
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
              
              {/* Show general feedback after submission */}
              {feedback?.review && (
                <div className="mt-4 space-y-3">
                  {feedback.review.feedback?.praise && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium">{feedback.review.feedback.praise}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.guidance && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-1">Guidance:</h4>
                      <p className="text-blue-700">{feedback.review.feedback.guidance}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.encouragement && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 font-medium">{feedback.review.feedback.encouragement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 'trueFalse':
      return (
        <div className="space-y-4">
          {/* True/False Statement */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Statement:</h4>
            <p className="text-gray-900 text-lg">{problem.statement}</p>
          </div>
          
          {/* True/False Options */}
          <div className="space-y-3">
            {[{value: true, label: 'True'}, {value: false, label: 'False'}].map((option) => {
              const isSelected = currentResponse?.selected_answer === option.value;
              const isCorrect = isSubmitted && option.value === problem.correct;
              const isIncorrectSelection = isSubmitted && isSelected && option.value !== problem.correct;
              
              return (
                <div key={option.label} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={option.label.toLowerCase()}
                    name="true-false-option"
                    value={option.label.toLowerCase()}
                    checked={isSelected}
                    disabled={isSubmitted}
                    onChange={(e) => {
                      if (e.target.checked && onUpdate) {
                        onUpdate({ 
                          selected_answer: option.value,
                          explanation: currentResponse?.explanation || ''
                        });
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
                    htmlFor={option.label.toLowerCase()}
                    className={`flex-1 cursor-pointer text-lg font-medium p-3 rounded border ${
                      isCorrect
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : isIncorrectSelection
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : isSubmitted
                            ? 'text-gray-600 bg-gray-50 border-gray-200'
                            : 'hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    {option.label}
                    {isCorrect && <span className="ml-2 text-green-600">✓</span>}
                    {isIncorrectSelection && <span className="ml-2 text-red-600">✗</span>}
                  </label>
                </div>
              );
            })}
          </div>

          {/* Explanation input if required */}
          {problem.allow_explain_why && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Explain your reasoning:
              </label>
              <textarea
                value={currentResponse?.explanation || ''}
                onChange={(e) => {
                  if (onUpdate) {
                    onUpdate({
                      selected_answer: currentResponse?.selected_answer,
                      explanation: e.target.value
                    });
                  }
                }}
                disabled={isSubmitted}
                placeholder="Why did you choose this answer?"
                className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>
          )}

          {isSubmitted && (
            <div className="space-y-4">
              {/* Show rationale after submission */}
              {problem.rationale && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Explanation:</h4>
                  <p className="text-gray-700">{problem.rationale}</p>
                </div>
              )}
              
              {/* Show general feedback after submission */}
              {feedback?.review && (
                <div className="mt-4 space-y-3">
                  {feedback.review.feedback?.praise && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium">{feedback.review.feedback.praise}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.guidance && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-1">Guidance:</h4>
                      <p className="text-blue-700">{feedback.review.feedback.guidance}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.encouragement && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 font-medium">{feedback.review.feedback.encouragement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 'matching':
      return (
        <div className="space-y-4">
          {/* Matching interactive area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Items */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800 mb-3">Items to Match</h4>
              {problem.left_items?.map((leftItem) => {
                const matchedRightId = currentResponse?.student_matches?.find(m => m.left_id === leftItem.id)?.right_id;
                const evaluation = isSubmitted && feedback?.matchingReview?.match_evaluations?.find(e => e.left_id === leftItem.id);
                const isCorrect = evaluation?.is_correct;
                const isIncorrect = evaluation && !evaluation.is_correct;

                return (
                  <div
                    key={leftItem.id}
                    className={`p-4 rounded-lg border-2 border-dashed transition-colors ${
                      isCorrect
                        ? 'border-green-300 bg-green-50'
                        : isIncorrect
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{leftItem.text}</p>
                        {matchedRightId && (
                          <div className="mt-2 flex items-center text-sm">
                            <span className="mr-2">→</span>
                            <span className={
                              isCorrect 
                                ? 'text-green-700' 
                                : isIncorrect 
                                  ? 'text-red-700' 
                                  : 'text-gray-700'
                            }>
                              {problem.right_items?.find(r => r.id === matchedRightId)?.text || matchedRightId}
                            </span>
                            {isSubmitted && (
                              <span className="ml-2">
                                {isCorrect && <span className="text-green-600">✓</span>}
                                {isIncorrect && <span className="text-red-600">✗</span>}
                              </span>
                            )}
                          </div>
                        )}
                        {isSubmitted && isIncorrect && evaluation?.expected_right_ids && (
                          <div className="mt-2 text-xs text-green-600">
                            Expected: {evaluation.expected_right_ids.map(rightId => 
                              problem.right_items?.find(r => r.id === rightId)?.text || rightId
                            ).join(' or ')}
                          </div>
                        )}
                      </div>
                      {matchedRightId && !isSubmitted && (
                        <button
                          onClick={() => {
                            const newMatches = (currentResponse?.student_matches || []).filter(m => m.left_id !== leftItem.id);
                            if (onUpdate) {
                              onUpdate({ student_matches: newMatches });
                            }
                          }}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Items */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800 mb-3">Options</h4>
              {problem.right_items?.map((rightItem) => {
                const isUsed = (currentResponse?.student_matches || []).some(m => m.right_id === rightItem.id);
                
                return (
                  <div
                    key={rightItem.id}
                    onClick={() => {
                      if (isSubmitted) return;
                      
                      // Simple click-to-match: find first unmatched left item
                      const unmatchedLeftItem = problem.left_items?.find(leftItem => 
                        !(currentResponse?.student_matches || []).some(m => m.left_id === leftItem.id)
                      );
                      
                      if (unmatchedLeftItem) {
                        const newMatches = [
                          ...(currentResponse?.student_matches || []).filter(m => m.right_id !== rightItem.id),
                          { left_id: unmatchedLeftItem.id, right_id: rightItem.id }
                        ];
                        if (onUpdate) {
                          onUpdate({ student_matches: newMatches });
                        }
                      }
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSubmitted
                        ? 'border-gray-300 bg-gray-50 cursor-default'
                        : isUsed
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <p className="font-medium">{rightItem.text}</p>
                    {rightItem.image_url && (
                      <img 
                        src={rightItem.image_url} 
                        alt={rightItem.text}
                        className="mt-2 max-w-full h-auto max-h-20 object-contain"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Show detailed feedback after submission */}
          {isSubmitted && feedback?.matchingReview && (
            <div className="space-y-2 mt-6">
              <h4 className="font-medium text-gray-800">Match Details:</h4>
              {feedback.matchingReview.match_evaluations.map(evaluation => (
                <div key={evaluation.left_id} className={`p-3 rounded-lg border ${
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
                        {problem.left_items?.find(l => l.id === evaluation.left_id)?.text || evaluation.left_id} → {problem.right_items?.find(r => r.id === evaluation.right_id)?.text || evaluation.right_id}
                      </p>
                      <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                        {evaluation.feedback}
                      </p>
                      {!evaluation.is_correct && evaluation.expected_right_ids?.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Expected: {evaluation.expected_right_ids.map(rightId => 
                            problem.right_items?.find(r => r.id === rightId)?.text || rightId
                          ).join(' or ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show rationale after submission */}
              {(problem.rationale_global || feedback?.matchingReview?.explanation) && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Explanation:</h4>
                  <p className="text-blue-700">{feedback.matchingReview.explanation}</p>
                  {problem.rationale_global && (
                    <p className="text-blue-700 mt-2">{problem.rationale_global}</p>
                  )}
                </div>
              )}
              
              {/* Show general feedback after submission */}
              {feedback?.review && (
                <div className="mt-4 space-y-3">
                  {feedback.review.feedback?.praise && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium">{feedback.review.feedback.praise}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.guidance && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-1">Guidance:</h4>
                      <p className="text-blue-700">{feedback.review.feedback.guidance}</p>
                    </div>
                  )}
                  {feedback.review.feedback?.encouragement && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 font-medium">{feedback.review.feedback.encouragement}</p>
                    </div>
                  )}
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