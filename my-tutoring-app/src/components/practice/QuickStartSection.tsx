import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PracticeActivityCard } from './PracticeActivityCard';
import { ActivityCardSkeleton } from './ActivityCardSkeleton';
import { useDailyActivities, DailyActivity } from '@/lib/dailyActivitiesAPI';

interface QuickStartSectionProps {
  studentId: number;
  getAuthToken: () => Promise<string | null>;
  onActivitySelect: (activity: DailyActivity) => void;
  onMarkComplete?: (activityId: string, pointsEarned?: number) => void;
}

export function QuickStartSection({
  studentId,
  getAuthToken,
  onActivitySelect,
  onMarkComplete
}: QuickStartSectionProps) {
  const {
    dailyPlan,
    loading,
    error,
    refreshPlan,
    completeActivity,
    isCompleting
  } = useDailyActivities({
    studentId,
    getAuthToken,
    autoRefresh: false
  });

  const handleStartPractice = (activityId: string) => {
    const activity = dailyPlan?.activities.find(a => a.id === activityId);
    if (activity) {
      onActivitySelect(activity);
    }
  };

  const handleMarkComplete = async (activityId: string) => {
    const activity = dailyPlan?.activities.find(a => a.id === activityId);
    const pointsEarned = activity?.points || 0;

    await completeActivity(activityId, pointsEarned);
    if (onMarkComplete) {
      onMarkComplete(activityId, pointsEarned);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recommended for You</CardTitle>
              <CardDescription>Personalized practice activities</CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActivityCardSkeleton />
            <ActivityCardSkeleton />
            <ActivityCardSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !dailyPlan || dailyPlan.activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommended for You</CardTitle>
          <CardDescription>Personalized practice activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-3" />
            <p className="text-foreground mb-4">
              {error ? error : 'No personalized activities available right now.'}
            </p>
            {error && (
              <Button
                onClick={refreshPlan}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            {!error && (
              <p className="text-sm text-muted-foreground">
                Browse topics below to start practicing
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = dailyPlan.progress;
  const completedCount = progress.completed_activities;
  const totalCount = progress.total_activities;
  const progressPercentage = progress.progress_percentage;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle>Recommended for You</CardTitle>
              <span className="text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                {completedCount} / {totalCount} completed
              </span>
            </div>
            <CardDescription className="mt-1">
              {dailyPlan.total_points} points available today
            </CardDescription>
          </div>
          <Button
            onClick={refreshPlan}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 mt-4">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(progressPercentage)}% complete
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Activity cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyPlan.activities.map((activity) => (
            <PracticeActivityCard
              key={activity.id}
              activityData={activity}
              onStartPractice={handleStartPractice}
              onMarkComplete={handleMarkComplete}
              loading={isCompleting === activity.id}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
