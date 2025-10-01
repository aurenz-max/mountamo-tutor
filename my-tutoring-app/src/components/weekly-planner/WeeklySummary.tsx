// components/weekly-planner/WeeklySummary.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Target,
  TrendingUp,
  Calendar,
  BarChart3,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import type { WeeklyPlan } from '@/lib/weeklyPlannerApi';
import { formatWeekRange, getDayName } from '@/lib/weeklyPlannerApi';

interface WeeklySummaryProps {
  weeklyPlan: WeeklyPlan;
}

export function WeeklySummary({ weeklyPlan }: WeeklySummaryProps) {
  const progressPercentage = weeklyPlan.total_activities > 0
    ? (weeklyPlan.completed_activities / weeklyPlan.total_activities) * 100
    : 0;

  const pendingActivities = weeklyPlan.planned_activities.filter(
    (a) => a.status === 'pending'
  ).length;

  // Group activities by day for distribution chart
  const activitiesByDay = Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: getDayName(i),
    count: weeklyPlan.planned_activities.filter((a) => a.planned_day === i).length,
    completed: weeklyPlan.planned_activities.filter(
      (a) => a.planned_day === i && a.status === 'completed'
    ).length,
  }));

  // Group activities by subject
  const activitiesBySubject = weeklyPlan.planned_activities.reduce(
    (acc, activity) => {
      acc[activity.subject] = (acc[activity.subject] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const subjects = Object.entries(activitiesBySubject).map(([subject, count]) => ({
    subject,
    count,
    percentage: (count / weeklyPlan.total_activities) * 100,
  }));

  const weekRange = formatWeekRange(weeklyPlan.week_start_date);

  return (
    <div className="space-y-6">
      {/* Week Theme Header */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardDescription className="text-sm font-medium text-purple-700">
                  Weekly Theme
                </CardDescription>
              </div>
              <CardTitle className="text-2xl text-gray-900 mb-3">
                {weeklyPlan.weekly_theme}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-sm">
              {weekRange}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Objectives */}
      {weeklyPlan.weekly_objectives && weeklyPlan.weekly_objectives.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Weekly Objectives</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {weeklyPlan.weekly_objectives.map((objective, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{objective}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Weekly Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Overall Completion</span>
                <span className="text-2xl font-bold text-blue-600">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                <span>{weeklyPlan.completed_activities} completed</span>
                <span>{weeklyPlan.total_activities} total</span>
              </div>
            </div>

            {/* Activity Status Breakdown */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {weeklyPlan.assigned_activities}
                </div>
                <div className="text-xs text-gray-600">Assigned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {pendingActivities}
                </div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {weeklyPlan.completed_activities}
                </div>
                <div className="text-xs text-gray-600">Done</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities by Day Distribution */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Weekly Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activitiesByDay
              .filter((day) => day.count > 0)
              .map((day) => {
                const dayProgress = day.count > 0 ? (day.completed / day.count) * 100 : 0;
                return (
                  <div key={day.dayIndex}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {day.dayName}
                      </span>
                      <span className="text-xs text-gray-600">
                        {day.completed}/{day.count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${dayProgress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Subject Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Subject Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {subjects.map(({ subject, count, percentage }) => (
              <div key={subject}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {subject}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {count} {count === 1 ? 'activity' : 'activities'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Model Info (footer) */}
      <div className="text-xs text-gray-500 text-center">
        Generated by {weeklyPlan.generation_model} on{' '}
        {new Date(weeklyPlan.generated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

export default WeeklySummary;
