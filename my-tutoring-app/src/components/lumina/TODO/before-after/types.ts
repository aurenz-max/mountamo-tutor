export interface GeneratedImages {
  before: string | null;
  after: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  description?: string;
  detailedExplanation?: string;
  keyTakeaways?: string[];
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  step?: 'analyzing' | 'generating_before' | 'generating_after';
}

export enum ComparisonMode {
  SIDE_BY_SIDE = 'SIDE_BY_SIDE',
  SLIDER = 'SLIDER'
}
