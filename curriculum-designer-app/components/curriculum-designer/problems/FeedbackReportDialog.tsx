'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, TrendingDown, TrendingUp, Lightbulb, Sparkles } from 'lucide-react';
import type { FeedbackReport, PerformanceFlag, FeedbackTheme, ImprovementSuggestion } from '@/types/problems';
import { PromptImprovementPanel } from './PromptImprovementPanel';

interface FeedbackReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackReport: FeedbackReport | null;
  isLoading: boolean;
  templateId: string;
}

export function FeedbackReportDialog({
  open,
  onOpenChange,
  feedbackReport,
  isLoading,
  templateId
}: FeedbackReportDialogProps) {
  const [showImprovements, setShowImprovements] = useState(false);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Feedback Report...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!feedbackReport) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>No Feedback Available</DialogTitle>
            <DialogDescription>
              Not enough evaluations have been collected yet. Generate and evaluate at least 3 problems to see feedback.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const getPerformanceFlagConfig = (flag: PerformanceFlag) => {
    const configs: Record<PerformanceFlag, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'PERFORMING_WELL': { variant: 'default', label: 'Performing Well' },
      'BELOW_TARGET_APPROVAL': { variant: 'secondary', label: 'Below Target Approval' },
      'LOW_APPROVAL_RATE': { variant: 'destructive', label: 'Low Approval Rate' },
      'BELOW_TARGET_SCORE': { variant: 'secondary', label: 'Below Target Score' },
      'LOW_OVERALL_SCORE': { variant: 'destructive', label: 'Low Overall Score' },
      'NO_EVALUATION_DATA': { variant: 'outline', label: 'No Evaluation Data' },
      'CRITICAL_PEDAGOGICAL_APPROACH_SCORE': { variant: 'destructive', label: 'Critical: Pedagogical Approach' },
      'CRITICAL_ALIGNMENT_SCORE': { variant: 'destructive', label: 'Critical: Alignment' },
      'CRITICAL_CLARITY_SCORE': { variant: 'destructive', label: 'Critical: Clarity' },
      'CRITICAL_CORRECTNESS_SCORE': { variant: 'destructive', label: 'Critical: Correctness' },
      'CRITICAL_BIAS_SCORE': { variant: 'destructive', label: 'Critical: Bias' },
      'WEAK_PEDAGOGICAL_APPROACH_SCORE': { variant: 'secondary', label: 'Weak: Pedagogical Approach' },
      'WEAK_ALIGNMENT_SCORE': { variant: 'secondary', label: 'Weak: Alignment' },
      'WEAK_CLARITY_SCORE': { variant: 'secondary', label: 'Weak: Clarity' },
      'WEAK_CORRECTNESS_SCORE': { variant: 'secondary', label: 'Weak: Correctness' },
      'WEAK_BIAS_SCORE': { variant: 'secondary', label: 'Weak: Bias' },
    };

    return configs[flag] || { variant: 'outline' as const, label: flag };
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { variant: 'destructive' as const, icon: '🔴' };
      case 'high':
        return { variant: 'default' as const, icon: '🟠' };
      case 'medium':
        return { variant: 'secondary' as const, icon: '🟡' };
      case 'low':
        return { variant: 'outline' as const, icon: '🟢' };
      default:
        return { variant: 'outline' as const, icon: '⚪' };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'critical':
        return { variant: 'destructive' as const, label: 'Critical', icon: '🔥' };
      case 'high':
        return { variant: 'default' as const, label: 'High', icon: '⬆️' };
      case 'medium':
        return { variant: 'secondary' as const, label: 'Medium', icon: '➡️' };
      case 'low':
        return { variant: 'outline' as const, label: 'Low', icon: '⬇️' };
      default:
        return { variant: 'outline' as const, label: priority, icon: '•' };
    }
  };

  const metrics = feedbackReport.performance_metrics;
  const approvalRate = (metrics.approval_rate || 0) * 100;
  const avgScore = metrics.avg_evaluation_score || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Feedback Report: {feedbackReport.template_name} (v{feedbackReport.template_version})
          </DialogTitle>
          <DialogDescription>
            Analysis of {feedbackReport.total_evaluations} evaluation{feedbackReport.total_evaluations !== 1 ? 's' : ''}
            {' • '}
            {new Date(feedbackReport.analysis_timestamp).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
            <TabsTrigger value="themes">Feedback Themes</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Performance Summary
                  {approvalRate >= 85 && <TrendingUp className="h-5 w-5 text-green-500" />}
                  {approvalRate < 50 && <TrendingDown className="h-5 w-5 text-red-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Approval Rate</p>
                    <p className="text-2xl font-bold">{approvalRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                    <p className="text-2xl font-bold">{avgScore.toFixed(1)}/10</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Generations</p>
                    <p className="text-2xl font-bold">{metrics.total_generations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rejections</p>
                    <p className="text-2xl font-bold text-red-600">{metrics.total_rejections}</p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Approved:</span>
                      <Badge variant="default">{metrics.total_approvals}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Needs Revision:</span>
                      <Badge variant="secondary">{metrics.total_revisions}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rejected:</span>
                      <Badge variant="destructive">{metrics.total_rejections}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Flags */}
            {feedbackReport.performance_flags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Performance Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {feedbackReport.performance_flags.map((flag) => {
                      const config = getPerformanceFlagConfig(flag);
                      return (
                        <Badge key={flag} variant={config.variant}>
                          {config.label}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Improvement Suggestions */}
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 text-purple-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Want AI-Powered Improvements?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Get intelligent suggestions to improve this prompt template based on evaluation feedback.
                    </p>
                    <Button
                      onClick={() => setShowImprovements(true)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate AI Suggestions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dimensions Tab */}
          <TabsContent value="dimensions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dimension Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(feedbackReport.dimension_analysis)
                    .filter(([key]) => !['weakest_dimension', 'weakest_score'].includes(key))
                    .map(([dimension, data]: [string, any]) => {
                      const severityColors = {
                        excellent: 'bg-green-500',
                        good: 'bg-blue-500',
                        needs_attention: 'bg-yellow-500',
                        critical: 'bg-red-500'
                      };

                      return (
                        <div key={dimension} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize">
                              {dimension.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {data.average.toFixed(1)}/10
                              </span>
                              <Badge
                                variant={data.is_weak ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {data.severity}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${severityColors[data.severity as keyof typeof severityColors] || 'bg-gray-400'}`}
                                style={{ width: `${(data.average / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {data.min.toFixed(1)} - {data.max.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {feedbackReport.dimension_analysis.weakest_dimension && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-red-600">
                      Weakest Dimension: {feedbackReport.dimension_analysis.weakest_dimension.replace(/_/g, ' ')}
                      {' '}
                      ({feedbackReport.dimension_analysis.weakest_score?.toFixed(1)}/10)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Themes Tab */}
          <TabsContent value="themes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Feedback Themes (AI-Clustered)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {feedbackReport.feedback_themes.summary}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedbackReport.feedback_themes.themes.map((theme, index) => {
                  const severityConfig = getSeverityConfig(theme.severity);
                  return (
                    <Card key={index} className="border-l-4" style={{
                      borderLeftColor: theme.severity === 'critical' ? '#ef4444' :
                                       theme.severity === 'high' ? '#f97316' :
                                       theme.severity === 'medium' ? '#eab308' : '#10b981'
                    }}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold">{theme.theme_name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {theme.description}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={severityConfig.variant}>
                              {severityConfig.icon} {theme.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {theme.count} instances ({theme.percentage.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      {theme.examples.length > 0 && (
                        <CardContent className="pt-0">
                          <details className="text-xs">
                            <summary className="cursor-pointer hover:text-foreground font-medium mb-2">
                              View Examples ({theme.examples.length})
                            </summary>
                            <ul className="space-y-1 pl-4 text-muted-foreground">
                              {theme.examples.slice(0, 3).map((example, i) => (
                                <li key={i} className="list-disc">{example}</li>
                              ))}
                            </ul>
                          </details>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}

                {feedbackReport.feedback_themes.primary_concern && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-800">
                      Primary Concern: {feedbackReport.feedback_themes.primary_concern}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Improvement Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedbackReport.improvement_suggestions.map((suggestion) => {
                  const priorityConfig = getPriorityConfig(suggestion.priority);
                  return (
                    <Card key={suggestion.suggestion_id} className="border-l-4" style={{
                      borderLeftColor: suggestion.priority === 'critical' ? '#ef4444' :
                                       suggestion.priority === 'high' ? '#3b82f6' :
                                       suggestion.priority === 'medium' ? '#eab308' : '#94a3b8'
                    }}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold">{suggestion.title}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={priorityConfig.variant}>
                              {priorityConfig.icon} {priorityConfig.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.category}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Description:</p>
                          <p>{suggestion.description}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Proposed Change:</p>
                          <p className="text-blue-600">{suggestion.proposed_change}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Expected Impact:</p>
                          <p className="text-green-600">{suggestion.expected_impact}</p>
                        </div>
                        {suggestion.addresses_themes.length > 0 && (
                          <div>
                            <p className="font-medium text-muted-foreground mb-1">Addresses Themes:</p>
                            <div className="flex flex-wrap gap-1">
                              {suggestion.addresses_themes.map((theme, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {feedbackReport.improvement_suggestions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No specific suggestions available. Template is performing well!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Prompt Improvement Panel (Nested Dialog) */}
      {showImprovements && (
        <PromptImprovementPanel
          templateId={templateId}
          onClose={() => setShowImprovements(false)}
        />
      )}
    </Dialog>
  );
}
