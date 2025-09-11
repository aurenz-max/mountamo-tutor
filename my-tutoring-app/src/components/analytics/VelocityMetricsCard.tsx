"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { VelocityMetric, VelocityMetricsResponse } from '@/lib/studentAnalyticsAPI';
import { useSubjectRecommendations } from '@/hooks/useSubjectRecommendations';

interface VelocityMetricsCardProps {
  data: VelocityMetricsResponse | null;
  loading: boolean;
  error: string | null;
  studentId?: number;
  onActivitySelect?: (subskillId: string, subject: string) => void;
}

interface SubjectRecommendationsSectionProps {
  metric: VelocityMetric;
  studentId: number;
  onActivitySelect?: (subskillId: string, subject: string) => void;
  loadingActivity?: string | null;
  setLoadingActivity?: (activityId: string | null) => void;
}

const getVelocityStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'significantly ahead':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'on track':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'slightly behind':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'behind':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'significantly behind':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getVelocityIcon = (daysAheadBehind: number) => {
  if (daysAheadBehind > 0) {
    return <TrendingUp className="h-4 w-4 text-green-600" />;
  } else if (daysAheadBehind < 0) {
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  } else {
    return <Target className="h-4 w-4 text-blue-600" />;
  }
};

const formatDaysAheadBehind = (days: number): string => {
  const absDays = Math.abs(days);
  if (days > 0) {
    return `${absDays.toFixed(1)} days ahead`;
  } else if (days < 0) {
    return `${absDays.toFixed(1)} days behind`;
  } else {
    return 'On schedule';
  }
};

