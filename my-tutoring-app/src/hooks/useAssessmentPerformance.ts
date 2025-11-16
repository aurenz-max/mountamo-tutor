import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { AssessmentPerformanceResponse, AssessmentPerformanceParams } from '@/types/analytics';

interface UseAssessmentPerformanceReturn {
  data: AssessmentPerformanceResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAssessmentPerformance = (
  studentId: number | null,
  params: AssessmentPerformanceParams = {}
): UseAssessmentPerformanceReturn => {
  const [data, setData] = useState<AssessmentPerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessmentPerformance = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getAssessmentPerformance(studentId, params);
      setData(result);
    } catch (err) {
      console.error('Error fetching assessment performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assessment performance');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchAssessmentPerformance();
  };

  useEffect(() => {
    fetchAssessmentPerformance();
  }, [studentId, params.subject, params.start_date, params.end_date]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
