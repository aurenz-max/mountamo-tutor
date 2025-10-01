"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import type { TodaysPlanSummary } from '@/lib/parentPortalApi';

interface TodaysPlanCardProps {
  todaysPlan: TodaysPlanSummary;
}

const TodaysPlanCard: React.FC<TodaysPlanCardProps> = ({ todaysPlan }) => {
  const completionPercentage = todaysPlan.total_activities > 0
    ? Math.round((todaysPlan.completed_activities / todaysPlan.total_activities) * 100)
    : 0;

  const formattedDate = new Date(todaysPlan.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span>Today's Plan</span>
            </CardTitle>
            <CardDescription>{formattedDate}</CardDescription>
          </div>
          <Badge
            variant={completionPercentage === 100 ? 'default' : 'secondary'}
            className="text-sm"
          >
            {completionPercentage}% Complete
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {todaysPlan.completed_activities}/{todaysPlan.total_activities}
            </p>
            <p className="text-sm text-gray-600">Activities</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {todaysPlan.estimated_total_time}
            </p>
            <p className="text-sm text-gray-600">Minutes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {todaysPlan.subjects_covered.length}
            </p>
            <p className="text-sm text-gray-600">Subjects</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Subjects Covered */}
        {todaysPlan.subjects_covered.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Subjects Today:</p>
            <div className="flex flex-wrap gap-2">
              {todaysPlan.subjects_covered.map((subject) => (
                <Badge key={subject} variant="outline">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Activities Preview */}
        {todaysPlan.activities_preview && todaysPlan.activities_preview.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Activities:</p>
            <div className="space-y-2">
              {todaysPlan.activities_preview.slice(0, 5).map((activity) => (
                <div
                  key={activity.activity_id}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  {activity.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${activity.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {activity.title}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {activity.subject}
                      </Badge>
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {activity.estimated_time} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {todaysPlan.activities_preview.length > 5 && (
              <p className="text-xs text-gray-500 text-center mt-3">
                +{todaysPlan.activities_preview.length - 5} more activities
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysPlanCard;
