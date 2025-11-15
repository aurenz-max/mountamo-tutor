// src/components/analytics/ProgressDashboard.tsx - Updated to work with simplified analytics
'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AnalyticsMetricsResponse, AnalyticsTimeseriesResponse } from '@/lib/authApiClient'
import MetricsCards from './MetricsCards'
import PerformanceTimeline from './PerformanceTimeline'
import AttemptsVisualization from './AttemptsVisualization'
import NextSteps from './NextSteps'
import RecommendationsPanel from './RecommendationsPanel'
import HierarchicalMetrics from './HierarchicalMetrics'

interface ProgressDashboardProps {
  data: AnalyticsMetricsResponse | null;
  timeseries?: AnalyticsTimeseriesResponse | null;
  loading?: boolean;
  error?: string | null;
}

export default function ProgressDashboard({ 
  data: metrics, 
  timeseries, 
  loading = false, 
  error = null 
}: ProgressDashboardProps) {
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-8 w-2/3 mb-1" />
              <Skeleton className="h-4 w-1/4" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <Skeleton className="h-[300px] w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <Skeleton className="h-[300px] w-full" />
          </Card>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-red-500 font-medium">Error: {error}</div>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="text-amber-500 font-medium">No data available. Please check your API connection.</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary metrics at the top */}
      <MetricsCards data={metrics} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Timeline Chart */}
        <div className="lg:col-span-2">
          <PerformanceTimeline data={timeseries} />
        </div>
        
        {/* Right column: Recent Activity */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Activity (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-sm">Units</th>
                    <th className="text-right font-medium text-sm">Recent Activity</th>
                    <th className="text-right font-medium text-sm">Avg Score</th>
                    <th className="text-right font-medium text-sm">Proficiency %</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.hierarchical_data?.slice(0, 5).map((unit) => (
                    <tr key={unit.unit_id} className="border-b border-gray-100">
                      <td className="py-3 font-medium">{unit.unit_title}</td>
                      <td className="py-3 text-right">{unit.attempt_count}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          unit.avg_score >= 0.9 ? 'bg-green-100 text-green-800' :
                          unit.avg_score >= 0.8 ? 'bg-green-50 text-green-700' :
                          unit.avg_score >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                          unit.avg_score >= 0.6 ? 'bg-orange-100 text-orange-800' :
                          unit.avg_score > 0 ? 'bg-red-100 text-red-800' : ''
                        }`}>
                          {Math.round(unit.avg_score * 100)}%
                        </span>
                      </td>
                      <td className="py-3 text-right">{Math.round(unit.proficiency * 100)}%</td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-muted-foreground">
                        No unit data available
                      </td>
                    </tr>
                  )}
                  {metrics.summary && (
                    <tr className="font-semibold">
                      <td className="py-3">Total</td>
                      <td className="py-3 text-right">{metrics.summary.attempt_count}</td>
                      <td className="py-3 text-right">{Math.round(metrics.summary.avg_score * 100)}%</td>
                      <td className="py-3 text-right">{Math.round(metrics.summary.proficiency * 100)}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Curriculum Hierarchy */}
      <HierarchicalMetrics data={metrics} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendations Panel */}
        <RecommendationsPanel studentId={metrics.student_id} />
        
        {/* Next Steps */}
        <NextSteps data={metrics} />
      </div>
      
      {/* Attempts Visualization */}
      <AttemptsVisualization data={metrics} />
    </div>
  );
}