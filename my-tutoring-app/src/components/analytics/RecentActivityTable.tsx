// src/components/analytics/RecentActivityTable.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export default function RecentActivityTable() {
  const { metrics, subject } = useAnalytics()
  
  if (!metrics || !metrics.hierarchical_data) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground">No data available</div>;
  }
  
  // Extract recent activity data from the API response
  const generateUnitActivityData = () => {
    return metrics.hierarchical_data.map(unit => ({
      unit: unit.unit_title,
      recent_activity: unit.attempted,
      avg_score: Math.round(unit.mastery * 100), // Convert to percentage
      proficiency: Math.round(unit.proficiency * 100) // Convert to percentage
    })).filter(item => item.recent_activity > 0); // Only show units with activity
  };
  
  // Extract skill level data if a subject is selected
  const generateSkillActivityData = () => {
    // Flatten skills from all units
    const skills = metrics.hierarchical_data.flatMap(unit => 
      unit.skills.map(skill => ({
        skill: skill.skill_description,
        recent_activity: skill.attempted,
        avg_score: Math.round(skill.mastery * 100) // Convert to percentage
      }))
    ).filter(item => item.recent_activity > 0); // Only show skills with activity
    
    return skills;
  };
  
  // Use appropriate data based on whether a specific subject is selected
  const data = subject ? generateSkillActivityData() : generateUnitActivityData();
  
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-green-50 text-green-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              {subject ? 'Skill' : 'Units'}
            </TableHead>
            <TableHead className="text-right">Recent Activity</TableHead>
            <TableHead className="text-right">Avg Score</TableHead>
            {!subject && <TableHead className="text-right">Proficiency %</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {item.unit || item.skill}
              </TableCell>
              <TableCell className="text-right">{item.recent_activity}</TableCell>
              <TableCell className="text-right">
                <span className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium",
                  getScoreColorClass(item.avg_score)
                )}>
                  {item.avg_score}%
                </span>
              </TableCell>
              {!subject && (
                <TableCell className="text-right">
                  {item.proficiency}%
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">
              {data.reduce((sum, item) => sum + item.recent_activity, 0)}
            </TableCell>
            <TableCell className="text-right font-bold">
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                getScoreColorClass(
                  Math.round(
                    data.reduce((sum, item) => sum + (item.avg_score * item.recent_activity), 0) / 
                    data.reduce((sum, item) => sum + item.recent_activity, 0)
                  )
                )
              )}>
                {Math.round(
                  data.reduce((sum, item) => sum + (item.avg_score * item.recent_activity), 0) / 
                  data.reduce((sum, item) => sum + item.recent_activity, 0)
                )}%
              </span>
            </TableCell>
            {!subject && (
              <TableCell className="text-right font-bold">
                {Math.round(
                  data.reduce((sum, item) => sum + (item.proficiency || 0), 0) / 
                  data.filter(item => item.proficiency !== undefined).length
                )}%
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}