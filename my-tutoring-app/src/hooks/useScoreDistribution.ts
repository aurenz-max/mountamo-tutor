import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { ScoreDistributionResponse, ScoreDistributionParams } from '@/types/analytics';

interface UseScoreDistributionReturn {
  data: ScoreDistributionResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useScoreDistribution = (
  studentId: number | null,
  params: ScoreDistributionParams
): UseScoreDistributionReturn => {
  const [data, setData] = useState<ScoreDistributionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScoreDistribution = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    if (!params.subject) {
      setLoading(false);
      setError('Subject is required');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getScoreDistribution(studentId, params);
      setData(result);
    } catch (err) {
      console.error('Error fetching score distribution:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch score distribution');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchScoreDistribution();
  };

  useEffect(() => {
    fetchScoreDistribution();
  }, [studentId, params.subject, params.start_date, params.end_date]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
