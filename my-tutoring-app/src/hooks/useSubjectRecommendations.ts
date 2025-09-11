import { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';

interface SubjectRecommendation {
  subskill_id: string;
  priority_rank: number;
  student_friendly_reason: string;
  engagement_hook: string;
  estimated_time_minutes: number;
  difficulty_level: string;
  skill_description: string;
  subskill_description: string;
  grade: string;
  unit_title: string;
}

interface SubjectRecommendationsResponse {
  student_id: number;
  subject: string;
  recommendations: SubjectRecommendation[];
  generated_at: string;
}

export const useSubjectRecommendations = (studentId: number | null, subject: string | null) => {
  const [data, setData] = useState<SubjectRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    if (!studentId || !subject) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authApi.get(
        `/api/analytics/student/${studentId}/subject-recommendations?subject=${encodeURIComponent(subject)}&count=5`
      );
      setData(response);
    } catch (err: any) {
      console.error('Error fetching subject recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && subject) {
      fetchRecommendations();
    }
  }, [studentId, subject]);

  return {
    data,
    loading,
    error,
    refetch: fetchRecommendations
  };
};