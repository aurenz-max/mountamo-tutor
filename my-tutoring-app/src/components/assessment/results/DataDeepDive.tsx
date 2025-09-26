'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { AssessmentSummaryData } from '@/types/assessment';

interface DataDeepDiveProps {
  summary?: AssessmentSummaryData;
}

const DataDeepDive: React.FC<DataDeepDiveProps> = ({ summary }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary) {
    return null;
  }

  const renderPerformanceChart = (
    data: Record<string, { percentage: number; correct: number; total: number }>,
    title: string,
    icon: React.ReactNode
  ) => {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h4 className="font-semibold text-gray-900">{title}</h4>
        </div>
        <div className="space-y-3">
          {entries.map(([category, stats]) => {
            const percentage = Math.round(stats.percentage);
            const getBarColor = (pct: number) => {
              if (pct >= 80) return 'bg-green-500';
              if (pct >= 60) return 'bg-blue-500';
              if (pct >= 40) return 'bg-yellow-500';
              return 'bg-red-500';
            };

            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700 capitalize">
                    {category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-600">
                    {stats.correct}/{stats.total} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getBarColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMetricsGrid = () => {
    const metrics = summary.detailed_metrics;
    if (!metrics) return null;

    const formatMetricKey = (key: string) => {
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    };

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Key Metrics</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded border">
              <div className="text-sm text-gray-600 mb-1">
                {formatMetricKey(key)}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {typeof value === 'number' ? value : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Detailed Analytics</h3>
          <p className="text-gray-600 text-sm">
            {isExpanded ? 'Dive into the data behind your results' : 'Click to explore performance data and analytics'}
          </p>
        </div>
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
          className="flex items-center gap-2"
        >
          {isExpanded ? (
            <>
              Hide Details
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show Details
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-6 mt-6 pt-6 border-t border-gray-200">
          {/* Performance by Category */}
          {summary.performance_by_category &&
            Object.keys(summary.performance_by_category).length > 0 && (
            <div>
              {renderPerformanceChart(
                summary.performance_by_category,
                'Performance by Skill Category',
                <BarChart3 className="h-5 w-5 text-blue-600" />
              )}
            </div>
          )}

          {/* Performance by Problem Type */}
          {summary.performance_by_problem_type &&
            Object.keys(summary.performance_by_problem_type).length > 0 && (
            <div>
              {renderPerformanceChart(
                summary.performance_by_problem_type,
                'Performance by Question Type',
                <PieChart className="h-5 w-5 text-green-600" />
              )}
            </div>
          )}

          {/* Key Metrics Grid */}
          {summary.detailed_metrics && (
            <div>
              {renderMetricsGrid()}
            </div>
          )}

          {/* Summary Stats Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-3">Assessment Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {summary.correct_count}
                </div>
                <div className="text-sm text-gray-600">Questions Correct</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {summary.total_questions}
                </div>
                <div className="text-sm text-gray-600">Total Questions</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {Math.round(summary.score_percentage)}%
                </div>
                <div className="text-sm text-gray-600">Overall Score</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DataDeepDive;