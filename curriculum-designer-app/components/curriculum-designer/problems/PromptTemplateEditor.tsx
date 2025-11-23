'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Copy, CheckCheck, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useActivePrompt, useFeedbackReport } from '@/lib/curriculum-authoring/problems-hooks';
import { FeedbackReportDialog } from './FeedbackReportDialog';
import type { PromptTemplateType } from '@/types/problems';

interface PromptTemplateEditorProps {
  templateName: string;
  templateType: PromptTemplateType;
  onPromptChange?: (prompt: string | undefined) => void;
}

export function PromptTemplateEditor({
  templateName,
  templateType,
  onPromptChange,
}: PromptTemplateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // Fetch active prompt template
  const { data: activePrompt, isLoading } = useActivePrompt(templateName, templateType);

  // Fetch feedback report (only if template exists and has metrics)
  const { data: feedbackReport } = useFeedbackReport(
    activePrompt?.template_id || '',
    3,
  );

  // Initialize edited prompt when active prompt loads
  useEffect(() => {
    if (activePrompt) {
      setEditedPrompt(activePrompt.template_text);
    }
  }, [activePrompt]);

  const handlePromptChange = (value: string) => {
    setEditedPrompt(value);
    // If prompt is different from original, pass custom prompt to parent
    if (value !== activePrompt?.template_text) {
      onPromptChange?.(value);
    } else {
      onPromptChange?.(undefined);
    }
  };

  const handleReset = () => {
    if (activePrompt) {
      setEditedPrompt(activePrompt.template_text);
      onPromptChange?.(undefined);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isModified = editedPrompt !== activePrompt?.template_text;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="p-0 h-auto">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Label className="cursor-pointer">
                  Prompt Template
                  {isModified && <Badge variant="secondary" className="ml-2">Modified</Badge>}
                </Label>
              </div>
            </Button>
          </CollapsibleTrigger>

          {activePrompt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>v{activePrompt.version}</span>
              {activePrompt.usage_count > 0 && (
                <span>• {activePrompt.usage_count} uses</span>
              )}
            </div>
          )}
        </div>

        <CollapsibleContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading prompt template...</p>
          ) : activePrompt ? (
            <div className="space-y-3 pt-2">
              {/* Prompt Textarea */}
              <div>
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                  placeholder="Enter prompt template..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables: {activePrompt.template_variables?.join(', ') || 'None'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!isModified}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Default
                </Button>

                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {isCopied ? (
                    <>
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Performance Metrics */}
              {activePrompt.performance_metrics && (
                <div className="space-y-3">
                  {/* Performance Alert */}
                  {feedbackReport && feedbackReport.performance_flags.some(flag =>
                    flag.includes('LOW') || flag.includes('BELOW_TARGET')
                  ) && (
                    <Alert variant="default" className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>Performance Alert:</strong> This template has{' '}
                            {feedbackReport.performance_metrics.approval_rate !== undefined && (
                              <>{(feedbackReport.performance_metrics.approval_rate * 100).toFixed(0)}% approval</>
                            )}
                            {feedbackReport.feedback_themes.primary_concern && (
                              <> • Main issue: {feedbackReport.feedback_themes.primary_concern}</>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFeedbackDialog(true)}
                            className="ml-2 gap-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            View Feedback & Get Suggestions
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Performance Metrics */}
                  <div className="p-3 bg-muted rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Performance Metrics</p>
                      {feedbackReport && feedbackReport.performance_flags.includes('PERFORMING_WELL') && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Performing Well
                        </Badge>
                      )}
                    </div>

                    {activePrompt.performance_metrics.avg_evaluation_score !== undefined && (
                      <p>
                        Avg Score: {activePrompt.performance_metrics.avg_evaluation_score.toFixed(1)}/10
                      </p>
                    )}
                    {activePrompt.performance_metrics.approval_rate !== undefined && (
                      <p>
                        Approval Rate: {(activePrompt.performance_metrics.approval_rate * 100).toFixed(0)}%
                        {activePrompt.performance_metrics.approval_rate >= 0.85 ? ' ✓' : activePrompt.performance_metrics.approval_rate >= 0.5 ? ' ⚠' : ' ⚠️'}
                      </p>
                    )}
                    <p>
                      Generations: {activePrompt.performance_metrics.total_generations}
                    </p>

                    {feedbackReport && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowFeedbackDialog(true)}
                        className="p-0 h-auto text-xs"
                      >
                        View detailed feedback →
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isModified && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Using custom prompt for this generation
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Context Variety Mode:</strong> Problem generation uses automatic context variety through primitives
                  (objects, characters, scenarios, locations). This creates natural variation without requiring a template.
                </AlertDescription>
              </Alert>

              {/* Optional custom prompt override */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Optional: Paste custom prompt to override</Label>
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="Leave empty to use context variety generation, or paste a custom prompt here..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  High-scoring prompts (&gt;85%) from evaluations can be promoted to templates for reuse.
                </p>
              </div>

              {editedPrompt && (
                <Button variant="outline" size="sm" onClick={() => { setEditedPrompt(''); onPromptChange?.(undefined); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Custom Prompt
                </Button>
              )}
            </div>
          )}
        </CollapsibleContent>
      </div>

      {/* Feedback Report Dialog */}
      <FeedbackReportDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        feedbackReport={feedbackReport || null}
        isLoading={false}
        templateId={activePrompt?.template_id || ''}
      />
    </Collapsible>
  );
}
