"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, CheckCircle, Flame, Award } from 'lucide-react';
import type { WeeklySummaryMetrics } from '@/lib/parentPortalApi';

interface WeeklySummaryCardProps {
  weeklySummary: WeeklySummaryMetrics;
}

const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({ weeklySummary }) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'text-green-600';
    if (mastery >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMasteryLabel = (mastery: number) => {
    if (mastery >= 80) return 'Strong';
    if (mastery >= 60) return 'Developing';
    return 'Needs Practice';
  };

  const weekRange = `${new Date(weeklySummary.week_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(weeklySummary.week_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          <span>Weekly Summary</span>
        </CardTitle>
        <CardDescription>{weekRange}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-700">Time Spent</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatTime(weeklySummary.total_time_spent_minutes)}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-gray-700">Problems Done</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {weeklySummary.problems_completed}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Award className="h-5 w-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-700">Avg. Mastery</p>
            </div>
            <p className={`text-2xl font-bold ${getMasteryColor(weeklySummary.average_mastery)}`}>
              {Math.round(weeklySummary.average_mastery)}%
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {getMasteryLabel(weeklySummary.average_mastery)} Understanding
            </p>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Flame className="h-5 w-5 text-orange-600" />
              <p className="text-sm font-medium text-gray-700">Streak</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {weeklySummary.streak_days}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {weeklySummary.streak_days === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        {/* Top Skill */}
        {weeklySummary.top_skill && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-lg mb-6 border border-yellow-200">
            <div className="flex items-center space-x-2 mb-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <p className="text-sm font-medium text-gray-700">Top Skill This Week</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {weeklySummary.top_skill}
            </p>
          </div>
        )}

        {/* Subject Progress Breakdown */}
        {weeklySummary.subjects_progress && weeklySummary.subjects_progress.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Progress by Subject:</p>
            <div className="space-y-3">
              {weeklySummary.subjects_progress.map((subject) => (
                <div key={subject.subject} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {subject.subject}
                    </span>
                    <Badge
                      variant={subject.mastery >= 80 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {Math.round(subject.mastery)}% mastery
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(subject.time_spent)}
                    </span>
                    <span className="flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {subject.problems_completed} problems
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        subject.mastery >= 80
                          ? 'bg-green-500'
                          : subject.mastery >= 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${subject.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklySummaryCard;
