'use client';

import { Check, X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import type { ProblemEvaluation } from '@/types/problems';

interface EvaluationResultsProps {
  evaluation: ProblemEvaluation;
}

export function EvaluationResults({ evaluation }: EvaluationResultsProps) {
  const [showTier1, setShowTier1] = useState(true);
  const [showTier2, setShowTier2] = useState(true);
  const [showTier3, setShowTier3] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);

  // Get overall recommendation badge
  const getRecommendationBadge = () => {
    const rec = evaluation.final_recommendation;

    if (rec === 'approve') {
      return <Badge className="bg-green-600">🟢 Approve</Badge>;
    } else if (rec === 'revise') {
      return <Badge className="bg-yellow-600">🟡 Needs Revision</Badge>;
    } else {
      return <Badge variant="destructive">🔴 Reject</Badge>;
    }
  };

  // Render score bar (1-10 scale)
  const renderScoreBar = (score: number | null | undefined, label: string, justification?: string | null) => {
    // Don't render if score is not available
    if (score === null || score === undefined) {
      return null;
    }

    const percentage = (score / 10) * 100;
    let colorClass = 'bg-green-500';

    if (score < 5) {
      colorClass = 'bg-red-500';
    } else if (score < 7) {
      colorClass = 'bg-yellow-500';
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-bold">{score}/10</span>
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full ${colorClass} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {justification && <p className="text-xs text-muted-foreground">{justification}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Overall Evaluation</CardTitle>
            {getRecommendationBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">
              {evaluation.overall_score.toFixed(1)}/10
            </div>
            <div className="flex-1">
              <Progress value={(evaluation.overall_score / 10) * 100} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier 1: Structural Validation */}
      <Collapsible open={showTier1} onOpenChange={setShowTier1}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                <div className="flex items-center gap-2">
                  {showTier1 ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">
                    Tier 1: Structural Validation
                  </CardTitle>
                  {evaluation.tier1_passed ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {evaluation.tier1_passed ? (
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  All structural requirements met
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 font-medium">Issues found:</p>
                  <ul className="space-y-1 pl-4">
                    {evaluation.tier1_issues.map((issue, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tier 2: Heuristic Validation */}
      <Collapsible open={showTier2} onOpenChange={setShowTier2}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                <div className="flex items-center gap-2">
                  {showTier2 ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">
                    Tier 2: Heuristic Validation
                  </CardTitle>
                  {evaluation.tier2_passed ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {/* Readability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Readability</span>
                  {evaluation.readability_appropriate ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                {evaluation.readability_score !== undefined && evaluation.readability_score !== null && (
                  <p className="text-xs text-muted-foreground">
                    Grade level: {evaluation.readability_score.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Placeholders */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">No placeholders</span>
                  {!evaluation.has_placeholders ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              {/* Overflow risk */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">No overflow risk</span>
                  {!evaluation.has_overflow_risk ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
              </div>

              {/* Issues */}
              {evaluation.tier2_issues.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">Issues:</p>
                  <ul className="space-y-1 pl-4">
                    {evaluation.tier2_issues.map((issue, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tier 3: LLM Pedagogical Assessment */}
      <Collapsible open={showTier3} onOpenChange={setShowTier3}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                <div className="flex items-center gap-2">
                  {showTier3 ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">
                    Tier 3: LLM Pedagogical Assessment
                  </CardTitle>
                  {evaluation.llm_judgment?.overall_quality && (
                    <Badge variant="outline">{evaluation.llm_judgment.overall_quality}</Badge>
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Score Bars */}
              {renderScoreBar(
                evaluation.pedagogical_approach_score,
                'Pedagogical Approach (40%)',
                evaluation.llm_judgment?.pedagogical_approach_justification
              )}
              {renderScoreBar(
                evaluation.alignment_score,
                'Alignment (20%)',
                evaluation.llm_judgment?.alignment_justification
              )}
              {renderScoreBar(
                evaluation.clarity_score,
                'Clarity (10%)',
                evaluation.llm_judgment?.clarity_justification
              )}
              {renderScoreBar(
                evaluation.correctness_score,
                'Correctness (20%)',
                evaluation.llm_judgment?.correctness_justification
              )}
              {renderScoreBar(
                evaluation.bias_score,
                'Bias (10%)',
                evaluation.llm_judgment?.bias_justification
              )}

              {/* LLM Reasoning */}
              {evaluation.llm_reasoning && (
                <div className="pt-2 border-t">
                  <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="mb-2">
                        {showReasoning ? 'Hide' : 'Show'} LLM Reasoning
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {evaluation.llm_reasoning}
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* Suggestions */}
              {evaluation.llm_suggestions.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Improvement Suggestions:</p>
                  <ul className="space-y-1 pl-4">
                    {evaluation.llm_suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        • {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Evaluation Metadata */}
      {evaluation.evaluation_prompt && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Evaluation metadata
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            <p>Model: {evaluation.evaluation_model}</p>
            <p>
              Evaluated: {new Date(evaluation.evaluation_timestamp).toLocaleString()}
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
