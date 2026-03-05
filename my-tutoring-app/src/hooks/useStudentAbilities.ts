import { useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { StudentAbilitySummary } from '@/types/calibration';

interface UseStudentAbilitiesReturn {
  data: StudentAbilitySummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useStudentAbilities = (
  studentId: number | null | undefined,
): UseStudentAbilitiesReturn => {
  const [data, setData] = useState<StudentAbilitySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAbilities = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const result = await authApi.getStudentAbilities(studentId);
      setData(result as StudentAbilitySummary);
    } catch (err) {
      console.error('Error fetching student abilities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch abilities');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchAbilities();
  }, [fetchAbilities]);

  useEffect(() => {
    fetchAbilities();
  }, [fetchAbilities]);

  return { data, loading, error, refetch };
};
