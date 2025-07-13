'use client';

import React from 'react';
import { Zap, Headphones, Target, Eye, Brain, RefreshCw, Calendar, Star } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { useDailyActivities, DailyActivity, DailyPlan, ActivityUtils } from '@/lib/dailyActivitiesAPI';
import { useAuth } from '@/contexts/AuthContext';

interface DailyActivitiesDisplayProps {
  studentId?: number;
  className?: string;
  onActivityClick?: (activity: DailyActivity) => void;
}

const DailyActivitiesDisplay: React.FC<DailyActivitiesDisplayProps> = ({
  studentId,
  className = '',
  onActivityClick
}) => {
  const { getAuthToken, userProfile } = useAuth();
  
  const finalStudentId = studentId || userProfile?.student_id;
  
  const {
    dailyPlan,
    loading,
    error,
    refreshPlan,
    completeActivity,
    isCompleting
  } = useDailyActivities({
    studentId: finalStudentId!,
    getAuthToken,
    autoRefresh: true
  });

  // Activity type icons
  const getActivityIcon = (type: string) => {
    const icons = {
      practice: Zap,
      tutoring: Headphones,
      pathway: Target,
      visual: Eye,
      review: Brain
    };
    return icons[type as keyof typeof icons] || Zap;
  };

  // Handle activity completion
  const handleCompleteActivity = async (activity: DailyActivity) => {
    try {
      await completeActivity(activity.id, activity.points);
    } catch (error) {
      console.error('Failed to complete activity:', error);
    }
  };

  // Handle activity click
  const handleActivityClick = (activity: DailyActivity) => {
    if (onActivityClick) {
      onActivityClick(activity);
    } else {
      // Default behavior - navigate to activity endpoint
      window.location.href = activity.endpoint;
    }
  };

  if (!finalStudentId) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please log in to view your daily activities.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading your personalized plan...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-3">
            <p className="text-red-600">Error loading daily activities: {error}</p>
            <Button onClick={refreshPlan} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dailyPlan) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No daily plan available.</p>
          <Button onClick={refreshPlan} variant="outline" size="sm" className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completedCount = dailyPlan.progress.completed_activities;
  const totalCount = dailyPlan.progress.total_activities;
  const progressPercentage = ActivityUtils.calculateProgress(completedCount, totalCount);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Today's Learning Plan
            </CardTitle>
            <div className="flex items-center space-x-2">
              {dailyPlan.personalization_source === 'bigquery_recommendations' && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
              )}
              <Button onClick={refreshPlan} variant="ghost" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Overview */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{completedCount}/{totalCount} activities</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{dailyPlan.total_points}</div>
                <div className="text-xs text-muted-foreground">Points Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{dailyPlan.progress.points_earned_today}</div>
                <div className="text-xs text-muted-foreground">Points Earned</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600 flex items-center justify-center">
                  <Star className="h-5 w-5 mr-1" />
                  {dailyPlan.progress.current_streak}
                </div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities by Time Slot */}
      {Object.entries(ActivityUtils.groupActivitiesByTimeSlot(dailyPlan.activities)).map(([timeSlot, activities]) => (
        <Card key={timeSlot}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg capitalize flex items-center">
              {timeSlot === 'morning' && <span className="mr-2">🌅</span>}
              {timeSlot === 'midday' && <span className="mr-2">☀️</span>}
              {timeSlot === 'afternoon' && <span className="mr-2">🌤️</span>}
              {timeSlot === 'evening' && <span className="mr-2">🌙</span>}
              {timeSlot}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                const isCompleted = activity.metadata?.completed || false;
                const isCurrentlyCompleting = isCompleting === activity.id;

                return (
                  <Card 
                    key={activity.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isCompleted ? 'opacity-60 bg-green-50 border-green-200' : ''
                    } ${ActivityUtils.getPriorityColor(activity.priority)}`}
                    onClick={() => !isCompleted && handleActivityClick(activity)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <IconComponent className="h-4 w-4" />
                            <h4 className="font-medium">{activity.title}</h4>
                            <Badge 
                              variant="outline" 
                              className={ActivityUtils.getActivityColor(activity.type)}
                            >
                              {activity.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {activity.description}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{activity.estimated_time}</span>
                            <span>{activity.points} points</span>
                            <span className="capitalize">{activity.priority} priority</span>
                            {activity.metadata?.from_recommendations && (
                              <Badge variant="secondary" className="text-xs">
                                AI-Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col items-end space-y-2">
                          {isCompleted ? (
                            <Badge variant="default" className="bg-green-600">
                              ✓ Complete
                            </Badge>
                          ) : (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteActivity(activity);
                              }}
                              disabled={isCurrentlyCompleting}
                              variant="outline"
                              size="sm"
                            >
                              {isCurrentlyCompleting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                'Mark Complete'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Daily Goal Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Points towards daily goal</span>
              <span>{dailyPlan.progress.points_earned_today}/{dailyPlan.progress.daily_goal}</span>
            </div>
            <Progress 
              value={ActivityUtils.calculateProgress(
                dailyPlan.progress.points_earned_today, 
                dailyPlan.progress.daily_goal
              )} 
              className="h-3" 
            />
            <div className="text-xs text-muted-foreground text-center">
              {dailyPlan.progress.daily_goal - dailyPlan.progress.points_earned_today > 0 
                ? `${dailyPlan.progress.daily_goal - dailyPlan.progress.points_earned_today} points to go!`
                : 'Daily goal completed! 🎉'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyActivitiesDisplay;