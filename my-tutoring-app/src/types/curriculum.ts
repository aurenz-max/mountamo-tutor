/**
 * Curriculum Type Definitions
 *
 * These types match the backend schema exactly to ensure type safety
 * across the entire application. DO NOT parse or transform these IDs -
 * use them as-is from the curriculum_metadata provided by the backend.
 */

// ============================================================================
// CORE CURRICULUM TYPES (Match backend exactly)
// ============================================================================

export interface CurriculumUnit {
  id: string;          // e.g., "SS001", "COUNT001"
  title: string;       // e.g., "Classroom Routines and Social Skills"
  description?: string;
}

export interface CurriculumSkill {
  id: string;          // e.g., "SS001-04", "COUNT001-01"
  description: string; // e.g., "Local Governance"
}

export interface CurriculumSubskill {
  id: string;          // e.g., "SS001-04-E", "COUNT001-01-A"
  description: string; // e.g., "Create simple maps showing locations of local public services"
}

/**
 * Curriculum metadata attached to activities
 * This is the SOURCE OF TRUTH for curriculum IDs
 */
export interface CurriculumMetadata {
  subject: string;
  unit: CurriculumUnit;
  skill: CurriculumSkill;
  subskill: CurriculumSubskill;
}

// ============================================================================
// ACTIVITY TYPES (Daily/Weekly Planner)
// ============================================================================

export type ActivityType = 'practice' | 'packages' | 'review' | 'tutoring' | 'assessment';
export type ActivityPriority = 'high' | 'medium' | 'low';
export type ActivityPedagogicalType = 'warm_up' | 'core_challenge' | 'practice' | 'cool_down';
export type ActivitySourceType = 'ai_recommendations' | 'bigquery_recommendations' | 'fallback';

export interface ActivitySourceDetails {
  ai_reason?: string;
  priority_rank?: number;
  estimated_time_minutes?: number;
  readiness_status?: string;
  mastery_level?: number;
  reason?: string;
}

export interface CurriculumTransparency {
  subject: string;
  unit: string;
  skill: string;
  subskill: string;
}

/**
 * Activity from Daily Planner or Weekly Planner
 *
 * IMPORTANT:
 * - `id` is for tracking/routing (e.g., "weekly-ACT-Social Studies-0-1")
 * - `curriculum_metadata` contains the ACTUAL curriculum IDs to use for API calls
 * - Never parse or derive curriculum IDs from the activity `id`
 */
export interface DailyActivity {
  id: string;  // Activity instance ID (for routing/tracking only)
  type: ActivityType;
  title: string;
  description: string;
  category: string;
  estimated_time: string;
  points: number;
  priority: ActivityPriority;
  time_slot?: string;
  action?: string;
  endpoint?: string;
  icon_type?: string;
  is_complete?: boolean;

  // THE KEY: Contains actual curriculum IDs - USE THESE for API calls
  curriculum_metadata?: CurriculumMetadata;

  metadata: Record<string, any>;

  // Transparency and recommendation metadata
  source_type?: ActivitySourceType;
  source_details?: ActivitySourceDetails;
  activity_type?: ActivityPedagogicalType;
  reason?: string;
  curriculum_transparency?: CurriculumTransparency;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Problem Generation Request (matches backend ProblemRequest schema)
 *
 * IMPORTANT: Use IDs from curriculum_metadata, not from activity.id
 */
export interface ProblemGenerationRequest {
  subject: string;
  unit_id?: string;      // From curriculum_metadata.unit.id
  skill_id?: string;     // From curriculum_metadata.skill.id
  subskill_id?: string;  // From curriculum_metadata.subskill.id
  difficulty?: number;
  count?: number;
}

/**
 * Topic selection for practice sessions
 * This structure is used by ProblemSet component
 */
export interface TopicSelection {
  subject: string;
  selection: {
    unit?: string;
    skill: string;
    subskill: string;
  };
  unit?: CurriculumUnit;
  skill?: CurriculumSkill;
  subskill?: CurriculumSubskill;
  difficulty_range?: {
    target: number;
  };
  autoStart?: boolean;
  fromCardInterface?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract TopicSelection from DailyActivity
 * Uses curriculum_metadata as the source of truth
 */
export function activityToTopicSelection(
  activity: DailyActivity,
  autoStart: boolean = true
): TopicSelection | null {
  if (!activity.curriculum_metadata) {
    console.warn('Activity missing curriculum_metadata:', activity.id);
    return null;
  }

  const { curriculum_metadata } = activity;

  return {
    subject: curriculum_metadata.subject,
    selection: {
      unit: curriculum_metadata.unit.id,
      skill: curriculum_metadata.skill.id,
      subskill: curriculum_metadata.subskill.id,
    },
    unit: curriculum_metadata.unit,
    skill: curriculum_metadata.skill,
    subskill: curriculum_metadata.subskill,
    difficulty_range: {
      target: activity.metadata?.difficulty || 3.0,
    },
    autoStart,
    fromCardInterface: true,
  };
}

/**
 * Extract ProblemGenerationRequest from DailyActivity
 * Uses curriculum_metadata as the source of truth
 */
export function activityToProblemRequest(
  activity: DailyActivity,
  count: number = 5
): ProblemGenerationRequest | null {
  if (!activity.curriculum_metadata) {
    console.warn('Activity missing curriculum_metadata:', activity.id);
    return null;
  }

  const { curriculum_metadata } = activity;

  return {
    subject: curriculum_metadata.subject,
    unit_id: curriculum_metadata.unit.id,
    skill_id: curriculum_metadata.skill.id,
    subskill_id: curriculum_metadata.subskill.id,
    difficulty: activity.metadata?.difficulty,
    count,
  };
}

/**
 * Validate that an activity has proper curriculum metadata
 */
export function hasValidCurriculumMetadata(activity: DailyActivity): boolean {
  return !!(
    activity.curriculum_metadata &&
    activity.curriculum_metadata.subject &&
    activity.curriculum_metadata.unit?.id &&
    activity.curriculum_metadata.skill?.id &&
    activity.curriculum_metadata.subskill?.id
  );
}
