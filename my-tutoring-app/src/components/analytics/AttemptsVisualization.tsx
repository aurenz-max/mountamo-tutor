// src/components/analytics/AttemptsVisualization.tsx
'use client'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsMetricsResponse } from '@/lib/authApiClient';

interface AttemptsVisualizationProps {
  data: AnalyticsMetricsResponse;
}

export default function AttemptsVisualization({ data }: AttemptsVisualizationProps) {
  // Replace: const { metrics } = useAnalytics()
  // With: Use the 'data' prop directly

  if (!data?.hierarchical_data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attempts Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.hierarchical_data.map((unit) => (
            <div key={unit.unit_id} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{unit.unit_title}</span>
                <span className="text-sm text-muted-foreground">{unit.attempt_count} attempts</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(unit.completion * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}