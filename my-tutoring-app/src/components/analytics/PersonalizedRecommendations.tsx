// components/analytics/PersonalizedRecommendations.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Info, BookOpen, AlertTriangle, LightbulbIcon, ArrowRight,
  CheckCircle, BarChart, Target 
} from "lucide-react";
import { api } from '@/lib/api';

interface PersonalizedRecommendationsProps {
  studentId: number;
  subject?: string;
  count?: number;
  onSelectRecommendation?: (recommendation: any) => void;
}

const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({ 
  studentId,
  subject,
  count = 5,
  onSelectRecommendation
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.getPersonalizedRecommendations(studentId, subject, count);
        setRecommendations(response.recommendations || []);
        setError(null);
      } catch (err) {
        setError('Failed to load recommendations');
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, subject, count]);

  if (loading) {
    return <div className="p-8 text-center">Loading personalized recommendations...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No recommendations are available at this time.
        </AlertDescription>
      </Alert>
    );
  }

  // Get icon for recommendation type
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'gap_filling':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'reinforcement':
        return <BarChart className="h-5 w-5 text-blue-500" />;
      case 'mastery_challenge':
        return <Target className="h-5 w-5 text-green-500" />;
      default:
        return <LightbulbIcon className="h-5 w-5 text-purple-500" />;
    }
  };

  // Get background style based on reasoning
  const getRecommendationStyle = (recommendation: any) => {
    const reasoning = recommendation.reasoning;
    if (!reasoning) return {};
    
    switch (reasoning.recommendation_type) {
      case 'gap_filling':
        return { backgroundColor: '#fff8e6' }; // Light amber
      case 'reinforcement':
        return { backgroundColor: '#edf5ff' }; // Light blue
      case 'mastery_challenge':
        return { backgroundColor: '#edf7ed' }; // Light green
      default:
        return {};
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Personalized Recommendations</h2>
      
      <div className="space-y-4">
        {recommendations.map((recommendation, index) => (
          <Card 
            key={index}
            style={getRecommendationStyle(recommendation)}
          >
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="p-3 rounded-full bg-white shadow-sm">
                  {getRecommendationIcon(recommendation.reasoning?.recommendation_type)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {recommendation.subskill.description}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {recommendation.unit.title} - {recommendation.skill.description}
                  </p>
                  
                  {recommendation.reasoning && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          Current Mastery:
                        </div>
                        <div className="flex items-center">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${recommendation.reasoning.current_mastery * 10}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-sm font-medium">
                            {(recommendation.reasoning.current_mastery * 10).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          Credibility:
                        </div>
                        <div className="flex items-center">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${recommendation.reasoning.credibility * 100}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-sm font-medium">
                            {(recommendation.reasoning.credibility * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <span className="font-medium">Type:</span>{' '}
                        <span className="capitalize">
                          {recommendation.reasoning.recommendation_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-white bg-opacity-50 pt-3">
              {onSelectRecommendation && (
                <Button 
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => onSelectRecommendation(recommendation)}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Start Learning</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These recommendations are personalized based on your learning patterns and mastery levels.
          Focusing on these areas will help you make efficient progress.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default PersonalizedRecommendations;