// components/analytics/SkillsProgression.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

interface SkillsProgressionProps {
  studentId: number;
  subject?: string;
}

// List of colors for chart lines - using accessible color palette
const LINE_COLORS = [
  '#4285F4', '#34A853', '#FBBC05', '#EA4335', '#8AB4F8', 
  '#137333', '#F29900', '#C5221F', '#669DF6', '#1E8E3E'
];

const SkillsProgression: React.FC<SkillsProgressionProps> = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [timePeriod, setTimePeriod] = useState('quarter'); // Default to quarter for better visualization
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>(subject || '');
  const [chartData, setChartData] = useState<any[]>([]);

  // Fetch available subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const availableSubjects = await api.getSubjects();
        setSubjects(availableSubjects);
        
        // If no subject was provided and we have subjects available, use the first one
        if (!subject && availableSubjects.length > 0) {
          setSelectedSubject(availableSubjects[0]);
        } else if (subject) {
          setSelectedSubject(subject);
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };
    
    fetchSubjects();
  }, [subject]);

  // Fetch performance data when subject or time period changes
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSubject) return;
      
      try {
        setLoading(true);
        
        // Make a direct fetch to the correct endpoint instead of using api client
        // This is a temporary fix until the api client can be updated
        
        const responseData = await api.getSubjectPerformanceDetails(studentId, selectedSubject, timePeriod);
        setData(responseData);
        
        // Extract skill ids from skill analytics
        if (responseData.skill_analytics && responseData.skill_analytics.length > 0) {
          // Sort by score and select top 5 skills
          const topSkills = [...responseData.skill_analytics]
            .sort((a, b) => b.average_score - a.average_score)
            .slice(0, Math.min(5, responseData.skill_analytics.length))
            .map(skill => skill.skill_id);
          
          setSelectedSkills(topSkills);
        }
        
        // Generate chart data for progression over time
        const progressData = generateChartData(responseData);
        setChartData(progressData);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching performance details:', err);
        setError(`Failed to load skill progression data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, selectedSubject, timePeriod]);

  // Generate chart data from the response
  const generateChartData = (responseData: any) => {
    if (!responseData || !responseData.skill_analytics) return [];
    
    // For the progression chart, we'll use time-based data
    // Since the endpoint doesn't directly provide time-series data, 
    // we'll use the skills data with their trends to simulate some progression
    
    // Get all skills
    const allSkills = responseData.skill_analytics;
    
    // For each skill, we'll create data points based on trend
    // 3 points: past, current, and projected
    
    // Step 1: Create time periods (we'll use relative periods)
    const periods = ["Previous", "Current", "Projected"];
    
    // Step 2: Create data points for each period
    const chartData = periods.map((period, periodIndex) => {
      // Start with the period
      const dataPoint: any = { period };
      
      // Add data for each skill
      allSkills.forEach(skill => {
        // Determine the skill score for this period based on trend
        let score = skill.average_score * 10; // Convert to percentage
        const trendValue = skill.trend_value ? skill.trend_value * 10 : 0; // Convert to percentage change
        
        if (periodIndex === 0) {
          // Previous period (subtract trend value)
          score = Math.max(0, score - trendValue);
        } else if (periodIndex === 2) {
          // Projected (add trend value)
          score = Math.min(100, score + trendValue);
        }
        
        // Add to data point
        dataPoint[skill.skill_id] = score;
      });
      
      return dataPoint;
    });
    
    return chartData;
  };

  // Toggle skill selection
  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev => {
      if (prev.includes(skillId)) {
        return prev.filter(id => id !== skillId);
      } else {
        return [...prev, skillId];
      }
    });
  };

  // Get skill display name
  const getSkillDisplayName = (skillId: string): string => {
    if (!data || !data.skill_analytics) return skillId;
    
    const skill = data.skill_analytics.find(s => s.skill_id === skillId);
    if (skill) {
      // Use description if available, or fall back to ID
      return skill.description ? 
        (skill.description.length > 20 ? skill.description.substring(0, 20) + '...' : skill.description) : 
        skillId;
    }
    
    return skillId;
  };

  // Get skill info (score and trend)
  const getSkillInfo = (skillId: string) => {
    if (!data || !data.skill_analytics) return { score: 0, trend: 'stable' };
    
    const skill = data.skill_analytics.find(s => s.skill_id === skillId);
    if (!skill) return { score: 0, trend: 'stable' };
    
    return {
      score: skill.average_score * 10, // Convert to percentage
      trend: skill.trend || 'stable',
      trendValue: skill.trend_value ? skill.trend_value * 10 : 0 // Convert to percentage change
    };
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {getSkillDisplayName(entry.dataKey)}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </Card>
      );
    }
    return null;
  };

  // Function to determine progress status and color
  const getProgressStatus = (score: number) => {
    // Based on score
    if (score >= 80) return { status: 'Advanced', color: 'text-green-600' };
    if (score >= 60) return { status: 'Proficient', color: 'text-blue-600' };
    if (score >= 40) return { status: 'Developing', color: 'text-yellow-600' };
    return { status: 'Beginning', color: 'text-red-600' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Skills Progression</h2>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No skill progression data available'}</AlertDescription>
      </Alert>
    );
  }

  const allSkills = data.skill_analytics || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Skills Progression</h2>
        <div className="flex gap-2">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(subj => (
                <SelectItem key={subj} value={subj}>{subj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="year">Year</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progression Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Mastery Progression</CardTitle>
          <CardDescription>
            Shows skill progression based on trend analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 || !selectedSkills.length ? (
            <div className="p-8 text-center text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Not enough data to generate progression chart</p>
              <p className="text-sm mt-2">Try a different subject or time period</p>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="period" 
                    tickMargin={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <ReferenceLine y={60} stroke="#34A853" strokeDasharray="3 3" opacity={0.7} label="Proficient" />
                  
                  {selectedSkills.map((skillId, index) => (
                    <Line
                      key={skillId}
                      type="monotone"
                      dataKey={skillId}
                      name={getSkillDisplayName(skillId)}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Selection */}
      {allSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills to Display</CardTitle>
            <CardDescription>
              Select which skills to show in the progression chart
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allSkills.map((skill, index) => {
                const { score, trend, trendValue } = getSkillInfo(skill.skill_id);
                const { status, color } = getProgressStatus(score);
                
                return (
                  <div 
                    key={skill.skill_id}
                    className={`p-3 rounded border cursor-pointer flex items-center justify-between 
                      transition-colors duration-150 hover:bg-gray-50
                      ${selectedSkills.includes(skill.skill_id) 
                        ? 'bg-blue-50 border-blue-300 shadow-sm' 
                        : 'bg-white border-gray-200'}`}
                    onClick={() => toggleSkill(skill.skill_id)}
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
                      ></div>
                      <span className="text-sm font-medium">
                        {getSkillDisplayName(skill.skill_id)}
                      </span>
                    </div>
                    
                    {/* Only show status for selected skills */}
                    {selectedSkills.includes(skill.skill_id) && (
                      <span className={`text-xs ${color}`}>
                        {status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Skill Analytics */}
      {allSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Skill Mastery</CardTitle>
            <CardDescription>
              Your current mastery level for each skill in {selectedSubject}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allSkills
                .sort((a, b) => b.average_score - a.average_score)
                .map((skill) => {
                  const score = skill.average_score * 10; // Convert to percentage
                  const { status, color } = getProgressStatus(score);
                  
                  return (
                    <div key={skill.skill_id} className="flex items-center gap-4">
                      <div className="w-32 font-medium truncate">{getSkillDisplayName(skill.skill_id)}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="h-2 rounded-full bg-gray-100 flex-grow overflow-hidden">
                          <div 
                            className={`h-full rounded-full bg-blue-500 transition-all duration-500`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-20">
                          {score.toFixed(1)}%
                        </span>
                        <span className={`text-xs ${color} min-w-20`}>
                          {status}
                        </span>
                        <span className={`text-xs ${skill.trend === 'improving' ? 'text-green-600' : 
                                              skill.trend === 'declining' ? 'text-red-600' : 
                                              'text-gray-500'}`}>
                          {skill.trend === 'improving' ? '↑' : 
                           skill.trend === 'declining' ? '↓' : 
                           '→'} {skill.trend || 'stable'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This visualization shows your skill mastery and progression trends.
          The chart plots each skill's trajectory based on recent performance trends.
          Click on a skill tile to add or remove it from the chart.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SkillsProgression;