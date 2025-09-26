'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Target, ArrowRight } from 'lucide-react';
import { AssessmentSummaryData, AssessmentAIInsights, AssessmentSkillAnalysisItem } from '@/types/assessment';

interface AtAGlanceHeaderProps {
  summary?: AssessmentSummaryData;
  aiInsights?: AssessmentAIInsights;
  skillAnalysis?: AssessmentSkillAnalysisItem[];
}

const AtAGlanceHeader: React.FC<AtAGlanceHeaderProps> = ({
  summary,
  aiInsights,
  skillAnalysis
}) => {
  if (!summary || !aiInsights) {
    return null;
  }

  const scorePercentage = summary.score_percentage;
  const primaryNextStep = skillAnalysis?.[0]?.next_step;

  // Determine score color based on performance
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackgroundColor = (score: number) => {
    if (score >= 90) return 'from-green-100 to-green-50';
    if (score >= 70) return 'from-blue-100 to-blue-50';
    if (score >= 50) return 'from-yellow-100 to-yellow-50';
    return 'from-red-100 to-red-50';
  };

  return (
    <Card className={`p-8 mb-6 bg-gradient-to-r ${getScoreBackgroundColor(scorePercentage)} border-l-4 ${scorePercentage >= 70 ? 'border-l-blue-500' : 'border-l-yellow-500'}`}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Score Display */}
        <div className="flex items-center gap-6">
          <div className="relative">
            {/* Radial Progress Circle */}
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${scorePercentage * 2.51}, 251`}
                  className={getScoreColor(scorePercentage)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${getScoreColor(scorePercentage)}`}>
                  {Math.round(scorePercentage)}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className={`h-5 w-5 ${getScoreColor(scorePercentage)}`} />
              <span className="text-sm text-gray-600">
                {summary.correct_count} of {summary.total_questions} correct
              </span>
            </div>
            <p className="text-base lg:text-lg font-medium text-gray-900 max-w-md break-words">
              {aiInsights.performance_quote}
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        {primaryNextStep && (
          <div className="flex flex-col items-center lg:items-end gap-3 lg:max-w-xs">
            <div className="text-center lg:text-right">
              <p className="text-sm text-gray-600 mb-1">Recommended Next Step:</p>
              <p className="text-sm font-medium text-gray-900 break-words">{skillAnalysis?.[0]?.skill_name}</p>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex items-center gap-2 text-sm w-full lg:w-auto max-w-sm"
              onClick={() => window.open(primaryNextStep.link, '_blank')}
            >
              <Target className="h-4 w-4 flex-shrink-0" />
              <span className="truncate flex-1 text-center lg:text-left">
                {primaryNextStep.text}
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AtAGlanceHeader;