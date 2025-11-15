// src/components/analytics/CompletionChart.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export default function CompletionChart() {
  const { metrics } = useAnalytics()
  
  if (!metrics) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data available</div>;
  }
  
  // Calculate completion percentages from API data
  const attemptsPercentage = metrics.summary.completion;
  const noAttemptsPercentage = 100 - attemptsPercentage;
  
  const data = [
    { name: 'Has Attempts', value: attemptsPercentage, color: '#1E88E5' },
    { name: 'No Attempts', value: noAttemptsPercentage, color: '#E0E0E0' }
  ];
  
  return (
    <div className="h-[300px] flex justify-center items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value}%`, name]}
          />
          <Legend verticalAlign="bottom" align="center" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}