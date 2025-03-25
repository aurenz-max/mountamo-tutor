// src/lib/studentAnalyticsAPI.ts

const API_BASE_URL = 'http://localhost:8000/api';

// Types for Student Learning Analytics API
export interface StudentMetrics {
  student_id: number;
  subject?: string;
  date_range?: {
    start_date: string;
    end_date: string;
  };
  summary: {
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    ready_items: number;
    recommended_items: number;
    total_items: number;
    attempted_items: number;
    attempt_count: number;
    raw_attempt_count?: number; // For backward compatibility
  };
  hierarchical_data: Array<UnitData>;
}

export interface UnitData {
  unit_id: string;
  unit_title: string;
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempted_skills: number;
  total_skills: number;
  attempt_count: number;
  attempted?: number; // For backward compatibility
  total?: number; // For backward compatibility
  skills: Array<SkillData>;
}

export interface SkillData {
  skill_id: string;
  skill_description: string;
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempted_subskills: number;
  total_subskills: number;
  attempt_count: number;
  attempted?: number; // For backward compatibility
  total?: number; // For backward compatibility
  subskills: Array<SubskillData>;
}

export interface SubskillData {
  subskill_id: string;
  subskill_description: string;
  mastery: number;
  avg_score: number;
  proficiency: number;
  completion: number;
  is_attempted: boolean;
  readiness_status: string;
  priority_level: string;
  priority_order: number;
  next_subskill: string | null;
  recommended_next: string | null;
  attempt_count: number;
  individual_attempts?: Array<{
    timestamp: string;
    score: string;
  }>;
}

// For compatibility with existing components
export interface TimeSeriesMetrics {
  mastery: number;
  proficiency: number;
  avg_score: number;
  completion: number;
  attempts: number; // For backward compatibility
  attempt_count: number;
  unique_subskills: number; // For backward compatibility
  attempted_items: number;
  total_items: number;
  ready_items: number;
  total_curriculum_items?: number; // For backward compatibility
  total_ready_items?: number; // For backward compatibility
}

// Interface for new timeseries API format
export interface TimeSeriesInterval {
  interval_date: string;
  summary: {
    mastery: number;
    proficiency: number;
    avg_score: number;
    completion: number;
    attempted_items: number;
    total_items: number;
    attempt_count: number;
    ready_items: number;
    recommended_items: number;
  };
  hierarchical_data?: any[]; // Optional hierarchy if requested
}

// Combined interface that works with both old format and new format
export interface TimeSeriesData {
  student_id: number;
  subject?: string;
  date_range?: {
    start_date: string | null;
    end_date: string | null;
  };
  level: string;
  interval: string;
  
  // New API format
  intervals?: TimeSeriesInterval[];
  
  // Old API format (for backward compatibility)
  data?: Array<{
    interval_date: string;
    metrics: TimeSeriesMetrics;
    subject?: string;
    unit_id?: string;
    unit_title?: string;
    skill_id?: string;
    skill_description?: string;
    subskill_id?: string;
    subskill_description?: string;
  }>;
}

export interface Recommendation {
  type: string;
  priority: string;
  unit_id: string;
  unit_title: string;
  skill_id: string;
  skill_description: string;
  subskill_id: string;
  subskill_description: string;
  proficiency: number;
  mastery: number;
  avg_score: number;
  priority_level: string;
  priority_order: number;
  readiness_status: string;
  is_ready: boolean;
  completion: number;
  attempt_count: number;
  is_attempted: boolean;
  next_subskill: string | null;
  message: string;
}

// Add to existing API or create a dedicated object
export const analyticsApi = {
  // Get hierarchical metrics for a student
  async getStudentMetrics(
    studentId: number,
    options: {
      subject?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<StudentMetrics> {
    const { subject, startDate, endDate } = options;
    let url = `${API_BASE_URL}/analytics/student/${studentId}/metrics`;
    
    // Add optional query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch student metrics: ${response.statusText}. ${errorText}`);
    }
    
    return response.json();
  },

  // Get metrics time series for a student
  async getTimeSeriesMetrics(
    studentId: number,
    options: {
      subject?: string;
      interval?: string;
      level?: string;
      startDate?: string;
      endDate?: string;
      unitId?: string;
      skillId?: string;
      includeHierarchy?: boolean;
    } = {}
  ): Promise<TimeSeriesData> {
    const { subject, interval, level, startDate, endDate, unitId, skillId, includeHierarchy } = options;
    let url = `${API_BASE_URL}/analytics/student/${studentId}/metrics/timeseries`;
    
    // Add optional query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (interval) params.append('interval', interval);
    if (level) params.append('level', level);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (unitId) params.append('unit_id', unitId);
    if (skillId) params.append('skill_id', skillId);
    if (includeHierarchy !== undefined) params.append('include_hierarchy', includeHierarchy.toString());
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch time series metrics: ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    
    // For backward compatibility: transform new format to old format if needed
    if (data.intervals && !data.data && Array.isArray(data.intervals)) {
      data.data = data.intervals.map(interval => ({
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
    }
    
    return data;
  },

  // Get recommendations for a student
  async getRecommendations(
    studentId: number,
    options: {
      subject?: string;
      limit?: number;
    } = {}
  ): Promise<Array<Recommendation>> {
    const { subject, limit } = options;
    let url = `${API_BASE_URL}/analytics/student/${studentId}/recommendations`;
    
    // Add optional query parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (limit) params.append('limit', limit.toString());
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch recommendations: ${response.statusText}. ${errorText}`);
    }
    
    return response.json();
  }
};