import type { LessonPackage } from '../lessonPackage';

/** Harness assumptions, not calibrated predictions about real children. */
export type Capability = 'sound-production' | 'sound-recognition' | 'onset' | 'decode' | 'keyword' | 'letter-recognition' | 'letter-name';
export interface Demand {
  capability: Capability;
  target: string;
  graphemes: string[];
}
export interface JourneyProbe extends Demand { id: string }
export interface LessonContract {
  id: string;
  topic: string;
  gradeLevel: string;
  requires: string[];
  targets: Demand[];
  allowedGraphemes: string[];
  probes: JourneyProbe[];
  /** Explicit curriculum attribution; never infer an ID from a topic or slot number. */
  objectiveScope?: Record<string, { skillId: string; subskillId: string }>;
  packagePath: string;
  /** Frozen production generation inputs. Probes never enter this request. */
  generationRequest?: Record<string, unknown>;
}
export interface JourneyScenario {
  version: 1;
  id: string;
  curriculumSource: string;
  lessons: LessonContract[];
  minIndependentItems: number;
  minProbeAccuracy: number;
  retentionDays: number;
  seeds: number[];
}
export interface LearnerProfile {
  id: string;
  initial: Record<string, number>;
  learningRate: number;
  decay: number;
  echo: number;
  slip: number;
  hearsTutor: boolean;
  canSpeak: boolean;
  canTap: boolean;
  /** Declarative UI access; decoding knowledge is tracked separately. */
  reader: 'none' | 'emerging' | 'developing';
}
export interface InstructionEvent extends Demand {
  packageId: string;
  instanceId: string;
  itemId: string;
  componentId: string;
  evalMode: string;
  objectiveId: string | null;
  skillId?: string;
  subskillId?: string;
  /** JSON pointer into the immutable package. */
  source: string;
  cue: string;
  modality: 'spoken' | 'tap';
  modeled: boolean;
  guided: boolean;
  feedback: boolean;
  /** A worked sound-to-word relationship, not merely naming the answer. */
  explainsRelation: boolean;
  reader: LearnerProfile['reader'];
}
export interface Finding {
  code: string;
  layer: 'CONTENT' | 'COMPONENT' | 'SELECTION' | 'EVIDENCE' | 'CURRICULUM';
  instanceId: string;
  source?: string;
  note: string;
}
export interface ExtractedLesson {
  packageId: string;
  events: InstructionEvent[];
  findings: Finding[];
  unknowns: Finding[];
  /** Blocks the adapter recognised that ask the child for NOTHING (a card grid).
   *  Known, so they never block certification; credited with nothing. */
  exposures: Finding[];
}
export interface AttemptEvidence extends InstructionEvent {
  firstCorrect: boolean;
  finalCorrect: boolean;
  independent: boolean;
  accessible: boolean;
  correction: boolean;
  responseRoute: 'knowledge' | 'echo' | 'guess' | 'inaccessible';
  before: number;
  after: number;
}
export interface ProbeEvidence extends JourneyProbe { correct: boolean; probability: number }
export interface LessonResult {
  lessonId: string;
  packageId: string;
  decision: 'ADVANCE' | 'REMEDIATE' | 'REVIEW' | 'INSUFFICIENT_EVIDENCE' | 'BLOCKED';
  reasons: string[];
  before: ProbeEvidence[];
  after: ProbeEvidence[];
  delayed: ProbeEvidence[];
  attempts: AttemptEvidence[];
  findings: Finding[];
  unknowns: Finding[];
  exposures: Finding[];
  independentItems: number;
  knowledge: Record<string, number>;
  /** Audit mode: the lesson ran although an earlier one had not been demonstrated. */
  prerequisitesWaived?: boolean;
}
export interface JourneyRun {
  profile: string;
  seed: number;
  lessons: LessonResult[];
}
export interface JourneyInput { contract: LessonContract; package: LessonPackage }
