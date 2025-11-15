// components/analytics/CurriculumTree.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Star, Book, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface CurriculumTreeProps {
  studentId: number;
}

// Helper function to determine level color
const getLevelColor = (value: number) => {
  if (value >= 90) return "#10b981"; // emerald-500
  if (value >= 75) return "#3b82f6"; // blue-500
  if (value >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
};

const CurriculumTree: React.FC<CurriculumTreeProps> = ({ studentId }) => {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [curriculumData, setCurriculumData] = useState<any | null>(null);
  const [metricsData, setMetricsData] = useState<Record<string, any>>({});
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [expandedSkills, setExpandedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  // Fetch available subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const data = await api.getSubjects();
        setSubjects(data);
        
        if (data.length > 0 && !selectedSubject) {
          setSelectedSubject(data[0]);
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
        setError('Failed to load subjects');
      }
    };

    fetchSubjects();
  }, []);

  // Fetch curriculum and attempts data when subject changes
  useEffect(() => {
    if (!selectedSubject) return;
    
    const fetchCurriculumAndMetrics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch curriculum structure
        const curriculum = await api.getSubjectCurriculum(selectedSubject);
        setCurriculumData(curriculum);
        
        // Fetch attempts data
        const attempts = await api.getStudentAttempts(studentId, selectedSubject);
        
        // Calculate metrics for each curriculum item
        const metrics = calculateMetrics(curriculum, attempts);
        setMetricsData(metrics);
        
        // Get recommendation
        try {
          const recommendationData = await api.getNextRecommendations({
            student_id: studentId,
            subject: selectedSubject
          });
          
          if (recommendationData && recommendationData.recommended_skills && recommendationData.recommended_skills.length > 0) {
            setRecommendation(recommendationData.recommended_skills[0]);
          } else {
            setRecommendation(null);
          }
        } catch (err) {
          console.error('Error fetching recommendations:', err);
          setRecommendation(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching curriculum data:', err);
        setError('Failed to load curriculum data');
        setLoading(false);
      }
    };
    
    fetchCurriculumAndMetrics();
  }, [studentId, selectedSubject]);

  // Toggle expansion of a unit
  const toggleUnit = (unitId: string) => {
    if (expandedUnits.includes(unitId)) {
      setExpandedUnits(expandedUnits.filter(id => id !== unitId));
    } else {
      setExpandedUnits([...expandedUnits, unitId]);
    }
  };

  // Toggle expansion of a skill
  const toggleSkill = (skillId: string) => {
    if (expandedSkills.includes(skillId)) {
      setExpandedSkills(expandedSkills.filter(id => id !== skillId));
    } else {
      setExpandedSkills([...expandedSkills, skillId]);
    }
  };

  // Calculate metrics for all curriculum items
  const calculateMetrics = (curriculum: any, attempts: any[]) => {
    const metrics: Record<string, any> = {};
    
    // Helper function to count attempts and calculate scores
    const processItem = (itemId: string, itemType: 'unit' | 'skill' | 'subskill', parentIds: string[] = []) => {
      // Filter attempts for this item
      const itemAttempts = attempts.filter(attempt => {
        if (itemType === 'unit') {
          return attempt.unit_id === itemId;
        } else if (itemType === 'skill') {
          return attempt.skill_id === itemId;
        } else {
          return attempt.subskill_id === itemId;
        }
      });
      
      // Calculate metrics
      const totalAttempts = itemAttempts.length;
      const averageScore = totalAttempts > 0 
        ? itemAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / totalAttempts
        : 0;
      
      // Store metrics
      metrics[itemId] = {
        totalAttempts,
        averageScore: averageScore,
        // Normalize to percentage (assuming score is 0-10)
        proficiency: Math.round((averageScore / 10) * 100),
        // For mastery and coverage, we'll need to calculate after processing all items
        mastery: 0,
        coverage: 0,
        childIds: [],
        parentIds
      };
      
      return itemId;
    };
    
    // Process all units, skills, and subskills in the curriculum
    const processUnits = (units: any[], parentIds: string[] = []) => {
      if (!Array.isArray(units)) return [];
      
      return units.map(unit => {
        const unitId = processItem(unit.unit_id || unit.id, 'unit', parentIds);
        
        // Process skills
        const skillIds = processSkills(unit.skills || [], [unitId, ...parentIds]);
        metrics[unitId].childIds = skillIds;
        
        return unitId;
      });
    };
    
    const processSkills = (skills: any[], parentIds: string[] = []) => {
      if (!Array.isArray(skills)) return [];
      
      return skills.map(skill => {
        const skillId = processItem(skill.skill_id || skill.id, 'skill', parentIds);
        
        // Process subskills
        const subskillIds = processSubskills(skill.subskills || [], [skillId, ...parentIds]);
        metrics[skillId].childIds = subskillIds;
        
        return skillId;
      });
    };
    
    const processSubskills = (subskills: any[], parentIds: string[] = []) => {
      if (!Array.isArray(subskills)) return [];
      
      return subskills.map(subskill => {
        const subskillId = processItem(subskill.subskill_id || subskill.id, 'subskill', parentIds);
        metrics[subskillId].childIds = [];
        return subskillId;
      });
    };
    
    // Start processing from units
    const unitIds = processUnits(curriculum?.units || []);
    
    // Calculate mastery and coverage
    // First count total subskills
    let totalSubskills = 0;
    let attemptedSubskills = 0;
    
    // Helper to calculate mastery and coverage bottom-up
    const calculateHierarchicalMetrics = (itemId: string) => {
      const item = metrics[itemId];
      
      if (!item) return { mastery: 0, coverage: 0, attemptedItems: 0, totalItems: 0 };
      
      // If no children, this is a leaf node (subskill)
      if (item.childIds.length === 0) {
        totalSubskills++;
        if (item.totalAttempts > 0) attemptedSubskills++;
        
        // For leaf nodes, mastery equals proficiency if attempted
        item.mastery = item.proficiency;
        item.coverage = item.totalAttempts > 0 ? 100 : 0;
        return { 
          mastery: item.mastery, 
          coverage: item.coverage,
          attemptedItems: item.totalAttempts > 0 ? 1 : 0,
          totalItems: 1
        };
      }
      
      // For non-leaf nodes, calculate based on children
      let totalMastery = 0;
      let totalCoverage = 0;
      let childAttemptedItems = 0;
      let childTotalItems = 0;
      
      item.childIds.forEach((childId: string) => {
        const childMetrics = calculateHierarchicalMetrics(childId);
        totalMastery += childMetrics.mastery * childMetrics.totalItems;
        totalCoverage += childMetrics.coverage * childMetrics.totalItems;
        childAttemptedItems += childMetrics.attemptedItems;
        childTotalItems += childMetrics.totalItems;
      });
      
      // Average mastery and coverage weighted by number of subskills
      item.mastery = childTotalItems > 0 ? Math.round(totalMastery / childTotalItems) : 0;
      item.coverage = childTotalItems > 0 ? Math.round(totalCoverage / childTotalItems) : 0;
      
      return { 
        mastery: item.mastery, 
        coverage: item.coverage,
        attemptedItems: childAttemptedItems,
        totalItems: childTotalItems
      };
    };
    
    // Calculate metrics for all units
    unitIds.forEach(unitId => {
      calculateHierarchicalMetrics(unitId);
    });
    
    return metrics;
  };

  // Render a metric badge
  const renderMetricBadge = (value: number, label: string, colorClass: string) => (
    <div className="flex flex-col items-center">
      <div className={`text-xs font-semibold ${colorClass}`}>{label}</div>
      <div className={`text-sm font-bold ${colorClass}`}>{value}%</div>
    </div>
  );

  // Render loading state
  if (loading && !curriculumData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-48" />
        </div>
        
        {[1, 2, 3].map(i => (
          <Card key={i} className="w-full">
            <CardContent className="p-4">
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-6 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <p className="text-red-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Subject Selector */}
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">Learning Path</div>
        <Select value={selectedSubject || ''} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Curriculum" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map(subject => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Recommendation Card */}
      {recommendation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">Recommended next:</div>
              <div className="text-amber-700">{recommendation}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Units */}
      {curriculumData && Array.isArray(curriculumData.units) && curriculumData.units.map((unit: any) => {
        const unitId = unit.unit_id || unit.id;
        const unitMetrics = metricsData[unitId] || { mastery: 0, proficiency: 0, coverage: 0 };
        const isExpanded = expandedUnits.includes(unitId);
        
        return (
          <div key={unitId} className="space-y-2">
            {/* Unit Card */}
            <Card 
              className="w-full cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleUnit(unitId)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <BookOpen className="h-5 w-5 text-gray-700" />
                    <span className="font-semibold">{unit.title || unit.name}</span>
                  </div>
                  
                  <div className="flex gap-4">
                    {renderMetricBadge(unitMetrics.mastery, 'Mastery', 'text-blue-600')}
                    {renderMetricBadge(unitMetrics.proficiency, 'Proficiency', 'text-violet-600')}
                    {renderMetricBadge(unitMetrics.coverage, 'Coverage', 'text-emerald-600')}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-2">
                  <Progress 
                    value={unitMetrics.mastery} 
                    className="h-1.5"
                    indicatorClassName="bg-gradient-to-r from-blue-400 to-blue-600"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Skills (shown when unit is expanded) */}
            {isExpanded && Array.isArray(unit.skills) && (
              <div className="pl-6 space-y-2">
                {unit.skills.map((skill: any) => {
                  const skillId = skill.skill_id || skill.id;
                  const skillMetrics = metricsData[skillId] || { mastery: 0, proficiency: 0, coverage: 0 };
                  const isSkillExpanded = expandedSkills.includes(skillId);
                  
                  return (
                    <div key={skillId} className="space-y-2">
                      {/* Skill Card */}
                      <Card 
                        className="w-full cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleSkill(skillId)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isSkillExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                              <Book className="h-4 w-4 text-gray-700" />
                              <span className="font-medium text-sm">{skill.description || skill.name}</span>
                            </div>
                            
                            <div className="flex gap-3">
                              {renderMetricBadge(skillMetrics.mastery, 'M', 'text-blue-600')}
                              {renderMetricBadge(skillMetrics.proficiency, 'P', 'text-violet-600')}
                              {renderMetricBadge(skillMetrics.coverage, 'C', 'text-emerald-600')}
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-1.5">
                            <Progress 
                              value={skillMetrics.mastery} 
                              className="h-1"
                              indicatorClassName="bg-gradient-to-r from-blue-400 to-blue-600"
                            />
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Subskills (shown when skill is expanded) */}
                      {isSkillExpanded && Array.isArray(skill.subskills) && (
                        <div className="pl-6 space-y-2">
                          {skill.subskills.map((subskill: any) => {
                            const subskillId = subskill.subskill_id || subskill.id;
                            const subskillMetrics = metricsData[subskillId] || { mastery: 0, proficiency: 0, coverage: 0 };
                            const hasRecommendation = recommendation === subskill.description;
                            
                            return (
                              <Card 
                                key={subskillId} 
                                className={`w-full ${hasRecommendation ? 'bg-amber-50 border-amber-300' : ''}`}
                              >
                                <CardContent className="p-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {hasRecommendation && (
                                        <Star className="h-4 w-4 text-amber-500" />
                                      )}
                                      <span className="text-sm">{subskill.description || subskill.name}</span>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      {renderMetricBadge(subskillMetrics.mastery, 'M', 'text-blue-600')}
                                      {renderMetricBadge(subskillMetrics.proficiency, 'P', 'text-violet-600')}
                                      {renderMetricBadge(subskillMetrics.coverage, 'C', 'text-emerald-600')}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {/* Empty state */}
      {(!curriculumData || !Array.isArray(curriculumData.units) || curriculumData.units.length === 0) && (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500">No curriculum data available for {selectedSubject}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CurriculumTree;