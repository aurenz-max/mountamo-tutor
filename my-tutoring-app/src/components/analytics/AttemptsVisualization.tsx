// src/components/analytics/AttemptsVisualization.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'

export default function AttemptsVisualization() {
  const { metrics } = useAnalytics()
  
  if (!metrics || !metrics.hierarchical_data) {
    return null
  }

  // Format data for unit attempts using attempt_count
  const unitData = metrics.hierarchical_data.map(unit => ({
    name: unit.unit_title,
    attempts: unit.attempt_count,
    avgScore: Math.round(unit.avg_score * 100),
  }))

  // Format data for skill attempts if we expand the first unit
  const skillData = metrics.hierarchical_data[0]?.skills.map(skill => ({
    name: skill.skill_description.length > 20 
      ? skill.skill_description.substring(0, 20) + '...' 
      : skill.skill_description,
    fullName: skill.skill_description,
    attempts: skill.attempt_count,
    avgScore: Math.round(skill.avg_score * 100),
  })) || []

  // Custom tooltip to show full name
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{data.fullName || data.name}</p>
          <p>Attempts: <span className="font-medium">{data.attempts}</span></p>
          <p>Avg Score: <span className="font-medium">{data.avgScore}%</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Unit Attempts */}
      <Card>
        <CardHeader>
          <CardTitle>Attempts by Unit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={unitData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="attempts" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList 
                    dataKey="avgScore" 
                    position="right" 
                    formatter={(value) => `${value}%`}
                    style={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Skill Attempts */}
      <Card>
        <CardHeader>
          <CardTitle>Attempts by Skill</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={skillData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="attempts" 
                  fill="#f59e0b" 
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList 
                    dataKey="avgScore" 
                    position="right" 
                    formatter={(value) => `${value}%`}
                    style={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}