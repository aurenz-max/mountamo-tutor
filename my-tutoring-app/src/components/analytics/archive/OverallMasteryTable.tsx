// src/components/analytics/OverallMasteryTable.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function OverallMasteryTable() {
  const { metrics, subject } = useAnalytics()
  const [expandedUnits, setExpandedUnits] = React.useState<string[]>([])
  
  if (!metrics || !metrics.hierarchical_data) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground">No data available</div>;
  }
  
  // Process data from the API
  const subjectName = subject || 'All Subjects';
  
  // Calculate overall metrics
  const totalAttempts = metrics.summary.attempt_count; // Use attempt_count instead of attempted_items
  const totalProficiency = Math.round(metrics.summary.proficiency * 100);
  const totalCompletionRate = Math.round(metrics.summary.completion);
  const totalMastery = Math.round(metrics.summary.mastery * 100);
  
  // Calculate average score from all attempted items
  const avgScore = Math.round(metrics.summary.avg_score * 100); // Use avg_score from the data
  
  // Transform unit data
  const unitData = metrics.hierarchical_data.map(unit => ({
    id: unit.unit_id,
    title: unit.unit_title,
    attempts: unit.attempt_count, // Use attempt_count instead of attempted
    proficiency: Math.round(unit.proficiency * 100),
    completion_rate: Math.round(unit.completion),
    mastery: Math.round(unit.mastery * 100),
    average_score: Math.round(unit.avg_score * 100) // Use avg_score from the data
  }));
  
  // Create data object for rendering
  const data = {
    subject: subjectName,
    attempts: totalAttempts,
    proficiency: totalProficiency,
    completion_rate: totalCompletionRate,
    mastery: totalMastery,
    average_score: avgScore,
    units: unitData
  };
  
  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits((prev) => 
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
    )
  }
  
  const getScoreColorClass = (score: number) => {
    if (score === 0) return '';
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
            <TableHead className="w-[300px]">Subject</TableHead>
            <TableHead className="text-right">Attempt Count</TableHead>
            <TableHead className="text-right">Proficiency %</TableHead>
            <TableHead className="text-right">Completion Rate %</TableHead>
            <TableHead className="text-right">Mastery %</TableHead>
            <TableHead className="text-right">Average Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Subject Row */}
          <TableRow className="bg-muted/50">
            <TableCell className="font-bold flex items-center">
              <ChevronDown className="h-4 w-4 mr-2" />
              {data.subject}
            </TableCell>
            <TableCell className="text-right font-bold">{data.attempts}</TableCell>
            <TableCell className="text-right font-bold">{data.proficiency}%</TableCell>
            <TableCell className="text-right font-bold">{data.completion_rate}%</TableCell>
            <TableCell className="text-right font-bold">{data.mastery}%</TableCell>
            <TableCell className="text-right font-bold">{data.average_score}%</TableCell>
          </TableRow>
          
          {/* Unit Rows */}
          {data.units.map((unit) => (
            <TableRow 
              key={unit.id}
              className={unit.attempts > 0 ? "" : "text-muted-foreground"}
            >
              <TableCell className="font-medium pl-8 flex items-center">
                <button onClick={() => toggleUnitExpansion(unit.id)} className="mr-2">
                  {expandedUnits.includes(unit.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {unit.title}
              </TableCell>
              <TableCell className="text-right">{unit.attempts}</TableCell>
              <TableCell className="text-right">{unit.proficiency}%</TableCell>
              <TableCell className="text-right">{unit.completion_rate}%</TableCell>
              <TableCell className="text-right">{unit.mastery}%</TableCell>
              <TableCell className="text-right">
                {unit.average_score > 0 && (
                  <span className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium",
                    getScoreColorClass(unit.average_score)
                  )}>
                    {unit.average_score}%
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
          
          {/* Totals Row */}
          <TableRow className="bg-muted/50">
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">{data.attempts}</TableCell>
            <TableCell className="text-right font-bold">{data.proficiency}%</TableCell>
            <TableCell className="text-right font-bold">{data.completion_rate}%</TableCell>
            <TableCell className="text-right font-bold">{data.mastery}%</TableCell>
            <TableCell className="text-right font-bold">
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                getScoreColorClass(data.average_score)
              )}>
                {data.average_score}%
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}