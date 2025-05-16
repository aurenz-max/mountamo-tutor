import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Info, AlertCircle } from "lucide-react";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// Custom tooltip component for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Card className="p-3">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            {entry.name.includes('mastery') || entry.name.includes('score') || entry.name.includes('coverage') ? '%' : ''}
          </p>
        ))}
      </Card>
    );
  }
  return null;
};

const RecentProgressChart = ({ 
  data, 
  loading, 
  error, 
  chartType = 'line',
  timeRange = 'week'
}) => {
  // Chart configuration based on chart type
  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area yAxisId="left" type="monotone" dataKey="problems" name="Problems Completed" fill="#8884d8" stroke="#8884d8" />
            <Area yAxisId="right" type="monotone" dataKey="competency" name="Mastery Score" fill="#82ca9d" stroke="#82ca9d" />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="problems" name="Problems Completed" fill="#8884d8" />
            <Bar yAxisId="right" dataKey="competency" name="Mastery Score" fill="#82ca9d" />
          </BarChart>
        );
      
      case 'line':
      default:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="problems" name="Problems Completed" stroke="#8884d8" activeDot={{ r: 8 }} />
            <Line yAxisId="right" type="monotone" dataKey="competency" name="Mastery Score" stroke="#82ca9d" />
            {data.some(d => d.hasOwnProperty('timeSpent')) && (
              <Line yAxisId="right" type="monotone" dataKey="timeSpent" name="Time Spent (hrs)" stroke="#ffc658" />
            )}
          </LineChart>
        );
    }
  };

  // Calculate summary stats for the info alert
  const calculateSummary = () => {
    if (!data || data.length === 0) return null;
    
    const totalProblems = data.reduce((sum, item) => sum + (item.problems || 0), 0);
    const avgCompetency = data.reduce((sum, item) => sum + (item.competency || 0), 0) / data.length;
    
    let timeSpentText = '';
    if (data.some(d => d.hasOwnProperty('timeSpent'))) {
      const totalTimeSpent = data.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
      timeSpentText = ` with ${totalTimeSpent.toFixed(1)} hours spent learning`;
    }
    
    return {
      totalProblems,
      avgCompetency,
      timeSpentText,
    };
  };

  const summary = calculateSummary();

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress Over Time
          </CardTitle>
          <CardDescription>
            Your learning progress for the past {timeRange}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : data && data.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No progress data available
            </div>
          )}
        </CardContent>
      </Card>

      {summary && !error && !loading && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {timeRange === 'week' ? 'Weekly' : timeRange === 'month' ? 'Monthly' : 'Quarterly'} Summary: 
            You've completed {summary.totalProblems} problems 
            with an average mastery score of {summary.avgCompetency.toFixed(1)}%
            {summary.timeSpentText}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default RecentProgressChart;