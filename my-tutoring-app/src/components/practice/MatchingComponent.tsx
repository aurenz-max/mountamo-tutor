'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface AssocItem {
  id: string;
  text: string;
  image_url?: string;
  metadata?: { [key: string]: string };
}

interface LeftToRightMapping {
  left_id: string;
  right_ids: string[];
  rationale?: string;
}

interface MatchingQuestion {
  id: string;
  subject: string;
  unit_id: string;
  skill_id: string;
  subskill_id: string;
  difficulty: string;
  prompt: string;
  left_items: AssocItem[];
  right_items: AssocItem[];
  mappings: LeftToRightMapping[];
  allow_many_to_one: boolean;
  include_distractors: boolean;
  shuffle_left: boolean;
  shuffle_right: boolean;
  rationale_global?: string;
  metadata: {
    concept_group?: string;
    detailed_objective?: string;
    [key: string]: any;
  };
}

interface StudentMatching {
  left_id: string;
  right_id: string;
}

interface MatchingSubmission {
  matching: MatchingQuestion;
  student_matches: StudentMatching[];
}

interface MatchingEvaluation {
  left_id: string;
  right_id: string;
  is_correct: boolean;
  expected_right_ids: string[];
  feedback?: string;
}

interface MatchingReview {
  overall_correct: boolean;
  total_score: number;
  match_evaluations: MatchingEvaluation[];
  explanation: string;
  percentage_correct: number;
  metadata: {
    matching_id: string;
    [key: string]: any;
  };
}

interface MatchingComponentProps {
  matching: MatchingQuestion;
  onNext?: () => void;
  onComplete?: (review: MatchingReview) => void;
  onNewQuestion?: () => void;
}

