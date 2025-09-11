import { useState, useEffect } from 'react';
import { analyticsApi, VelocityMetricsResponse } from '@/lib/studentAnalyticsAPI';

interface UseVelocityMetricsOptions {
  subject?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseVelocityMetricsReturn {
  data: VelocityMetricsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useVelocityMetrics = (
  studentId: number | null,
  options: UseVelocityMetricsOptions = {}
): UseVelocityMetricsReturn => {
  const { subject, autoRefresh = false, refreshInterval = 15 * 60 * 1000 } = options; // Default 15 minutes
  
  const [data, setData] = useState<VelocityMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVelocityMetrics = async () => {
    if (!studentId) {
      setLoading(false);
      setError('No student ID provided');
      return;
    }

    try {
      setError(null);
      const result = await analyticsApi.getVelocityMetrics(studentId, { subject });
      setData(result);
    } catch (err) {
      console.error('Error fetching velocity metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch velocity metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchVelocityMetrics();
  };

  useEffect(() => {
    fetchVelocityMetrics();
  }, [studentId, subject]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchVelocityMetrics();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, studentId, subject]);

  return {
    data,
    loading,
    error,
    refetch
  };
};