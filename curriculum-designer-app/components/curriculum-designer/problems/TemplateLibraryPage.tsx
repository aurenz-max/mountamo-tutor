'use client';

import { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  CheckCircle,
  Eye,
  Copy,
  Trash2,
  Loader2,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePrompts, useActivatePrompt, useFeedbackReport } from '@/lib/curriculum-authoring/problems-hooks';
import type { PromptTemplate, PromptTemplateType } from '@/types/problems';
import { PromptImprovementPanel } from './PromptImprovementPanel';
import { FeedbackReportDialog } from './FeedbackReportDialog';

export function TemplateLibraryPage() {
  const [templateTypeFilter, setTemplateTypeFilter] = useState<PromptTemplateType>('problem_generation');
  const [minApprovalRate, setMinApprovalRate] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'approval_rate' | 'usage_count' | 'created_at'>('approval_rate');
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'improve' | 'feedback' | null>(null);

  // Fetch templates
  const { data: templates, isLoading } = usePrompts({
    template_type: templateTypeFilter,
    active_only: false,
  });

  // Activate template mutation
  const activateMutation = useActivatePrompt();

  // Filter and sort templates
  const filteredTemplates = (templates || [])
    .filter((template) => {
      // Filter by approval rate
      const approvalRate = template.approval_rate ?? 0;
      if (approvalRate < minApprovalRate) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          template.template_name.toLowerCase().includes(query) ||
          template.template_text.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by selected criteria
      if (sortBy === 'approval_rate') {
        return (b.approval_rate ?? 0) - (a.approval_rate ?? 0);
      } else if (sortBy === 'usage_count') {
        return (b.usage_count ?? 0) - (a.usage_count ?? 0);
      } else if (sortBy === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  const handleActivate = async (templateId: string) => {
    try {
      await activateMutation.mutateAsync(templateId);
    } catch (error) {
      console.error('Failed to activate template:', error);
    }
  };

  const handleCopyTemplate = async (template: PromptTemplate) => {
    await navigator.clipboard.writeText(template.template_text);
  };

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Template Library</h1>
          <p className="text-muted-foreground mt-1">
            Browse, manage, and improve proven prompt templates
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Template Type */}
            <div className="space-y-2">
              <Label>Template Type</Label>
              <Select
                value={templateTypeFilter}
                onValueChange={(value) => setTemplateTypeFilter(value as PromptTemplateType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="problem_generation">Problem Generation</SelectItem>
                  <SelectItem value="evaluation">Evaluation</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Approval Rate */}
            <div className="space-y-2">
              <Label>Min Approval Rate</Label>
              <Select
                value={minApprovalRate.toString()}
                onValueChange={(value) => setMinApprovalRate(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Templates</SelectItem>
                  <SelectItem value="0.75">75%+ (Good)</SelectItem>
                  <SelectItem value="0.85">85%+ (Very Good)</SelectItem>
                  <SelectItem value="0.9">90%+ (Excellent)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as typeof sortBy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approval_rate">Approval Rate</SelectItem>
                  <SelectItem value="usage_count">Usage Count</SelectItem>
                  <SelectItem value="created_at">Created Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No templates found matching your filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setMinApprovalRate(0);
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </p>

          {filteredTemplates.map((template) => (
            <Card key={template.template_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {template.template_name.replace(/_proven_\d+/, ' (Proven)')}
                      </CardTitle>
                      {template.is_active && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                      {getPerformanceBadge(template.approval_rate)}
                    </div>
                    <CardDescription>
                      Version {template.version} • Created {formatDate(template.created_at)}
                      {template.change_notes && ` • ${template.change_notes}`}
                    </CardDescription>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setViewMode('view');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {!template.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivate(template.template_id)}
                        disabled={activateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatApprovalRate(template.approval_rate)}
                    </span>
                    <span className="text-muted-foreground">approval</span>
                  </div>
                  {template.usage_count !== null && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.usage_count}</span>
                      <span className="text-muted-foreground">uses</span>
                    </div>
                  )}
                </div>

                {/* Template Preview */}
                <div className="bg-slate-50 border rounded-md p-3">
                  <p className="text-xs font-mono text-slate-700 line-clamp-3">
                    {template.template_text}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setViewMode('improve');
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Improve
                  </Button>
                  {template.approval_rate !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setViewMode('feedback');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Feedback
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyTemplate(template)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Template Dialog */}
      <Dialog open={viewMode === 'view'} onOpenChange={() => setViewMode(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.template_name}</DialogTitle>
            <DialogDescription>
              Version {selectedTemplate?.version} • {getPerformanceBadge(selectedTemplate?.approval_rate)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Text</Label>
              <Textarea
                value={selectedTemplate?.template_text || ''}
                readOnly
                className="min-h-[400px] font-mono text-xs mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => selectedTemplate && handleCopyTemplate(selectedTemplate)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Improvement Panel Dialog */}
      {selectedTemplate && viewMode === 'improve' && (
        <Dialog open={true} onOpenChange={() => setViewMode(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <PromptImprovementPanel
              templateId={selectedTemplate.template_id}
              onClose={() => setViewMode(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Feedback Report Dialog */}
      {selectedTemplate && viewMode === 'feedback' && (
        <FeedbackReportWrapper
          templateId={selectedTemplate.template_id}
          onClose={() => setViewMode(null)}
        />
      )}
    </div>
  );
}

// Wrapper component to fetch feedback report and pass to dialog
function FeedbackReportWrapper({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const { data: feedbackReport, isLoading } = useFeedbackReport(templateId, 3);

  return (
    <FeedbackReportDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      feedbackReport={feedbackReport || null}
      isLoading={isLoading}
      templateId={templateId}
    />
  );
}
