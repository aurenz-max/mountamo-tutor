"use client";

import React, { useState } from 'react';
import { useLinkedStudents, useParentStudentMetrics, useParentStudentTimeseries } from '@/hooks/useParentPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';

export default function ParentAnalyticsPage() {
  const { students } = useLinkedStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    students.length > 0 ? students[0] : null
  );
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  const [timeInterval, setTimeInterval] = useState<'day' | 'week' | 'month'>('week');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useParentStudentMetrics(selectedStudentId, selectedSubject);
  const { timeseries, loading: timeseriesLoading, refetch: refetchTimeseries } = useParentStudentTimeseries(selectedStudentId, {
    subject: selectedSubject,
    interval: timeInterval,
  });

  // Update selected student when students list changes
  React.useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0]);
    }
  }, [students, selectedStudentId]);

  const toggleUnit = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'bg-green-500';
    if (mastery >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMasteryTextColor = (mastery: number) => {
    if (mastery >= 80) return 'text-green-700';
    if (mastery >= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  const getMasteryLabel = (mastery: number) => {
    if (mastery >= 80) return 'Strong Understanding';
    if (mastery >= 60) return 'Developing';
    return 'Needs Practice';
  };

  const renderTrendIcon = (current: number, previous: number) => {
    const diff = current - previous;
    if (Math.abs(diff) < 2) return <Minus className="h-4 w-4 text-gray-400" />;
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (students.length === 0) {
    return null;
  }

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">Failed to load analytics: {metricsError.message}</p>
          <Button onClick={() => refetchMetrics()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metricsData = metrics?.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Learning Analytics</h2>
          <p className="text-gray-600 mt-1">Detailed progress and performance insights</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Student Selector */}
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
            onClick={() => {
              refetchMetrics();
              refetchTimeseries();
            }}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {metricsData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Overall Mastery</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${getMasteryTextColor(metricsData.summary.mastery)}`}>
                {Math.round(metricsData.summary.mastery)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {getMasteryLabel(metricsData.summary.mastery)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average Score</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(metricsData.summary.avg_score)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Across {metricsData.summary.attempt_count} attempts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completion</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(metricsData.summary.completion)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {metricsData.summary.attempted_items} of {metricsData.summary.total_items} topics
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ready to Learn</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {metricsData.summary.ready_items}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                New topics available
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance</CardTitle>
          <CardDescription>Detailed breakdown by subject and skill</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsData?.hierarchical_data && metricsData.hierarchical_data.length > 0 ? (
            <div className="space-y-6">
              {metricsData.hierarchical_data.map((unit: any) => (
                <div key={unit.unit_id} className="border rounded-lg">
                  {/* Unit Header */}
                  <button
                    onClick={() => toggleUnit(unit.unit_id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      {expandedUnits.has(unit.unit_id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div className="text-left flex-1">
                        <h3 className="font-semibold text-gray-900">{unit.unit_title}</h3>
                        <p className="text-xs text-gray-600">
                          {unit.attempted_skills}/{unit.total_skills} skills started
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${getMasteryTextColor(unit.mastery)}`}>
                          {Math.round(unit.mastery)}%
                        </p>
                        <p className="text-xs text-gray-600">{getMasteryLabel(unit.mastery)}</p>
                      </div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getMasteryColor(unit.mastery)} transition-all`}
                          style={{ width: `${unit.mastery}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Skills */}
                  {expandedUnits.has(unit.unit_id) && unit.skills && (
                    <div className="border-t bg-gray-50 p-4 space-y-4">
                      {unit.skills.map((skill: any) => (
                        <div key={skill.skill_id} className="bg-white rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{skill.skill_description}</h4>
                            <Badge variant={skill.mastery >= 80 ? 'default' : 'secondary'}>
                              {Math.round(skill.mastery)}% mastery
                            </Badge>
                          </div>

                          {/* Subskills */}
                          {skill.subskills && skill.subskills.length > 0 && (
                            <div className="space-y-2 pl-4">
                              {skill.subskills.map((subskill: any) => (
                                <div
                                  key={subskill.subskill_id}
                                  className="flex items-center justify-between py-2 border-l-2 border-gray-200 pl-3"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-700">{subskill.subskill_description}</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <Badge
                                        variant={subskill.readiness_status === 'ready' ? 'default' : 'outline'}
                                        className="text-xs"
                                      >
                                        {subskill.readiness_status}
                                      </Badge>
                                      {subskill.is_attempted && (
                                        <span className="text-xs text-gray-500">
                                          Avg: {Math.round(subskill.avg_score)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-3">
                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getMasteryColor(subskill.mastery)}`}
                                        style={{ width: `${subskill.mastery}%` }}
                                      />
                                    </div>
                                    <span className={`text-sm font-semibold ${getMasteryTextColor(subskill.mastery)} w-12 text-right`}>
                                      {Math.round(subskill.mastery)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No analytics data available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
