'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { StudentAnalytics as StudentAnalyticsData, DetailedAnalytics, DailyProgress, SkillCompetency } from '@/lib/api';

const StudentAnalytics = ({ studentId = 1 }) => {
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalyticsData | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
        const data = await api.getStudentAnalytics(studentId, days);
        setAnalytics(data);
        setError(null);
      } catch (err) {
        setError('Failed to load analytics data');
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [studentId, timeRange]);

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (error || !analytics) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No data available'}</AlertDescription>
      </Alert>
    );
  }

  const { dailyProgress, skillCompetencies, detailedAnalytics } = analytics;
  const { currentStats, progressionData } = detailedAnalytics;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'timeSpent' ? ' min' : entry.name === 'competency' ? '%' : ''}
            </p>
          ))}
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Learning Progress</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Competency Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Competency Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="competency"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    name="Competency"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Time vs Problems Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="timeSpent"
                    stroke="#82ca9d"
                    name="Time Spent"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="problems"
                    stroke="#ffc658"
                    name="Problems Solved"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Progress</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Raw Score</p>
              <p className="text-2xl font-semibold">
                {currentStats.averageScore.toFixed(1)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Credibility</p>
              <p className="text-2xl font-semibold">
                {(currentStats.credibility * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Problems Completed</p>
              <p className="text-2xl font-semibold">
                {currentStats.totalProblems}
              </p>
            </div>
          </div>

          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="problems" 
                  label={{ 
                    value: 'Problems Completed', 
                    position: 'bottom' 
                  }} 
                />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2563eb"
                  name="Skill Score"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="credibility"
                  stroke="#16a34a"
                  name="Credibility"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Skills Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={skillCompetencies}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Skills"
                    dataKey="score"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sub-skill Breakdown */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentStats.subSkills).map(([skillId, data]) => (
                <div key={skillId} className="flex items-center gap-4">
                  <div className="w-24 capitalize">{skillId}</div>
                  <div className="flex-1 flex items-center gap-2">
                    <div 
                      className="h-2 rounded-full bg-blue-200 flex-grow"
                    >
                      <div 
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(data.averageScore * 10)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20">
                      {data.averageScore.toFixed(1)} ({data.problems})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {timeRange === 'week' ? 'Weekly' : timeRange === 'month' ? 'Monthly' : 'Yearly'} Summary: 
          You've spent {dailyProgress.reduce((sum, day) => sum + day.timeSpent, 0)} minutes learning
          and completed {dailyProgress.reduce((sum, day) => sum + day.problems, 0)} problems.
          Your competency has increased from {dailyProgress[0]?.competency.toFixed(1)}% 
          to {dailyProgress[dailyProgress.length - 1]?.competency.toFixed(1)}%.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default StudentAnalytics;