// src/components/dashboard/RecentActivityCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { analyticsApi, StudentMetrics } from '@/lib/studentAnalyticsAPI';

interface ActivitySummary {
  unit: string;
  recentActivity: number;
  avgScore: number;
  proficiency: number;
}

const RecentActivityCard = ({ studentId, days = 30 }: { studentId: number; days?: number }) => {
  const [activityData, setActivityData] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<{
    activity: number;
    avgScore: number;
    proficiency: number;
  }>({
    activity: 0,
    avgScore: 0,
    proficiency: 0
  });

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        setLoading(true);
        
        // Get metrics for the student
        const metrics = await analyticsApi.getStudentMetrics(studentId);
        
        // Transform the hierarchical data into the activity format
        const transformedData = transformMetricsToActivityData(metrics);
        setActivityData(transformedData);
        
        // Calculate totals
        calculateTotals(transformedData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError('Failed to load activity data');
        setLoading(false);
      }
    };
    
    fetchActivityData();
  }, [studentId, days]);

  // Transform the hierarchical data from the API into activity summaries
  const transformMetricsToActivityData = (metrics: StudentMetrics): ActivitySummary[] => {
    if (!metrics.hierarchical_data) {
      return [];
    }
    
    return metrics.hierarchical_data.map(unit => ({
      unit: unit.unit_title,
      recentActivity: unit.attempt_count,
      avgScore: Math.round(unit.avg_score * 100),
      proficiency: Math.round(unit.proficiency * 100)
    }));
  };

  // Calculate totals for the summary row
  const calculateTotals = (data: ActivitySummary[]) => {
    const totalActivity = data.reduce((sum, item) => sum + item.recentActivity, 0);
    
    // Calculate weighted average score
    const weightedScoreSum = data.reduce(
      (sum, item) => sum + (item.avgScore * item.recentActivity), 
      0
    );
    const avgScore = totalActivity > 0 
      ? Math.round(weightedScoreSum / totalActivity) 
      : 0;
    
    // Calculate average proficiency
    const proficiencySum = data.reduce((sum, item) => sum + item.proficiency, 0);
    const avgProficiency = data.length > 0 
      ? Math.round(proficiencySum / data.length) 
      : 0;
    
    setTotals({
      activity: totalActivity,
      avgScore,
      proficiency: avgProficiency
    });
  };

  // Helper to get a color class based on the score value
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-green-50 text-green-700';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity ({days} Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading activity data...</div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : activityData.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Recent Activity</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Proficiency %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.unit}</TableCell>
                    <TableCell className="text-right">{item.recentActivity}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-xs font-medium",
                        getScoreColorClass(item.avgScore)
                      )}>
                        {item.avgScore}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.proficiency}%</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{totals.activity}</TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium",
                      getScoreColorClass(totals.avgScore)
                    )}>
                      {totals.avgScore}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold">{totals.proficiency}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">No activity data found</div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityCard;