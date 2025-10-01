"use client";

import React, { useState, useEffect } from 'react';
import { useLinkedStudents } from '@/hooks/useParentPortal';
import { useWeeklyPlan, useActivityMutations, useWeeklyPlanGeneration } from '@/hooks/useWeeklyPlanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { WeeklySummary, DayView, WeeklyPlannerLoading } from '@/components/weekly-planner';
import { getDayName, formatWeekRange } from '@/lib/weeklyPlannerApi';

export default function WeeklyExplorerPage() {
  const { students } = useLinkedStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    students.length > 0 ? students[0] : null
  );
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() === 0 ? 0 : new Date().getDay() - 1); // 0=Monday
  const [isGenerating, setIsGenerating] = useState(false);

  const { weeklyPlan, loading, error, refetch } = useWeeklyPlan(selectedStudentId);
  const { markActivityComplete, toggleStarActivity } = useActivityMutations(selectedStudentId);
  const { generatePlan } = useWeeklyPlanGeneration(selectedStudentId);

  // Update selected student when students list changes
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0]);
    }
  }, [students, selectedStudentId]);

  const handleGeneratePlan = async () => {
    if (!selectedStudentId) return;

    setIsGenerating(true);
    try {
      await generatePlan({ force_regenerate: true });
      await refetch();
    } catch (error) {
      console.error('Failed to generate plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleStar = async (activityUid: string, isStarred: boolean) => {
    try {
      await toggleStarActivity(activityUid, isStarred, weeklyPlan?.week_start_date);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleComplete = async (activityUid: string) => {
    try {
      await markActivityComplete(activityUid, weeklyPlan?.week_start_date);
    } catch (error) {
      console.error('Failed to complete activity:', error);
    }
  };

  if (students.length === 0) {
    return null;
  }

  // Loading State
  if (loading) {
    return <WeeklyPlannerLoading />;
  }

  // Error State
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Failed to load weekly plan: {error.message}</p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No Plan State (with generation option)
  if (!weeklyPlan) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Weekly Learning Plan</h2>
          <p className="text-gray-600 mt-1">
            AI-powered weekly roadmap for personalized learning
          </p>
        </div>

        {/* No Plan Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Weekly Plan Yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Generate a personalized weekly learning plan to see a roadmap of activities
              tailored to your child's progress and learning goals.
            </p>
            <Button
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Weekly Plan
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="py-4">
            <div className="flex items-start space-x-3">
              <Lightbulb className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">About Weekly Plans</h3>
                <p className="text-sm text-gray-700">
                  Our AI analyzes your child's current progress and generates a strategic 5-day
                  learning plan with carefully selected activities. Plans adapt daily based on
                  actual performance, ensuring your child stays challenged but not overwhelmed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all activities for current view (could include catch-up and accelerate)
  const allDayActivities = weeklyPlan.planned_activities;

  const weekRange = formatWeekRange(weeklyPlan.week_start_date);

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Weekly Learning Plan</h2>
          <p className="text-gray-600 mt-1">{weekRange}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Week Navigation (Future feature) */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="px-3">This Week</Badge>
            <Button variant="outline" size="sm" disabled>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Regenerate Button */}
          <Button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            variant="outline"
            size="sm"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">How it works</h3>
              <p className="text-sm text-gray-700">
                Star activities to prioritize them in future plans. The daily plan adapts
                automatically based on your child's progress, pulling from this weekly roadmap.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">
            <Sparkles className="h-4 w-4 mr-2" />
            Weekly Summary
          </TabsTrigger>
          <TabsTrigger value="daily">
            <Calendar className="h-4 w-4 mr-2" />
            Daily View
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-6">
          <WeeklySummary weeklyPlan={weeklyPlan} />
        </TabsContent>

        {/* Daily View Tab */}
        <TabsContent value="daily" className="mt-6 space-y-6">
          {/* Day Selector */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: 5 }, (_, i) => {
                  const dayActivitiesCount = weeklyPlan.planned_activities.filter(
                    (a) => a.planned_day === i
                  ).length;
                  const completedCount = weeklyPlan.planned_activities.filter(
                    (a) => a.planned_day === i && a.status === 'completed'
                  ).length;

                  return (
                    <Button
                      key={i}
                      variant={selectedDay === i ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDay(i)}
                      className="flex-1 min-w-[100px]"
                    >
                      <div className="text-center">
                        <div className="font-semibold">{getDayName(i)}</div>
                        <div className="text-xs opacity-80">
                          {completedCount}/{dayActivitiesCount}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Day Activities */}
          <DayView
            dayIndex={selectedDay}
            date={
              new Date(
                new Date(weeklyPlan.week_start_date).getTime() + selectedDay * 24 * 60 * 60 * 1000
              ).toISOString().split('T')[0]
            }
            activities={allDayActivities}
            starredActivities={weeklyPlan.parent_starred_activities}
            onToggleStar={handleToggleStar}
            onComplete={handleComplete}
            showSections={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
