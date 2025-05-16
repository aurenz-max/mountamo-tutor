// components/analytics/SkillGaps.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Info, AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ChevronRight 
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { SkillGapsResponse, GapData, RecommendationData } from '@/lib/api';

interface SkillGapsProps {
  studentId: number;
  subject?: string;
}

const SkillGaps: React.FC<SkillGapsProps> = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SkillGapsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'gaps' | 'recommendations' | 'strengths'>('gaps');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getSkillGapsAnalysis(studentId, subject);
        setData(response);
        setError(null);
      } catch (err) {
        setError('Failed to load skill gaps analysis');
        console.error('Error fetching skill gaps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, subject]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Get color for score display
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-blue-100 text-blue-800';
    if (score >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Get color for priority
  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-800';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading skill gaps analysis...</div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No skill gaps data available'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Skills Analysis</h2>
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              activeTab === 'gaps' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveTab('gaps')}
          >
            Gaps
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              activeTab === 'recommendations' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveTab('recommendations')}
          >
            Recommendations
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              activeTab === 'strengths' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setActiveTab('strengths')}
          >
            Strengths
          </button>
        </div>
      </div>

      {/* Gaps View */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          {/* Prerequisite Gaps Section */}
          {data.prerequisite_gaps.length > 0 && (
            <Card>
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                  Prerequisite Skill Gaps ({data.prerequisite_gaps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {data.prerequisite_gaps.map((gap) => (
                    <div key={`${gap.subject}_${gap.skill_id}`} className="border-l-4 border-amber-400 pl-3 py-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{gap.skill_description}</h4>
                          <p className="text-sm text-gray-500">{gap.subject} - Unit {gap.unit_id}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(gap.score)}`}>
                          {(gap.score * 10).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular Gaps Section */}
          <Card>
            <CardHeader>
              <CardTitle>Skill Gaps ({data.gaps.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.gaps.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No skill gaps identified</p>
              ) : (
                <div className="space-y-3">
                  {data.gaps.map((gap) => (
                    <div 
                      key={`${gap.subject}_${gap.skill_id}_${gap.subskill_id}`}
                      className="border-l-4 border-blue-400 pl-3 py-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{gap.subskill_description || gap.skill_description}</h4>
                          <p className="text-sm text-gray-500">{gap.subject} - {gap.skill_id}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500">{gap.attempts} attempts</span>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(gap.score)}`}>
                            {(gap.score * 10).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendations View */}
      {activeTab === 'recommendations' && (
        <Card>
          <CardHeader>
            <CardTitle>Learning Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recommendations.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No recommendations available</p>
            ) : (
              <div className="space-y-4">
                {data.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-md ${
                      rec.priority === 'high' ? 'bg-red-50' :
                      rec.priority === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full mt-1 ${
                        rec.priority === 'high' ? 'bg-red-100' :
                        rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          rec.priority === 'high' ? 'text-red-500' :
                          rec.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium">
                            {rec.subskill_description || rec.skill_description}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs uppercase font-bold ${getPriorityColor(rec.priority)}`}>
                              {rec.priority}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(rec.current_score)}`}>
                              {(rec.current_score * 10).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{rec.subject} - {rec.skill_id}</p>
                        <p className="text-sm">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strengths View */}
      {activeTab === 'strengths' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Strengths</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.strengths.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No strengths identified yet</p>
            ) : (
              <div className="space-y-3">
                {data.strengths.map((strength) => (
                  <div 
                    key={`${strength.subject}_${strength.skill_id}_${strength.subskill_id}`}
                    className="border-l-4 border-green-400 pl-3 py-2"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{strength.subskill_description || strength.skill_description}</h4>
                        <p className="text-sm text-gray-500">{strength.subject} - {strength.skill_id}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500">{strength.attempts} attempts</span>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(strength.score)}`}>
                          {(strength.score * 10).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {activeTab === 'gaps' && 'These are areas where you might need more practice to improve your understanding.'}
          {activeTab === 'recommendations' && 'These recommendations are based on your performance data and will help you focus your learning efforts.'}
          {activeTab === 'strengths' && 'These are your strongest areas - skills where youve demonstrated solid mastery.'}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SkillGaps;