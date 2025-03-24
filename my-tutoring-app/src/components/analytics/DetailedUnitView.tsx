// src/components/analytics/DetailedUnitView.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DetailedUnitView() {
  const { metrics } = useAnalytics()
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['Ready'])
  
  if (!metrics || !metrics.hierarchical_data) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground">No data available</div>;
  }
  
  // Process data from the API to group by readiness status
  const processReadinessData = () => {
    // Get all units
    const units = metrics.hierarchical_data;
    
    // Create readiness groups
    const readinessGroups: Record<string, {
      status: string;
      completion_rate: number;
      average_score: number;
      proficiency: number;
      mastery: number;
      attempts: number;
      units: Array<{
        title: string;
        completion_rate: number;
        average_score: number;
        proficiency: number;
        mastery: number;
        attempts: number;
      }>;
    }> = {
      'Ready': {
        status: 'Ready',
        completion_rate: 0,
        average_score: 0,
        proficiency: 0,
        mastery: 0,
        attempts: 0,
        units: []
      },
      'Ready for Skill': {
        status: 'Ready for Skill',
        completion_rate: 0,
        average_score: 0,
        proficiency: 0,
        mastery: 0,
        attempts: 0,
        units: []
      }
    };
    
    // For each unit, check subskills for readiness status and group accordingly
    units.forEach(unit => {
      // Check if unit has any "Ready" subskills
      const hasReadySubskills = unit.skills.some(skill => 
        skill.subskills.some(subskill => 
          subskill.readiness_status === 'Ready'
        )
      );
      
      // Check if unit has any "Ready for Skill" subskills
      const hasReadyForSkillSubskills = unit.skills.some(skill => 
        skill.subskills.some(subskill => 
          subskill.readiness_status === 'Ready for Skill'
        )
      );
      
      // Create unit data
      const unitData = {
        title: unit.unit_title,
        completion_rate: Math.round(unit.completion),
        average_score: Math.round(unit.mastery * 100),
        proficiency: Math.round(unit.proficiency * 100),
        mastery: Math.round(unit.mastery * 100),
        attempts: unit.attempted
      };
      
      // Add unit to appropriate readiness group
      if (hasReadySubskills) {
        readinessGroups['Ready'].units.push(unitData);
        readinessGroups['Ready'].attempts += unitData.attempts;
      }
      
      if (hasReadyForSkillSubskills) {
        readinessGroups['Ready for Skill'].units.push(unitData);
        readinessGroups['Ready for Skill'].attempts += unitData.attempts;
      }
    });
    
    // Calculate averages for each readiness group
    Object.keys(readinessGroups).forEach(key => {
      const group = readinessGroups[key];
      if (group.units.length > 0) {
        const totalUnits = group.units.length;
        
        group.completion_rate = Math.round(
          group.units.reduce((sum, unit) => sum + unit.completion_rate, 0) / totalUnits
        );
        
        // Only calculate averages for units with attempts
        const unitsWithAttempts = group.units.filter(unit => unit.attempts > 0);
        if (unitsWithAttempts.length > 0) {
          group.average_score = Math.round(
            unitsWithAttempts.reduce((sum, unit) => sum + unit.average_score, 0) / unitsWithAttempts.length
          );
          
          group.proficiency = Math.round(
            unitsWithAttempts.reduce((sum, unit) => sum + unit.proficiency, 0) / unitsWithAttempts.length
          );
          
          group.mastery = Math.round(
            unitsWithAttempts.reduce((sum, unit) => sum + unit.mastery, 0) / unitsWithAttempts.length
          );
        }
      }
    });
    
    // Filter out empty groups
    const filteredGroups = Object.values(readinessGroups)
      .filter(group => group.units.length > 0);
    
    // Calculate totals
    const total = {
      completion_rate: Math.round(metrics.summary.completion),
      average_score: Math.round(metrics.summary.mastery * 100),
      proficiency: Math.round(metrics.summary.proficiency * 100),
      mastery: Math.round(metrics.summary.mastery * 100),
      attempts: metrics.summary.attempted_items
    };
    
    return { 
      readiness_groups: filteredGroups, 
      total 
    };
  };
  
  // Generate data from API
  const data = processReadinessData();
  
  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => 
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
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
            <TableHead className="w-[300px]">Readiness Status</TableHead>
            <TableHead className="text-right">Completion Rate %</TableHead>
            <TableHead className="text-right">Average Score</TableHead>
            <TableHead className="text-right">Proficiency %</TableHead>
            <TableHead className="text-right">Mastery %</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Readiness Groups */}
          {data.readiness_groups.map((group) => (
            <React.Fragment key={group.status}>
              {/* Group Header Row */}
              <TableRow className="bg-muted/50">
                <TableCell className="font-bold flex items-center">
                  <button 
                    onClick={() => toggleGroupExpansion(group.status)} 
                    className="mr-2"
                  >
                    {expandedGroups.includes(group.status) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {group.status}
                </TableCell>
                <TableCell className="text-right font-medium">{group.completion_rate}%</TableCell>
                <TableCell className="text-right font-medium">{group.average_score}%</TableCell>
                <TableCell className="text-right font-medium">{group.proficiency}%</TableCell>
                <TableCell className="text-right font-medium">{group.mastery}%</TableCell>
                <TableCell className="text-right font-medium">{group.attempts}</TableCell>
              </TableRow>
              
              {/* Unit Rows */}
              {expandedGroups.includes(group.status) && group.units.map((unit, index) => (
                <TableRow 
                  key={`${group.status}-${index}`}
                  className={unit.attempts > 0 ? "" : "text-muted-foreground"}
                >
                  <TableCell className="pl-8 font-medium">{unit.title}</TableCell>
                  <TableCell className="text-right">{unit.completion_rate}%</TableCell>
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
                  <TableCell className="text-right">{unit.proficiency}%</TableCell>
                  <TableCell className="text-right">{unit.mastery}%</TableCell>
                  <TableCell className="text-right">{unit.attempts}</TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
          
          {/* Totals Row */}
          <TableRow className="bg-muted/50">
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">{data.total.completion_rate}%</TableCell>
            <TableCell className="text-right font-bold">
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                getScoreColorClass(data.total.average_score)
              )}>
                {data.total.average_score}%
              </span>
            </TableCell>
            <TableCell className="text-right font-bold">{data.total.proficiency}%</TableCell>
            <TableCell className="text-right font-bold">{data.total.mastery}%</TableCell>
            <TableCell className="text-right font-bold">{data.total.attempts}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}