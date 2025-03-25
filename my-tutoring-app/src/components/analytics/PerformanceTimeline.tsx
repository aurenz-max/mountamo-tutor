// src/components/analytics/PerformanceTimeline.tsx
'use client'

import React, { useState } from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

export default function PerformanceTimeline() {
  const { timeSeriesData, loading } = useAnalytics()
  
  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader className="pb-2 border-b">
          <CardTitle>Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }
  
  // Handle the case when no timeseries data is available
  if (!timeSeriesData || 
      ((!timeSeriesData.data || timeSeriesData.data.length === 0) && 
       (!timeSeriesData.intervals || timeSeriesData.intervals.length === 0))) {
    return (
      <Card className="shadow-md">
        <CardHeader className="pb-2 border-b">
          <CardTitle>Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="text-amber-500">No timeline data available</div>
        </CardContent>
      </Card>
    )
  }

  // Handle both the old and new API formats
  const dataSource = timeSeriesData.data || 
    (timeSeriesData.intervals?.map(interval => ({
      interval_date: interval.interval_date,
      metrics: {
        mastery: interval.summary.mastery,
        proficiency: interval.summary.proficiency,
        avg_score: interval.summary.avg_score,
        completion: interval.summary.completion,
        attempts: interval.summary.attempt_count,
        unique_subskills: interval.summary.attempted_items
      }
    })));

  // Format the data for the chart
  const chartData = dataSource
    .sort((a, b) => new Date(a.interval_date).getTime() - new Date(b.interval_date).getTime())
    .map(item => {
      // Format date to be more readable
      const date = new Date(item.interval_date)
      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      return {
        date: formattedDate,
        month: date.toLocaleString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        attempts: item.metrics.attempts,
        mastery: Math.round(item.metrics.mastery * 100),
        proficiency: Math.round(item.metrics.proficiency * 100),
        unique_subskills: item.metrics.unique_subskills,
      }
    });

  // Custom tooltip with improved styling
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded-md shadow-lg">
          <p className="font-semibold text-gray-800 border-b pb-2 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={`tooltip-${index}`} className="flex items-center justify-between text-sm my-1">
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="ml-4 font-bold">
                {entry.value}{entry.name !== 'Attempts' ? '%' : ''}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 border-b">
        <CardTitle>Progress Over Time</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorAttempts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="colorMastery" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorProficiency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={false}
                padding={{ left: 10, right: 10 }}
              />
              
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={false}
                domain={[0, 'auto']}
                padding={{ top: 10 }}
                label={{ 
                  value: 'Attempts',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#6b7280', fontWeight: 500 }
                }}
              />
              
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={false}
                domain={[0, 100]}
                padding={{ top: 10 }}
                label={{ 
                  value: 'Percentage (%)',
                  angle: 90,
                  position: 'insideRight',
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#6b7280', fontWeight: 500 }
                }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ paddingTop: 10 }}
              />
              
              {/* Bar chart for attempts */}
              <Bar 
                yAxisId="left"
                dataKey="attempts" 
                name="Attempts" 
                fill="url(#colorAttempts)" 
                radius={[4, 4, 0, 0]}
                barSize={30}
              />
              
              {/* Line chart for mastery */}
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="mastery" 
                stroke="#f97316" 
                name="Mastery %" 
                strokeWidth={3} 
                dot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#f97316', strokeWidth: 2 }}
              />
              
              {/* Line chart for proficiency */}
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="proficiency" 
                stroke="#8b5cf6" 
                name="Proficiency %" 
                strokeWidth={3} 
                dot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#8b5cf6', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}