// Component for showing subject recommendations when behind
const SubjectRecommendationsSection: React.FC<SubjectRecommendationsSectionProps> = ({ 
  metric, 
  studentId, 
  onActivitySelect,
  loadingActivity,
  setLoadingActivity
}) => {
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  // Only show recommendations for subjects that are behind
  const isBehind = metric.velocity_status.includes('Behind');
  
  const {
    data: recommendations,
    loading: recLoading,
    error: recError
  } = useSubjectRecommendations(
    isBehind && showRecommendations ? studentId : null,
    isBehind && showRecommendations ? metric.subject : null
  );

  if (!isBehind) {
    return null;
  }

  const handleRecommendationClick = async (subskillId: string) => {
    setLoadingActivity?.(subskillId);
    try {
      await onActivitySelect?.(subskillId, metric.subject);
    } finally {
      setLoadingActivity?.(null);
    }
  };

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowRecommendations(!showRecommendations)}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 p-0 h-auto font-normal"
      >
        <Target className="w-4 h-4" />
        <span className="text-sm">
          {recLoading 
            ? 'Loading recommendations...' 
            : `Get ${metric.subject} catch-up activities`
          }
        </span>
        {!recLoading && (showRecommendations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </Button>

      {showRecommendations && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-blue-200">
          {recError && (
            <div className="text-red-600 text-sm py-2">
              Failed to load recommendations. Please try again.
            </div>
          )}
          
          {recLoading && (
            <div className="flex items-center gap-2 text-gray-600 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Finding the best activities for you...</span>
            </div>
          )}
          
          {recommendations?.recommendations?.map((rec, index) => (
            <div
              key={rec.subskill_id}
              className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h6 className="font-medium text-blue-900">
                      {rec.skill_description}
                    </h6>
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                      #{rec.priority_rank}
                    </Badge>
                  </div>
                  <p className="text-blue-700 mb-2">{rec.subskill_description}</p>
                  <div className="flex items-start gap-2 mb-2">
                    <Lightbulb className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 italic">"{rec.engagement_hook}"</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-blue-600">
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {rec.estimated_time_minutes} min
                    </div>
                    {rec.difficulty_level && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        {rec.difficulty_level}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRecommendationClick(rec.subskill_id)}
                  disabled={loadingActivity === rec.subskill_id}
                  className="ml-3 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loadingActivity === rec.subskill_id ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Start'
                  )}
                </Button>
              </div>
            </div>
          ))}
          
          {recommendations && recommendations.recommendations.length === 0 && (
            <div className="text-gray-600 text-sm py-2">
              No specific recommendations available for {metric.subject} right now.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const VelocityMetricsCard: React.FC<VelocityMetricsCardProps> = ({ 
  data, 
  loading, 
  error, 
  studentId,
  onActivitySelect
}) => {
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null);
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Learning Velocity
          </CardTitle>
          <CardDescription>Your learning pace compared to expected progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-20 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Learning Velocity
          </CardTitle>
          <CardDescription>Your learning pace compared to expected progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-2">Failed to load velocity metrics</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.metrics || data.metrics.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Learning Velocity
          </CardTitle>
          <CardDescription>Your learning pace compared to expected progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-2">No velocity data available</p>
            <p className="text-sm text-gray-500">Complete some learning activities to see your progress velocity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall velocity metrics
  const totalProgress = data.metrics.reduce((sum, metric) => sum + metric.actual_progress, 0);
  const totalExpected = data.metrics.reduce((sum, metric) => sum + metric.expected_progress, 0);
  const totalSubskills = data.metrics.reduce((sum, metric) => sum + metric.total_subskills, 0);
  const overallVelocityPercentage = totalExpected > 0 ? (totalProgress / totalExpected) * 100 : 0;
  const averageDaysAheadBehind = data.metrics.reduce((sum, metric) => sum + metric.days_ahead_behind, 0) / data.metrics.length;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Learning Velocity
        </CardTitle>
        <CardDescription>
          Your learning pace compared to expected progress
          {data.last_updated && (
            <span className="block text-xs text-gray-400 mt-1">
              Last updated: {new Date(data.last_updated).toLocaleDateString()} at {new Date(data.last_updated).toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Overall Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
          <div className="flex items-center gap-3">
            {getVelocityIcon(averageDaysAheadBehind)}
            <div>
              <div className="text-2xl font-bold">
                {formatDaysAheadBehind(averageDaysAheadBehind)}
              </div>
              <div className="text-sm text-gray-600">
                {overallVelocityPercentage.toFixed(1)}% velocity ({totalProgress}/{totalSubskills} completed)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Overall Progress</div>
            <Progress 
              value={(totalProgress / totalSubskills) * 100} 
              className="w-32 h-2 mt-1"
            />
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3">Subject Breakdown</h4>
          {data.metrics.map((metric: VelocityMetric, index: number) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{metric.subject}</span>
                    <Badge className={getVelocityStatusColor(metric.velocity_status)}>
                      {metric.velocity_status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {metric.actual_progress}/{metric.total_subskills} subskills completed
                  </div>
                </div>
                <div className="text-right min-w-0 ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    {getVelocityIcon(metric.days_ahead_behind)}
                    <span className="text-sm font-medium">
                      {formatDaysAheadBehind(metric.days_ahead_behind)}
                    </span>
                  </div>
                  <div className="w-24">
                    <Progress 
                      value={metric.velocity_percentage > 100 ? 100 : metric.velocity_percentage}
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {metric.velocity_percentage.toFixed(1)}% velocity
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Subject Recommendations Section - Only for behind subjects */}
              {studentId && (
                <SubjectRecommendationsSection 
                  metric={metric}
                  studentId={studentId}
                  onActivitySelect={onActivitySelect}
                  loadingActivity={loadingActivity}
                  setLoadingActivity={setLoadingActivity}
                />
              )}
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {loadingActivity && (
          <div className="mt-4 text-center py-4 border-t">
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Finding or creating your learning content...</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t">
          <button 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            onClick={() => {
              // Could navigate to detailed analytics or open a modal
              console.log('View detailed velocity analytics');
            }}
          >
            View Detailed Analytics →
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VelocityMetricsCard;