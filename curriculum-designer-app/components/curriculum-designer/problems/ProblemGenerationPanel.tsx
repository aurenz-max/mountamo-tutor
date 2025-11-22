'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Trash2, Plus, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useProblems, useGenerateProblems, useBatchRegenerateProblems, useBatchEvaluateProblems } from '@/lib/curriculum-authoring/problems-hooks';
import { useActiveVersion } from '@/lib/curriculum-authoring/hooks';
import type { Subskill } from '@/types/curriculum-authoring';
import type { ProblemType } from '@/types/problems';
import { ProblemCard } from './ProblemCard';
import { PromptTemplateEditor } from './PromptTemplateEditor';

interface ProblemGenerationPanelProps {
  subskill: Subskill;
}

const PROBLEM_TYPES: { value: ProblemType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True/False' },
  { value: 'fill_in_blanks', label: 'Fill in the Blanks' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'matching_activity', label: 'Matching Activity' },
  { value: 'sequencing_activity', label: 'Sequencing Activity' },
  { value: 'categorization_activity', label: 'Categorization Activity' },
  { value: 'scenario_question', label: 'Scenario Question' },
  { value: 'live_interaction', label: 'Live Interaction' },
];

export function ProblemGenerationPanel({ subskill }: ProblemGenerationPanelProps) {
  const [problemCount, setProblemCount] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<ProblemType[]>(['multiple_choice', 'true_false']);
  const [temperature, setTemperature] = useState(0.7);
  const [autoEvaluate, setAutoEvaluate] = useState(true);
  const [customPrompt, setCustomPrompt] = useState<string | undefined>();

  // Get active version
  const { data: activeVersion } = useActiveVersion(subskill.subject_id);
  const versionId = activeVersion?.version_id || 'v1';

  // Fetch existing problems
  const { data: problems, isLoading: isLoadingProblems } = useProblems(
    subskill.subskill_id,
    versionId,
    false // Include drafts
  );

  // Mutations
  const generateMutation = useGenerateProblems();
  const batchRegenerateMutation = useBatchRegenerateProblems();
  const batchEvaluateMutation = useBatchEvaluateProblems();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        subskillId: subskill.subskill_id,
        request: {
          version_id: versionId,
          count: problemCount,
          problem_types: selectedTypes.length > 0 ? selectedTypes : undefined,
          temperature,
          auto_evaluate: autoEvaluate,
          custom_prompt: customPrompt,
        },
      });
    } catch (error) {
      console.error('Failed to generate problems:', error);
    }
  };

  const handleBatchRegenerate = async () => {
    if (!confirm('Regenerate all rejected problems? This will replace them with new versions.')) {
      return;
    }

    try {
      await batchRegenerateMutation.mutateAsync({
        subskillId: subskill.subskill_id,
        versionId,
        temperature,
      });
    } catch (error) {
      console.error('Failed to batch regenerate problems:', error);
    }
  };

  const handleBatchEvaluate = async () => {
    if (!problemsArray.length) {
      return;
    }

    try {
      await batchEvaluateMutation.mutateAsync({
        subskillId: subskill.subskill_id,
        versionId,
        skipLlm: false,
      });
    } catch (error) {
      console.error('Failed to batch evaluate problems:', error);
    }
  };

  const toggleProblemType = (type: ProblemType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const isGenerating = generateMutation.isPending;
  const isBatchRegenerating = batchRegenerateMutation.isPending;
  const isBatchEvaluating = batchEvaluateMutation.isPending;

  // Ensure problems is always an array
  const problemsArray = Array.isArray(problems) ? problems : [];

  // Count problems by status
  const approvedCount = problemsArray.filter((p) => !p.is_draft && p.is_active).length;
  const draftCount = problemsArray.filter((p) => p.is_draft).length;

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Practice Problems</CardTitle>
          <CardDescription>
            Configure and generate AI-powered practice problems for this subskill
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt Template Editor */}
          <PromptTemplateEditor
            templateName="default"
            templateType="problem_generation"
            onPromptChange={setCustomPrompt}
          />

          {/* Problem Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Number of Problems: {problemCount}</Label>
            </div>
            <Slider
              value={[problemCount]}
              onValueChange={(values) => setProblemCount(values[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Generate 1-20 problems per batch
            </p>
          </div>

          {/* Problem Types */}
          <div className="space-y-2">
            <Label>Problem Types</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PROBLEM_TYPES.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.value}
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => toggleProblemType(type.value)}
                  />
                  <label
                    htmlFor={type.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
            {selectedTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No types selected - will use variety mix
              </p>
            )}
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature: {temperature.toFixed(1)}</Label>
            </div>
            <Slider
              value={[temperature * 10]}
              onValueChange={(values) => setTemperature(values[0] / 10)}
              min={0}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Lower = more consistent, Higher = more creative
            </p>
          </div>

          {/* Auto-evaluate */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-evaluate after generation</Label>
              <p className="text-xs text-muted-foreground">
                Automatically run quality evaluation on generated problems
              </p>
            </div>
            <Switch checked={autoEvaluate} onCheckedChange={setAutoEvaluate} />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isLoadingProblems}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating {problemCount} problems...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Generate {problemCount} Problem{problemCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>

          {generateMutation.isError && (
            <p className="text-sm text-destructive">
              Error: {generateMutation.error?.message || 'Failed to generate problems'}
            </p>
          )}
          {generateMutation.isSuccess && (
            <p className="text-sm text-green-600">
              Successfully generated {generateMutation.data?.length || 0} problems!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Problems List */}
      {isLoadingProblems ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : problemsArray.length > 0 ? (
        <div className="space-y-4">
          {/* Header with counts */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                Generated Problems ({problemsArray.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                {approvedCount} approved • {draftCount} drafts
              </p>
            </div>

            {/* Batch Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchEvaluate}
                disabled={isBatchEvaluating || problemsArray.length === 0}
              >
                {isBatchEvaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Evaluate All
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchRegenerate}
                disabled={isBatchRegenerating}
              >
                {isBatchRegenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate Rejected
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Batch Evaluation Feedback */}
          {batchEvaluateMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✓ Successfully evaluated {batchEvaluateMutation.data?.length || 0} problems!
                {batchEvaluateMutation.data && batchEvaluateMutation.data.length > 0 && (
                  <span className="block mt-1 text-xs">
                    {batchEvaluateMutation.data.filter((e: any) => e.final_recommendation === 'approve').length} approved •{' '}
                    {batchEvaluateMutation.data.filter((e: any) => e.final_recommendation === 'revise').length} need revision •{' '}
                    {batchEvaluateMutation.data.filter((e: any) => e.final_recommendation === 'reject').length} rejected
                  </span>
                )}
              </p>
            </div>
          )}
          {batchEvaluateMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                Error: {batchEvaluateMutation.error?.message || 'Failed to evaluate problems'}
              </p>
            </div>
          )}

          {/* Problem Cards */}
          <div className="space-y-3">
            {problemsArray.map((problem) => (
              <ProblemCard
                key={problem.problem_id}
                problem={problem}
                subskillId={subskill.subskill_id}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No problems generated yet for this subskill
            </p>
            <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
              <Plus className="mr-2 h-4 w-4" />
              Generate Your First Problems
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
