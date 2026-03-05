import { useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/authApiClient';
import type { ItemCalibrationList } from '@/types/calibration';

interface UseItemCalibrationsReturn {
  data: ItemCalibrationList | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useItemCalibrations = (
  primitiveType?: string,
): UseItemCalibrationsReturn => {
  const [data, setData] = useState<ItemCalibrationList | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalibrations = useCallback(async () => {
    try {
      setError(null);
      const result = await authApi.getItemCalibrations(primitiveType);
      setData(result as ItemCalibrationList);
    } catch (err) {
      console.error('Error fetching item calibrations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calibrations');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [primitiveType]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchCalibrations();
  }, [fetchCalibrations]);

  useEffect(() => {
    fetchCalibrations();
  }, [fetchCalibrations]);

  return { data, loading, error, refetch };
};
