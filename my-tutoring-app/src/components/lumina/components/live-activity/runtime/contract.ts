/** Mounted capabilities, not catalog declarations, authorize live actions. */
export type LocalAction =
  | { type: 'advance' | 'retry' | 'replay' }
  | { type: 'point'; targetId: string }
  | { type: 'scaffold'; strategyId: string; direction: 1 | -1 };
export type TutorAction = LocalAction
  | { type: 'request_support'; artifactId: string }
  | { type: 'return' };

export interface TutorCommand {
  sessionEpoch: string;
  commandId: string;
  instanceId: string;
  itemId: string;
  expectedRevision: number;
  action: TutorAction;
}

export type TeachingOwner = 'tutor' | 'runner' | 'support' | 'none';
export type AnswerExposure = 'none' | 'partial' | 'full';
export interface TutorPrimitiveState {
  itemId: string;
  phase: string;
  task: string;
  completed: boolean;
  evidence: {
    attemptNumber: number;
    correctness: 'correct' | 'incorrect' | 'unknown';
    recentResponses: Array<{ response: string; source: 'gesture' | 'speech'; recognition: 'clear' | 'uncertain' | 'not-applicable' }>;
  };
  demand: Record<string, string | number>;
  support: { level: number; answerExposure: AnswerExposure; instruction?: string };
}

export interface Affordance {
  /** A certified runner already queued the response; transport must not add another tutor turn. */
  responseSpeech?: 'runner';
  action: TutorAction;
  description: string;
  /** Every assistance-producing action declares its effect before execution. */
  assistance?: { level: number; answerExposure: AnswerExposure };
}
export interface ExecutableAffordance extends Omit<Affordance, 'action'> {
  action: LocalAction;
  /** Synchronous validated transition shared with learner controls. False must leave state untouched. No queued mutation. */
  execute: () => boolean;
}

export interface CounterSupport {
  operation?: 'subtract' | 'make-ten' | 'count';
  id: string;
  kind: 'counter-example';
  title: string;
  total: number;
  removed: number;
  altText: string;
  answerExposure: AnswerExposure;
  provenance: 'prepared';
}

export interface PrimitiveRuntimeAdapter {
  /** Certified runner exposes only help actions here; progression stays with its judge. */
  canYieldForHelp?: () => boolean;
  getTutorState(): TutorPrimitiveState;
  getAffordances(): ExecutableAffordance[];
  /** Only implement after timers, cues, judgments and gesture commits can be synchronously quiesced. */
  suspension?: { suspend(): void; resume(): void };
  /** Trusted host supplies examples, never an LLM-supplied capability descriptor. */
  supportArtifacts?: CounterSupport[];
}

export interface RuntimeMount {
  instanceId: string;
  planItemId: string;
  primitiveId: string;
  objectiveId: string;
  evalMode: string;
  adapter: PrimitiveRuntimeAdapter;
}
export interface AssistanceEvent {
  instanceId: string;
  itemId: string;
  revision: number;
  action: TutorAction;
  level: number;
  answerExposure: AnswerExposure;
}
export interface RuntimeSnapshot {
  sessionEpoch: string;
  revision: number;
  /** DOM acknowledgement is separate from command commit. */
  visibleRevision: number | null;
  instanceId: string | null;
  planItemId: string | null;
  primitiveId: string | null;
  objectiveId: string | null;
  evalMode: string | null;
  owner: TeachingOwner;
  status: 'empty' | 'active' | 'support' | 'closing' | 'completed' | 'stopped' | 'faulted';
  task: TutorPrimitiveState | null;
  supportArtifact: CounterSupport | null;
  affordances: Affordance[];
  blockedReason: string | null;
  canStartNext: boolean;
  assistance: AssistanceEvent[];
}
export interface TransitionReceipt {
  commandId: string | null;
  status: 'committed' | 'invalid' | 'stale' | 'duplicate' | 'conflict' | 'unsupported' | 'blocked' | 'failed';
  reason?: string;
  state: RuntimeSnapshot;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const exactKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

/** Reject malformed wire input, unknown actions, arbitrary params and scope omissions. */
export function parseTutorCommand(value: unknown): TutorCommand | null {
  if (!object(value) || !exactKeys(value, ['sessionEpoch', 'commandId', 'instanceId', 'itemId', 'expectedRevision', 'action'])
    || !['sessionEpoch', 'commandId', 'instanceId', 'itemId'].every(k => id(value[k]))
    || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0 || !object(value.action)) return null;
  const a = value.action;
  const valid = ['advance', 'retry', 'replay', 'return'].includes(a.type as string) ? exactKeys(a, ['type'])
    : a.type === 'point' ? exactKeys(a, ['type', 'targetId']) && id(a.targetId)
    : a.type === 'scaffold' ? exactKeys(a, ['type', 'strategyId', 'direction']) && id(a.strategyId) && (a.direction === 1 || a.direction === -1)
    : a.type === 'request_support' ? exactKeys(a, ['type', 'artifactId']) && id(a.artifactId) : false;
  return valid ? value as unknown as TutorCommand : null;
}

export function actionKey(a: TutorAction): string {
  switch (a.type) {
    case 'point': return JSON.stringify([a.type, a.targetId]);
    case 'scaffold': return JSON.stringify([a.type, a.strategyId, a.direction]);
    case 'request_support': return JSON.stringify([a.type, a.artifactId]);
    default: return a.type;
  }
}

export function validateCounterSupport(a: CounterSupport): void {
  if (!a || !id(a.id) || a.kind !== 'counter-example' || a.provenance !== 'prepared'
    || !Number.isInteger(a.total) || a.total < 1 || a.total > 20
    || !Number.isInteger(a.removed) || a.removed < 0 || a.removed > a.total
    || !id(a.title) || typeof a.altText !== 'string' || !a.altText.trim() || a.altText.length > 600
    || (a.operation !== undefined && !['subtract', 'make-ten', 'count'].includes(a.operation))
    || !['none', 'partial', 'full'].includes(a.answerExposure)) throw new Error('Invalid prepared counter example');
}
