import React from 'react';
import { Clock, Star, CheckCircle, Sparkles, Database, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PracticeActivityCardProps {
  activityData: {
    id: string;
    title: string;
    description: string;
    category: string;
    estimated_time: string;
    points: number;
    is_complete?: boolean;
    curriculum_metadata?: {
      subject: string;
      unit: { id: string; title: string; description?: string };
      skill: { id: string; description: string };
      subskill: { id: string; description: string };
    };
    source_type?: 'ai_recommendations' | 'bigquery_recommendations' | 'fallback';
    activity_type?: 'warm_up' | 'core_challenge' | 'practice' | 'cool_down';
  };
  onStartPractice: (activityId: string) => void;
  onMarkComplete?: (activityId: string) => void;
  loading?: boolean;
}

export function PracticeActivityCard({
  activityData,
  onStartPractice,
  onMarkComplete,
  loading = false
}: PracticeActivityCardProps) {
  const isCompleted = activityData.is_complete === true;

  // Extract curriculum information
  const subject = activityData.curriculum_metadata?.subject || activityData.category;
  const unitDescription = activityData.curriculum_metadata?.unit?.description || activityData.curriculum_metadata?.unit?.title;
  const skillDescription = activityData.curriculum_metadata?.skill?.description;
  const subskillDescription = activityData.curriculum_metadata?.subskill?.description;

  // Source badge configuration
  const sourceConfig = {
    'ai_recommendations': {
      icon: Sparkles,
      label: 'AI Recommended',
      color: 'bg-purple-100 text-purple-700 border-purple-200'
    },
    'bigquery_recommendations': {
      icon: Database,
      label: 'Data Recommended',
      color: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    'fallback': {
      icon: AlertTriangle,
      label: 'Suggested',
      color: 'bg-gray-100 text-gray-600 border-gray-200'
    }
  };

  const source = activityData.source_type
    ? sourceConfig[activityData.source_type]
    : sourceConfig.fallback;

  // Activity type badge
  const activityTypeLabels = {
    'warm_up': 'Warm-Up',
    'core_challenge': 'Core Challenge',
    'practice': 'Practice',
    'cool_down': 'Cool-Down'
  };

  const activityTypeLabel = activityData.activity_type
    ? activityTypeLabels[activityData.activity_type]
    : null;

  return (
    <div className={`bg-white rounded-lg border transition-all hover:shadow-md ${
      isCompleted
        ? 'border-green-200 bg-green-50/30'
        : 'border-gray-200 hover:border-blue-300'
    }`}>
      <div className="p-5">
        {/* Header with subject and completion status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-600">
                {subject}
              </span>
              {isCompleted && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>
            {unitDescription && (
              <h3 className="text-base font-semibold text-gray-900 leading-tight">
                {unitDescription}
              </h3>
            )}
          </div>
        </div>

        {/* Skill hierarchy */}
        <div className="space-y-1 mb-4">
          {skillDescription && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Skill:</span> {skillDescription}
            </p>
          )}
          {subskillDescription && (
            <p className="text-sm text-gray-600">
              {subskillDescription}
            </p>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Time estimate */}
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="h-3.5 w-3.5" />
            <span>{activityData.estimated_time}</span>
          </div>

          {/* Points */}
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-500" />
            <span>{activityData.points} pts</span>
          </div>

          {/* Activity type */}
          {activityTypeLabel && (
            <Badge variant="outline" className="text-xs">
              {activityTypeLabel}
            </Badge>
          )}

          {/* Source indicator - subtle */}
          <div className="ml-auto">
            <Badge variant="outline" className={`text-xs ${source.color}`}>
              <source.icon className="h-3 w-3 mr-1" />
              {source.label}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => onStartPractice(activityData.id)}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Loading...' : isCompleted ? 'Practice Again' : 'Start Practice'}
          </Button>

          {!isCompleted && onMarkComplete && (
            <button
              onClick={() => onMarkComplete(activityData.id)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
