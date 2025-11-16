import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { AssessmentDetailsResponse } from '@/types/analytics';

interface UseAssessmentDetailsReturn {
  data: AssessmentDetailsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAssessmentDetails = (
  studentId: number | null,
  assessmentId: string | null
): UseAssessmentDetailsReturn => {
  const [data, setData] = useState<AssessmentDetailsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessmentDetails = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    if (!assessmentId) {
      setLoading(false);
      setError('No assessment ID provided');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getAssessmentDetailsAnalytics(studentId, assessmentId);
      setData(result);
    } catch (err) {
      console.error('Error fetching assessment details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assessment details');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchAssessmentDetails();
  };

  useEffect(() => {
    fetchAssessmentDetails();
  }, [studentId, assessmentId]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
