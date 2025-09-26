export interface NextStepAction {
  text: string;
  link: string;
  action_type: 'learn' | 'practice' | 'challenge' | 'review';
}

export interface SubskillDetail {
  subskill_id: string;
  subskill_description: string;
  questions: number;
  correct: number;
}

export interface AssessmentSkillAnalysisItem {
  skill_id: string;
  skill_name: string;
  category: string;
  total_questions: number;
  correct_count: number;
  percentage: number;
  unit_id: string;
  unit_title: string;
  assessment_focus_tag?: string;
  performance_label?: 'Mastered' | 'Proficient' | 'Developing' | 'Needs Review';
  insight_text?: string;
  next_step?: NextStepAction;
  subskills?: SubskillDetail[];
}

export interface AssessmentProblemReviewItem {
  problem_id: string;
  is_correct: boolean;
  score: number;
  student_answer_text: string;
  correct_answer_text: string;
  skill_id: string;
  skill_name: string;
  subskill_id: string;
  subskill_name: string;
  unit_id: string;
  unit_title: string;
  problem_type: string;
}

export interface AssessmentSummaryData {
  correct_count: number;
  total_questions: number;
  score_percentage: number;
  performance_by_problem_type: Record<string, {
    percentage: number;
    correct: number;
    total: number;
  }>;
  performance_by_category: Record<string, {
    percentage: number;
    correct: number;
    total: number;
  }>;
  detailed_metrics: Record<string, any>;
}

export interface AssessmentAIInsights {
  ai_summary: string;
  performance_quote: string;
  skill_insights?: AssessmentSkillAnalysisItem[];
  common_misconceptions?: string[];
  problem_insights?: Array<Record<string, any>>;
}

export interface EnhancedAssessmentSummaryResponse {
  assessment_id: string;
  student_id: number;
  subject: string;
  summary?: AssessmentSummaryData;
  skill_analysis?: AssessmentSkillAnalysisItem[];
  problem_reviews?: AssessmentProblemReviewItem[];
  ai_insights?: AssessmentAIInsights;
  submitted_at?: string;
  time_taken_minutes?: number;
}