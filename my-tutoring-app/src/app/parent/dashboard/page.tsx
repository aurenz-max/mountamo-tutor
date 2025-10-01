"use client";

import React, { useState } from 'react';
import { useParentDashboard, useLinkedStudents } from '@/hooks/useParentPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Users } from 'lucide-react';
import TodaysPlanCard from '@/components/parent/TodaysPlanCard';
import WeeklySummaryCard from '@/components/parent/WeeklySummaryCard';
import InsightCard from '@/components/parent/InsightCard';

export default function ParentDashboardPage() {
  const { students, loading: studentsLoading } = useLinkedStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    students.length > 0 ? students[0] : null
  );

  const { dashboard, loading: dashboardLoading, error, refetch } = useParentDashboard(selectedStudentId);

  // Update selected student when students list changes
  React.useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0]);
    }
  }, [students, selectedStudentId]);

  // Unified loading state: wait for students to load first, then wait for dashboard if we have students
  const isLoading = studentsLoading || (students.length > 0 && selectedStudentId && dashboardLoading);

  // Show single loading state for everything
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // After loading completes, check if no students are linked
  if (students.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Students Linked
          </h3>
          <p className="text-gray-600 mb-6">
            Link a student account to start viewing their progress and insights.
          </p>
          <Button onClick={() => window.location.href = '/parent/link-student'}>
            Link Student Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">Failed to load dashboard: {error.message}</p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">No dashboard data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Student Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {dashboard.student_name}'s Progress
          </h2>
          <p className="text-gray-600 mt-1">
            Last updated: {new Date(dashboard.generated_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Student Selector (if multiple students) */}
          {students.length > 1 && (
            <Select
              value={selectedStudentId?.toString()}
              onValueChange={(value) => setSelectedStudentId(parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((studentId) => (
                  <SelectItem key={studentId} value={studentId.toString()}>
                    Student {studentId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={dashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${dashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Plan */}
        <div>
          <TodaysPlanCard todaysPlan={dashboard.todays_plan} />
        </div>

        {/* Weekly Summary */}
        <div>
          <WeeklySummaryCard weeklySummary={dashboard.weekly_summary} />
        </div>
      </div>

      {/* Key Insights - Full Width */}
      <div>
        <InsightCard insights={dashboard.key_insights} />
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Want to dive deeper?
              </h3>
              <p className="text-sm text-gray-600">
                Explore detailed analytics, weekly plans, and more.
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/parent/analytics'}
              >
                View Analytics
              </Button>
              <Button
                onClick={() => window.location.href = '/parent/explorer'}
              >
                Weekly Explorer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
