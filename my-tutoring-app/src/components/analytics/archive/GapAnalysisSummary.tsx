import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Target, BookOpen, Clock, ChevronRight } from "lucide-react";
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const GapAnalysisSummary = ({ studentId, subject, onViewFullReport }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gapData, setGapData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchGapData = async () => {
      if (!subject) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get gap analysis data
        const data = await api.getGapAnalysis(studentId, subject);
        setGapData(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load gap analysis');
        console.error('Error fetching gap analysis:', err);
        setLoading(false);
      }
    };

    fetchGapData();
  }, [studentId, subject]);
  
  // Function to get severity color
  const getSeverityColor = (severity) => {
    if (severity < 30) return 'bg-green-100 text-green-800';
    if (severity < 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const handleViewDetails = () => {
    if (onViewFullReport) {
      onViewFullReport();
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Gap Analysis
        </CardTitle>
        <CardDescription>
          Curriculum coverage and performance gaps
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-4/5 mb-4" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : gapData ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-2xl font-bold">{gapData.summary.coverage_gap_count}</div>
                <div className="text-xs text-muted-foreground">Coverage Gaps</div>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-2xl font-bold">{gapData.summary.performance_gap_count}</div>
                <div className="text-xs text-muted-foreground">Performance Gaps</div>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-2xl font-bold">{gapData.summary.stale_content_count}</div>
                <div className="text-xs text-muted-foreground">Stale Areas</div>
              </div>
            </div>
            
            <div className="pt-2">
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                <BookOpen className="h-4 w-4" /> 
                Top Priority Gaps
              </h4>
              
              {/* Show top 2 coverage gaps */}
              {gapData.coverage_gaps.length > 0 ? (
                <div className="space-y-2">
                  {gapData.coverage_gaps.slice(0, 2).map((gap, idx) => (
                    <div key={`cov-${idx}`} className="flex items-start space-x-2 text-sm">
                      <Badge variant="outline" className={getSeverityColor(gap.gap_severity)}>
                        Missing
                      </Badge>
                      <span className="flex-1 truncate">{gap.skill_description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No significant coverage gaps detected
                </div>
              )}
              
              {/* Show top performance gap */}
              {gapData.performance_gaps.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1 mt-3 mb-2">
                    <Clock className="h-4 w-4" /> 
                    Performance Issues
                  </h4>
                  <div className="space-y-2">
                    {gapData.performance_gaps.slice(0, 1).map((gap, idx) => (
                      <div key={`perf-${idx}`} className="flex items-start space-x-2 text-sm">
                        <Badge variant="outline" className={getSeverityColor(gap.gap_severity)}>
                          {gap.average_score.toFixed(0)}%
                        </Badge>
                        <span className="flex-1 truncate">{gap.skill_description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select a subject to view gap analysis
          </div>
        )}
      </CardContent>
      {gapData && (
        <CardFooter>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleViewDetails}
          >
            View Full Analysis
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default GapAnalysisSummary;