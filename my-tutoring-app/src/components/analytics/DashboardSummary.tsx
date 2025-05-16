// Updated DashboardSummary.tsx with enhanced subject data processing
import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, BookOpen, TrendingUp, CalendarDays } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { api } from '@/lib/api';

const DashboardSummary = ({ analytics, timeRange, loading, error }) => {
  // State to store processed subject data
  const [subjectOverview, setSubjectOverview] = useState([]);
  const [curriculumMap, setCurriculumMap] = useState({});
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  
  // Load curriculum data for unit mappings
  useEffect(() => {
    const loadCurriculumData = async () => {
      try {
        setIsLoadingCurriculum(true);
        
        // Attempt to get available subjects (we need at least one to get the curriculum)
        const subjects = await api.getSubjects();
        const subject = subjects && subjects.length > 0 ? subjects[0] : 'Mathematics';
        
        // Fetch curriculum for mapping skills to units
        const curriculumData = await api.getSubjectCurriculum(subject);
        
        // Create a mapping of skill IDs to their units
        const skillToUnitMap = {};
        
        if (curriculumData && curriculumData.curriculum) {
          curriculumData.curriculum.forEach(unit => {
            // Store unit data
            unit.skills.forEach(skill => {
              // Map this skill to its parent unit
              skillToUnitMap[skill.id] = {
                unitId: unit.id,
                unitTitle: unit.title
              };
            });
          });
        }
        
        setCurriculumMap(skillToUnitMap);
      } catch (err) {
        console.error('Error loading curriculum data:', err);
      } finally {
        setIsLoadingCurriculum(false);
      }
    };
    
    loadCurriculumData();
  }, []);
  
  // Process subject data when analytics or curriculum data changes
  useEffect(() => {
    if (analytics && analytics.detailedAnalytics && Object.keys(curriculumMap).length > 0) {
      processSubjectData();
    }
  }, [analytics, curriculumMap]);
  
  // Function to process subject data using the curriculum mapping
  const processSubjectData = () => {
    if (!analytics || !analytics.detailedAnalytics || !analytics.detailedAnalytics.currentStats.subSkills) {
      return;
    }
    
    // Group subskills by their parent unit (using the curriculum data)
    const subSkills = analytics.detailedAnalytics.currentStats.subSkills;
    const unitMap = {};
    
    Object.entries(subSkills).forEach(([subskillId, data]) => {
      // Extract the skill ID from the subskill ID
      const skillId = subskillId.split('_')[0] || subskillId;
      
      // Find the unit for this skill from our curriculum map
      const unitInfo = curriculumMap[skillId];
      
      // If we can't find the unit, put it in 'Other'
      const unitTitle = unitInfo ? unitInfo.unitTitle : 'Other';
      const unitId = unitInfo ? unitInfo.unitId : 'other';
      
      // Initialize unit data if not exists
      if (!unitMap[unitId]) {
        unitMap[unitId] = {
          id: unitId,
          name: unitTitle,
          totalScore: 0,
          totalProblems: 0,
          skillIds: new Set(),
          subskills: 0
        };
      }
      
      // Track this skill ID and accumulate scores
      unitMap[unitId].skillIds.add(skillId);
      unitMap[unitId].totalScore += data.averageScore * data.problems;
      unitMap[unitId].totalProblems += data.problems;
      unitMap[unitId].subskills += 1;
    });
    
    // Calculate average mastery for each unit
    const processedUnits = Object.values(unitMap).map(unit => ({
      id: unit.id,
      name: unit.name,
      mastery: unit.totalProblems > 0 ? (unit.totalScore / unit.totalProblems) : 0,
      problems: unit.totalProblems,
      skills: unit.skillIds.size,
      subskills: unit.subskills
    }));
    
    // Sort by mastery (highest first)
    processedUnits.sort((a, b) => b.mastery - a.mastery);
    
    setSubjectOverview(processedUnits);
  };
  
  // Function to get background color based on mastery level
  // This matches the MasteryHeatmap component's color system
  const getMasteryColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  
  // Custom tooltip component for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-md shadow-sm">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'timeSpent' ? ' min' : entry.name === 'competency' ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Function to determine mastery color based on score
  const getMasteryColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) {
    return <div className="p-8 text-center">No analytics data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Current Mastery</p>
                <h3 className="text-2xl font-bold">{analytics.detailedAnalytics.currentStats.averageScore.toFixed(1)}%</h3>
                <p className="text-sm text-gray-500">Raw Score</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Award className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Problems Completed</p>
                <h3 className="text-2xl font-bold">{analytics.detailedAnalytics.currentStats.totalProblems}</h3>
                <p className="text-sm text-gray-500">Total Attempts</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <BookOpen className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Credibility</p>
                <h3 className="text-2xl font-bold">{(analytics.detailedAnalytics.currentStats.credibility * 100).toFixed(0)}%</h3>
                <p className="text-sm text-gray-500">Data Confidence</p>
              </div>
              <div className="p-3 rounded-full bg-amber-100">
                <TrendingUp className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Days</p>
                <h3 className="text-2xl font-bold">
                  {analytics.dailyProgress.filter(day => day.problems > 0).length}
                </h3>
                <p className="text-sm text-gray-500">of {analytics.dailyProgress.length}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <CalendarDays className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Competency Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Competency Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dailyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="competency"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    name="Competency"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Time vs Problems Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyProgress}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="timeSpent"
                    stroke="#82ca9d"
                    name="Time Spent"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="problems"
                    stroke="#ffc658"
                    name="Problems Solved"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Overview using curriculum hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingCurriculum ? (
              <div className="p-4 text-center">Loading curriculum data...</div>
            ) : (
              <>
                {subjectOverview.map((unit) => (
                  <Card key={unit.id} className="overflow-hidden">
                    <div className="p-4 flex justify-between items-center border-b">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium">{unit.name}</h3>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-500">{unit.skills} skills</span>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(unit.mastery)}`}>
                          {unit.mastery.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <CardContent className="pt-2 pb-3">
                      <div className="h-2 w-full bg-gray-100 rounded-full">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${unit.mastery}%`, 
                            backgroundColor: unit.mastery >= 80 ? '#10B981' : 
                                            unit.mastery >= 60 ? '#3B82F6' : 
                                            unit.mastery >= 40 ? '#F59E0B' : '#EF4444'
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>{unit.problems} problems completed</span>
                        <span>{unit.subskills} subskills attempted</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* If no subject data is available */}
                {subjectOverview.length === 0 && !isLoadingCurriculum && (
                  <p className="text-gray-500 text-center py-4">No curriculum data available</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {timeRange === 'week' ? 'Weekly' : timeRange === 'month' ? 'Monthly' : 'Yearly'} Summary: 
          You've spent {analytics.dailyProgress.reduce((sum, day) => sum + day.timeSpent, 0)} minutes learning
          and completed {analytics.dailyProgress.reduce((sum, day) => sum + day.problems, 0)} problems.
          {analytics.dailyProgress.length > 1 && 
            ` Your competency has changed from ${analytics.dailyProgress[0]?.competency.toFixed(1)}% 
            to ${analytics.dailyProgress[analytics.dailyProgress.length - 1]?.competency.toFixed(1)}%.`}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default DashboardSummary;