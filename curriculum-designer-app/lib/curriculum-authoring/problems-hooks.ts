/**
 * React Query hooks for Problems and Prompts
 * Provides efficient server state management for problem generation and evaluation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsAPI } from './problems-api';
import type {
  ProblemInDB,
  GenerateProblemsRequest,
  RegenerateProblemRequest,
  UpdateProblemRequest,
  ProblemEvaluation,
  PromptTemplate,
  CreatePromptTemplateRequest,
  UpdatePromptTemplateRequest,
  PromptTemplateType,
} from '@/types/problems';

// ==================== QUERY KEYS ====================

export const PROBLEMS_QUERY_KEYS = {
  // Problems
  problems: (subskillId: string, versionId: string, activeOnly?: boolean) =>
    ['problems', subskillId, versionId, { activeOnly }] as const,
  problem: (problemId: string) => ['problem', problemId] as const,

  // Evaluations
  evaluation: (problemId: string) => ['evaluation', problemId] as const,

  // Prompts
  prompts: (filters?: {
    template_type?: PromptTemplateType;
    template_name?: string;
    active_only?: boolean;
  }) => ['prompts', filters] as const,
  prompt: (templateId: string) => ['prompt', templateId] as const,
  activePrompt: (name: string, type: PromptTemplateType) =>
    ['activePrompt', name, type] as const,
  promptPerformance: (templateId: string) => ['promptPerformance', templateId] as const,
  promptTypes: () => ['promptTypes'] as const,
};

// ==================== PROBLEM HOOKS ====================

/**
 * Query hook to list problems for a subskill
 */
export function useProblems(
  subskillId: string,
  versionId: string,
  activeOnly: boolean = false
) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.problems(subskillId, versionId, activeOnly),
    queryFn: () => problemsAPI.listProblems(subskillId, versionId, activeOnly),
    enabled: !!subskillId && !!versionId,
  });
}

/**
 * Query hook to get a specific problem
 */
export function useProblem(problemId: string) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.problem(problemId),
    queryFn: () => problemsAPI.getProblem(problemId),
    enabled: !!problemId,
  });
}

/**
 * Mutation hook to generate problems for a subskill
 */
export function useGenerateProblems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      request,
    }: {
      subskillId: string;
      request: GenerateProblemsRequest;
    }) => problemsAPI.generateProblems(subskillId, request),
    onSuccess: (data, variables) => {
      // Invalidate problems list to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['problems', variables.subskillId],
      });
    },
  });
}

/**
 * Mutation hook to update a problem
 */
export function useUpdateProblem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      problemId,
      updates,
    }: {
      problemId: string;
      updates: UpdateProblemRequest;
    }) => problemsAPI.updateProblem(problemId, updates),
    onSuccess: (data, variables) => {
      // Update cache for this specific problem
      queryClient.setQueryData(
        PROBLEMS_QUERY_KEYS.problem(variables.problemId),
        data
      );

      // Invalidate problems list (contains this problem)
      queryClient.invalidateQueries({
        queryKey: ['problems'],
      });
    },
  });
}

/**
 * Mutation hook to regenerate a problem
 */
export function useRegenerateProblem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      problemId,
      request,
    }: {
      problemId: string;
      request?: RegenerateProblemRequest;
    }) => problemsAPI.regenerateProblem(problemId, request),
    onSuccess: (data, variables) => {
      // Update cache for this specific problem
      queryClient.setQueryData(
        PROBLEMS_QUERY_KEYS.problem(variables.problemId),
        data
      );

      // Invalidate problems list
      queryClient.invalidateQueries({
        queryKey: ['problems'],
      });

      // Invalidate evaluation for this problem (will be re-run)
      queryClient.invalidateQueries({
        queryKey: PROBLEMS_QUERY_KEYS.evaluation(variables.problemId),
      });
    },
  });
}

/**
 * Mutation hook to delete a problem
 */
export function useDeleteProblem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (problemId: string) => problemsAPI.deleteProblem(problemId),
    onSuccess: (_, problemId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: PROBLEMS_QUERY_KEYS.problem(problemId),
      });

      // Invalidate problems list
      queryClient.invalidateQueries({
        queryKey: ['problems'],
      });
    },
  });
}

/**
 * Mutation hook to batch regenerate rejected problems
 */
export function useBatchRegenerateProblems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      versionId,
      temperature,
    }: {
      subskillId: string;
      versionId: string;
      temperature?: number;
    }) => problemsAPI.batchRegenerateProblems(subskillId, versionId, temperature),
    onSuccess: (data, variables) => {
      // Invalidate problems list
      queryClient.invalidateQueries({
        queryKey: ['problems', variables.subskillId],
      });

      // Invalidate evaluations
      queryClient.invalidateQueries({
        queryKey: ['evaluation'],
      });
    },
  });
}

