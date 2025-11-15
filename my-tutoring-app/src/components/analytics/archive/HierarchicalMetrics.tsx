// src/components/analytics/HierarchicalMetrics.tsx - Updated to use props while preserving all features
'use client'

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnalyticsMetricsResponse } from '@/lib/authApiClient'

interface HierarchicalMetricsProps {
  data: AnalyticsMetricsResponse;
}

export default function HierarchicalMetrics({ data: metrics }: HierarchicalMetricsProps) {
  const [expandedUnits, setExpandedUnits] = useState<string[]>([])
  const [expandedSkills, setExpandedSkills] = useState<string[]>([])
  
  // Initialize with first unit expanded if available
  React.useEffect(() => {
    if (metrics?.hierarchical_data && metrics.hierarchical_data.length > 0) {
      const firstUnitId = metrics.hierarchical_data[0].unit_id;
      setExpandedUnits(prev => prev.length === 0 ? [firstUnitId] : prev);
    }
  }, [metrics?.hierarchical_data]);
  
  if (!metrics || !metrics.hierarchical_data) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground">No data available</div>
  }

  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId) 
        : [...prev, unitId]
    )
  }

  const toggleSkillExpansion = (skillId: string) => {
    setExpandedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId) 
        : [...prev, skillId]
    )
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }
  
  const getMetricColor = (value: number) => {
    const percent = value * 100
    if (percent >= 80) return 'bg-green-100 text-green-800'
    if (percent >= 70) return 'bg-lime-100 text-lime-800'
    if (percent >= 60) return 'bg-yellow-100 text-yellow-800'
    if (percent >= 50) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  // Calculate total number of subskills in a unit
  const getTotalSubskills = (unit: any) => {
    return unit.skills.reduce((total: number, skill: any) => total + skill.total_subskills, 0);
  }

  // Calculate total number of attempted subskills in a unit
  const getAttemptedSubskills = (unit: any) => {
    return unit.skills.reduce((total: number, skill: any) => 
      total + skill.attempted_subskills, 0);
  }

  // Get status display for a unit
  const getUnitStatus = (unit: any) => {
    const readyItems = unit.skills.reduce((total: number, skill: any) => 
      total + skill.subskills.filter((subskill: any) => 
        subskill.readiness_status === 'Ready' || 
        subskill.readiness_status === 'Ready for Subskill'
      ).length, 0);
    
    const recommendedItems = unit.skills.reduce((total: number, skill: any) => 
      total + skill.subskills.filter((subskill: any) => 
        subskill.recommended_next !== null
      ).length, 0);

    return (
      <div className="flex space-x-2">
        {readyItems > 0 && (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
            {readyItems} items ready
          </span>
        )}
        {recommendedItems > 0 && (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
            {recommendedItems} recommended
          </span>
        )}
        {getAttemptedSubskills(unit) > 0 && (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
            In Progress
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Curriculum Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[350px]">Curriculum Level</TableHead>
                <TableHead className="text-right">Mastery</TableHead>
                <TableHead className="text-right">Proficiency</TableHead>
                <TableHead className="text-right">Average Score</TableHead>
                <TableHead className="text-right">Completion %</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Summary Row */}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>Overall Summary (All Subjects)</TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "px-2 py-1 rounded-md font-medium",
                    getMetricColor(metrics.summary.mastery)
                  )}>
                    {formatPercent(metrics.summary.mastery)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "px-2 py-1 rounded-md font-medium",
                    getMetricColor(metrics.summary.proficiency)
                  )}>
                    {formatPercent(metrics.summary.proficiency)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "px-2 py-1 rounded-md font-medium",
                    getMetricColor(metrics.summary.avg_score)
                  )}>
                    {formatPercent(metrics.summary.avg_score)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(metrics.summary.completion)}
                </TableCell>
                <TableCell className="text-right">{metrics.summary.attempt_count}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      {metrics.summary.ready_items} items ready
                    </span>
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                      {metrics.summary.recommended_items} recommended
                    </span>
                  </div>
                </TableCell>
              </TableRow>

              {/* Units */}
              {metrics.hierarchical_data.map((unit) => (
                <React.Fragment key={unit.unit_id}>
                  {/* Unit Row */}
                  <TableRow>
                    <TableCell>
                      <button 
                        onClick={() => toggleUnitExpansion(unit.unit_id)}
                        className="flex items-center text-left font-medium hover:text-primary"
                      >
                        {expandedUnits.includes(unit.unit_id) ? (
                          <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                        )}
                        {unit.unit_title}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "px-2 py-1 rounded-md font-medium",
                        getMetricColor(unit.mastery)
                      )}>
                        {formatPercent(unit.mastery)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "px-2 py-1 rounded-md font-medium",
                        getMetricColor(unit.proficiency)
                      )}>
                        {formatPercent(unit.proficiency)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "px-2 py-1 rounded-md font-medium",
                        getMetricColor(unit.avg_score)
                      )}>
                        {formatPercent(unit.avg_score)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatPercent(unit.completion)}</TableCell>
                    <TableCell className="text-right">{unit.attempt_count}</TableCell>
                    <TableCell>
                      {getUnitStatus(unit)}
                    </TableCell>
                  </TableRow>

                  {/* Skills (when unit is expanded) */}
                  {expandedUnits.includes(unit.unit_id) && unit.skills.map((skill) => (
                    <React.Fragment key={skill.skill_id}>
                      {/* Skill Row */}
                      <TableRow className="border-l-2 border-l-gray-200">
                        <TableCell className="pl-8">
                          <button 
                            onClick={() => toggleSkillExpansion(skill.skill_id)}
                            className="flex items-center text-left hover:text-primary"
                          >
                            {expandedSkills.includes(skill.skill_id) ? (
                              <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                            )}
                            {skill.skill_description}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-md font-medium",
                            getMetricColor(skill.mastery)
                          )}>
                            {formatPercent(skill.mastery)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-md font-medium",
                            getMetricColor(skill.proficiency)
                          )}>
                            {formatPercent(skill.proficiency)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "px-2 py-1 rounded-md font-medium",
                            getMetricColor(skill.avg_score)
                          )}>
                            {formatPercent(skill.avg_score)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatPercent(skill.completion)}</TableCell>
                        <TableCell className="text-right">
                          {skill.attempt_count}
                        </TableCell>
                        <TableCell>
                          {skill.attempted_subskills > 0 ? (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              In Progress
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                              Not Started
                            </span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Subskills (when skill is expanded) */}
                      {expandedSkills.includes(skill.skill_id) && skill.subskills.map((subskill) => (
                        <TableRow 
                          key={subskill.subskill_id}
                          className="border-l-4 border-l-gray-200"
                        >
                          <TableCell className="pl-16">
                            {subskill.subskill_description}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "px-2 py-1 rounded-md font-medium",
                              getMetricColor(subskill.mastery)
                            )}>
                              {formatPercent(subskill.mastery)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "px-2 py-1 rounded-md font-medium",
                              getMetricColor(subskill.proficiency)
                            )}>
                              {formatPercent(subskill.proficiency)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "px-2 py-1 rounded-md font-medium",
                              getMetricColor(subskill.avg_score)
                            )}>
                              {formatPercent(subskill.avg_score)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(subskill.completion)}
                          </TableCell>
                          <TableCell className="text-right">
                            {subskill.attempt_count}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium",
                                subskill.readiness_status === 'Ready' ? "bg-blue-100 text-blue-800" :
                                subskill.readiness_status === 'Ready for Subskill' ? "bg-cyan-100 text-cyan-800" :
                                subskill.readiness_status === 'Ready for Skill' ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              )}>
                                {subskill.readiness_status}
                              </span>
                              <span className={cn(
                                "px-2 py-1 rounded-md text-xs font-medium",
                                subskill.priority_level === 'Mastered' ? "bg-green-100 text-green-800" :
                                subskill.priority_level === 'High Priority' ? "bg-orange-100 text-orange-800" :
                                subskill.priority_level === 'Medium Priority' ? "bg-yellow-100 text-yellow-800" :
                                subskill.priority_level === 'Not Started' ? "bg-gray-100 text-gray-800" :
                                "bg-blue-100 text-blue-800"
                              )}>
                                {subskill.priority_level}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}