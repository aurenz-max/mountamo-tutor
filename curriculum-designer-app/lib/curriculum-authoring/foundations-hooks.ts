/**
 * React Query hooks for AI Foundations System
 * Manages server state for foundations data with caching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foundationsAPI } from './foundations-api';
import type {
  FoundationsData,
  FoundationStatus,
  VisualSchemasResponse,
  SaveFoundationsRequest,
} from '@/types/foundations';

// ==================== QUERY KEYS ====================

export const FOUNDATIONS_QUERY_KEYS = {
  foundations: (subskillId: string, versionId: string = 'v1') =>
    ['foundations', subskillId, versionId] as const,
  foundationStatus: (subskillId: string, versionId: string = 'v1') =>
    ['foundationStatus', subskillId, versionId] as const,
  visualSchemas: () => ['visualSchemas'] as const,
};

// ==================== QUERY HOOKS ====================

/**
 * Hook to fetch foundations for a subskill
 * Returns 404 if foundations don't exist yet
 */
export function useFoundations(subskillId: string, versionId: string = 'v1') {
  return useQuery({
    queryKey: FOUNDATIONS_QUERY_KEYS.foundations(subskillId, versionId),
    queryFn: async () => {
      const response = await foundationsAPI.getFoundations(subskillId, versionId);
      return response.data;
    },
    enabled: !!subskillId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (foundations don't exist yet)
      if (error instanceof Error && 'status' in error && (error as any).status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to check foundation status (lightweight)
 */
export function useFoundationStatus(subskillId: string, versionId: string = 'v1') {
  return useQuery({
    queryKey: FOUNDATIONS_QUERY_KEYS.foundationStatus(subskillId, versionId),
    queryFn: () => foundationsAPI.getFoundationStatus(subskillId, versionId),
    enabled: !!subskillId,
  });
}

/**
 * Hook to fetch all available visual schemas
 * Cached with long staleTime since schemas rarely change
 */
export function useVisualSchemas() {
  return useQuery({
    queryKey: FOUNDATIONS_QUERY_KEYS.visualSchemas(),
    queryFn: () => foundationsAPI.getVisualSchemas(),
    staleTime: 1000 * 60 * 60, // 1 hour - schemas don't change often
  });
}

// ==================== MUTATION HOOKS ====================

/**
 * Hook to generate fresh AI foundations
 * Takes 10-30 seconds to complete
 */
export function useGenerateFoundations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, versionId = 'v1' }: { subskillId: string; versionId?: string }) =>
      foundationsAPI.generateFoundations(subskillId, versionId),
    onSuccess: (response, { subskillId, versionId = 'v1' }) => {
      // Update the foundations cache with new data
      queryClient.setQueryData(
        FOUNDATIONS_QUERY_KEYS.foundations(subskillId, versionId),
        response.data
      );
      // Invalidate status to refresh
      queryClient.invalidateQueries({
        queryKey: FOUNDATIONS_QUERY_KEYS.foundationStatus(subskillId, versionId),
      });
    },
  });
}

/**
 * Hook to save educator-edited foundations
 */
export function useSaveFoundations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subskillId,
      data,
      versionId = 'v1',
    }: {
      subskillId: string;
      data: SaveFoundationsRequest;
      versionId?: string;
    }) => foundationsAPI.saveFoundations(subskillId, data, versionId),
    onSuccess: (response, { subskillId, versionId = 'v1' }) => {
      // Update the foundations cache
      queryClient.setQueryData(
        FOUNDATIONS_QUERY_KEYS.foundations(subskillId, versionId),
        response.data
      );
      // Invalidate status to refresh
      queryClient.invalidateQueries({
        queryKey: FOUNDATIONS_QUERY_KEYS.foundationStatus(subskillId, versionId),
      });
    },
  });
}

/**
 * Hook to delete foundations
 * Used to regenerate from scratch
 */
export function useDeleteFoundations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, versionId = 'v1' }: { subskillId: string; versionId?: string }) =>
      foundationsAPI.deleteFoundations(subskillId, versionId),
    onSuccess: (_, { subskillId, versionId = 'v1' }) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: FOUNDATIONS_QUERY_KEYS.foundations(subskillId, versionId),
      });
      // Invalidate status
      queryClient.invalidateQueries({
        queryKey: FOUNDATIONS_QUERY_KEYS.foundationStatus(subskillId, versionId),
      });
    },
  });
}
