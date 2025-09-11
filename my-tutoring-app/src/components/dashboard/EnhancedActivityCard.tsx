import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Target } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubjectRecommendations } from '@/hooks/useSubjectRecommendations';

interface ActivityCardProps {
  studentId: number;
  subject: string;
  velocityStatus: string;
  daysAheadBehind: number;
  primaryActivity: {
    skill: string;
    description: string;
    estimatedTime?: number;
  };
  onActivitySelect?: (subskillId: string, activityType: 'primary' | 'alternative') => void;
}

const EnhancedActivityCard: React.FC<ActivityCardProps> = ({
  studentId,
  subject,
  velocityStatus,
  daysAheadBehind,
  primaryActivity,
  onActivitySelect
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  // Only fetch recommendations if student is behind
  const shouldShowAlternatives = velocityStatus.includes('Behind');
  const {
    data: recommendations,
    loading: recLoading,
    error: recError
  } = useSubjectRecommendations(
    shouldShowAlternatives ? studentId : null,
    shouldShowAlternatives ? subject : null
  );

  const getVelocityColor = (status: string) => {
    if (status.includes('Significantly Behind')) return 'text-red-600 bg-red-50';
    if (status.includes('Behind')) return 'text-orange-600 bg-orange-50';
    if (status.includes('Slightly Behind')) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const handlePrimaryActivityClick = () => {
    onActivitySelect?.('primary', 'primary');
  };

  const handleAlternativeClick = (subskillId: string) => {
    onActivitySelect?.(subskillId, 'alternative');
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-6">
        {/* Subject Header with Velocity Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">{subject}</h3>
            <Badge className={getVelocityColor(velocityStatus)}>
              {velocityStatus}
              {daysAheadBehind !== 0 && (
                <span className="ml-1">
                  {daysAheadBehind > 0 ? '+' : ''}{daysAheadBehind.toFixed(1)} days
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Primary Activity */}
        <div className="border rounded-lg p-4 mb-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">{primaryActivity.skill}</h4>
              <p className="text-blue-700 text-sm mb-2">{primaryActivity.description}</p>
              {primaryActivity.estimatedTime && (
                <div className="flex items-center text-blue-600 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {primaryActivity.estimatedTime} min
                </div>
              )}
            </div>
            <Button
              onClick={handlePrimaryActivityClick}
              className="ml-4 bg-blue-600 hover:bg-blue-700"
            >
              Start
            </Button>
          </div>
        </div>

        {/* Alternative Skills Section */}
        {shouldShowAlternatives && (
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="w-full flex items-center justify-center space-x-2 py-2 text-gray-600 hover:text-gray-800"
              disabled={recLoading}
            >
              <Target className="w-4 h-4" />
              <span>
                {recLoading 
                  ? 'Loading more skills...' 
                  : `Explore ${recommendations?.recommendations?.length || 4} more ${subject} skills`
                }
              </span>
              {!recLoading && (showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
            </Button>

            {/* Alternative Skills List */}
            {showAlternatives && (
              <div className="mt-3 space-y-2">
                {recError && (
                  <div className="text-red-600 text-sm text-center py-2">
                    Failed to load recommendations. Please try again.
                  </div>
                )}
                
                {recommendations?.recommendations?.map((rec, index) => (
                  <div
                    key={rec.subskill_id}
                    className="border rounded-lg p-3 bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-medium text-gray-900 text-sm">
                            {rec.skill_description}
                          </h5>
                          <Badge variant="outline" className="text-xs">
                            #{rec.priority_rank}
                          </Badge>
                        </div>
                        <p className="text-gray-700 text-xs mb-1">{rec.subskill_description}</p>
                        <p className="text-gray-600 text-xs italic mb-2">"{rec.engagement_hook}"</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {rec.estimated_time_minutes} min
                          </div>
                          {rec.difficulty_level && (
                            <Badge variant="secondary" className="text-xs">
                              {rec.difficulty_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAlternativeClick(rec.subskill_id)}
                        className="ml-3"
                      >
                        Try This
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedActivityCard;