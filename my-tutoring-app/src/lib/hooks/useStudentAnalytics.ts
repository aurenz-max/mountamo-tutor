// hooks/useStudentAnalytics.ts - Simplified analytics hook
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import authApi, { AnalyticsMetricsResponse, AnalyticsTimeseriesResponse, AnalyticsRecommendation } from '@/lib/authApiClient';

interface AnalyticsFilters {
  subject?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
}

interface AnalyticsState {
  metrics: AnalyticsMetricsResponse | null;
  timeseries: AnalyticsTimeseriesResponse | null;
  recommendations: AnalyticsRecommendation[] | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

interface UseStudentAnalyticsReturn extends AnalyticsState {
  studentId: number | null;
  filters: AnalyticsFilters;
  setFilters: (filters: Partial<AnalyticsFilters>) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const cache = new Map<string, { data: any; timestamp: number }>();

function getCacheKey(type: string, studentId: number, filters: AnalyticsFilters): string {
  return `${type}:${studentId}:${JSON.stringify(filters)}`;
}

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired data
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function useStudentAnalytics(): UseStudentAnalyticsReturn {
  const { userProfile } = useAuth();
  const studentId = userProfile?.student_id || null;

  const [filters, setFiltersState] = useState<AnalyticsFilters>({
    subject: undefined,
    dateRange: 'month'
  });

  const [state, setState] = useState<AnalyticsState>({
    metrics: null,
    timeseries: null,
    recommendations: null,
    loading: false,
    error: null,
    lastFetch: null
  });

  // Convert dateRange to actual dates
  const dateParams = useMemo(() => {
    if (!filters.dateRange || filters.dateRange === 'all') {
      return { start_date: undefined, end_date: undefined };
    }

    const now = new Date();
    const start = new Date();

    switch (filters.dateRange) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    return {
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    };
  }, [filters.dateRange]);

  const apiParams = useMemo(() => ({
    subject: filters.subject,
    start_date: filters.startDate || dateParams.start_date,
    end_date: filters.endDate || dateParams.end_date
  }), [filters.subject, filters.startDate, filters.endDate, dateParams]);

  const fetchAnalytics = async (useCache = true) => {
    if (!studentId) {
      setState(prev => ({ ...prev, error: 'No student ID available' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('📊 Fetching analytics for student:', studentId, 'with params:', apiParams);

      // Check cache first if useCache is true
      let metrics = null;
      let timeseries = null;
      let recommendations = null;

      if (useCache) {
        metrics = getCachedData<AnalyticsMetricsResponse>(getCacheKey('metrics', studentId, filters));
        timeseries = getCachedData<AnalyticsTimeseriesResponse>(getCacheKey('timeseries', studentId, filters));
        recommendations = getCachedData<AnalyticsRecommendation[]>(getCacheKey('recommendations', studentId, filters));
      }

      // Fetch metrics if not cached
      if (!metrics) {
        console.log('🔄 Fetching fresh metrics...');
        metrics = await authApi.getStudentMetrics(studentId, apiParams);
        setCachedData(getCacheKey('metrics', studentId, filters), metrics);
      } else {
        console.log('💾 Using cached metrics');
      }

      // Fetch timeseries if not cached
      if (!timeseries) {
        console.log('🔄 Fetching fresh timeseries...');
        timeseries = await authApi.getStudentTimeseries(studentId, {
          ...apiParams,
          interval: 'week', // Default to weekly intervals
          level: 'subject'   // Default to subject level
        });
        setCachedData(getCacheKey('timeseries', studentId, filters), timeseries);
      } else {
        console.log('💾 Using cached timeseries');
      }

      // Fetch recommendations if not cached
      if (!recommendations) {
        console.log('🔄 Fetching fresh recommendations...');
        recommendations = await authApi.getStudentRecommendations(studentId, {
          subject: filters.subject,
          limit: 10
        });
        setCachedData(getCacheKey('recommendations', studentId, filters), recommendations);
      } else {
        console.log('💾 Using cached recommendations');
      }

      setState({
        metrics,
        timeseries,
        recommendations,
        loading: false,
        error: null,
        lastFetch: new Date()
      });

      console.log('✅ Analytics fetch completed successfully');

    } catch (error: any) {
      console.error('❌ Analytics fetch error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch analytics data'
      }));
    }
  };

  // Fetch data when studentId or filters change
  useEffect(() => {
    if (studentId) {
      fetchAnalytics();
    }
  }, [studentId, apiParams.subject, apiParams.start_date, apiParams.end_date]);

  const setFilters = (newFilters: Partial<AnalyticsFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  };

  const refresh = async () => {
    await fetchAnalytics(false); // Force fresh fetch, bypass cache
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    studentId,
    filters,
    setFilters,
    metrics: state.metrics,
    timeseries: state.timeseries,
    recommendations: state.recommendations,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    refresh,
    clearError
  };
}

// Helper hook for getting specific metrics
export function useStudentMetrics(filters?: AnalyticsFilters) {
  const analytics = useStudentAnalytics();
  
  // Apply additional filters if provided
  useEffect(() => {
    if (filters) {
      analytics.setFilters(filters);
    }
  }, [filters]);

  return {
    data: analytics.metrics,
    loading: analytics.loading,
    error: analytics.error,
    refresh: analytics.refresh
  };
}

// Helper hook for getting recommendations only
export function useStudentRecommendations(subject?: string) {
  const analytics = useStudentAnalytics();
  
  useEffect(() => {
    if (subject) {
      analytics.setFilters({ subject });
    }
  }, [subject]);

  return {
    recommendations: analytics.recommendations,
    loading: analytics.loading,
    error: analytics.error,
    refresh: analytics.refresh
  };
}

// Helper hook for getting timeseries data with custom interval/level
export function useStudentTimeseries(params?: {
  subject?: string;
  interval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  level?: 'subject' | 'unit' | 'skill' | 'subskill';
  unit_id?: string;
  skill_id?: string;
}) {
  const { userProfile } = useAuth();
  const studentId = userProfile?.student_id || null;
  
  const [timeseriesData, setTimeseriesData] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeseries = async () => {
    if (!studentId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await authApi.getStudentTimeseries(studentId, params);
      setTimeseriesData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch timeseries data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchTimeseries();
    }
  }, [studentId, params?.subject, params?.interval, params?.level, params?.unit_id, params?.skill_id]);

  return {
    data: timeseriesData,
    loading,
    error,
    refresh: fetchTimeseries
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for getting analytics health status
 */
export function useAnalyticsHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      const healthData = await authApi.getAnalyticsHealth();
      setHealth(healthData);
    } catch (err: any) {
      setError(err.message || 'Failed to check analytics health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return {
    health,
    loading,
    error,
    refresh: checkHealth
  };
}

/**
 * Hook for admin functions (cache management, ETL)
 */
export function useAnalyticsAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const clearCache = async () => {
    setLoading(true);
    setError(null);

    try {
      await authApi.clearAnalyticsCache();
      setLastAction('Cache cleared successfully');
      
      // Clear our local cache as well
      cache.clear();
    } catch (err: any) {
      setError(err.message || 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (syncType: 'incremental' | 'full' = 'incremental') => {
    setLoading(true);
    setError(null);

    try {
      const result = await authApi.triggerAnalyticsSync(syncType);
      setLastAction(`${syncType} sync completed`);
      
      // Clear local cache after sync
      if (result.success) {
        cache.clear();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to trigger sync');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    lastAction,
    clearCache,
    triggerSync,
    clearError: () => setError(null)
  };
}

/**
 * Hook for real-time analytics updates (using polling)
 */
export function useRealTimeAnalytics(studentId: number | null, intervalMs: number = 30000) {
  const [isPolling, setIsPolling] = useState(false);
  const analytics = useStudentAnalytics();

  useEffect(() => {
    if (!studentId || !isPolling) return;

    const interval = setInterval(() => {
      console.log('🔄 Polling for analytics updates...');
      analytics.refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [studentId, isPolling, intervalMs, analytics.refresh]);

  return {
    startPolling: () => setIsPolling(true),
    stopPolling: () => setIsPolling(false),
    isPolling
  };
}

/**
 * Hook for comparing multiple students (future enhancement)
 */
export function useStudentComparison(studentIds: number[]) {
  const [comparisons, setComparisons] = useState<Record<number, AnalyticsMetricsResponse>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparisons = async () => {
    if (studentIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const promises = studentIds.map(id => 
        authApi.getStudentMetrics(id).then(data => ({ id, data }))
      );
      
      const results = await Promise.all(promises);
      const comparisonData = results.reduce((acc, { id, data }) => {
        acc[id] = data;
        return acc;
      }, {} as Record<number, AnalyticsMetricsResponse>);

      setComparisons(comparisonData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch comparison data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons();
  }, [JSON.stringify(studentIds)]); // Re-run when student IDs change

  return {
    comparisons,
    loading,
    error,
    refresh: fetchComparisons
  };
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Clear all cached analytics data
 */
export function clearAnalyticsCache() {
  cache.clear();
  console.log('🧹 Local analytics cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(cache.entries());
  const now = Date.now();
  
  const stats = {
    totalEntries: entries.length,
    validEntries: entries.filter(([, value]) => now - value.timestamp < CACHE_TTL).length,
    expiredEntries: entries.filter(([, value]) => now - value.timestamp >= CACHE_TTL).length,
    cacheSize: JSON.stringify(Object.fromEntries(cache)).length,
    oldestEntry: entries.length > 0 ? Math.min(...entries.map(([, value]) => value.timestamp)) : null,
    newestEntry: entries.length > 0 ? Math.max(...entries.map(([, value]) => value.timestamp)) : null
  };

  return stats;
}

/**
 * Preload analytics data for better UX
 */
export function preloadAnalytics(studentId: number, subjects: string[] = []) {
  if (!studentId) return;

  console.log('🚀 Preloading analytics data...');
  
  // Preload main metrics
  authApi.getStudentMetrics(studentId).catch(console.error);
  
  // Preload recommendations
  authApi.getStudentRecommendations(studentId).catch(console.error);
  
  // Preload subject-specific data
  subjects.forEach(subject => {
    authApi.getStudentMetrics(studentId, { subject }).catch(console.error);
    authApi.getStudentRecommendations(studentId, { subject }).catch(console.error);
  });
}