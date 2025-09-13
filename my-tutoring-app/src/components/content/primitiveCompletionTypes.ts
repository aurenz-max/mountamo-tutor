// Types for primitive completion tracking
export interface PrimitiveCompletionState {
  completed: boolean;
  score?: number;
  timestamp: Date;
}

export interface SectionPrimitiveCompletions {
  [primitiveType: string]: {
    [primitiveIndex: number]: PrimitiveCompletionState;
  };
}

export interface PackagePrimitiveCompletions {
  [sectionIndex: number]: SectionPrimitiveCompletions;
}

// Helper type for tracking section completion status
export interface SectionCompletionStatus {
  manuallyCompleted: boolean;
  primitivesCompleted: boolean;
  allPrimitivesCount: number;
  completedPrimitivesCount: number;
}

// Overall package completion tracking
export interface PackageCompletionTracking {
  primitiveCompletions: PackagePrimitiveCompletions;
  sectionCompletions: Record<string, SectionCompletionStatus>;
  packageId: string;
}

// API request types to match backend schemas
export interface PrimitiveCompletionRequest {
  package_id: string;
  section_title: string;
  primitive_type: string;
  primitive_index: number;
  score?: number;
}

export interface SectionCompletionRequest {
  section_title: string;
  time_spent_minutes?: number;
}

export interface PackageCompletionRequest {
  sections_completed: number;
  total_time_minutes?: number;
}