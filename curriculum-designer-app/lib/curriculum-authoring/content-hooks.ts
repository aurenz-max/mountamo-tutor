/**
 * React Query hooks for Content Generation System
 * Manages server state for reading content with caching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentAPI } from './content-api';
import type {
  ReadingContent,
  ReadingSection,
  VisualSnippet,
  UpdateSectionRequest,
  GenerateVisualRequest,
} from '@/types/content';

// ==================== QUERY KEYS ====================

export const CONTENT_QUERY_KEYS = {
  content: (subskillId: string, versionId: string = 'v1') =>
    ['content', subskillId, versionId] as const,
  visual: (subskillId: string, sectionId: string) =>
    ['visual', subskillId, sectionId] as const,
};

// ==================== QUERY HOOKS ====================

/**
 * Hook to fetch reading content for a subskill
 * Returns 404 if content doesn't exist yet
 */
export function useContent(subskillId: string, versionId: string = 'v1') {
  return useQuery({
    queryKey: CONTENT_QUERY_KEYS.content(subskillId, versionId),
    queryFn: async () => {
      const response = await contentAPI.getContent(subskillId, versionId);
      return response.data;
    },
    enabled: !!subskillId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (content doesn't exist yet)
      if (error instanceof Error && 'status' in error && (error as any).status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to fetch visual snippet for a section
 */
export function useVisualSnippet(subskillId: string, sectionId: string) {
  return useQuery({
    queryKey: CONTENT_QUERY_KEYS.visual(subskillId, sectionId),
    queryFn: async () => {
      const response = await contentAPI.getVisual(subskillId, sectionId);
      return response.data;
    },
    enabled: !!subskillId && !!sectionId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (visual doesn't exist yet)
      if (error instanceof Error && 'status' in error && (error as any).status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// ==================== MUTATION HOOKS ====================

/**
 * Hook to generate complete reading content
 * Takes 30-60 seconds to complete
 */
export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      versionId = 'v1',
      useFoundations = true,
    }: {
      subskillId: string;
      versionId?: string;
      useFoundations?: boolean;
    }) => contentAPI.generateContent(subskillId, versionId, useFoundations),
    onSuccess: (response, { subskillId, versionId = 'v1' }) => {
      // Update the content cache with new data
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.content(subskillId, versionId),
        response.data
      );
    },
  });
}

/**
 * Hook to delete all reading content for a subskill
 * This action cannot be undone
 */
export function useDeleteContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      versionId = 'v1',
      cascadeDeleteVisuals = true,
    }: {
      subskillId: string;
      versionId?: string;
      cascadeDeleteVisuals?: boolean;
    }) => contentAPI.deleteContent(subskillId, versionId, cascadeDeleteVisuals),
    onSuccess: (_, { subskillId, versionId = 'v1' }) => {
      // Remove content from cache
      queryClient.removeQueries({
        queryKey: CONTENT_QUERY_KEYS.content(subskillId, versionId),
      });

      // Also remove all visual snippets for this subskill
      queryClient.removeQueries({
        queryKey: ['visual', subskillId],
      });
    },
  });
}

/**
 * Hook to regenerate a single section
 * Takes 10-20 seconds to complete
 */
export function useRegenerateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      sectionId,
      versionId = 'v1',
      customPrompt,
    }: {
      subskillId: string;
      sectionId: string;
      versionId?: string;
      customPrompt?: string;
    }) => contentAPI.regenerateSection(subskillId, sectionId, versionId, customPrompt),
    onSuccess: (response, { subskillId, versionId = 'v1' }) => {
      // Invalidate content to refetch with updated section
      queryClient.invalidateQueries({
        queryKey: CONTENT_QUERY_KEYS.content(subskillId, versionId),
      });
    },
  });
}

/**
 * Hook to manually update a section
 */
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      sectionId,
      data,
      versionId = 'v1',
    }: {
      subskillId: string;
      sectionId: string;
      data: UpdateSectionRequest;
      versionId?: string;
    }) => contentAPI.updateSection(subskillId, sectionId, data, versionId),
    onSuccess: (response, { subskillId, sectionId, versionId = 'v1' }) => {
      // Optimistically update the content cache
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.content(subskillId, versionId),
        (oldData: ReadingContent | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            sections: oldData.sections.map((section) =>
              section.section_id === sectionId
                ? { ...section, ...response.data }
                : section
            ),
            generation_status: 'edited' as const,
          };
        }
      );
    },
  });
}

/**
 * Hook to generate visual snippet
 * Takes 20-40 seconds to complete
 */
export function useGenerateVisual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      sectionId,
      request,
    }: {
      subskillId: string;
      sectionId: string;
      request: GenerateVisualRequest;
    }) => contentAPI.generateVisual(subskillId, sectionId, request),
    onSuccess: (response, { subskillId, sectionId, request }) => {
      // Update visual cache
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.visual(subskillId, sectionId),
        response.data
      );

      // Update has_visual_snippet flag in content cache
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.content(subskillId, request.section_id.split('_section_')[0]),
        (oldData: ReadingContent | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            sections: oldData.sections.map((section) =>
              section.section_id === sectionId
                ? { ...section, has_visual_snippet: true }
                : section
            ),
          };
        }
      );
    },
  });
}

/**
 * Hook to update visual snippet HTML
 */
export function useUpdateVisual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      sectionId,
      htmlContent,
    }: {
      subskillId: string;
      sectionId: string;
      htmlContent: string;
    }) => contentAPI.updateVisual(subskillId, sectionId, htmlContent),
    onSuccess: (response, { subskillId, sectionId }) => {
      // Update visual cache
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.visual(subskillId, sectionId),
        response.data
      );
    },
  });
}

/**
 * Hook to delete visual snippet
 */
export function useDeleteVisual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      sectionId,
    }: {
      subskillId: string;
      sectionId: string;
    }) => contentAPI.deleteVisual(subskillId, sectionId),
    onSuccess: (_, { subskillId, sectionId }) => {
      // Remove from visual cache
      queryClient.removeQueries({
        queryKey: CONTENT_QUERY_KEYS.visual(subskillId, sectionId),
      });

      // Update has_visual_snippet flag in content cache
      queryClient.setQueryData(
        CONTENT_QUERY_KEYS.content(subskillId, sectionId.split('_section_')[0]),
        (oldData: ReadingContent | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            sections: oldData.sections.map((section) =>
              section.section_id === sectionId
                ? { ...section, has_visual_snippet: false }
                : section
            ),
          };
        }
      );
    },
  });
}
