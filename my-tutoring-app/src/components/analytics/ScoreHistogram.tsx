'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ScoreHistogram as ScoreHistogramType } from '@/types/analytics'

interface ScoreHistogramProps {
  scoreHistogram: ScoreHistogramType
  title?: string
  height?: number
  showPercentage?: boolean
}

// Color coding for score ranges
const getScoreColor = (score: number): string => {
  if (score >= 9) return '#10b981' // green - excellent
  if (score >= 7) return '#3b82f6' // blue - good
  if (score >= 5) return '#f59e0b' // orange - fair
  return '#ef4444' // red - needs work
}

export const ScoreHistogram: React.FC<ScoreHistogramProps> = ({
  scoreHistogram,
  title,
  height = 250,
  showPercentage = false
}) => {
  // Convert histogram object to array format for Recharts
  const data = Object.entries(scoreHistogram)
    .map(([score, count]) => ({
      score: parseInt(score),
      count: count,
      scoreLabel: `${score}/10`
    }))
    .sort((a, b) => a.score - b.score)

  const totalReviews = data.reduce((sum, item) => sum + item.count, 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = totalReviews > 0 ? ((data.count / totalReviews) * 100).toFixed(1) : '0'

      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-semibold text-sm">Score: {data.score}/10</p>
          <p className="text-sm">Count: {data.count}</p>
          {showPercentage && <p className="text-sm text-gray-600">{percentage}%</p>}
        </div>
      )
    }
    return null
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-500">
        No score data available
      </div>
    )
  }

  return (
    <div>
      {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="scoreLabel"
            tick={{ fontSize: 12 }}
            label={{ value: 'Score', position: 'insideBottom', offset: -10, fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: 'Count', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
