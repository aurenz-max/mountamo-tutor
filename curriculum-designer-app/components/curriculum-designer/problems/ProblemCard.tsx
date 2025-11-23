'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit, RefreshCw, Trash2, Eye, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDeleteProblem, useRegenerateProblem, useEvaluation, useEvaluateProblem, useCreatePrompt } from '@/lib/curriculum-authoring/problems-hooks';
import type {
  ProblemInDB,
  MultipleChoiceProblem,
  TrueFalseProblem,
  FillInBlanksProblem,
  ShortAnswerProblem,
  MatchingActivity,
  SequencingActivity,
  CategorizationActivity,
  ScenarioQuestion,
  LiveInteractionProblem
} from '@/types/problems';
import { EvaluationResults } from './EvaluationResults';
import { ProblemEditor } from './ProblemEditor';
import { EvaluationBadge, TierProgress } from './EvaluationBadge';
import { PromoteToTemplateDialog } from './PromoteToTemplateDialog';

interface ProblemCardProps {
  problem: ProblemInDB;
  subskillId: string;
}

export function ProblemCard({ problem, subskillId }: ProblemCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);

  // Fetch evaluation if it exists
  const { data: evaluation, isLoading: isLoadingEvaluation, refetch: refetchEvaluation } = useEvaluation(problem.problem_id);

  // Mutations
  const deleteMutation = useDeleteProblem();
  const regenerateMutation = useRegenerateProblem();
  const evaluateMutation = useEvaluateProblem();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this problem?')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(problem.problem_id);
    } catch (error) {
      console.error('Failed to delete problem:', error);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate this problem? This will replace it with a new version.')) {
      return;
    }

    try {
      await regenerateMutation.mutateAsync({
        problemId: problem.problem_id,
      });
    } catch (error) {
      console.error('Failed to regenerate problem:', error);
    }
  };

  const handleEvaluate = async () => {
    try {
      await evaluateMutation.mutateAsync({
        problemId: problem.problem_id,
        skipLlm: false,
      });
      // Show evaluation results after successful evaluation
      setShowEvaluation(true);
      // Refetch evaluation to ensure we have the latest data
      await refetchEvaluation();
    } catch (error) {
      console.error('Failed to evaluate problem:', error);
    }
  };

  const handlePromoteToTemplate = () => {
    setShowPromoteDialog(true);
  };

  // Get problem type badge color
  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return 'default';
      case 'true_false':
        return 'secondary';
      case 'fill_in_blanks':
        return 'outline';
      case 'matching_activity':
        return 'default';
      case 'sequencing_activity':
        return 'secondary';
      case 'categorization_activity':
        return 'outline';
      case 'scenario_question':
        return 'default';
      case 'short_answer':
        return 'secondary';
      case 'live_interaction':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Get difficulty badge color
  const getDifficultyBadgeVariant = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'outline';
      case 'medium':
        return 'secondary';
      case 'hard':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Check if evaluation has LLM scores
  const hasLlmEvaluation = evaluation?.pedagogical_approach_score !== null &&
                          evaluation?.pedagogical_approach_score !== undefined;

  // Get question text preview
  const getQuestionPreview = () => {
    const json = problem.problem_json as any;
    let text = '';

    if (problem.problem_type === 'multiple_choice') {
      text = json.question || json.question_text || '';
    } else if (problem.problem_type === 'true_false') {
      text = json.statement || '';
    } else if (problem.problem_type === 'fill_in_blanks') {
      text = json.text_with_blanks || json.question || json.question_text || '';
    } else if (problem.problem_type === 'short_answer') {
      text = json.question || json.question_text || '';
    } else if (problem.problem_type === 'matching_activity') {
      text = json.prompt || json.instruction || '';
    } else if (problem.problem_type === 'sequencing_activity') {
      text = json.instruction || '';
    } else if (problem.problem_type === 'categorization_activity') {
      text = json.instruction || '';
    } else if (problem.problem_type === 'scenario_question') {
      text = json.scenario || json.scenario_question || '';
    } else if (problem.problem_type === 'live_interaction') {
      text = json.interaction_config?.prompt?.instruction || 'Interactive problem';
    }

    if (!text) {
      return 'No preview available';
    }

    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  // Render full problem content
  const renderProblemContent = () => {
    const json = problem.problem_json as any;

    if (problem.problem_type === 'multiple_choice') {
      const mc = json as any;
      const questionText = mc.question || mc.question_text || 'No question text';
      const explanation = mc.rationale || mc.explanation || 'No explanation';

      // Handle both formats: new format with {id, text} objects and old format with string array
      const options = (mc.options || []).map((opt: any) =>
        typeof opt === 'string' ? opt : opt.text || ''
      );

      // Handle both formats: new format with correct_option_id and old format with correct_answer_index
      let correctIndex = -1;
      if (mc.correct_option_id) {
        // Find index by matching option ID
        correctIndex = (mc.options || []).findIndex((opt: any) =>
          typeof opt === 'object' && opt.id === mc.correct_option_id
        );
      } else if (typeof mc.correct_answer_index === 'number') {
        correctIndex = mc.correct_answer_index;
      }

      return (
        <div className="space-y-3">
          <div>
            <p className="font-medium mb-2">{questionText}</p>
            <div className="space-y-1 pl-4">
              {options.map((option: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <span className={index === correctIndex ? 'font-bold text-green-600' : ''}>
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <span className={index === correctIndex ? 'font-bold text-green-600' : ''}>
                    {option}
                    {index === correctIndex && ' ✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'true_false') {
      const tf = json as any;
      const statement = tf.question || tf.statement || 'No statement';
      const explanation = tf.rationale || tf.explanation || 'No explanation';
      const correctAnswer = tf.correct_answer ?? false;

      return (
        <div className="space-y-3">
          <p className="font-medium">{statement}</p>
          <div className="flex gap-4">
            <Badge variant={correctAnswer ? 'default' : 'outline'}>
              True {correctAnswer && '✓'}
            </Badge>
            <Badge variant={!correctAnswer ? 'default' : 'outline'}>
              False {!correctAnswer && '✓'}
            </Badge>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'fill_in_blanks') {
      const fib = json as any;
      const questionText = fib.question || fib.question_text || 'No question text';
      const explanation = fib.rationale || fib.explanation || 'No explanation';
      const blanks = fib.blanks || [];

      return (
        <div className="space-y-3">
          <p className="font-medium">{questionText}</p>
          <div>
            <p className="text-sm font-medium mb-1">Correct answers:</p>
            <div className="flex flex-wrap gap-2">
              {blanks.map((blank: any, index: number) => (
                <Badge key={index} variant="secondary">
                  {typeof blank === 'string' ? blank : blank.text || blank.answer || ''}
                </Badge>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'short_answer') {
      const sa = json as any;
      const questionText = sa.question || sa.question_text || 'No question text';
      const explanation = sa.rationale || sa.explanation || 'No explanation';
      const sampleAnswers = sa.sample_answers || [];

      return (
        <div className="space-y-3">
          <p className="font-medium">{questionText}</p>
          {sampleAnswers.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Sample answers:</p>
              <div className="space-y-1 pl-4">
                {sampleAnswers.map((answer: any, index: number) => (
                  <p key={index} className="text-sm">
                    • {typeof answer === 'string' ? answer : answer.text || answer.answer || ''}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'matching_activity') {
      const ma = json as any;
      const prompt = ma.prompt || ma.instruction || 'No prompt';
      const explanation = ma.rationale || ma.explanation || 'No explanation';
      const leftItems = ma.left_items || [];
      const rightItems = ma.right_items || [];
      const mappings = ma.mappings || [];

      return (
        <div className="space-y-3">
          <p className="font-medium">{prompt}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Left Items:</p>
              <div className="space-y-1">
                {leftItems.map((item: any, index: number) => (
                  <Badge key={item.id || index} variant="outline">
                    {item.text}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Right Items:</p>
              <div className="space-y-1">
                {rightItems.map((item: any, index: number) => (
                  <Badge key={item.id || index} variant="outline">
                    {item.text}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Correct Mappings:</p>
            <div className="space-y-1 pl-4 text-sm">
              {mappings.map((mapping: any, index: number) => {
                const leftItem = leftItems.find((i: any) => i.id === mapping.left_id);
                const rightItemIds = mapping.right_ids || [];
                const rightMatches = rightItemIds.map((rid: string) =>
                  rightItems.find((i: any) => i.id === rid)?.text
                ).filter(Boolean).join(', ');
                return (
                  <p key={index}>
                    • {leftItem?.text} → {rightMatches}
                  </p>
                );
              })}
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'sequencing_activity') {
      const seq = json as any;
      const instruction = seq.instruction || 'No instruction';
      const explanation = seq.rationale || seq.explanation || 'No explanation';
      const items = seq.items || [];

      return (
        <div className="space-y-3">
          <p className="font-medium">{instruction}</p>
          <div>
            <p className="text-sm font-medium mb-1">Correct Order:</p>
            <div className="space-y-1 pl-4">
              {items.map((item: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'categorization_activity') {
      const cat = json as any;
      const instruction = cat.instruction || 'No instruction';
      const explanation = cat.rationale || cat.explanation || 'No explanation';
      const categories = cat.categories || [];
      const items = cat.categorization_items || [];

      return (
        <div className="space-y-3">
          <p className="font-medium">{instruction}</p>
          <div>
            <p className="text-sm font-medium mb-2">Categories:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((category: string, index: number) => (
                <Badge key={index} variant="default">{category}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Items to Categorize:</p>
            <div className="space-y-1 pl-4 text-sm">
              {items.map((item: any, index: number) => (
                <p key={index}>
                  • {item.item_text} → <Badge variant="secondary" className="ml-1">{item.correct_category}</Badge>
                </p>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'scenario_question') {
      const scen = json as any;
      const scenario = scen.scenario || 'No scenario';
      const question = scen.scenario_question || scen.question || 'No question';
      const answer = scen.scenario_answer || scen.answer || 'No answer';
      const explanation = scen.rationale || scen.explanation || 'No explanation';

      return (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Scenario:</p>
            <p className="text-sm bg-muted/50 p-2 rounded">{scenario}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Question:</p>
            <p className="font-medium">{question}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Expected Answer:</p>
            <p className="text-sm">{answer}</p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'live_interaction') {
      const live = json as any;
      const explanation = live.rationale || live.explanation || 'No explanation';
      const interactionConfig = live.interaction_config || {};
      const prompt = interactionConfig.prompt || {};
      const targets = interactionConfig.targets || [];

      return (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm font-medium text-purple-900 mb-2">🎙️ Live Interaction Problem</p>
            {prompt.instruction && (
              <p className="text-sm mb-2">
                <span className="font-medium">Instruction:</span> {prompt.instruction}
              </p>
            )}
            {interactionConfig.interaction_mode && (
              <p className="text-sm">
                <span className="font-medium">Mode:</span> {interactionConfig.interaction_mode}
              </p>
            )}
          </div>
          {targets.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Interactive Targets:</p>
              <div className="space-y-1 pl-4 text-sm">
                {targets.map((target: any, index: number) => (
                  <p key={index}>
                    {target.is_correct ? '✓' : '✗'} {target.id}
                    {target.description && ` - ${target.description}`}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Explanation:</span> {explanation}
            </p>
          </div>
        </div>
      );
    }

    return <p className="text-sm text-muted-foreground">Unsupported problem type: {problem.problem_type}</p>;
  };

  const difficulty = (problem.problem_json as any).difficulty || 'medium';

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="space-y-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getTypeBadgeVariant(problem.problem_type)}>
                      {problem.problem_type.replace('_', ' ')}
                    </Badge>
                    <Badge variant={getDifficultyBadgeVariant(difficulty)}>
                      {difficulty}
                    </Badge>
                    {evaluation && (
                      <EvaluationBadge
                        recommendation={evaluation.final_recommendation}
                        score={evaluation.overall_score}
                        size="default"
                      />
                    )}
                    {problem.is_draft && <Badge variant="outline">Draft</Badge>}
                    {problem.is_active && !problem.is_draft && (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  {evaluation && (
                    <TierProgress
                      tier1Passed={evaluation.tier1_passed}
                      tier2Passed={evaluation.tier2_passed}
                      hasLlmEvaluation={hasLlmEvaluation}
                    />
                  )}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto font-normal text-left hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className="text-sm">{getQuestionPreview()}</span>
                    </div>
                  </Button>
                </CollapsibleTrigger>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditor(true)}
                  title="Edit problem"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEvaluate}
                  disabled={evaluateMutation.isPending}
                  title="Evaluate problem quality"
                >
                  <CheckCircle className={`h-4 w-4 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerateMutation.isPending}
                  title="Regenerate problem"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  title="Delete problem"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Problem Content */}
              <div className="bg-muted/50 rounded-lg p-4">
                {renderProblemContent()}
              </div>

              {/* Evaluation */}
              <div>
                {evaluation ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEvaluation(!showEvaluation)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {showEvaluation ? 'Hide' : 'View'} Evaluation Results
                      </Button>

                      {/* Promote to Template button - only show for high-scoring problems */}
                      {evaluation.overall_score >= 8.5 && problem.generation_prompt && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handlePromoteToTemplate}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Promote to Template
                        </Button>
                      )}
                    </div>

                    {showEvaluation && <EvaluationResults evaluation={evaluation} />}
                  </>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                    No evaluation available yet. Click the <CheckCircle className="inline h-3 w-3 mx-1" /> button to run quality assessment.
                  </div>
                )}
              </div>

              {/* Generation Metadata */}
              {problem.generation_prompt && (
                <details className="text-xs text-muted-foreground border-t pt-3">
                  <summary className="cursor-pointer hover:text-foreground font-medium mb-2">
                    📊 Generation Metadata
                  </summary>
                  <div className="mt-2 space-y-3 pl-4">
                    {/* Basic Generation Info */}
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Basic Information</p>
                      <p>Model: {problem.generation_model}</p>
                      <p>Temperature: {problem.generation_temperature}</p>
                      <p>Generated: {new Date(problem.generation_timestamp!).toLocaleString()}</p>
                      {problem.generation_duration_ms && (
                        <p>Duration: {problem.generation_duration_ms}ms</p>
                      )}
                    </div>

                    {/* Extended Metadata */}
                    {problem.generation_metadata && (
                      <>
                        {/* Generation ID & Type Selection */}
                        {(problem.generation_metadata.generation_id || problem.generation_metadata.type_selection_reasoning) && (
                          <div className="space-y-1 border-t pt-2">
                            <p className="font-medium text-foreground">Type Selection</p>
                            {problem.generation_metadata.generation_id && (
                              <p>Generation ID: {problem.generation_metadata.generation_id}</p>
                            )}
                            {problem.generation_metadata.complexity && (
                              <p>Complexity: {problem.generation_metadata.complexity}</p>
                            )}
                            {problem.generation_metadata.type_selection_reasoning && (
                              <p>Reasoning: {problem.generation_metadata.type_selection_reasoning}</p>
                            )}
                          </div>
                        )}

                        {/* AI Coach Configuration */}
                        {(problem.generation_metadata.enable_ai_coach !== undefined) && (
                          <div className="space-y-1 border-t pt-2">
                            <p className="font-medium text-foreground">AI Coach Configuration</p>
                            <p>Enabled: {problem.generation_metadata.enable_ai_coach ? 'Yes' : 'No'}</p>
                            {problem.generation_metadata.ai_coach_rationale && (
                              <p>Rationale: {problem.generation_metadata.ai_coach_rationale}</p>
                            )}
                          </div>
                        )}

                        {/* Context Primitives */}
                        {problem.generation_metadata.context_primitives && (
                          <div className="space-y-1 border-t pt-2">
                            <p className="font-medium text-foreground">Context Primitives Used</p>
                            {problem.generation_metadata.context_primitives.objects && problem.generation_metadata.context_primitives.objects.length > 0 && (
                              <div>
                                <p className="font-medium">Objects:</p>
                                <p className="pl-2">{problem.generation_metadata.context_primitives.objects.join(', ')}</p>
                              </div>
                            )}
                            {problem.generation_metadata.context_primitives.characters && problem.generation_metadata.context_primitives.characters.length > 0 && (
                              <div>
                                <p className="font-medium">Characters:</p>
                                <p className="pl-2">{problem.generation_metadata.context_primitives.characters.join(', ')}</p>
                              </div>
                            )}
                            {problem.generation_metadata.context_primitives.scenarios && problem.generation_metadata.context_primitives.scenarios.length > 0 && (
                              <div>
                                <p className="font-medium">Scenarios:</p>
                                <p className="pl-2">{problem.generation_metadata.context_primitives.scenarios.join(', ')}</p>
                              </div>
                            )}
                            {problem.generation_metadata.context_primitives.locations && problem.generation_metadata.context_primitives.locations.length > 0 && (
                              <div>
                                <p className="font-medium">Locations:</p>
                                <p className="pl-2">{problem.generation_metadata.context_primitives.locations.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Generation Prompt */}
                    <details className="border-t pt-2">
                      <summary className="cursor-pointer hover:text-foreground font-medium">
                        📝 Full Generation Prompt
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                        {problem.generation_prompt}
                      </pre>
                    </details>
                  </div>
                </details>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Problem Editor Dialog */}
      {showEditor && (
        <ProblemEditor
          problem={problem}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Promote to Template Dialog */}
      <PromoteToTemplateDialog
        open={showPromoteDialog}
        onOpenChange={setShowPromoteDialog}
        problem={problem}
        evaluation={evaluation}
        subskillId={subskillId}
      />
    </>
  );
}