// ==================== EVALUATION HOOKS ====================

/**
 * Query hook to get evaluation for a problem
 */
export function useEvaluation(problemId: string) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.evaluation(problemId),
    queryFn: () => problemsAPI.getEvaluation(problemId),
    enabled: !!problemId,
    retry: false, // Don't retry if evaluation doesn't exist yet
  });
}

/**
 * Mutation hook to evaluate a problem
 */
export function useEvaluateProblem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      problemId,
      skipLlm,
    }: {
      problemId: string;
      skipLlm?: boolean;
    }) => problemsAPI.evaluateProblem(problemId, skipLlm),
    onSuccess: (data, variables) => {
      // Update cache for this evaluation
      queryClient.setQueryData(
        PROBLEMS_QUERY_KEYS.evaluation(variables.problemId),
        data
      );
    },
  });
}

/**
 * Mutation hook to batch evaluate problems
 */
export function useBatchEvaluateProblems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      versionId,
      skipLlm,
    }: {
      subskillId: string;
      versionId: string;
      skipLlm?: boolean;
    }) => problemsAPI.batchEvaluateProblems(subskillId, versionId, skipLlm),
    onSuccess: (data, variables) => {
      // Invalidate all evaluations for this subskill
      queryClient.invalidateQueries({
        queryKey: ['evaluation'],
      });
    },
  });
}

// ==================== PROMPT TEMPLATE HOOKS ====================

/**
 * Query hook to list prompt templates
 */
export function usePrompts(filters?: {
  template_type?: PromptTemplateType;
  template_name?: string;
  active_only?: boolean;
}) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.prompts(filters),
    queryFn: () => problemsAPI.listPrompts(filters),
  });
}

/**
 * Query hook to get a specific prompt template
 */
export function usePrompt(templateId: string) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.prompt(templateId),
    queryFn: () => problemsAPI.getPrompt(templateId),
    enabled: !!templateId,
  });
}

/**
 * Query hook to get the active prompt template
 */
export function useActivePrompt(name: string, type: PromptTemplateType) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.activePrompt(name, type),
    queryFn: () => problemsAPI.getActivePrompt(name, type),
    enabled: !!name && !!type,
  });
}

/**
 * Query hook to get prompt performance metrics
 */
export function usePromptPerformance(templateId: string) {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.promptPerformance(templateId),
    queryFn: () => problemsAPI.getPromptPerformance(templateId),
    enabled: !!templateId,
  });
}

/**
 * Query hook to get available prompt types
 */
export function usePromptTypes() {
  return useQuery({
    queryKey: PROBLEMS_QUERY_KEYS.promptTypes(),
    queryFn: () => problemsAPI.getPromptTypes(),
  });
}

/**
 * Mutation hook to create a prompt template
 */
export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreatePromptTemplateRequest) =>
      problemsAPI.createPrompt(request),
    onSuccess: () => {
      // Invalidate prompts list
      queryClient.invalidateQueries({
        queryKey: ['prompts'],
      });
    },
  });
}

/**
 * Mutation hook to update a prompt template
 */
export function useUpdatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      updates,
    }: {
      templateId: string;
      updates: UpdatePromptTemplateRequest;
    }) => problemsAPI.updatePrompt(templateId, updates),
    onSuccess: (data, variables) => {
      // Update cache for this specific prompt
      queryClient.setQueryData(
        PROBLEMS_QUERY_KEYS.prompt(variables.templateId),
        data
      );

      // Invalidate prompts list
      queryClient.invalidateQueries({
        queryKey: ['prompts'],
      });

      // Invalidate active prompt queries
      queryClient.invalidateQueries({
        queryKey: ['activePrompt'],
      });
    },
  });
}

/**
 * Mutation hook to activate a prompt template
 */
export function useActivatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => problemsAPI.activatePrompt(templateId),
    onSuccess: (data, templateId) => {
      // Update cache for this specific prompt
      queryClient.setQueryData(
        PROBLEMS_QUERY_KEYS.prompt(templateId),
        data
      );

      // Invalidate prompts list
      queryClient.invalidateQueries({
        queryKey: ['prompts'],
      });

      // Invalidate active prompt queries (this prompt is now active)
      queryClient.invalidateQueries({
        queryKey: ['activePrompt'],
      });
    },
  });
}
