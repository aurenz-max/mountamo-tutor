import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, Target, BookOpen, Clock, ArrowRight, 
  Layers, BarChart3, RefreshCw, Calendar
} from "lucide-react";
import { api } from '@/lib/api';

// This component provides a detailed gap analysis view
const GapAnalysisDetails = ({ studentId, subject, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [activeTab, setActiveTab] = useState("coverage");

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
  
  // Function to get progress color based on severity
  const getProgressColor = (severity) => {
    if (severity < 30) return 'bg-green-500';
    if (severity < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Render loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Gap Analysis</CardTitle>
          <CardDescription>
            Analyzing curriculum coverage and performance gaps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={onBack}>
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // If no data or subject not selected
  if (!gapData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-muted-foreground">
            {subject ? "No gap analysis data available" : "Select a subject to view gap analysis"}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={onBack}>
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Detailed Gap Analysis: {subject}
        </CardTitle>
        <CardDescription>
          Comprehensive analysis of curriculum areas that need attention
        </CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="coverage">
              <Layers className="h-4 w-4 mr-2" />
              Coverage Gaps ({gapData.summary.coverage_gap_count})
            </TabsTrigger>
            <TabsTrigger value="performance">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance Gaps ({gapData.summary.performance_gap_count})
            </TabsTrigger>
            <TabsTrigger value="recency">
              <RefreshCw className="h-4 w-4 mr-2" />
              Stale Content ({gapData.summary.stale_content_count})
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* Coverage Gaps Tab */}
        <TabsContent value="coverage">
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium">Coverage Gaps</h3>
                <p className="text-sm text-muted-foreground">
                  Curriculum areas with missing attempts
                </p>
              </div>
              <Badge className="px-3 py-1">
                {gapData.summary.coverage_percentage.toFixed(1)}% Coverage
              </Badge>
            </div>
            
            {gapData.coverage_gaps.length > 0 ? (
              <div className="space-y-4">
                {gapData.coverage_gaps.map((gap, idx) => (
                  <div key={`cov-${idx}`} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(gap.gap_severity)}>
                          {gap.gap_severity >= 70 ? 'Critical' : gap.gap_severity >= 40 ? 'Moderate' : 'Minor'}
                        </Badge>
                        <h4 className="font-medium">{gap.skill_description}</h4>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Gap Severity</span>
                        <span className="font-medium">{gap.gap_severity.toFixed(0)}%</span>
                      </div>
                      <Progress 
                        value={gap.gap_severity} 
                        className="h-2"
                        indicatorClassName={getProgressColor(gap.gap_severity)} 
                      />
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {gap.recommendation || 'Focus on this skill to improve overall curriculum coverage.'}
                    </p>
                    
                    <div className="text-sm flex justify-between">
                      <div>
                        <span className="text-muted-foreground">Unit: </span>
                        <span>{gap.unit_title}</span>
                      </div>
                      {gap.subskill_description && (
                        <div>
                          <span className="text-muted-foreground">Subskill: </span>
                          <span>{gap.subskill_description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground border rounded-lg">
                No significant coverage gaps detected
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        {/* Performance Gaps Tab */}
        <TabsContent value="performance">
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium">Performance Gaps</h3>
                <p className="text-sm text-muted-foreground">
                  Skills with consistently low scores
                </p>
              </div>
              <Badge className="px-3 py-1">
                {gapData.summary.average_performance.toFixed(1)}% Avg. Score
              </Badge>
            </div>
            
            {gapData.performance_gaps.length > 0 ? (
              <div className="space-y-4">
                {gapData.performance_gaps.map((gap, idx) => (
                  <div key={`perf-${idx}`} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(gap.gap_severity)}>
                          {gap.average_score.toFixed(0)}% Score
                        </Badge>
                        <h4 className="font-medium">{gap.skill_description}</h4>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {gap.attempts} attempts
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Improvement Needed</span>
                        <span className="font-medium">{gap.gap_severity.toFixed(0)}%</span>
                      </div>
                      <Progress 
                        value={gap.gap_severity} 
                        className="h-2"
                        indicatorClassName={getProgressColor(gap.gap_severity)} 
                      />
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {gap.recommendation || 'Additional practice needed to improve performance on this skill.'}
                    </p>
                    
                    <div className="text-sm flex justify-between">
                      <div>
                        <span className="text-muted-foreground">Unit: </span>
                        <span>{gap.unit_title}</span>
                      </div>
                      {gap.subskill_description && (
                        <div>
                          <span className="text-muted-foreground">Subskill: </span>
                          <span>{gap.subskill_description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground border rounded-lg">
                No significant performance gaps detected
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        {/* Stale Content Tab */}
        <TabsContent value="recency">
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium">Stale Content</h3>
                <p className="text-sm text-muted-foreground">
                  Skills that haven't been practiced recently
                </p>
              </div>
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {gapData.stale_content.length} Skills
              </Badge>
            </div>
            
            {gapData.stale_content.length > 0 ? (
              <div className="space-y-4">
                {gapData.stale_content.map((item, idx) => (
                  <div key={`stale-${idx}`} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-muted">
                          {item.days_since_attempt} days ago
                        </Badge>
                        <h4 className="font-medium">{item.skill_description}</h4>
                      </div>
                      <div className="text-sm">
                        Last: {new Date(item.last_attempt_date).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      Refreshing this skill will help maintain your mastery.
                    </p>
                    
                    <div className="text-sm flex justify-between">
                      <div>
                        <span className="text-muted-foreground">Unit: </span>
                        <span>{item.unit_title}</span>
                      </div>
                      {item.subskill_description && (
                        <div>
                          <span className="text-muted-foreground">Subskill: </span>
                          <span>{item.subskill_description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground border rounded-lg">
                All content is up to date
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to Dashboard
        </Button>
        
        <Button>
          <Target className="h-4 w-4 mr-2" />
          Generate Practice Problems
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GapAnalysisDetails;