const MatchingComponent: React.FC<MatchingComponentProps> = ({
  matching,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [matches, setMatches] = useState<{ [leftId: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<MatchingReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleMatch = useCallback((leftId: string, rightId: string) => {
    if (submitted) return;
    
    setMatches(prev => ({
      ...prev,
      [leftId]: rightId
    }));
  }, [submitted]);

  const handleClearMatch = useCallback((leftId: string) => {
    if (submitted) return;
    
    setMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[leftId];
      return newMatches;
    });
  }, [submitted]);

  const handleSubmit = async () => {
    // Check if all left items are matched
    const unmatchedItems = matching.left_items.filter(item => !matches[item.id]);
    if (unmatchedItems.length > 0) {
      setError(`Please match all items before submitting. ${unmatchedItems.length} items remaining.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare student matches
      const studentMatches: StudentMatching[] = Object.entries(matches).map(([leftId, rightId]) => ({
        left_id: leftId,
        right_id: rightId
      }));

      // Convert to universal problem submission format
      const problemData = {
        subject: matching.subject,
        problem: {
          id: matching.id,
          skill_id: matching.skill_id,
          subskill_id: matching.subskill_id,
          problem_data: {
            full_problem_data: {
              left_items: matching.left_items,
              right_items: matching.right_items,
              correct_matches: matching.correct_matches,
              difficulty: matching.difficulty,
              rationale: matching.rationale
            }
          }
        },
        skill_id: matching.skill_id,
        subskill_id: matching.subskill_id,
        student_answer: JSON.stringify(studentMatches),
        canvas_used: false
      };

      const reviewResult = await authApi.submitProblem(problemData);
      
      // Convert response to Matching format for compatibility (simplified)
      const matchingReview: MatchingReview = {
        overall_correct: reviewResult.review?.correct || false,
        match_evaluations: studentMatches.map(match => ({
          left_id: match.left_id,
          right_id: match.right_id,
          is_correct: true, // Would need proper evaluation logic
          feedback: reviewResult.review?.feedback?.guidance || ''
        })),
        total_score: reviewResult.review?.score || 0,
        percentage_correct: reviewResult.review?.correct ? 100 : 0,
        explanation: reviewResult.review?.feedback?.guidance || matching.rationale,
        metadata: {
          question_id: matching.id,
          submitted_at: new Date().toISOString(),
          evaluation_method: 'universal_submission_service'
        }
      };

      setReview(matchingReview);
      setSubmitted(true);

      if (onComplete) {
        onComplete(matchingReview);
      }
    } catch (err: any) {
      console.error('Error submitting matching problem:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setMatches({});
    setSubmitted(false);
    setReview(null);
    setError(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  const getLeftItemText = (leftId: string) => {
    const item = matching.left_items.find(item => item.id === leftId);
    return item ? item.text : leftId;
  };

  const getRightItemText = (rightId: string) => {
    const item = matching.right_items.find(item => item.id === rightId);
    return item ? item.text : rightId;
  };

  const isCorrectMatch = (leftId: string, rightId: string) => {
    if (!submitted || !review) return false;
    const evaluation = review.match_evaluations.find(e => e.left_id === leftId);
    return evaluation?.is_correct && evaluation?.right_id === rightId;
  };

  const isIncorrectMatch = (leftId: string, rightId: string) => {
    if (!submitted || !review) return false;
    const evaluation = review.match_evaluations.find(e => e.left_id === leftId);
    return !evaluation?.is_correct && evaluation?.right_id === rightId;
  };

  const getExpectedMatches = (leftId: string): string[] => {
    if (!submitted || !review) return [];
    const evaluation = review.match_evaluations.find(e => e.left_id === leftId);
    return evaluation?.expected_right_ids || [];
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, rightId: string) => {
    setDraggedItem(rightId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, leftId: string) => {
    e.preventDefault();
    if (draggedItem) {
      handleMatch(leftId, draggedItem);
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {matching.prompt}
          </h3>
          {matching.metadata.concept_group && (
            <div className="flex items-center text-sm text-blue-600 mb-2">
              <BookOpen className="w-4 h-4 mr-1" />
              <span>Topic: {matching.metadata.concept_group}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            matching.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : matching.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {matching.difficulty}
          </span>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            {matching.skill_id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800 mb-3">Items to Match</h4>
          {matching.left_items.map((leftItem) => {
            const matchedRightId = matches[leftItem.id];
            const isCorrect = matchedRightId ? isCorrectMatch(leftItem.id, matchedRightId) : false;
            const isIncorrect = matchedRightId ? isIncorrectMatch(leftItem.id, matchedRightId) : false;
            const expectedMatches = getExpectedMatches(leftItem.id);

            return (
              <div
                key={leftItem.id}
                className={`p-4 rounded-lg border-2 border-dashed transition-colors ${
                  isCorrect
                    ? 'border-green-300 bg-green-50'
                    : isIncorrect
                      ? 'border-red-300 bg-red-50'
                      : draggedItem
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, leftItem.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{leftItem.text}</p>
                    {matchedRightId && (
                      <div className="mt-2 flex items-center">
                        <ArrowRight className="w-4 h-4 text-gray-400 mr-2" />
                        <span className={`text-sm ${
                          isCorrect 
                            ? 'text-green-700' 
                            : isIncorrect 
                              ? 'text-red-700' 
                              : 'text-gray-700'
                        }`}>
                          {getRightItemText(matchedRightId)}
                        </span>
                        {submitted && (
                          <span className="ml-2">
                            {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {isIncorrect && <XCircle className="w-4 h-4 text-red-600" />}
                          </span>
                        )}
                      </div>
                    )}
                    {submitted && isIncorrect && expectedMatches.length > 0 && (
                      <div className="mt-2 text-xs text-green-600">
                        Expected: {expectedMatches.map(rightId => getRightItemText(rightId)).join(' or ')}
                      </div>
                    )}
                  </div>
                  {matchedRightId && !submitted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearMatch(leftItem.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-800 mb-3">Options</h4>
          {matching.right_items.map((rightItem) => {
            const isUsed = Object.values(matches).includes(rightItem.id);
            
            return (
              <div
                key={rightItem.id}
                draggable={!submitted}
                onDragStart={(e) => handleDragStart(e, rightItem.id)}
                onDragEnd={handleDragEnd}
                className={`p-4 rounded-lg border cursor-move transition-all ${
                  submitted
                    ? isUsed
                      ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-default'
                      : 'border-gray-300 bg-gray-50 cursor-default'
                    : isUsed
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
                } ${draggedItem === rightItem.id ? 'opacity-50' : ''}`}
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button
          onClick={handleNewQuestion}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Question
        </Button>

        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={loading || Object.keys(matches).length !== matching.left_items.length}
            className="px-6"
          >
            {loading ? 'Submitting...' : 'Submit Matches'}
          </Button>
        ) : (
          <>
            {onNext && (
              <Button
                onClick={onNext}
                className="px-6"
              >
                Next Question
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderFeedback = () => {
    if (!review) return null;

    const correctCount = review.match_evaluations.filter(e => e.is_correct).length;
    const totalCount = review.match_evaluations.length;

    return (
      <div className="mt-6 space-y-4">
        <Alert className={review.overall_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center">
            {review.overall_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
            )}
            <AlertDescription className={review.overall_correct ? 'text-green-800' : 'text-red-800'}>
              <strong>
                {review.overall_correct ? 'Perfect Match!' : 'Some matches need work'}
              </strong>
              {` You got ${correctCount} out of ${totalCount} matches correct (${review.percentage_correct.toFixed(1)}%)`}
            </AlertDescription>
          </div>
        </Alert>

        {/* Individual match feedback */}
        {review.match_evaluations.some(e => !e.is_correct) && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Match Details:</h4>
            {review.match_evaluations.map(evaluation => (
              <div key={evaluation.left_id} className={`p-3 rounded-lg border ${
                evaluation.is_correct 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {evaluation.is_correct ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold ${evaluation.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                      {getLeftItemText(evaluation.left_id)} → {getRightItemText(evaluation.right_id)}
                    </p>
                    <p className={`text-sm ${evaluation.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                      {evaluation.feedback}
                    </p>
                    {!evaluation.is_correct && evaluation.expected_right_ids.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Expected: {evaluation.expected_right_ids.map(rightId => getRightItemText(rightId)).join(' or ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Explanation:</p>
              <p className="text-gray-700">{review.explanation}</p>
              {matching.rationale_global && (
                <p className="text-gray-700 mt-2">{matching.rationale_global}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="w-6 h-6" />
          Concept Matching
        </CardTitle>
        {matching.metadata.detailed_objective && (
          <p className="text-sm text-gray-600">
            Learning Objective: {matching.metadata.detailed_objective}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default MatchingComponent;