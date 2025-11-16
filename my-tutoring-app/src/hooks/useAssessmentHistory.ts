import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { AssessmentHistoryResponse, AssessmentHistoryParams } from '@/types/analytics';

interface UseAssessmentHistoryReturn {
  data: AssessmentHistoryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAssessmentHistory = (
  studentId: number | null,
  params: AssessmentHistoryParams = {}
): UseAssessmentHistoryReturn => {
  const [data, setData] = useState<AssessmentHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessmentHistory = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    try {
      setError(null);
      const result = await authApi.getAssessmentHistoryAnalytics(studentId, params);

      // Backend returns array directly, wrap it in AssessmentHistoryResponse format
      const wrappedResult: AssessmentHistoryResponse = {
        student_id: studentId,
        subject: params.subject,
        date_range: {
          start_date: params.start_date,
          end_date: params.end_date
        },
        limit: params.limit || 20,
        assessments: Array.isArray(result) ? result : [],
        cached: false,
        generated_at: new Date().toISOString()
      };

      setData(wrappedResult);
    } catch (err) {
      console.error('Error fetching assessment history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch assessment history');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchAssessmentHistory();
  };

  useEffect(() => {
    fetchAssessmentHistory();
  }, [studentId, params.subject, params.start_date, params.end_date, params.limit]);

  return {
    data,
    loading,
    error,
    refetch
  };
};
