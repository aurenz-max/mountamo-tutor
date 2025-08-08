// lib/packages/types.ts
export interface ContentPackage {
  id: string;
  subskill_id?: string;
  subject: string;
  skill: string;
  subskill: string;
  master_context: {
    core_concepts: string[];
    key_terminology: Record<string, string>;
    learning_objectives: string[];
    difficulty_level: string;
    real_world_applications: string[];
  };
  content: {
    reading: {
      title: string;
      sections: Array<{
        heading: string;
        content: string;
        key_terms_used: string[];
        concepts_covered: string[];
      }>;
      word_count: number;
      reading_level: string;
    };
    visual?: {
      p5_code: string;
      description: string;
      interactive_elements: string[];
      concepts_demonstrated: string[];
    };
    audio?: {
      audio_blob_url: string;
      duration_seconds: number;
      dialogue_script: string;
    };
    practice?: {
      problems: PracticeProblem[];
      problem_count: number;
      estimated_time_minutes: number;
    };
  };
  status: string;
  created_at: string;
}

export interface PackageCard {
  id: string;
  subject: string;
  skill: string;
  subskill: string;
  title: string;
  description: string[];
  difficulty_level: string;
  learning_objectives: string[];
  has_visual: boolean;
  has_audio: boolean;
  has_practice: boolean;
  created_at: string;
}

export interface PracticeProblem {
  id: string;
  problem_data: {
    problem_type: string;
    problem: string;
    answer: string;
    success_criteria: string[];
    teaching_note: string;
    difficulty: number;
  };
}

export interface PackageFilters {
  subject?: string;
  skill?: string;
  subskill?: string;
  difficulty?: string;
  status?: string;
  limit?: number;
}