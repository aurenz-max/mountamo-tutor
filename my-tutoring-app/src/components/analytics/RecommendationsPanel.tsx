// src/components/analytics/RecommendationsPanel.tsx
'use client'
import React from 'react';
import { useStudentRecommendations } from '@/lib/hooks/useStudentAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecommendationsPanelProps {
  studentId: number;
  subject?: string;
}

export default function RecommendationsPanel({ studentId, subject }: RecommendationsPanelProps) {
  // Use the specialized hook instead of context
  const { recommendations, loading, error } = useStudentRecommendations(subject);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">Error loading recommendations: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No recommendations available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.slice(0, 5).map((rec) => (
            <div key={rec.subskill_id} className="p-3 border rounded-lg">
              <div className="font-medium text-sm">{rec.skill_description}</div>
              <div className="text-xs text-muted-foreground">{rec.subskill_description}</div>
              <div className="mt-2 flex justify-between items-center text-xs">
                <span className={`px-2 py-1 rounded ${
                  rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                  rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {rec.priority} priority
                </span>
                <span>Mastery: {Math.round(rec.mastery * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}