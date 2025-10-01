// components/weekly-planner/DayView.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityCard } from './ActivityCard';
import { Calendar, CheckCircle, Circle, Clock } from 'lucide-react';
import type { PlannedActivity } from '@/lib/weeklyPlannerApi';
import { getDayName } from '@/lib/weeklyPlannerApi';

interface DayViewProps {
  dayIndex: number;
  date?: string;
  activities: PlannedActivity[];
  starredActivities?: string[];
  onToggleStar?: (activityUid: string, isStarred: boolean) => void;
  onComplete?: (activityUid: string) => void;
  showSections?: boolean;
}

export function DayView({
  dayIndex,
  date,
  activities,
  starredActivities = [],
  onToggleStar,
  onComplete,
  showSections = true,
}: DayViewProps) {
  // Group activities by status for organized display
  const catchUpActivities = activities.filter(
    (a) => a.planned_day < dayIndex && (a.status === 'pending' || a.status === 'assigned')
  );
  const scheduledActivities = activities.filter(
    (a) => a.planned_day === dayIndex && (a.status === 'pending' || a.status === 'assigned')
  );
  const accelerateActivities = activities.filter(
    (a) => a.planned_day > dayIndex && a.status === 'pending'
  );
  const completedActivities = activities.filter(
    (a) => a.status === 'completed'
  );

  const totalActivities = activities.length;
  const completedCount = completedActivities.length;
  const pendingCount = activities.filter((a) => a.status === 'pending').length;
  const assignedCount = activities.filter((a) => a.status === 'assigned').length;

  const progressPercentage = totalActivities > 0 ? (completedCount / totalActivities) * 100 : 0;

  const dayName = getDayName(dayIndex);
  const displayDate = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="space-y-6">
      {/* Day Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">{dayName}</CardTitle>
                {displayDate && (
                  <CardDescription className="text-base">{displayDate}</CardDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{completedCount}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{totalActivities}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {totalActivities > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Day Progress</span>
                <span className="text-sm font-semibold text-blue-600">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Empty State */}
      {totalActivities === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Circle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No activities planned for this day</p>
          </CardContent>
        </Card>
      )}

      {/* Catch-Up Section (Activities from previous days) */}
      {showSections && catchUpActivities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="destructive" className="text-sm">
              Catch Up
            </Badge>
            <span className="text-sm text-gray-600">
              {catchUpActivities.length} {catchUpActivities.length === 1 ? 'activity' : 'activities'} from previous days
            </span>
          </div>
          <div className="space-y-3">
            {catchUpActivities.map((activity) => (
              <ActivityCard
                key={activity.activity_uid}
                activity={activity}
                isStarred={starredActivities.includes(activity.activity_uid)}
                onToggleStar={onToggleStar}
                onComplete={onComplete}
                showDay={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Section (Today's activities) */}
      {showSections && scheduledActivities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="default" className="text-sm">
              Scheduled for Today
            </Badge>
            <span className="text-sm text-gray-600">
              {scheduledActivities.length} {scheduledActivities.length === 1 ? 'activity' : 'activities'}
            </span>
          </div>
          <div className="space-y-3">
            {scheduledActivities.map((activity) => (
              <ActivityCard
                key={activity.activity_uid}
                activity={activity}
                isStarred={starredActivities.includes(activity.activity_uid)}
                onToggleStar={onToggleStar}
                onComplete={onComplete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Accelerate Section (Future activities - for students ahead) */}
      {showSections && accelerateActivities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-sm">
              Get Ahead
            </Badge>
            <span className="text-sm text-gray-600">
              Optional activities from upcoming days
            </span>
          </div>
          <div className="space-y-3">
            {accelerateActivities.slice(0, 2).map((activity) => (
              <ActivityCard
                key={activity.activity_uid}
                activity={activity}
                isStarred={starredActivities.includes(activity.activity_uid)}
                onToggleStar={onToggleStar}
                onComplete={onComplete}
                showDay={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completedActivities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
            <span className="text-sm text-gray-600">
              {completedCount} {completedCount === 1 ? 'activity' : 'activities'}
            </span>
          </div>
          <div className="space-y-3">
            {completedActivities.map((activity) => (
              <ActivityCard
                key={activity.activity_uid}
                activity={activity}
                isStarred={starredActivities.includes(activity.activity_uid)}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Simple list view (when sections are disabled) */}
      {!showSections && totalActivities > 0 && (
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.activity_uid}
              activity={activity}
              isStarred={starredActivities.includes(activity.activity_uid)}
              onToggleStar={onToggleStar}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DayView;
