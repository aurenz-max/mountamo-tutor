import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Award, AlertCircle } from "lucide-react";
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// This component displays the mastery and score summary for a student
const MasteryScoreSummary = ({ studentId, subject }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [masteryData, setMasteryData] = useState(null);

  useEffect(() => {
    const fetchMasteryData = async () => {
      if (!subject) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get mastery breakdown data which includes both mastery and score
        const data = await api.getMasteryBreakdown(studentId, subject);
        setMasteryData(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load mastery data');
        console.error('Error fetching mastery data:', err);
        setLoading(false);
      }
    };

    fetchMasteryData();
  }, [studentId, subject]);

  // Function to get color class based on score
  const getColorClass = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Function to get progress color based on score
  const getProgressColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Mastery & Performance
        </CardTitle>
        <CardDescription>
          Subject mastery and score metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-4/5 mb-4" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-4/5" />
          </>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : masteryData ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <div className="text-sm font-medium">Mastery (Breadth of Curriculum)</div>
                <div className={`text-sm font-bold ${getColorClass(masteryData.overall_mastery)}`}>
                  {masteryData.overall_mastery.toFixed(1)}%
                </div>
              </div>
              <Progress 
                value={masteryData.overall_mastery} 
                className="h-2"
                indicatorClassName={getProgressColor(masteryData.overall_mastery)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {masteryData.overall_completion.toFixed(1)}% of curriculum attempted
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <div className="text-sm font-medium">Performance Score (Quality)</div>
                <div className={`text-sm font-bold ${getColorClass(masteryData.overall_score)}`}>
                  {masteryData.overall_score.toFixed(1)}%
                </div>
              </div>
              <Progress 
                value={masteryData.overall_score} 
                className="h-2"
                indicatorClassName={getProgressColor(masteryData.overall_score)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Average score on attempted work
              </p>
            </div>

            <div className="pt-2 border-t">
              <div className={`text-sm font-medium ${getColorClass(masteryData.overall_mastery)}`}>
                {masteryData.mastery_level} Level
              </div>
              <p className="text-xs text-muted-foreground">
                Overall competency assessment
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select a subject to view mastery data
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MasteryScoreSummary;