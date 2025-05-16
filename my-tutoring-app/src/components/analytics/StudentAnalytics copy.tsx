'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const StudentAnalytics = ({ studentId = 1 }) => {
  const [timeRange, setTimeRange] = useState('week');

  // Subject configuration
  const subjects = {
    math: {
      credibilityStandard: 15, // Adjusted for kindergarten level
      subSkills: ['counting', 'shapes', 'patterns'],
      name: 'Mathematics'
    }
  };

  // Student progress data
  const studentProgress = {
    math: {
      totalProblems: 28,
      averageScore: 8.5,
      subSkills: {
        counting: { problems: 12, averageScore: 8.8 },
        shapes: { problems: 9, averageScore: 8.2 },
        patterns: { problems: 7, averageScore: 7.5 }
      }
    }
  };

  // Daily progress data
  const progressData = [
    { day: 'Mon', competency: 65, timeSpent: 45, problems: 12 },
    { day: 'Tue', competency: 68, timeSpent: 30, problems: 8 },
    { day: 'Wed', competency: 75, timeSpent: 60, problems: 15 },
    { day: 'Thu', competency: 74, timeSpent: 25, problems: 6 },
    { day: 'Fri', competency: 80, timeSpent: 50, problems: 10 }
  ];

  const skillCompetency = [
    { skill: 'Counting', score: 85 },
    { skill: 'Number Recognition', score: 75 },
    { skill: 'Pattern Recognition', score: 70 },
    { skill: 'Shape Recognition', score: 80 },
    { skill: 'Basic Addition', score: 65 }
  ];

  // Calculate credibility score
  const calculateCredibility = (problemCount, credibilityStandard) => {
    return Math.min(Math.sqrt(problemCount / credibilityStandard), 1);
  };

  // Calculate final skill score
  const calculateSkillScore = (averageScore, credibility, baselineScore = 5.0) => {
    return (averageScore * credibility) + (baselineScore * (1 - credibility));
  };

  // Generate progression data
  const generateProgressionData = () => {
    const data = [];
    const subject = studentProgress.math;
    const standard = subjects.math.credibilityStandard;
    
    for (let problems = 0; problems <= Math.max(standard, subject.totalProblems); problems += 2) {
      const credibility = calculateCredibility(problems, standard);
      const skillScore = calculateSkillScore(subject.averageScore, credibility, 5.0);
      
      data.push({
        problems,
        score: skillScore,
        credibility: credibility * 100
      });
    }
    return data;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
              {entry.name === 'timeSpent' ? ' min' : entry.name === 'credibility' ? '%' : ''}
            </p>
          ))}
        </Card>
      );
    }
    return null;
  };

  // Calculate current scores
  const currentSubject = studentProgress.math;
  const credibility = calculateCredibility(
    currentSubject.totalProblems,
    subjects.math.credibilityStandard
  );
  const finalScore = calculateSkillScore(
    currentSubject.averageScore,
    credibility
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Learning Analytics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Current Progress</h2>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Raw Score</p>
            <p className="text-2xl font-semibold">{currentSubject.averageScore.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Credibility</p>
            <p className="text-2xl font-semibold">{(credibility * 100).toFixed(1)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Final Score</p>
            <p className="text-2xl font-semibold">{finalScore.toFixed(1)}</p>
          </div>
        </div>

        <div className="h-64 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={generateProgressionData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="problems" 
                label={{ 
                  value: 'Problems Completed', 
                  position: 'bottom' 
                }} 
              />
              <YAxis domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                x={subjects.math.credibilityStandard} 
                stroke="#888" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Credibility Target', 
                  position: 'top',
                  fill: '#888'
                }} 
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                name="Skill Score"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="credibility"
                stroke="#16a34a"
                name="Credibility"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your score reflects both performance ({currentSubject.averageScore.toFixed(1)}) 
            and experience ({(credibility * 100).toFixed(1)}% credibility). 
            Complete {subjects.math.credibilityStandard - currentSubject.totalProblems} more 
            problems to reach full credibility.
          </AlertDescription>
        </Alert>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
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

        {/* Sub-skill Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentSubject.subSkills).map(([skill, data]) => {
                const subCredibility = calculateCredibility(
                  data.problems,
                  subjects.math.credibilityStandard / 3
                );
                const subScore = calculateSkillScore(
                  data.averageScore,
                  subCredibility,
                  finalScore
                );
                
                return (
                  <div key={skill} className="flex items-center gap-4">
                    <div className="w-24 capitalize">{skill}</div>
                    <div className="flex-1 flex items-center gap-2">
                      <div 
                        className="h-2 rounded-full bg-blue-200"
                        style={{ width: `${100}%` }}
                      >
                        <div 
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${subScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12">
                        {subScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentAnalytics;