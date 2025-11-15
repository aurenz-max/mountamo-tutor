// src/components/analytics/PerformanceTimeline.tsx
'use client'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsTimeseriesResponse } from '@/lib/authApiClient';

interface PerformanceTimelineProps {
  data?: AnalyticsTimeseriesResponse | null;
}

export default function PerformanceTimeline({ data }: PerformanceTimelineProps) {
  // Replace: const { timeseries } = useAnalytics()
  // With: Use the 'data' prop directly

  if (!data?.intervals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No timeline data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {/* Your existing chart implementation using data.intervals */}
          {/* Example: */}
          <div className="space-y-2">
            {data.intervals.map((interval, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{interval.period}</span>
                <span className="font-medium">{Math.round(interval.mastery * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}