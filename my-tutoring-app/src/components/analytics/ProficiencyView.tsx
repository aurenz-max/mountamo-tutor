// src/components/analytics/ProficiencyView.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'

export default function ProficiencyView() {
  const { metrics, subject } = useAnalytics()
  const [dataType, setDataType] = React.useState<'unit' | 'skill'>('unit')
  
  if (!metrics || !metrics.hierarchical_data) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground">No data available</div>;
  }
  
  // Process unit data from the API
  const processUnitData = () => {
    return metrics.hierarchical_data.map(unit => ({
      unit: unit.unit_title,
      attempts: unit.attempted,
      score: Math.round(unit.mastery * 100)  // Convert to percentage
    })).filter(unit => unit.attempts > 0);  // Only include units with attempts
  };
  
  // Process skill data from the API
  const processSkillData = () => {
    // Flatten all skills from all units
    return metrics.hierarchical_data.flatMap(unit => 
      unit.skills.map(skill => ({
        skill: skill.skill_description,
        attempts: skill.attempted,
        score: Math.round(skill.mastery * 100)  // Convert to percentage
      }))
    ).filter(skill => skill.attempts > 0);  // Only include skills with attempts
  };
  
  // Process data for proficiency scatter chart
  const processScatterData = () => {
    return metrics.hierarchical_data
      .filter(unit => unit.attempted > 0)  // Only include units with attempts
      .map(unit => ({
        name: unit.unit_title,
        attempts: unit.attempted,
        proficiency: Math.round(unit.proficiency * 100)  // Convert to percentage
      }));
  };
  
  // Use data from API
  const unitData = processUnitData();
  const skillData = processSkillData();
  const scatterData = processScatterData();
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Proficiency by Unit</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 20,
                  left: 20,
                }}
              >
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="attempts" 
                  name="Attempts" 
                  domain={[0, 'dataMax + 5']}
                />
                <YAxis 
                  type="number" 
                  dataKey="proficiency" 
                  name="Proficiency %"
                  domain={[0, 40]}
                  label={{ 
                    value: 'Proficiency %', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'proficiency') return [`${value}%`, 'Proficiency'];
                    return [value, name];
                  }}
                  labelFormatter={(value) => `${scatterData[value].name}`}
                />
                <Scatter 
                  name="Units" 
                  data={scatterData} 
                  fill="#1E88E5"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Attempts and Average Score by {dataType === 'unit' ? 'Unit' : 'Skill'}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataType === 'unit' ? unitData : skillData}
                layout="vertical"
                margin={{
                  top: 20,
                  right: 60,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  domain={[0, 'dataMax + 5']} 
                />
                <YAxis 
                  type="category" 
                  dataKey={dataType === 'unit' ? 'unit' : 'skill'} 
                  width={200}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                yAxisId={1}
                orientation="right"
                type="number"
                domain={[0, 100]}
                label={{ 
                  value: 'Score %', 
                  angle: -90, 
                  position: 'insideRight',
                  style: { textAnchor: 'middle' }
                }}
              />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'score') return [`${value}%`, 'Average Score'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="attempts" 
                  name="Attempts" 
                  fill="#1E88E5"
                />
                <Bar 
                  dataKey="score" 
                  name="Average Score" 
                  yAxisId={1}
                  hide
                >
                  {(dataType === 'unit' ? unitData : skillData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}