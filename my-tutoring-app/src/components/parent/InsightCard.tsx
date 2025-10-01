"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle, Trophy, Lightbulb, CheckCircle } from 'lucide-react';
import type { KeyInsight } from '@/lib/parentPortalApi';

interface InsightCardProps {
  insights: KeyInsight[];
}

const InsightCard: React.FC<InsightCardProps> = ({ insights }) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'progress':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'struggle':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'milestone':
        return <Trophy className="h-5 w-5 text-yellow-600" />;
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-blue-600" />;
      default:
        return <Lightbulb className="h-5 w-5 text-gray-600" />;
    }
  };

  const getInsightColor = (type: string, priority: string) => {
    if (priority === 'high') {
      switch (type) {
        case 'progress':
          return 'bg-green-50 border-green-200';
        case 'struggle':
          return 'bg-orange-50 border-orange-200';
        case 'milestone':
          return 'bg-yellow-50 border-yellow-200';
        case 'recommendation':
          return 'bg-blue-50 border-blue-200';
        default:
          return 'bg-gray-50 border-gray-200';
      }
    }
    return 'bg-white border-gray-200';
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <span>Key Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 text-center py-8">
            No insights available yet. Check back after more learning activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <span>Key Insights</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${getInsightColor(insight.insight_type, insight.priority)}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getInsightIcon(insight.insight_type)}
                  <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                </div>
                <Badge variant={getPriorityBadgeVariant(insight.priority)} className="text-xs">
                  {insight.priority}
                </Badge>
              </div>

              {/* Message */}
              <p className="text-sm text-gray-700 mb-3">{insight.message}</p>

              {/* Subject Badge */}
              {insight.subject && (
                <Badge variant="outline" className="mb-3">
                  {insight.subject}
                </Badge>
              )}

              {/* Action Items */}
              {insight.action_items && insight.action_items.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">What you can do:</p>
                  <ul className="space-y-1">
                    {insight.action_items.map((action, actionIndex) => (
                      <li
                        key={actionIndex}
                        className="text-sm text-gray-600 flex items-start space-x-2"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default InsightCard;
