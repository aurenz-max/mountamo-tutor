'use client';

import React from 'react';
import { Trophy, Target, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProblemRenderer from '@/components/practice/ProblemRenderer';
import XPCounter from '@/components/engagement/XPCounter';
import StreakCounter from '@/components/engagement/StreakCounter';

interface BatchSubmissionResult {
  problem_id: string;
  review: {
    observation: {
      selected_answer: string;
      work_shown: string;
    };
    analysis: {
      understanding: string;
      approach: string;
    };
    evaluation: {
      score: number;
      justification: string;
    };
    feedback: {
      praise: string;
      guidance: string;
      encouragement: string;
    };
  };
  score: number;
  correct: boolean;
}

interface BatchAssessmentResultsProps {
  batchSubmission: {
    batch_id: string;
    submission_results: BatchSubmissionResult[];
    xp_earned: number;
    level_up: boolean;
    current_streak: number;
    current_level?: number;
    total_xp?: number;
  };
}

const BatchAssessmentResults: React.FC<BatchAssessmentResultsProps> = ({ batchSubmission }) => {
  const {
    submission_results,
    xp_earned,
    level_up,
    current_streak,
    current_level,
    total_xp
  } = batchSubmission;

  const correctCount = submission_results.filter(result => result.correct).length;
  const totalCount = submission_results.length;
  const scorePercentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Good';
    if (percentage >= 70) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Summary */}
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-4">Your Performance</CardTitle>
          <div className={`inline-flex items-center px-6 py-3 rounded-full text-2xl font-bold ${getScoreColor(scorePercentage)}`}>
            {correctCount} / {totalCount} ({scorePercentage.toFixed(1)}%)
          </div>
          <Badge variant="outline" className="mt-2 text-lg px-4 py-1">
            {getScoreLabel(scorePercentage)}
          </Badge>
        </CardHeader>
      </Card>

      {/* Engagement Summary */}
      {(xp_earned > 0 || level_up || current_streak > 0) && (
        <Card className="shadow-lg border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-700">
              <Trophy className="h-6 w-6 mr-2" />
              Rewards Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {xp_earned > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    +{xp_earned} XP
                  </div>
                  <div className="text-sm text-gray-600">Experience Points</div>
                </div>
              )}

              {current_streak > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {current_streak} Day{current_streak !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-gray-600">Learning Streak</div>
                </div>
              )}

              {current_level && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    Level {current_level}
                  </div>
                  <div className="text-sm text-gray-600">
                    {level_up ? 'Level Up!' : 'Current Level'}
                  </div>
                </div>
              )}
            </div>

            {total_xp && (
              <div className="mt-6 flex justify-center">
                <XPCounter
                  currentXP={total_xp}
                  size="lg"
                  animate={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Problem Reviews */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-6 w-6 mr-2" />
            Problem-by-Problem Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {submission_results.map((result, index) => (
            <ProblemReviewCard
              key={result.problem_id || index}
              problemId={result.problem_id}
              review={result.review}
              score={result.score}
              isCorrect={result.correct}
              problemIndex={index + 1}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

interface ProblemReviewCardProps {
  problemId: string;
  review: BatchSubmissionResult['review'];
  score: number;
  isCorrect: boolean;
  problemIndex: number;
}

const ProblemReviewCard: React.FC<ProblemReviewCardProps> = ({
  problemId,
  review,
  score,
  isCorrect,
  problemIndex
}) => {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-lg">Problem {problemIndex}</h4>
        <div className="flex items-center space-x-2">
          <Badge
            variant={isCorrect ? "default" : "destructive"}
            className={isCorrect ? "bg-green-600" : "bg-red-600"}
          >
            {isCorrect ? "Correct" : "Incorrect"} ({score}/100)
          </Badge>
        </div>
      </div>

      {/* Analysis and Feedback */}
      <div className="space-y-3">
        {review.analysis && (
          <div className="bg-blue-50 p-3 rounded-md">
            <h5 className="text-sm font-medium text-blue-900 mb-1">Analysis</h5>
            <p className="text-sm text-blue-800">{review.analysis.understanding}</p>
            {review.analysis.approach && (
              <p className="text-sm text-blue-700 mt-1">Approach: {review.analysis.approach}</p>
            )}
          </div>
        )}

        {review.feedback && (
          <div className="bg-purple-50 p-3 rounded-md border-l-4 border-purple-200">
            <h5 className="text-sm font-medium text-purple-900 mb-1">Feedback</h5>
            <div className="space-y-2">
              {review.feedback.praise && (
                <p className="text-sm text-purple-800">{review.feedback.praise}</p>
              )}
              {review.feedback.guidance && (
                <p className="text-sm text-purple-800">{review.feedback.guidance}</p>
              )}
              {review.feedback.encouragement && (
                <p className="text-sm text-purple-700 italic">{review.feedback.encouragement}</p>
              )}
            </div>
          </div>
        )}

        {review.evaluation && review.evaluation.justification && (
          <div className="bg-gray-100 p-3 rounded-md">
            <h5 className="text-sm font-medium text-gray-900 mb-1">Evaluation</h5>
            <p className="text-sm text-gray-700">{review.evaluation.justification}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchAssessmentResults;