import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { ScoreTrendsResponse, ScoreTrendsParams } from '@/types/analytics';

interface UseScoreTrendsReturn {
  data: ScoreTrendsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useScoreTrends = (
  studentId: number | null,
  params: ScoreTrendsParams
): UseScoreTrendsReturn => {
  const [data, setData] = useState<ScoreTrendsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScoreTrends = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    if (!params.granularity) {
      setLoading(false);
      setError('Granularity is required');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getScoreTrends(studentId, params);
      setData(result);
    } catch (err) {
      console.error('Error fetching score trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch score trends');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchScoreTrends();
  };

  useEffect(() => {
    fetchScoreTrends();
  }, [studentId, params.granularity, params.lookback_weeks, params.lookback_months, params.subjects]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
