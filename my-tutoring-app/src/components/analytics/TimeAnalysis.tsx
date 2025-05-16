// components/analytics/TimeAnalysis.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp, TrendingDown, Clock, Calendar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { TimeAnalyticsResponse } from '@/lib/api';

interface TimeAnalysisProps {
  studentId: number;
  subject?: string;
}

const TimeAnalysis: React.FC<TimeAnalysisProps> = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TimeAnalyticsResponse | null>(null);
  const [granularity, setGranularity] = useState('daily');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getTimeBasedAnalytics(studentId, subject, granularity);
        setData(response);
        setError(null);
      } catch (err) {
        setError('Failed to load time-based analytics');
        console.error('Error fetching time analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, subject, granularity]);

  if (loading) {
    return <div className="p-8 text-center">Loading time-based analytics...</div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No time analysis data available'}</AlertDescription>
      </Alert>
    );
  }

  const { time_data, trend_data, activity_patterns } = data;

  // Get trend direction icon
  const getTrendIcon = (direction: string) => {
    if (direction === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (direction === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'Time Spent' ? ' min' : entry.name === 'Average Score' ? '' : ''}
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
        <h2 className="text-2xl font-bold">Learning Activity Over Time</h2>
        <Select value={granularity} onValueChange={setGranularity}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Time Granularity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Performance by Time Period */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by {granularity === 'daily' ? 'Day' : granularity === 'weekly' ? 'Week' : 'Month'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={time_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" domain={[0, 10]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="average_score"
                  name="Average Score"
                  stroke="#8884d8"
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  name="Number of Attempts"
                  stroke="#82ca9d"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Time Spent */}
      <Card>
        <CardHeader>
          <CardTitle>Time Spent Learning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={time_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="time_spent_minutes" 
                  name="Time Spent" 
                  fill="#8884d8"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Activity Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Active Periods</p>
                  <p className="text-xl font-bold">{activity_patterns.active_periods}/{activity_patterns.total_periods}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Activity Rate</p>
                  <p className="text-xl font-bold">{activity_patterns.activity_rate.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Consistency</p>
                  <p className={`text-xl font-bold ${
                    activity_patterns.consistency === 'High' ? 'text-green-600' :
                    activity_patterns.consistency === 'Medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {activity_patterns.consistency}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg h-full flex items-center">
              {typeof trend_data === 'object' && 'direction' in trend_data ? (
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-center space-x-3">
                    {getTrendIcon(trend_data.direction)}
                    <span className="text-xl font-bold capitalize">{trend_data.direction}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Trend Strength</p>
                      <p className="font-medium">{(trend_data.r_squared * 100).toFixed(1)}%</p>
                    </div>
                    {trend_data.predicted_next_score && (
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Predicted Next</p>
                        <p className="font-medium">{trend_data.predicted_next_score.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      {trend_data.significant ? 
                        'This trend is statistically significant.' : 
                        'This trend is not yet statistically significant.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center text-gray-500">
                  {trend_data.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This analysis shows how your learning patterns and performance change over time. 
          Regular, consistent practice tends to lead to better mastery.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default TimeAnalysis;