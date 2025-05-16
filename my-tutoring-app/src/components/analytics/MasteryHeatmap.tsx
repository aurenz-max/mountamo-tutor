// components/analytics/MasteryHeatmap.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronRight, ChevronDown, Info, BookOpen
} from "lucide-react";
import { api } from '@/lib/api';

interface MasteryHeatmapProps {
  studentId: number;
  subject: string;
}

// Define the data structure based on your actual API response
interface SubskillData {
  id: string;
  description: string;
  mastery: number;
  average_score: number;
  completion: number;
  credibility: number;
  attempts: number;
  difficulty_range?: {
    start: number;
    end: number;
    target: number;
  };
}

interface SkillData {
  id: string;
  description: string;
  mastery: number;
  average_score: number;
  completion: number;
  credibility: number;
  subskills: SubskillData[];
}

interface UnitData {
  id: string;
  title: string;
  mastery: number;
  average_score: number;
  completion: number;
  credibility: number;
  skills: SkillData[];
}

interface MasteryMapResponse {
  student_id: number;
  subject: string;
  subject_mastery: number;
  subject_completion: number;
  subject_average_score: number;
  subject_credibility: number;
  mastery_map: UnitData[];
}

const MasteryHeatmap: React.FC<MasteryHeatmapProps> = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MasteryMapResponse | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getStudentMasteryMap(studentId, subject);
        setData(response);
        
        // Initialize expanded states
        const unitExpanded = {};
        response.mastery_map.forEach(unit => {
          unitExpanded[unit.id] = false;
        });
        setExpandedUnits(unitExpanded);
        
        const skillExpanded = {};
        response.mastery_map.forEach(unit => {
          unit.skills.forEach(skill => {
            skillExpanded[`${unit.id}_${skill.id}`] = false;
          });
        });
        setExpandedSkills(skillExpanded);
        
        setError(null);
      } catch (err) {
        setError('Failed to load mastery heatmap');
        console.error('Error fetching mastery map:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, subject]);

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const toggleSkill = (unitId: string, skillId: string) => {
    const key = `${unitId}_${skillId}`;
    setExpandedSkills(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Function to get background color based on mastery level
  const getMasteryColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading mastery heatmap...</div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No mastery data available'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mastery Heatmap</h2>
      
      {/* Subject Level Summary */}
      <Card className="overflow-hidden">
        <div className="p-4 flex justify-between items-center border-b bg-slate-50">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium">{subject}</h3>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">{data.mastery_map.length} units</span>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(data.subject_mastery)}`}>
              {data.subject_mastery.toFixed(1)}% Mastery
            </div>
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {data.subject_completion.toFixed(1)}% Complete
            </div>
          </div>
        </div>
      </Card>
      
      <div className="space-y-4">
        {data.mastery_map.map((unit) => (
          <Card key={unit.id} className="overflow-hidden">
            <div 
              className="p-4 flex justify-between items-center cursor-pointer border-b"
              onClick={() => toggleUnit(unit.id)}
            >
              <div className="flex items-center space-x-2">
                {expandedUnits[unit.id] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <h3 className="text-lg font-medium">{unit.title}</h3>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">{unit.skills.length} skills</span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(unit.mastery)}`}>
                  {unit.mastery.toFixed(1)}% Mastery
                </div>
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {unit.completion.toFixed(1)}% Complete
                </div>
              </div>
            </div>
            
            {expandedUnits[unit.id] && (
              <CardContent className="pt-4">
                <div className="space-y-3 pl-6">
                  {unit.skills.map((skill) => (
                    <div key={skill.id} className="border rounded-md overflow-hidden">
                      <div 
                        className="p-3 flex justify-between items-center cursor-pointer bg-gray-50"
                        onClick={() => toggleSkill(unit.id, skill.id)}
                      >
                        <div className="flex items-center space-x-2">
                          {expandedSkills[`${unit.id}_${skill.id}`] ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />}
                          <h4 className="font-medium">{skill.description}</h4>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500">
                            {skill.subskills.reduce((sum, subskill) => sum + subskill.attempts, 0)} attempts
                          </span>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(skill.mastery)}`}>
                            {skill.mastery.toFixed(1)}% Mastery
                          </div>
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {skill.completion.toFixed(1)}% Complete
                          </div>
                        </div>
                      </div>
                      
                      {expandedSkills[`${unit.id}_${skill.id}`] && (
                        <div className="p-3 pl-9 space-y-2">
                          {skill.subskills.map((subskill) => (
                            <div key={subskill.id} className="flex justify-between items-center p-2 border-b">
                              <span className="text-sm">{subskill.description}</span>
                              <div className="flex items-center space-x-3">
                                <span className="text-xs text-gray-500">
                                  {subskill.attempts} attempts
                                </span>
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(subskill.mastery)}`}>
                                  {subskill.mastery.toFixed(1)}% Mastery
                                </div>
                                <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {subskill.completion.toFixed(1)}% Complete
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This heatmap shows your mastery level across the curriculum. Click on units and skills to explore your detailed competencies.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MasteryHeatmap;