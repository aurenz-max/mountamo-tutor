// Type-only, so the move layer can build on these shapes without a runtime import cycle.
import type { MoveDelta } from './moveContract';

/** Mounted capabilities, not catalog declarations, authorize live actions. */
export type LocalAction =
  | { type: 'advance' | 'retry' | 'replay' }
  | { type: 'workspace'; operation: string; input?: WorkspaceInput }
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
/** Parameters carry learner words or named scene objects, never executable code. */
export interface WorkspaceInput { targets?: string[]; dialogue?: {
  responseId: string; verdict: 'correct' | 'incorrect'; transition: 'none' | 'retry' | 'advance'; tutor: string;
} }
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
  /**
   * The task's own quantities, as data rather than inside the spoken sentence, so the tutor
   * can diagnose and price a composed move without parsing prose. Its own field, not more
   * keys in `demand`: a move is refused on these numbers, and they must never be confused
   * with the numbers of an example on screen. The answer is never among them.
   */
  values?: Record<string, number>;
  support: { level: number; answerExposure: AnswerExposure; instruction?: string };
  /**
   * What this item assesses. Published deliberately: it is a KIND of response, never the
   * response, so the tutor can see the dimension it must not give away — and the runtime
   * enforces it regardless of whether the tutor honours it.
   */
  assessment?: ItemAssessment;
  workspace?: {
    progression?: 'observer';
    pendingResponse?: { id: string; text: string };
    expectedAnswer?: string;
    objects: Array<{ id: string; label: string; selected: boolean; group?: string }>;
    demonstration: string[];
    lastResponse: { response: string; correct: boolean; assisted: boolean } | null;
    /** Recent session-local evidence, including assistance, retained across item changes. Not a mastery write. */
    attempts: Array<{ itemId: string; response: string; source: 'speech' | 'gesture'; correct: boolean; assisted: boolean; answerExposure: AnswerExposure }>;
  };
}

