// src/components/analytics/ProgressChart.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
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

export default function ProgressChart() {
  const { timeSeriesData } = useAnalytics()
  
  if (!timeSeriesData || !timeSeriesData.data || timeSeriesData.data.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data available</div>;
  }
  
  // Transform API data into format needed for chart
  const data = timeSeriesData.data.map(item => {
    // Parse date for display formatting
    const date = new Date(item.interval_date);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
    const quarter = `${date.getFullYear()} Qtr ${Math.floor(date.getMonth() / 3) + 1}`;
    
    return {
      month: month,
      quarter: `${quarter} ${month}`,
      attempts: item.metrics.attempts,
      mastery_percentage: item.metrics.mastery * 100,
      proficiency_percentage: item.metrics.proficiency * 100
    };
  });

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 30,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="quarter" 
            scale="point" 
            padding={{ left: 20, right: 20 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            yAxisId="left"
            orientation="left"
            domain={[0, 'auto']}
            label={{ 
              value: 'Attempts', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ 
              value: 'Mastery & Proficiency', 
              angle: 90, 
              position: 'insideRight',
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'attempts') return [value, 'Attempts'];
              if (name === 'mastery_percentage') return [`${value}%`, 'Mastery %'];
              if (name === 'proficiency_percentage') return [`${value}%`, 'Proficiency %'];
              return [value, name];
            }}
          />
          <Legend />
          <Bar 
            dataKey="attempts" 
            fill="#1E88E5" 
            yAxisId="left" 
            name="Attempts"
            barSize={60}
          />
          <Line 
            type="monotone" 
            dataKey="mastery_percentage" 
            stroke="#FF7043" 
            yAxisId="right" 
            name="Mastery %"
            strokeWidth={2}
            activeDot={{ r: 8 }}
          />
          <Line 
            type="monotone" 
            dataKey="proficiency_percentage" 
            stroke="#7E57C2" 
            yAxisId="right" 
            name="Proficiency %"
            strokeWidth={2}
            activeDot={{ r: 8 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}