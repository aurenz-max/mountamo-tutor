'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { SubjectTrend } from '@/types/analytics'

interface TrendsChartProps {
  trends: SubjectTrend[]
  height?: number
  showReviewCount?: boolean
}

// Color palette for different subjects
const SUBJECT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
]

export const TrendsChart: React.FC<TrendsChartProps> = ({
  trends,
  height = 350,
  showReviewCount = false
}) => {
  // Transform data for Recharts (merge all periods across subjects)
  const allPeriods = new Set<string>()
  trends.forEach(trend => {
    trend.periods.forEach(period => {
      allPeriods.add(period.period_key)
    })
  })

  // Create data structure with all periods
  const chartData = Array.from(allPeriods)
    .sort()
    .map(periodKey => {
      const dataPoint: any = { period: periodKey }

      trends.forEach(trend => {
        const period = trend.periods.find(p => p.period_key === periodKey)
        if (period) {
          dataPoint[`${trend.subject}_score`] = period.avg_score
          dataPoint[`${trend.subject}_pct`] = period.avg_score_pct
          dataPoint[`${trend.subject}_reviews`] = period.total_reviews
          dataPoint[`${trend.subject}_label`] = period.period_label
        }
      })

      return dataPoint
    })

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const period = payload[0].payload
      // Get the period label from the first available subject
      const periodLabel = trends[0]?.periods.find(p => p.period_key === period.period)?.period_label

      return (
        <div className="bg-white p-3 border rounded shadow-md max-w-xs">
          <p className="font-semibold text-sm mb-2">{periodLabel}</p>
          {payload.map((entry: any, index: number) => {
            const subject = entry.name.replace('_score', '')
            const reviews = period[`${subject}_reviews`]
            const percentage = (entry.value * 10).toFixed(1)

            return (
              <div key={index} className="text-sm mb-1">
                <span style={{ color: entry.color }} className="font-medium">
                  {subject}:
                </span>
                <span className="ml-2">{entry.value.toFixed(2)}/10 ({percentage}%)</span>
                {showReviewCount && reviews && (
                  <span className="text-gray-600 ml-1">({reviews} reviews)</span>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Format period labels for display (show every nth label to avoid crowding)
  const formatPeriodLabel = (periodKey: string, index: number): string => {
    // For weekly data, show every 4th week (roughly monthly)
    // For monthly data, show every label
    const showEveryN = periodKey.includes('-W') ? 4 : 1

    if (index % showEveryN === 0) {
      if (periodKey.includes('-W')) {
        // Format: "2025-W44" -> "W44"
        return periodKey.split('-W')[1] || periodKey
      } else {
        // Format: "2025-10" -> "Oct"
        const [year, month] = periodKey.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return monthNames[parseInt(month) - 1] || periodKey
      }
    }
    return ''
  }

  if (trends.length === 0 || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        No trend data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11 }}
          tickFormatter={(value, index) => formatPeriodLabel(value, index)}
          label={{ value: 'Period', position: 'insideBottom', offset: -10, fontSize: 12 }}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fontSize: 11 }}
          label={{ value: 'Average Score', angle: -90, position: 'insideLeft', fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value) => value.replace('_score', '')}
        />
        {trends.map((trend, index) => (
          <Line
            key={trend.subject}
            type="monotone"
            dataKey={`${trend.subject}_score`}
            name={trend.subject}
            stroke={SUBJECT_COLORS[index % SUBJECT_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
