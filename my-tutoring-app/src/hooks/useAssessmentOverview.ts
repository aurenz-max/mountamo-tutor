import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { AssessmentOverviewResponse, AssessmentOverviewParams } from '@/types/analytics';

interface UseAssessmentOverviewReturn {
  data: AssessmentOverviewResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAssessmentOverview = (
  studentId: number | null,
  params: AssessmentOverviewParams = {}
): UseAssessmentOverviewReturn => {
  const [data, setData] = useState<AssessmentOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessmentOverview = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getAssessmentOverview(studentId, params);
      setData(result);
    } catch (err) {
      console.error('Error fetching assessment overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assessment overview');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchAssessmentOverview();
  };

  useEffect(() => {
    fetchAssessmentOverview();
  }, [studentId, params.subject, params.start_date, params.end_date]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
