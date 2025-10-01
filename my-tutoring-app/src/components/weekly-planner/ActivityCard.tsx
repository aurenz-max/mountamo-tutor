// components/weekly-planner/ActivityCard.tsx
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Circle,
  Flame,
  AlertCircle
} from 'lucide-react';
import type {
  PlannedActivity,
  ActivityStatus,
  ActivityPriority
} from '@/lib/weeklyPlannerApi';
import {
  getActivityStatusColor,
  getActivityPriorityColor,
  getActivityTypeIcon
} from '@/lib/weeklyPlannerApi';

interface ActivityCardProps {
  activity: PlannedActivity;
  isStarred?: boolean;
  onToggleStar?: (activityUid: string, isStarred: boolean) => void;
  onComplete?: (activityUid: string) => void;
  showDay?: boolean;
  compact?: boolean;
}

export function ActivityCard({
  activity,
  isStarred = false,
  onToggleStar,
  onComplete,
  showDay = false,
  compact = false,
}: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStarring, setIsStarring] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleToggleStar = async () => {
    if (!onToggleStar || isStarring) return;

    setIsStarring(true);
    try {
      await onToggleStar(activity.activity_uid, !isStarred);
    } finally {
      setIsStarring(false);
    }
  };

  const handleComplete = async () => {
    if (!onComplete || isCompleting) return;

    setIsCompleting(true);
    try {
      await onComplete(activity.activity_uid);
    } finally {
      setIsCompleting(false);
    }
  };

  const canComplete = activity.status === 'assigned' || activity.status === 'pending';
  const isCompleted = activity.status === 'completed';

  const getDayName = (dayIndex: number) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[dayIndex];
  };

  const priorityBorderClass = getActivityPriorityColor(activity.priority);
  const statusColorClass = getActivityStatusColor(activity.status);
  const typeIcon = getActivityTypeIcon(activity.activity_type);

  return (
    <Card className={`border-2 transition-all hover:shadow-md ${priorityBorderClass}`}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {/* Subject & Type Badges */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {typeIcon} {activity.activity_type}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {activity.subject}
              </Badge>
              {showDay && (
                <Badge variant="outline" className="text-xs">
                  {getDayName(activity.planned_day)}
                </Badge>
              )}
              {activity.priority === 'high' && (
                <Badge variant="destructive" className="text-xs">
                  <Flame className="h-3 w-3 mr-1" />
                  High Priority
                </Badge>
              )}
            </div>

            {/* Subskill Description */}
            <h4 className="font-semibold text-gray-900 mb-1">
              {activity.subskill_description}
            </h4>

            {/* Unit & Skill Path */}
            {!compact && (activity.unit_title || activity.skill_description) && (
              <p className="text-sm text-gray-600 mb-2">
                {activity.unit_title && <span>{activity.unit_title}</span>}
                {activity.unit_title && activity.skill_description && <span> → </span>}
                {activity.skill_description && <span>{activity.skill_description}</span>}
              </p>
            )}
          </div>

          {/* Star Button */}
          {onToggleStar && (
            <Button
              variant={isStarred ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleStar}
              disabled={isStarring}
              className="ml-3"
              title="Star this activity to prioritize it in future plans"
            >
              <Star
                className={`h-4 w-4 ${isStarred ? 'fill-current' : ''}`}
              />
            </Button>
          )}
        </div>

        {/* Status & Metadata Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <Badge className={`text-xs ${statusColorClass}`}>
              {isCompleted ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <Circle className="h-3 w-3 mr-1" />
              )}
              {activity.status}
            </Badge>

            {/* Estimated Time */}
            <span className="flex items-center text-sm text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              {activity.estimated_time_minutes} min
            </span>

            {/* Difficulty */}
            {activity.difficulty_start && (
              <span className="text-xs text-gray-500">
                Level {activity.difficulty_start}
                {activity.target_difficulty && activity.target_difficulty !== activity.difficulty_start && (
                  <> → {activity.target_difficulty}</>
                )}
              </span>
            )}
          </div>

          {/* Complete Button */}
          {canComplete && onComplete && (
            <Button
              variant="default"
              size="sm"
              onClick={handleComplete}
              disabled={isCompleting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompleting ? 'Completing...' : 'Complete'}
            </Button>
          )}
        </div>

        {/* LLM Reasoning (Expandable) */}
        {!compact && activity.llm_reasoning && (
          <div className="border-t pt-3 mt-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-sm text-gray-700 hover:text-gray-900"
            >
              <span className="flex items-center font-medium">
                <AlertCircle className="h-4 w-4 mr-2" />
                Why this activity?
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {isExpanded && (
              <p className="mt-2 text-sm text-gray-600 italic">
                {activity.llm_reasoning}
              </p>
            )}
          </div>
        )}

        {/* Completion Date */}
        {isCompleted && activity.completed_date && (
          <div className="mt-2 text-xs text-green-600">
            ✅ Completed on {new Date(activity.completed_date).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityCard;
