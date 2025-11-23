'use client';

import { useState } from 'react';
import { Check, Sparkles, TrendingUp, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBestPerformingTemplate, usePrompts } from '@/lib/curriculum-authoring/problems-hooks';
import type { PromptTemplate } from '@/types/problems';

interface TemplateSelectorProps {
  subskillId: string;
  problemTypes?: string[];
  onTemplateSelect: (template: PromptTemplate) => void;
  selectedTemplateId?: string;
}

export function TemplateSelector({
  subskillId,
  problemTypes,
  onTemplateSelect,
  selectedTemplateId,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch best-performing template for this subskill
  const {
    data: bestTemplate,
    isLoading: isBestLoading,
    error: bestError,
  } = useBestPerformingTemplate({
    template_type: 'problem_generation',
    subskill_id: subskillId,
    problem_type: problemTypes?.[0], // Use first selected type
    min_approval_rate: 0.85,
  });

  // Fetch all templates for browsing (only when dropdown is open)
  const {
    data: allTemplates,
    isLoading: isAllLoading,
  } = usePrompts({
    template_type: 'problem_generation',
    active_only: false,
  });

  // Filter templates by subskill (template names contain subskill ID)
  const relevantTemplates = allTemplates?.filter(
    (template) =>
      template.template_name.includes(subskillId) ||
      template.template_name === 'default'
  ) || [];

  const formatApprovalRate = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(0)}%`;
  };

  const getPerformanceBadge = (approvalRate: number | null | undefined) => {
    if (approvalRate === null || approvalRate === undefined) {
      return <Badge variant="outline">Untested</Badge>;
    }
    if (approvalRate >= 0.9) {
      return <Badge className="bg-green-600 hover:bg-green-700">Excellent</Badge>;
    }
    if (approvalRate >= 0.85) {
      return <Badge className="bg-blue-600 hover:bg-blue-700">Very Good</Badge>;
    }
    if (approvalRate >= 0.75) {
      return <Badge className="bg-yellow-600 hover:bg-yellow-700">Good</Badge>;
    }
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  if (isBestLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Looking for proven templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Recommended Template */}
      {bestTemplate && (
        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                Recommended: High-performing template available
              </span>
              {getPerformanceBadge(bestTemplate.approval_rate)}
              <span className="text-xs text-muted-foreground">
                {formatApprovalRate(bestTemplate.approval_rate)} approval rate
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onTemplateSelect(bestTemplate)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {selectedTemplateId === bestTemplate.template_id ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Using This Template
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Use This Template
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* No templates available */}
      {!bestTemplate && !bestError && (
        <Alert variant="default" className="bg-slate-50">
          <AlertDescription className="text-sm text-muted-foreground">
            No proven templates available yet for this subskill. Generate and evaluate problems
            to create templates.
          </AlertDescription>
        </Alert>
      )}

      {/* Browse all templates */}
      {relevantTemplates.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Browse All Templates ({relevantTemplates.length})</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isOpen ? 'transform rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {isAllLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border p-2">
                {relevantTemplates.map((template) => (
                  <div
                    key={template.template_id}
                    className={`flex items-center justify-between p-3 rounded border transition-colors hover:bg-slate-50 ${
                      selectedTemplateId === template.template_id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {template.template_name.replace(/_proven_\d+/, ' (Proven)')}
                        </span>
                        {template.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>v{template.version}</span>
                        <span>•</span>
                        <span>
                          {formatApprovalRate(template.approval_rate)} approval
                        </span>
                        {template.usage_count && (
                          <>
                            <span>•</span>
                            <span>{template.usage_count} uses</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {getPerformanceBadge(template.approval_rate)}
                      <Button
                        size="sm"
                        variant={
                          selectedTemplateId === template.template_id
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() => onTemplateSelect(template)}
                      >
                        {selectedTemplateId === template.template_id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          'Use'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
