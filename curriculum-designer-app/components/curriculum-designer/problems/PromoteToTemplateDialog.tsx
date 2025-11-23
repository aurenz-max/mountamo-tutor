'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Star, Check, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCreatePrompt } from '@/lib/curriculum-authoring/problems-hooks';
import type { ProblemInDB, ProblemEvaluation } from '@/types/problems';

interface PromoteToTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem: ProblemInDB;
  evaluation?: ProblemEvaluation;
  subskillId: string;
}

interface FormData {
  template_name: string;
  change_notes: string;
  is_active: boolean;
}

export function PromoteToTemplateDialog({
  open,
  onOpenChange,
  problem,
  evaluation,
  subskillId,
}: PromoteToTemplateDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const createPromptMutation = useCreatePrompt();

  // Generate smart defaults
  const suggestedName = `${subskillId}_proven_${Date.now()}`;
  const defaultChangeNotes = evaluation
    ? `Promoted from problem ${problem.problem_id} with evaluation score ${evaluation.overall_score.toFixed(1)}/10 (${evaluation.final_recommendation})`
    : `Promoted from problem ${problem.problem_id}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      template_name: suggestedName,
      change_notes: defaultChangeNotes,
      is_active: false,
    },
  });

  const isActive = watch('is_active');

  const onSubmit = async (data: FormData) => {
    if (!problem.generation_prompt) {
      return;
    }

    try {
      await createPromptMutation.mutateAsync({
        template_name: data.template_name,
        template_type: 'problem_generation',
        template_text: problem.generation_prompt,
        template_variables: [],
        is_active: data.is_active,
        change_notes: data.change_notes,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
        reset();
      }, 2000);
    } catch (error) {
      console.error('Failed to promote to template:', error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setShowSuccess(false);
  };

  // Early return if no generation prompt
  if (!problem.generation_prompt) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cannot Promote to Template</DialogTitle>
            <DialogDescription>
              This problem has no generation prompt available to promote.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            Promote High-Quality Prompt to Template Library
          </DialogTitle>
          <DialogDescription>
            Save this proven prompt as a reusable template for generating similar high-quality problems.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Evaluation Context Section */}
          {evaluation && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
              <h3 className="text-sm font-semibold mb-3 text-purple-900">Evaluation Results</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="bg-purple-600">
                  Score: {evaluation.overall_score.toFixed(1)}/10
                </Badge>
                <Badge
                  variant={evaluation.final_recommendation === 'approve' ? 'default' : 'secondary'}
                  className={evaluation.final_recommendation === 'approve' ? 'bg-green-600' : ''}
                >
                  {evaluation.final_recommendation.charAt(0).toUpperCase() + evaluation.final_recommendation.slice(1)}
                </Badge>
                <Badge variant="outline">
                  {problem.problem_type.replace('_', ' ')}
                </Badge>
                {evaluation.tier1_passed && (
                  <Badge variant="outline" className="border-green-600 text-green-700">
                    <Check className="h-3 w-3 mr-1" />
                    Tier 1
                  </Badge>
                )}
                {evaluation.tier2_passed && (
                  <Badge variant="outline" className="border-green-600 text-green-700">
                    <Check className="h-3 w-3 mr-1" />
                    Tier 2
                  </Badge>
                )}
                {evaluation.pedagogical_approach_score !== null && evaluation.pedagogical_approach_score !== undefined && (
                  <Badge variant="outline" className="border-purple-600 text-purple-700">
                    <Check className="h-3 w-3 mr-1" />
                    LLM Evaluated
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Prompt Preview Section */}
          <div className="border rounded-lg">
            <Collapsible open={showPromptPreview} onOpenChange={setShowPromptPreview}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="text-sm font-medium">
                    {showPromptPreview ? <ChevronDown className="inline h-4 w-4 mr-2" /> : <ChevronRight className="inline h-4 w-4 mr-2" />}
                    Preview Generation Prompt
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {problem.generation_prompt.length} characters
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <pre className="text-xs bg-muted p-3 rounded border whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {problem.generation_prompt}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Template Name Field */}
          <div className="space-y-2">
            <Label htmlFor="template_name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template_name"
              placeholder="e.g., kindergarten_rhyming_proven_v1"
              {...register('template_name', {
                required: 'Template name is required',
                minLength: {
                  value: 3,
                  message: 'Template name must be at least 3 characters',
                },
              })}
              className={errors.template_name ? 'border-red-500' : ''}
            />
            {errors.template_name && (
              <p className="text-sm text-red-600">{errors.template_name.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use a descriptive name. If a template with this name exists, a new version will be created automatically.
            </p>
          </div>

          {/* Change Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="change_notes">
              Change Notes <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="change_notes"
              rows={3}
              placeholder="Describe why this prompt is being promoted..."
              {...register('change_notes')}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Document the reason for promotion and any context that will help others understand this template.
            </p>
          </div>

          {/* Activate Immediately Checkbox */}
          <div className="flex items-start space-x-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <Checkbox
              id="is_active"
              {...register('is_active')}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="is_active"
                className="text-sm font-medium cursor-pointer"
              >
                Activate immediately
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {isActive
                  ? 'This template will be activated and available for use immediately. Only one version per template name can be active at a time.'
                  : 'Template will be saved as inactive. You can review and activate it later from the template library.'}
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {createPromptMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {createPromptMutation.error instanceof Error
                  ? createPromptMutation.error.message
                  : 'Failed to create template. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {showSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Template created successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {/* Footer */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createPromptMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPromptMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createPromptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Promote to Template Library
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
