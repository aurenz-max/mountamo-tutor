// Core type definitions for the visual problem library system

export interface PrimitiveProps {
  id: string;
  params: Record<string, any>;
  disabled?: boolean;
  onChange?: (answer: PrimitiveAnswer) => void;
  initialAnswer?: PrimitiveAnswer;
}

export interface PrimitiveAnswer {
  type: string;
  value: any;
  metadata?: Record<string, any>;
}

export interface PrimitiveState {
  isValid: boolean;
  hasAnswer: boolean;
  answer: PrimitiveAnswer | null;
  isDirty: boolean;
}

export interface ProblemTemplate {
  id: string;
  type: 'visual' | 'text' | 'multiple_choice' | 'canvas';
  subject: string;
  skill_id: string;
  primitive?: PrimitiveConfig;
  problem_text: string;
  params: Record<string, any>;
  answer_key: any;
  grading_config: GradingConfig;
  metadata: TemplateMetadata;
}

export interface PrimitiveConfig {
  component: string; // Component name to render
  props: Record<string, any>; // Props to pass to the component
}

export interface GradingConfig {
  type: 'exact_match' | 'fuzzy_match' | 'range_match' | 'custom';
  tolerance?: number;
  custom_grader?: string;
}

export interface TemplateMetadata {
  difficulty: number;
  estimated_time_minutes: number;
  tags: string[];
  accessibility_notes?: string;
  i18n_keys?: string[];
}

// Math Primitives
export interface NumberLineProps extends PrimitiveProps {
  params: {
    min: number;
    max: number;
    step: number;
    tick_density: 'sparse' | 'normal' | 'dense';
    target_value?: number;
    show_labels?: boolean;
    highlight_zones?: Array<{start: number, end: number, color: string}>;
  };
}

export interface FractionBarsProps extends PrimitiveProps {
  params: {
    numerator: number;
    denominator: number;
    show_whole_numbers?: boolean;
    interactive_parts?: boolean;
    color?: string;
  };
}

export interface AreaModelProps extends PrimitiveProps {
  params: {
    rows: number;
    cols: number;
    highlight_cells?: number[];
    grid_labels?: boolean;
    cell_values?: number[];
  };
}

// Biology Primitives
export interface DiagramLabelerProps extends PrimitiveProps {
  params: {
    diagram_id: string;
    hotspots: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
    }>;
    label_options: string[];
    svg_content?: string;
  };
}

export interface PartFunctionMatcherProps extends PrimitiveProps {
  params: {
    parts: string[];
    functions: string[];
    allow_multiple_matches?: boolean;
  };
}

// Astronomy Primitives
export interface MoonPhaseSelectorProps extends PrimitiveProps {
  params: {
    phase_options: Array<{
      id: string;
      name: string;
      image_url: string;
      angle_degrees: number;
    }>;
    show_earth_sun?: boolean;
  };
}

export interface OrbitPanelProps extends PrimitiveProps {
  params: {
    central_body: string;
    orbiting_bodies: Array<{
      name: string;
      orbit_radius: number;
      color: string;
      size: number;
    }>;
    interactive?: boolean;
  };
}

// ELA Primitives
export interface EvidenceHighlighterProps extends PrimitiveProps {
  params: {
    passage_text: string;
    max_selections?: number;
    highlight_color?: string;
    show_line_numbers?: boolean;
  };
}

export interface PartsOfSpeechTaggerProps extends PrimitiveProps {
  params: {
    sentence: string;
    word_options: string[];
    pos_tags: string[];
  };
}

// Social Studies Primitives
export interface MapLabelerProps extends PrimitiveProps {
  params: {
    map_svg: string;
    regions: Array<{
      id: string;
      name: string;
      path: string;
    }>;
    label_options: string[];
  };
}

export interface TimelineBuilderProps extends PrimitiveProps {
  params: {
    events: Array<{
      id: string;
      title: string;
      date: string;
      description?: string;
    }>;
    time_range: {
      start: string;
      end: string;
    };
    supports_bce?: boolean;
  };
}

export type AllPrimitiveProps = 
  | NumberLineProps
  | FractionBarsProps
  | AreaModelProps
  | DiagramLabelerProps
  | PartFunctionMatcherProps
  | MoonPhaseSelectorProps
  | OrbitPanelProps
  | EvidenceHighlighterProps
  | PartsOfSpeechTaggerProps
  | MapLabelerProps
  | TimelineBuilderProps;