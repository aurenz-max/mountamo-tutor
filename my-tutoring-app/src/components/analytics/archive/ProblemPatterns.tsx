// components/analytics/ProblemPatterns.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Info, TrendingUp, TrendingDown, Minus, BarChart3
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';

interface ProblemPatternsProps {
  studentId: number;
  subject?: string;
}

const ProblemPatterns: React.FC<ProblemPatternsProps> = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getProblemSolvingPatterns(
          studentId, 
          subject,
          selectedSkill || undefined
        );
        setData(response);
        setError(null);
      } catch (err) {
        setError('Failed to load problem pattern analysis');
        console.error('Error fetching problem patterns:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, subject, selectedSkill]);

  if (loading) {
    return <div className="p-8 text-center">Loading problem patterns analysis...</div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No problem pattern data available'}</AlertDescription>
      </Alert>
    );
  }

  const { consistency_analysis, common_terms, score_distribution, trajectory } = data;

  // Get color for consistency level
  const getConsistencyColor = (level: string) => {
    if (level === 'High') return 'bg-green-100 text-green-800';
    if (level === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Problem Solving Patterns</h2>
        {/* Skill selector if needed */}
      </div>

      {/* Overall Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trajectory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Overall Trend</p>
              <div className="flex items-center mt-1">
                {getTrendIcon(trajectory.trend)}
                <span className="ml-1 font-medium">
                  {trajectory.trend === 'improving' ? 'Improving' : 
                   trajectory.trend === 'declining' ? 'Declining' : 'Stable'}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">First Half Average</p>
              <p className="font-medium">{trajectory.first_half_avg.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Second Half Average</p>
              <p className="font-medium">{trajectory.second_half_avg.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Change</p>
              <p className={`font-medium ${
                trajectory.improvement > 0 ? 'text-green-600' : 
                trajectory.improvement < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {trajectory.improvement > 0 ? '+' : ''}{trajectory.improvement.toFixed(1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end h-40 space-x-1">
            {Object.entries(score_distribution).map(([range, count]) => {
              // Calculate percentage
              const total = score_distribution.high + score_distribution.medium + score_distribution.low;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              // Determine color
              let color;
              if (range === 'high') color = 'bg-green-400';
              else if (range === 'medium') color = 'bg-yellow-400';
              else color = 'bg-red-400';
              
              return (
                <div key={range} className="flex flex-col items-center flex-1">
                  <div className="text-xs font-medium mb-1">{percentage.toFixed(1)}%</div>
                  <div 
                    className={`w-full ${color}`}
                    style={{ height: `${Math.max(5, percentage)}%` }}
                  ></div>
                  <div className="text-sm mt-2 capitalize">{range}</div>
                  <div className="text-xs text-gray-500">{count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Consistency Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Consistency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {consistency_analysis.map((item: any, index: number) => (
              <div key={index} className="border-l-4 border-blue-400 pl-3 py-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{item.subject}: {item.skill_id} - {item.subskill_id}</h4>
                    <div className="flex space-x-3 mt-1">
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Average:</span> {item.average_score.toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Attempts:</span> {item.attempts}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getTrendIcon(item.trend_direction)}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConsistencyColor(item.consistency_level)}`}>
                      {item.consistency_level} Consistency
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Standard Deviation: {item.standard_deviation.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Common Patterns */}
      {common_terms && common_terms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Common Terms in Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {common_terms.map(([term, count]: [string, number], index: number) => (
                <div 
                  key={index}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {term} ({count})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This analysis shows patterns in your problem-solving approach. 
          Look for areas with low consistency as these might benefit from more focused practice.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ProblemPatterns;