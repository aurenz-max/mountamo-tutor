'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useActivePrompt } from '@/lib/curriculum-authoring/problems-hooks';
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

  // Fetch active prompt template
  const { data: activePrompt, isLoading } = useActivePrompt(templateName, templateType);

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
                  Variables: {activePrompt.template_variables.join(', ')}
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
                <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                  <p className="font-medium">Performance Metrics</p>
                  {activePrompt.performance_metrics.avg_evaluation_score !== undefined && (
                    <p>
                      Avg Score: {activePrompt.performance_metrics.avg_evaluation_score.toFixed(1)}/10
                    </p>
                  )}
                  {activePrompt.performance_metrics.approval_rate !== undefined && (
                    <p>
                      Approval Rate: {(activePrompt.performance_metrics.approval_rate * 100).toFixed(0)}%
                    </p>
                  )}
                  <p>
                    Generations: {activePrompt.performance_metrics.total_generations}
                  </p>
                </div>
              )}

              {isModified && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Using custom prompt for this generation
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active prompt template found for "{templateName}"
            </p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
