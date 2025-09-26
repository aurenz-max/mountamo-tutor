'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Brain, AlertTriangle } from 'lucide-react';
import { AssessmentAIInsights } from '@/types/assessment';

interface AINarrativeProps {
  aiInsights?: AssessmentAIInsights;
}

const AINarrative: React.FC<AINarrativeProps> = ({ aiInsights }) => {
  if (!aiInsights) {
    return null;
  }

  return (
    <Card className="p-6 mb-6 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-blue-50">
      <div className="space-y-6">
        {/* AI Summary Section */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Brain className="h-6 w-6 text-purple-600 mt-1" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Assessment Summary
            </h3>
            <p className="text-gray-700 leading-relaxed">
              {aiInsights.ai_summary}
            </p>
          </div>
        </div>

        {/* Common Misconceptions */}
        {aiInsights.common_misconceptions && aiInsights.common_misconceptions.length > 0 && (
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-600 mt-1" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Key Learning Opportunities
              </h3>
              <ul className="space-y-2">
                {aiInsights.common_misconceptions.map((misconception, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-2 h-2 bg-amber-500 rounded-full mt-2"></span>
                    <span className="text-gray-700 leading-relaxed">
                      {misconception}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AINarrative;