export interface Affordance {
  controller?: 'observer';
  /** A certified runner already queued the response; transport must not add another tutor turn. */
  responseSpeech?: 'runner';
  action: TutorAction;
  description: string;
  /** Every assistance-producing action declares its effect before execution. */
  assistance?: { level: number; answerExposure: AnswerExposure };
  /**
   * The one sentence this aid says, as the tutor would speak it. Also what the
   * support panel prints. Adapters used to bury it in quotes inside `description`
   * and every reader re-extracted it; `spokenLine` still falls back to that, so an
   * adapter can adopt this field without the panel waiting for it.
   */
  spoken?: string;
  /** What a support artifact is FOR (see SUPPORT_PURPOSE), so the model chooses by purpose, not by title. */
  purpose?: string;
}
export interface ExecutableAffordance extends Omit<Affordance, 'action'> {
  action: LocalAction;
  /** Synchronous validated transition shared with learner controls. False must leave state untouched. No queued mutation. */
  execute: (input?: WorkspaceInput) => boolean;
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

/**
 * One side of a contrast. Counters is the only panel drawn so far; a glyph or a
 * shape panel is an additive member of this union, never a change to this one.
 */
export interface ContrastPanel {
  kind: 'counters';
  /** Read beside the row, e.g. "6". Never the child's own group. */
  label: string;
  count: number;
  /** The TRAILING counters ringed as the distinguishing feature: the ones with no partner in the other row. */
  highlighted: number;
}

/**
 * Two things side by side and the one feature that tells them apart. The shape a
 * single row of counters cannot draw: a relationship BETWEEN two collections.
 */
export interface ContrastPairSupport {
  id: string;
  kind: 'contrast-pair';
  title: string;
  panels: [ContrastPanel, ContrastPanel];
  /** The one sentence the contrast states, e.g. "6 has two more than 4." */
  caption: string;
  altText: string;
  answerExposure: AnswerExposure;
  provenance: 'prepared';
}

/** How one run of counters in a step is drawn. `marked` and `crossed` are outlines carrying + and ×. */
export type StepTone = 'plain' | 'added' | 'empty' | 'marked' | 'crossed';
export interface StepSegment { count: number; tone: StepTone }
/** One step: the counters as they stand at that moment, and the one sentence that says what changed. */
export interface StepFrame { segments: StepSegment[]; caption: string }

/**
 * An explanation: the SAME collection drawn two to four times, one change per step,
 * columns aligned so the child sees what moved between steps. The shape neither a
 * single row (one moment) nor a contrast pair (two collections) can draw: a PROCESS.
 */
export interface StepSequenceSupport {
  id: string;
  kind: 'step-sequence';
  title: string;
  frames: StepFrame[];
  altText: string;
  answerExposure: AnswerExposure;
  provenance: 'prepared';
}

/**
 * A picture the TUTOR described and an image model drew, shown only after a separate
 * vision check agreed the drawing matches the description. The bytes stay out of the
 * snapshot (the wire packet is bounded); the runtime hands them to the surface by id.
 */
export interface GeneratedImageSupport {
  id: string;
  kind: 'generated-image';
  title: string;
  /** The tutor's own description of the picture. It is also what the tutor may say about it. */
  altText: string;
  purpose: string;
  answerExposure: AnswerExposure;
  provenance: 'generated';
}

export type SupportArtifact = CounterSupport | ContrastPairSupport | StepSequenceSupport | GeneratedImageSupport;

/** What each shape is FOR, in the tutor's words. Sent as the choice's `purpose` so the model picks by purpose. */
export const SUPPORT_PURPOSE: Record<SupportArtifact['kind'], string> = {
  'counter-example': 'Worked example',
  'contrast-pair': 'Contrast',
  'step-sequence': 'Step-by-step explanation',
  'generated-image': 'Generated picture',
};

/**
 * What the support panel CALLS each move, in the reviewer's words.
 *
 * Closed, and derived from the action and its delta rather than authored per
 * primitive: a family that could name its own supports would re-open the lane where
 * every adapter invents its own vocabulary, which is the thing the delta list closed.
 */
export const SUPPORT_LABELS = ['Hint', 'Highlight', 'Simplify', 'One step', 'Another way',
  'Compare', 'Step by step', 'Picture', 'Repeat', 'Example'] as const;
export type SupportLabel = (typeof SUPPORT_LABELS)[number];

const DELTA_LABEL: Record<MoveDelta, SupportLabel> = {
  attend: 'Highlight', 'reveal-aid': 'Simplify', microstep: 'One step',
  're-represent': 'Another way', contrast: 'Compare', 'model-process': 'Step by step',
  illustrate: 'Picture',
};

const ACTION_LABEL: Partial<Record<TutorAction['type'], SupportLabel>> = {
  scaffold: 'Hint', point: 'Highlight', replay: 'Repeat', request_support: 'Example',
};

/** The panel's label for one committed assistance event, or null when it produces no aid. */
export function supportLabel(action: TutorAction, delta?: MoveDelta): SupportLabel | null {
  if (delta) return DELTA_LABEL[delta];
  return ACTION_LABEL[action.type] ?? null;
}

/**
 * The aid's sentence: its own `spoken` field, else the line an adapter quoted inside
 * `description`. Returns '' when neither is there, which the panel treats as nothing
 * to print rather than as an empty aid.
 */
export const spokenLine = (a: { spoken?: string; description?: string }): string =>
  a.spoken?.trim() || a.description?.split('"')[1]?.trim() || '';

/**
 * One addressable thing on screen. `semanticRole` is what KIND of thing it is; `represents`
 * is which one, within that kind. The eligibility policy reads the role; the tutor reads the
 * label and `represents` to choose.
 */
export interface AttentionTarget {
  id: string;
  /** How the tutor refers to it aloud, e.g. "the tens column". */
  label: string;
  /** The kind of thing, e.g. `place-column`, `position`, `object`, `cell`. Policy keys on this. */
  semanticRole: string;
  /** Which one within that kind, e.g. `tens`. Descriptive; the policy never reads it. */
  represents?: string;
}

/**
 * What the current item is assessing. A KIND of response, never the response itself — so it
 * is safe to publish, and the tutor can see what it must not give away.
 */
export interface ItemAssessment {
  /** The dimension the child's answer must supply, e.g. `place-column`, `count`, `position`. */
  responseDimension: string;
}

export type AttentionRefusal =
  | { code: 'UNKNOWN_TARGET'; targetId: string }
  | { code: 'ANSWER_REVEAL'; targetId: string; dimension: string };

/**
 * THE invariant: a support move may not disclose the dimension currently being assessed.
 *
 * Keyed on the role alone, not on whether the target happens to be the CORRECT one. Where the
 * ask is "which column?", ringing the right column answers it and ringing a wrong column is
 * misdirection — neither teaches, so the whole dimension is closed for that item. Keying on
 * the role also means the expected answer never has to exist in this layer at all.
 *
 * Generic by construction: it compares two declared strings and names no primitive. A family
 * that cannot be judged by it is reporting a missing semantic field, not an exception.
 */
export function attentionRefusal(
  ids: readonly string[],
  targets: readonly AttentionTarget[],
  assessment: ItemAssessment | null | undefined,
): AttentionRefusal | null {
  for (const id of ids) {
    const target = targets.find(t => t.id === id);
    if (!target) return { code: 'UNKNOWN_TARGET', targetId: id };
    if (assessment && target.semanticRole === assessment.responseDimension)
      return { code: 'ANSWER_REVEAL', targetId: id, dimension: assessment.responseDimension };
  }
  return null;
}

export interface PrimitiveRuntimeAdapter {
  /** Certified runner exposes only help actions here; progression stays with its judge. */
  canYieldForHelp?: () => boolean;
  getTutorState(): TutorPrimitiveState;
  getAffordances(): ExecutableAffordance[];
  /** Only implement after timers, cues, judgments and gesture commits can be synchronously quiesced. */
  suspension?: { suspend(): void; resume(): void };
  /** Trusted host supplies examples, never an LLM-supplied capability descriptor. */
  supportArtifacts?: SupportArtifact[];
  /**
   * Would a support showing these object counts draw the current item or its answer? Only an
   * adapter that declares this may receive a composed move that draws numbers: the tutor chooses
   * them, and the adapter is the one place that knows which numbers belong to the task.
   */
  drawsTask?: (counts: readonly number[]) => boolean;
  /**
   * What this workspace itself draws, e.g. `ten-frame`. A support may not redraw it (see
   * SAME_REPRESENTATION_DELTAS): a second copy of the model the child is already stuck on
   * adds nothing. Declaring this, with `alternateRepresentations`, opens the open lane.
   */
  representation?: string;
  /** The other models a support may use for the same quantity, e.g. `counters`, `number-bond`. */
  alternateRepresentations?: readonly string[];
  /**
   * Everything on this screen an attention move can address, as it stands right now.
   *
   * MECHANICAL. The adapter says what EXISTS; it never decides when attending is allowed.
   * That call belongs to `attentionRefusal`, because it depends on what is being assessed,
   * which is not a fact about the primitive. An adapter that starts withholding targets for
   * teaching reasons is re-opening the per-primitive pedagogy this contract closed.
   *
   * These are the primitive's Pip targets — it already publishes them with a live element
   * each, so a family that has them gets attention moves with no new handler. Only ids and
   * meaning cross the wire; the element is resolved at render time, and nothing here is
   * clicked or mutated.
   */
  attentionTargets?: () => ReadonlyArray<AttentionTarget>;
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
  /**
   * What the support panel prints for this event. Present only when the event
   * actually produced an aid, so the panel can never narrate a change that did not
   * happen: an event reaches this array only after `execute()` committed.
   */
  announce?: { label: SupportLabel; instruction: string };
  /**
   * Present when the tutor composed the help rather than copying an advertised ticket. The
   * obstacle is the tutor's own words: an obstacle that keeps recurring on one primitive is
   * how an open-lane move becomes a prepared aid, so it is logged even when the move works.
   */
  move?: { obstacle: string; delta: MoveDelta; representation: string; nextAction: string };
}

/**
 * What the mounted adapter lets the tutor compose right now. The tool schema's enums are
 * built from this, so the model cannot ask for a ten frame while a ten frame is on screen,
 * nor name a delta whose pieces this activity does not have.
 */
export interface MoveOptions {
  deltas: MoveDelta[];
  representation: string;
  alternateRepresentations: string[];
  /**
   * The targets attention may be directed to ON THIS ITEM — already filtered by
   * `attentionRefusal`, so the tutor is offered only what it is allowed to use. The refusal
   * still runs on commit: the advertised set guides, the policy guarantees. Empty = no attend.
   */
  attentionTargets: AttentionTarget[];
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
  supportArtifact: SupportArtifact | null;
  affordances: Affordance[];
  blockedReason: string | null;
  canStartNext: boolean;
  /** True while the tutor may ask for a generated picture on this item. */
  canGenerateSupport: boolean;
  /** Null when this activity has not declared what it draws, so no move can be composed. */
  moveOptions: MoveOptions | null;
  /**
   * The targets an attention move is ringing right now. One logical move is often several
   * rendered objects — the empty spaces, both terms of a comparison, every object of a kind —
   * so this is a set, not an element. The overlay resolves each through the Pip surface; no
   * element ever enters this packet.
   */
  markedTargetIds: string[];
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
    : a.type === 'workspace' ? id(a.operation)
      && Object.keys(a).every(k => ['type', 'operation', 'input'].includes(k))
      && (a.input === undefined || validWorkspaceInput(a.input))
    : a.type === 'request_support' ? exactKeys(a, ['type', 'artifactId']) && id(a.artifactId) : false;
  return valid ? value as unknown as TutorCommand : null;
}

export function actionKey(a: TutorAction): string {
  switch (a.type) {
    case 'workspace': return JSON.stringify([a.type, a.operation]);
    case 'point': return JSON.stringify([a.type, a.targetId]);
    case 'scaffold': return JSON.stringify([a.type, a.strategyId, a.direction]);
    case 'request_support': return JSON.stringify([a.type, a.artifactId]);
    default: return a.type;
  }
}

export function validWorkspaceInput(v: unknown): v is WorkspaceInput {
  return object(v) && Object.keys(v).every(k => k === 'targets' || k === 'dialogue')
    && (v.dialogue === undefined || v.targets === undefined && object(v.dialogue)
      && exactKeys(v.dialogue, ['responseId', 'verdict', 'transition', 'tutor']) && id(v.dialogue.responseId)
      && ['correct', 'incorrect'].includes(v.dialogue.verdict as string)
      && ['none', 'retry', 'advance'].includes(v.dialogue.transition as string)
      && typeof v.dialogue.tutor === 'string' && !!v.dialogue.tutor.trim() && v.dialogue.tutor.length <= 4000)
    && (v.targets === undefined || Array.isArray(v.targets) && v.targets.length <= 30
      && v.targets.every(id) && new Set(v.targets).size === v.targets.length);
}

export function validateCounterSupport(a: CounterSupport): void {
  if (!a || !id(a.id) || a.kind !== 'counter-example' || a.provenance !== 'prepared'
    || !Number.isInteger(a.total) || a.total < 1 || a.total > 20
    || !Number.isInteger(a.removed) || a.removed < 0 || a.removed > a.total
    || !id(a.title) || typeof a.altText !== 'string' || !a.altText.trim() || a.altText.length > 600
    || (a.operation !== undefined && !['subtract', 'make-ten', 'count'].includes(a.operation))
    || !['none', 'partial', 'full'].includes(a.answerExposure)) throw new Error('Invalid prepared counter example');
}

const contrastPanel = (p: unknown): p is ContrastPanel => object(p) && p.kind === 'counters'
  && typeof p.label === 'string' && !!p.label.trim() && p.label.length <= 40
  && Number.isInteger(p.count) && (p.count as number) >= 0 && (p.count as number) <= 20
  && Number.isInteger(p.highlighted) && (p.highlighted as number) >= 0 && (p.highlighted as number) <= (p.count as number);

/** Structure only. Whether the pair is NEARBY the task rather than the task itself is the preparer's contract. */
export function validateContrastPairSupport(a: ContrastPairSupport): void {
  if (!a || !id(a.id) || a.kind !== 'contrast-pair' || a.provenance !== 'prepared'
    || !id(a.title) || typeof a.caption !== 'string' || !a.caption.trim() || a.caption.length > 200
    || typeof a.altText !== 'string' || !a.altText.trim() || a.altText.length > 600
    || !Array.isArray(a.panels) || a.panels.length !== 2 || !a.panels.every(contrastPanel)
    || a.panels.every(p => p.count === 0)
    || !['none', 'partial', 'full'].includes(a.answerExposure)) throw new Error('Invalid prepared contrast pair');
}

const STEP_TONES: readonly string[] = ['plain', 'added', 'empty', 'marked', 'crossed'];
const stepFrame = (f: unknown): f is StepFrame => object(f)
  && typeof f.caption === 'string' && !!f.caption.trim() && f.caption.length <= 160
  && Array.isArray(f.segments) && f.segments.length >= 1 && f.segments.length <= 4
  && f.segments.every(s => object(s) && STEP_TONES.includes(s.tone as string)
    && Number.isInteger(s.count) && (s.count as number) >= 0 && (s.count as number) <= 20)
  && (total => total >= 1 && total <= 20)(f.segments.reduce((n: number, s) => n + ((s as StepSegment).count), 0));

/** Structure only. Whether the steps are TRUE, and nearby rather than the task itself, is the preparer's contract. */
export function validateStepSequenceSupport(a: StepSequenceSupport): void {
  if (!a || !id(a.id) || a.kind !== 'step-sequence' || a.provenance !== 'prepared' || !id(a.title)
    || typeof a.altText !== 'string' || !a.altText.trim() || a.altText.length > 600
    || !Array.isArray(a.frames) || a.frames.length < 2 || a.frames.length > 4 || !a.frames.every(stepFrame)
    || !['none', 'partial', 'full'].includes(a.answerExposure)) throw new Error('Invalid prepared step sequence');
}

export function validateGeneratedImageSupport(a: GeneratedImageSupport): void {
  if (!a || !id(a.id) || a.kind !== 'generated-image' || a.provenance !== 'generated' || !id(a.title) || !id(a.purpose)
    || typeof a.altText !== 'string' || !a.altText.trim() || a.altText.length > 600
    || !['none', 'partial', 'full'].includes(a.answerExposure)) throw new Error('Invalid generated picture');
}

export function validateSupportArtifact(a: SupportArtifact): void {
  const kind = (a as { kind?: unknown } | null)?.kind;
  if (kind === 'generated-image') return validateGeneratedImageSupport(a as GeneratedImageSupport);
  if (kind === 'contrast-pair') validateContrastPairSupport(a as ContrastPairSupport);
  else if (kind === 'step-sequence') validateStepSequenceSupport(a as StepSequenceSupport);
  else validateCounterSupport(a as CounterSupport);
}
