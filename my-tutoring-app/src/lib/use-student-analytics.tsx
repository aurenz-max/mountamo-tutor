// src/lib/use-student-analytics.ts
import { useState, useEffect } from 'react';
import { 
  analyticsApi, 
  StudentMetrics, 
  TimeSeriesData, 
  Recommendation 
} from '@/lib/studentAnalyticsAPI';

export function useStudentAnalytics() {
  const [studentId, setStudentId] = useState(1);
  const [subject, setSubject] = useState<string | null>(null);
  const [grade, setGrade] = useState('Kindergarten');
  const [startDate, setStartDate] = useState('2025-01-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2025-03-01T00:00:00Z');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);

  const setDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all the data you need from your API
      const [metricsData, timeSeriesResult, recommendationsData] = await Promise.all([
        analyticsApi.getStudentMetrics(studentId, {
          subject: subject || undefined,
          startDate,
          endDate,
        }),
        analyticsApi.getTimeSeriesMetrics(studentId, {
          subject: subject || undefined,
          startDate,
          endDate,
          interval: 'month',
          level: 'subject',
        }),
        analyticsApi.getRecommendations(studentId, {
          subject: subject || undefined,
          limit: 10,
        })
      ]);
      
      setMetrics(metricsData);
      setTimeSeriesData(timeSeriesResult);
      setRecommendations(recommendationsData);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dependencies change
  useEffect(() => {
    refreshData();
  }, [studentId, subject, startDate, endDate]);

  // Check if data is loaded
  const isDataLoaded = () => {
    return Boolean(metrics && timeSeriesData);
  };

  return {
    studentId,
    subject,
    grade,
    startDate,
    endDate,
    loading,
    error,
    metrics,
    timeSeriesData,
    recommendations,
    setStudentId,
    setSubject,
    setGrade,
    setDateRange,
    refreshData,
    isDataLoaded,
  };
}