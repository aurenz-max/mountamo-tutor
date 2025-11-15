// src/components/analytics/MetricsCards.tsx
'use client'

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsMetricsResponse } from '@/lib/authApiClient';

interface MetricsCardsProps {
  data: AnalyticsMetricsResponse;
}

export default function MetricsCards({ data }: MetricsCardsProps) {
  // Replace: const { metrics } = useAnalytics()
  // With: Use the 'data' prop directly
  
  if (!data?.summary) return null;

  const { summary } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Mastery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(summary.mastery * 100)}%</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Proficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(summary.proficiency * 100)}%</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.attempted_items}/{summary.total_items}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ready Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.ready_items}</div>
        </CardContent>
      </Card>
    </div>
  );
}