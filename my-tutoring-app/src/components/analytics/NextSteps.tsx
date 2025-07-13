// src/components/analytics/NextSteps.tsx
'use client'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsMetricsResponse } from '@/lib/authApiClient';

interface NextStepsProps {
  data: AnalyticsMetricsResponse;
}

export default function NextSteps({ data }: NextStepsProps) {
  // Replace: const { metrics } = useAnalytics()
  // With: Use the 'data' prop directly

  if (!data?.hierarchical_data) return null;

  // Find ready items from the hierarchical data
  const readyItems = data.hierarchical_data.flatMap(unit =>
    unit.skills.flatMap(skill =>
      skill.subskills.filter(subskill => subskill.readiness_status === 'ready')
        .map(subskill => ({
          ...subskill,
          unit_title: unit.unit_title,
          skill_description: skill.skill_description
        }))
    )
  ).slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        {readyItems.length === 0 ? (
          <div className="text-muted-foreground">No ready items available</div>
        ) : (
          <div className="space-y-3">
            {readyItems.map((item, index) => (
              <div key={item.subskill_id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-sm">{item.skill_description}</div>
                  <div className="text-xs text-muted-foreground">{item.subskill_description}</div>
                  <div className="text-xs text-green-600 mt-1">Ready to practice!</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}