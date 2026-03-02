// lib/skillProgressApi.ts
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// --- Types matching backend models ---

export interface PrerequisiteStatus {
  subskill_id: string;
  name: string;
  current_gate: number; // 0-4
  target_gate: number;  // 0-4
  completion_pct: number; // 0.0-1.0
  met: boolean;
}

export interface CraftingNowItem {
  skill_id: string;
  skill_name: string;
  subject: string;
  prerequisites: PrerequisiteStatus[];
  overall_readiness: number; // 0.0-1.0
}

export interface AlmostReadyItem {
  skill_id: string;
  skill_name: string;
  subject: string;
  blockers: PrerequisiteStatus[];
  readiness: number; // 0.0-1.0
}

export interface SubjectProgressSummary {
  total: number;
  mastered: number;
  in_progress: number;
  not_started: number;
}

export interface SkillProgressResponse {
  student_id: string;
  crafting_now: CraftingNowItem[];
  almost_ready: AlmostReadyItem[];
  progress_overview: Record<string, SubjectProgressSummary>;
  generated_at: string;
}

// --- API Client ---

export async function fetchSkillProgress(studentId: number): Promise<SkillProgressResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken();
  const response = await fetch(
    `${API_BASE_URL}/api/skill-progress/${studentId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch skill progress: ${response.status}`);
  }

  return response.json();
}
