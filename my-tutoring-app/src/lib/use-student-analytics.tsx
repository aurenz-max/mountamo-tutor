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
  // Setting default date values to null instead of specific dates
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [level, setLevel] = useState<string>('subject');
  const [interval, setInterval] = useState<string>('month');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [processedMetrics, setProcessedMetrics] = useState<StudentMetrics | null>(null);

  // Update to handle null date values
  const setDateRange = (start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Process metrics to handle any potential backward compatibility issues
  const processMetricsData = (rawMetrics: StudentMetrics) => {
    if (!rawMetrics) return null;

    // Create a deep copy to avoid mutating the original
    const processed = JSON.parse(JSON.stringify(rawMetrics)) as StudentMetrics;

    // Ensure the summary has the correct field names
    if (processed.summary.raw_attempt_count !== undefined && processed.summary.attempt_count === undefined) {
      processed.summary.attempt_count = processed.summary.raw_attempt_count;
      delete processed.summary.raw_attempt_count;
    }

    // Ensure unit level has correct field names
    processed.hierarchical_data.forEach(unit => {
      // Handle renamed fields for backward compatibility
      if (unit.attempted !== undefined && unit.attempted_skills === undefined) {
        unit.attempted_skills = unit.attempted;
        delete unit.attempted;
      }
      
      if (unit.total !== undefined && unit.total_skills === undefined) {
        unit.total_skills = unit.total;
        delete unit.total;
      }
      
      // Calculate attempt_count if it doesn't exist
      if (unit.attempt_count === undefined) {
        unit.attempt_count = unit.skills.reduce((sum, skill) => 
          sum + (skill.attempt_count || 0), 0);
      }

      // Process each skill
      unit.skills.forEach(skill => {
        // Handle renamed fields for backward compatibility
        if (skill.attempted !== undefined && skill.attempted_subskills === undefined) {
          skill.attempted_subskills = skill.attempted;
          delete skill.attempted;
        }
        
        if (skill.total !== undefined && skill.total_subskills === undefined) {
          skill.total_subskills = skill.total;
          delete skill.total;
        }
        
        // Calculate attempt_count if it doesn't exist
        if (skill.attempt_count === undefined) {
          skill.attempt_count = skill.subskills.reduce((sum, subskill) => 
            sum + (subskill.attempt_count || 0), 0);
        }

        // Ensure subskill details are complete
        skill.subskills.forEach(subskill => {
          // Make sure attempt_count is available
          if (subskill.attempt_count === undefined) {
            subskill.attempt_count = subskill.is_attempted ? 1 : 0;
          }
          
          // Make sure individual_attempts is available
          if (!subskill.individual_attempts) {
            subskill.individual_attempts = [];
          }
          
          // Ensure avg_score is available (for backward compatibility)
          if (subskill.avg_score === undefined && subskill.mastery !== undefined) {
            subskill.avg_score = subskill.mastery;
          }
        });
      });
    });

    return processed;
  };

  // Process time series data to handle both old and new formats
  const processTimeSeriesData = (data: TimeSeriesData): TimeSeriesData => {
    if (!data) return data;
    
    // If data already has the 'data' property, assume it's already in the expected format
    if (data.data && data.data.length > 0) {
      return data;
    }
    
    // If data has 'intervals' but no 'data', transform it to the old format for backward compatibility
    if (data.intervals && !data.data) {
      const transformedData = { ...data };
      transformedData.data = data.intervals.map(interval => ({
        interval_date: interval.interval_date,
        metrics: {
          mastery: interval.summary.mastery,
          proficiency: interval.summary.proficiency,
          avg_score: interval.summary.avg_score,
          completion: interval.summary.completion,
          attempts: interval.summary.attempt_count,
          attempt_count: interval.summary.attempt_count,
          unique_subskills: interval.summary.attempted_items,
          attempted_items: interval.summary.attempted_items,
          total_items: interval.summary.total_items,
          ready_items: interval.summary.ready_items,
          total_curriculum_items: interval.summary.total_items,
          total_ready_items: interval.summary.ready_items
        }
      }));
      
      return transformedData;
    }
    
    return data;
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all the data you need from your API
      const [metricsData, timeSeriesResult, recommendationsData] = await Promise.all([
        analyticsApi.getStudentMetrics(studentId, {
          subject: subject || undefined,
          // Only include date parameters if they're not null
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        }),
        analyticsApi.getTimeSeriesMetrics(studentId, {
          subject: subject || undefined,
          // Only include date parameters if they're not null
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          interval: interval,
          level: level,
          unitId: unitId || undefined,
          skillId: skillId || undefined,
          includeHierarchy: false, // Set to true if you need hierarchical data
        }),
        analyticsApi.getRecommendations(studentId, {
          subject: subject || undefined,
          limit: 10,
        })
      ]);
      
      setMetrics(metricsData);
      // Process metrics data to add derived fields and ensure consistent naming
      const processed = processMetricsData(metricsData);
      setProcessedMetrics(processed);
      
      // Process time series data to handle both old and new formats
      const processedTimeSeriesData = processTimeSeriesData(timeSeriesResult);
      setTimeSeriesData(processedTimeSeriesData);
      
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
  }, [studentId, subject, startDate, endDate, level, interval, unitId, skillId]);

  // Update time series with different filters
  const updateTimeSeriesView = (newLevel: string, newInterval: string, newUnitId?: string, newSkillId?: string) => {
    setLevel(newLevel);
    setInterval(newInterval);
    setUnitId(newUnitId || null);
    setSkillId(newSkillId || null);
  };

  // Check if data is loaded
  const isDataLoaded = () => {
    return Boolean(processedMetrics && timeSeriesData);
  };

  // Get total attempts for a unit
  const getUnitAttempts = (unitId: string) => {
    if (!processedMetrics) return 0;
    
    const unit = processedMetrics.hierarchical_data.find(u => u.unit_id === unitId);
    if (!unit) return 0;
    
    return unit.attempt_count || 0;
  };

  // Get total attempts for a skill
  const getSkillAttempts = (unitId: string, skillId: string) => {
    if (!processedMetrics) return 0;
    
    const unit = processedMetrics.hierarchical_data.find(u => u.unit_id === unitId);
    if (!unit) return 0;
    
    const skill = unit.skills.find(s => s.skill_id === skillId);
    if (!skill) return 0;
    
    return skill.attempt_count || 0;
  };

  // Get attempts for a subskill
  const getSubskillAttempts = (unitId: string, skillId: string, subskillId: string) => {
    if (!processedMetrics) return 0;
    
    const unit = processedMetrics.hierarchical_data.find(u => u.unit_id === unitId);
    if (!unit) return 0;
    
    const skill = unit.skills.find(s => s.skill_id === skillId);
    if (!skill) return 0;
    
    const subskill = skill.subskills.find(s => s.subskill_id === subskillId);
    if (!subskill) return 0;
    
    return subskill.attempt_count || 0;
  };

  return {
    studentId,
    subject,
    grade,
    startDate,
    endDate,
    level,
    interval,
    unitId,
    skillId,
    loading,
    error,
    metrics: processedMetrics || metrics, // Use processed metrics when available
    timeSeriesData,
    recommendations,
    setStudentId,
    setSubject,
    setGrade,
    setDateRange,
    updateTimeSeriesView,
    refreshData,
    isDataLoaded,
    getUnitAttempts,
    getSkillAttempts,
    getSubskillAttempts,
  };
}