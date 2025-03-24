// src/lib/api.ts
import { api } from './api';

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
    completion: number;
    ready_items: number;
    recommended_items: number;
    total_items: number;
    attempted_items: number;
  };
  hierarchical_data: Array<UnitData>;
}

export interface UnitData {
  unit_id: string;
  unit_title: string;
  mastery: number;
  proficiency: number;
  completion: number;
  attempted: number;
  total: number;
  skills: Array<SkillData>;
}

export interface SkillData {
  skill_id: string;
  skill_description: string;
  mastery: number;
  proficiency: number;
  completion: number;
  attempted: number;
  total: number;
  subskills: Array<SubskillData>;
}

export interface SubskillData {
  subskill_id: string;
  subskill_description: string;
  mastery: number;
  completion: number;
  is_attempted: boolean;
  readiness_status: string;
  priority_level: string;
  priority_order: number;
  next_subskill: string | null;
  recommended_next: string | null;
}

export interface TimeSeriesData {
  student_id: number;
  subject?: string;
  level: string;
  interval: string;
  data: Array<{
    interval_date: string;
    metrics: {
      mastery: number;
      proficiency: number;
      completion: number;
      attempts: number;
      unique_subskills: number;
      total_curriculum_items: number;
      total_ready_items: number;
    };
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
  priority_level: string;
  is_ready: boolean;
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
    } = {}
  ): Promise<TimeSeriesData> {
    const { subject, interval, level, startDate, endDate, unitId, skillId } = options;
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
    
    return response.json();
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