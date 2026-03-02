// hooks/useSkillProgress.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchSkillProgress, SkillProgressResponse } from '@/lib/skillProgressApi';

interface UseSkillProgressOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // ms, default 5 min
}

interface UseSkillProgressReturn {
  data: SkillProgressResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useSkillProgress = (
  studentId: number | null,
  options: UseSkillProgressOptions = {}
): UseSkillProgressReturn => {
  const { autoRefresh = false, refreshInterval = 5 * 60 * 1000 } = options;

  const [data, setData] = useState<SkillProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const result = await fetchSkillProgress(studentId);
      setData(result);
    } catch (err) {
      console.error('Error fetching skill progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch skill progress');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await doFetch();
  }, [doFetch]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && studentId) {
      const interval = setInterval(doFetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, studentId, doFetch]);

  return { data, loading, error, refetch };
};
