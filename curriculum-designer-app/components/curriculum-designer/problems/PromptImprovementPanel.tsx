'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Copy, Check, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import { useSuggestImprovements, useCreatePrompt } from '@/lib/curriculum-authoring/problems-hooks';
import { DiffViewer } from './DiffViewer';
import type { PromptSuggestion } from '@/types/problems';

interface PromptImprovementPanelProps {
  templateId: string;
  onClose: () => void;
}

export function PromptImprovementPanel({ templateId, onClose }: PromptImprovementPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const {
    mutate: generateSuggestions,
    data: suggestions,
    isPending: isGenerating,
    isError,
    error
  } = useSuggestImprovements();

  const {
    mutate: createPrompt,
    isPending: isCreating
  } = useCreatePrompt();

  const handleGenerateSuggestions = () => {
    generateSuggestions({
      templateId,
      focusAreas: focusAreas.length > 0 ? focusAreas : undefined
    });
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateNewVersion = () => {
    if (!suggestions) return;

    createPrompt({
      template_name: suggestions.template_name,
      template_type: 'problem_generation',
      template_text: suggestions.improved_prompt,
      template_variables: [],
      change_notes: `AI-suggested improvements: ${suggestions.key_changes.join(', ')}`
    }, {
      onSuccess: () => {
        alert('New template version created successfully!');
        onClose();
      },
      onError: (err) => {
        alert(`Failed to create new version: ${err.message}`);
      }
    });
  };

  const renderInitialView = () => (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <Sparkles className="h-8 w-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">AI-Powered Prompt Improvements</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Our AI will analyze evaluation feedback and suggest improvements to your prompt template.
          This may take 10-30 seconds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Optional: Focus Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Select specific dimensions to focus on (or leave blank for general improvements):
          </p>
          <div className="flex flex-wrap gap-2">
            {['pedagogical', 'alignment', 'clarity', 'correctness', 'bias'].map((area) => (
              <Badge
                key={area}
                variant={focusAreas.includes(area) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  setFocusAreas(prev =>
                    prev.includes(area)
                      ? prev.filter(a => a !== area)
                      : [...prev, area]
                  );
                }}
              >
                {area}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleGenerateSuggestions}
        disabled={isGenerating}
        className="w-full bg-purple-600 hover:bg-purple-700"
        size="lg"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Generating Suggestions...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate AI Suggestions
          </>
        )}
      </Button>
    </div>
  );

  const renderSuggestions = (data: PromptSuggestion) => (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="diff">Changes</TabsTrigger>
        <TabsTrigger value="impact">Expected Impact</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        {/* Performance Context */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm">
              <strong>Current Performance:</strong>{' '}
              {(data.performance_context.current_approval_rate * 100).toFixed(1)}% approval rate,{' '}
              {data.performance_context.current_avg_score.toFixed(1)}/10 avg score{' '}
              ({data.performance_context.total_evaluations} evaluations)
            </div>
          </AlertDescription>
        </Alert>

        {/* Rationale */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Rationale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{data.rationale}</p>
          </CardContent>
        </Card>

        {/* Key Changes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.key_changes.map((change, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Feedback Addressed */}
        {data.feedback_addressed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feedback Themes Addressed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.feedback_addressed.map((theme, index) => (
                  <Badge key={index} variant="secondary">
                    {theme}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleCreateNewVersion}
            disabled={isCreating}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Creating...
              </>
            ) : (
              'Create New Version'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleCopy(data.improved_prompt, 'improved')}
          >
            {copiedField === 'improved' ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Improved Prompt
              </>
            )}
          </Button>
        </div>
      </TabsContent>

      {/* Diff Tab */}
      <TabsContent value="diff" className="space-y-4">
        <DiffViewer
          diff={data.diff}
          originalText={data.original_prompt}
          improvedText={data.improved_prompt}
        />
      </TabsContent>

      {/* Impact Tab */}
      <TabsContent value="impact" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Expected Improvements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Approval Rate Target */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Target Approval Rate</span>
                <span className="text-lg font-bold text-green-600">
                  {(data.expected_improvements.approval_rate_target * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Current: {(data.performance_context.current_approval_rate * 100).toFixed(1)}%</span>
                <span>→</span>
                <span className="text-green-600">
                  +{((data.expected_improvements.approval_rate_target - data.performance_context.current_approval_rate) * 100).toFixed(1)}% improvement
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Dimension Score Targets:</p>
              <div className="space-y-3">
                {Object.entries(data.expected_improvements.score_improvements).map(([dimension, targetScore]) => (
                  <div key={dimension}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm capitalize">
                        {dimension.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold">
                        {targetScore.toFixed(1)}/10
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(targetScore / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Flags */}
        {data.performance_context.performance_flags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Issues Being Addressed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.performance_context.performance_flags.map((flag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {flag.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Prompt Improvement Suggestions
          </DialogTitle>
          <DialogDescription>
            AI-generated improvements based on evaluation feedback
          </DialogDescription>
        </DialogHeader>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to generate suggestions: {error instanceof Error ? error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {!suggestions && !isGenerating && !isError && renderInitialView()}
        {suggestions && renderSuggestions(suggestions)}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
