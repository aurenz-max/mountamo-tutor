import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, Target, BookOpen, ArrowRight, 
  ArrowUpRight, Brain, BarChart3 
} from "lucide-react";
import { api } from '@/lib/api';

const FocusRecommendations = ({ studentId, subject, limit = 3, onViewMore }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!subject) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get focus recommendations
        const data = await api.getFocusRecommendations(studentId, subject, limit);
        setRecommendations(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load recommendations');
        console.error('Error fetching recommendations:', err);
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [studentId, subject, limit]);
  
  // Function to get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };
  
  // Function to get icon based on recommendation type
  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'coverage_gap':
        return <Target className="h-4 w-4" />;
      case 'performance_gap':
        return <BarChart3 className="h-4 w-4" />;
      case 'stale_content':
        return <BookOpen className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };
  
  // Function to format the recommendation type for display
  const formatRecommendationType = (type) => {
    switch (type) {
      case 'coverage_gap':
        return 'Coverage Gap';
      case 'performance_gap':
        return 'Performance Gap';
      case 'stale_content':
        return 'Stale Content';
      default:
        return type;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Focus Recommendations
        </CardTitle>
        <CardDescription>
          Suggested areas to improve your mastery
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-20 w-full mb-4" />
            <Skeleton className="h-20 w-full mb-4" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : recommendations && recommendations.recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.recommendations.map((recommendation, idx) => (
              <div 
                key={idx} 
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getRecommendationIcon(recommendation.type)}
                    <span className="font-medium">{recommendation.skill_description}</span>
                  </div>
                  <Badge className={getPriorityColor(recommendation.priority)}>
                    {recommendation.priority}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {recommendation.rationale}
                </p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatRecommendationType(recommendation.type)}
                  </span>
                  
                  {recommendation.current_status && (
                    <div className="flex items-center gap-2">
                      {recommendation.current_status.average_score !== undefined && (
                        <span>Score: {recommendation.current_status.average_score.toFixed(0)}%</span>
                      )}
                      {recommendation.current_status.attempts !== undefined && (
                        <span>Attempts: {recommendation.current_status.attempts}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-muted-foreground">
            {subject 
              ? "No focused recommendations available for this subject"
              : "Select a subject to view recommendations"
            }
          </div>
        )}
      </CardContent>
      {recommendations && recommendations.recommendations.length > 0 && (
        <CardFooter>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onViewMore}
          >
            View All Recommendations
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default FocusRecommendations;