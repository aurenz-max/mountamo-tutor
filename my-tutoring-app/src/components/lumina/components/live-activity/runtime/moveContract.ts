/**
 * A support is a TEACHING MOVE, not a picture request.
 *
 * The 2026-09-18 failure this answers: the tutor drew a ten frame showing 4 beside a child
 * stuck on a ten frame showing 3. Accurate, no answer leak, and it taught nothing, because
 * nothing in the pipeline asked what the support ADDED to the screen the child already had.
 *
 * So a move carries four fields and is refused without them:
 *   obstacle    what the child is missing (the tutor's own diagnosis, free text, logged)
 *   delta       what is different from the current screen, from the closed list below
 *   nextAction  the one observable thing the child does next
 *   check       the runtime's job, not the tutor's: same item again, then a fresh item
 *
 * The tutor never picks a renderer. It names the delta; code picks the carrier and builds
 * the structure from the numbers (see `moveCarrier` and `buildMoveArtifact`). That is the
 * same division as every generator here: the model supplies scope, code supplies structure.
 *
 * Spec: `docs/LIVE_TEACHING_MOVES.md`.
 */
import {
  validateSupportArtifact,
  type AnswerExposure, type ContrastPairSupport, type CounterSupport,
  type GeneratedImageSupport, type StepFrame, type StepSequenceSupport, type SupportArtifact,
} from './contract';

/** The closed delta list, in cost order. A move outside it cannot be expressed. */
export const MOVE_DELTAS = ['attend', 'reveal-aid', 'microstep', 're-represent', 'contrast', 'model-process', 'illustrate'] as const;
export type MoveDelta = (typeof MOVE_DELTAS)[number];

/**
 * What each delta is FOR, in the tutor's words. Sent with the tool schema so the model
 * chooses by the obstacle it diagnosed, not by which word sounds most helpful.
 */
export const MOVE_DELTA_PURPOSE: Record<MoveDelta, string> = {
  attend: "Mark part of the child's OWN work so they look at the right place. Cheapest; nothing new appears.",
  'reveal-aid': 'Switch on an aid this activity already draws at an easier level, on the work in front of them.',
  microstep: 'Shrink the task to one action with its own finish line, on the work in front of them.',
  're-represent': 'Show the same quantity a second way, beside their work, when the first way is not reaching them.',
  contrast: 'Two cases side by side and the one feature that tells them apart, when the child cannot tell two things apart.',
  'model-process': 'Work a DIFFERENT example in steps, then hand back, when the child does not know what to do first.',
  illustrate: 'Draw a picture of something no shape here can draw: a story, a real object, a scene. Slow; rare.',
};

/**
 * Deltas that may legitimately reuse the workspace's own representation, because the
 * teaching is in the comparison, the process or the smaller ask, not in a second model.
 * Any other delta drawing the workspace's own representation is a redraw, and refused.
 */
export const SAME_REPRESENTATION_DELTAS: readonly MoveDelta[] = ['attend', 'reveal-aid', 'microstep', 'contrast', 'model-process'];

/** Deltas that leave the workspace on screen. The rest open a returnable detour. */
export const IN_PLACE_DELTAS: readonly MoveDelta[] = ['attend', 'reveal-aid', 'microstep'];

/** Which shape draws each detour delta. The tutor names the delta; this picks the renderer. */
export const moveCarrier = (delta: MoveDelta): SupportArtifact['kind'] | null =>
  delta === 'contrast' ? 'contrast-pair'
    : delta === 'model-process' ? 'step-sequence'
      : delta === 're-represent' ? 'counter-example'
        : delta === 'illustrate' ? 'generated-image' : null;

/**
 * What every shape built so far actually draws: counters. Naming it keeps two rules honest
 * at once — a shape-carried move must ask for the model its renderer can really produce, and
 * a generated picture may never ask for something a shape draws exactly and instantly.
 *
 * A contrast or a process is exempt (SAME_REPRESENTATION_DELTAS) and may name the workspace's
 * own representation; it is then drawn as aligned counter rows, which is that model without
 * its frame. When a second shape draws a second model (part-whole, M4), this becomes a set.
 */
export const SHAPE_REPRESENTATION = 'counters';

/**
 * The non-redundancy rule, in code rather than in the prompt. It is the one refusal the
 * 2026-09-18 ten-frame picture would have failed: accurate, leak-free, and a second copy
 * of the model the child was already stuck on.
 */
export function representationRefusal(move: ComposedMove, workspace: string, alternates: readonly string[]): string | null {
  if (move.representation === workspace) {
    return SAME_REPRESENTATION_DELTAS.includes(move.delta) ? null
      : `A ${move.delta} move may not redraw the ${workspace} already on screen; a second copy of it adds nothing. `
        + `Use a different representation (${alternates.join(', ') || 'none declared'}), or a delta that compares or works a process.`;
  }
  if (move.delta === 'illustrate' && move.representation === SHAPE_REPRESENTATION)
    return `A shape here draws ${SHAPE_REPRESENTATION} exactly and at once. Ask for a picture only of something no shape draws.`;
  if (moveCarrier(move.delta) !== 'generated-image' && move.representation !== SHAPE_REPRESENTATION)
    return `A ${move.delta} move here is drawn with ${SHAPE_REPRESENTATION}. Choose ${SHAPE_REPRESENTATION}, or illustrate for ${move.representation}.`;
  return null;
}

/** The processes `model-process` and `re-represent` can draw. Code builds the frames. */
export const MOVE_OPERATIONS = ['make-ten', 'subtract', 'count'] as const;
export type MoveOperation = (typeof MOVE_OPERATIONS)[number];

/**
 * What the tutor sends. Flat on purpose: no nested arrays of objects, because a Live model
 * fills a flat schema reliably and drops structure under nesting. `values` means whatever the
 * delta needs; code reads it, and the same numbers go through the adapter's answer sweep.
 */
export interface ComposedMove {
  obstacle: string;
  delta: MoveDelta;
  /** From the mounted adapter's own representation plus its alternates. Enforced against both. */
  representation: string;
  nextAction: string;
  /** contrast: the two counts. re-represent / model-process: [start, change]. illustrate: every count drawn. */
  values: number[];
  /** Required by `re-represent` and `model-process`; the process the counters show. */
  operation?: MoveOperation;
  /** `illustrate` only: the literal picture, which is also all the tutor may say about it. */
  description?: string;
  /**
   * `attend` only: which parts of the child's OWN work to direct attention to, from the ids
   * the mounted adapter publishes. A SET, because one logical move is often several rendered
   * objects — the empty spaces, both terms compared, every object of a kind. That is
   * cardinality, not pedagogy, so it belongs in the shape rather than in a later `attendMany`.
   * An attend draws nothing new, so it carries targets where every other delta carries numbers.
   */
  targets?: string[];
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

/** Wire shape only. Whether the move FITS the obstacle is the runtime's refusal, not this. */
export function parseComposedMove(value: unknown): ComposedMove | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const allowed = ['obstacle', 'delta', 'representation', 'nextAction', 'values', 'operation', 'description', 'targets'];
  if (Object.keys(v).some(k => !allowed.includes(k))) return null;
  if (!text(v.obstacle, 300) || !text(v.nextAction, 200) || !text(v.representation, 60)) return null;
  if (!(MOVE_DELTAS as readonly string[]).includes(v.delta as string)) return null;
  if (!Array.isArray(v.values) || v.values.length > 6
    || !v.values.every(n => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20)) return null;
  if (v.operation !== undefined && !(MOVE_OPERATIONS as readonly string[]).includes(v.operation as string)) return null;
  if (v.description !== undefined && !text(v.description, 600)) return null;
  if (v.targets !== undefined && (!Array.isArray(v.targets) || v.targets.length < 1 || v.targets.length > 12
    || !v.targets.every(t => text(t, 100)) || new Set(v.targets as string[]).size !== v.targets.length)) return null;
  return { obstacle: (v.obstacle as string).trim(), delta: v.delta as MoveDelta,
    representation: (v.representation as string).trim(), nextAction: (v.nextAction as string).trim(),
    values: [...(v.values as number[])],
    ...(v.operation ? { operation: v.operation as MoveOperation } : {}),
    ...(v.description ? { description: (v.description as string).trim() } : {}),
    ...(v.targets ? { targets: (v.targets as string[]).map(t => t.trim()) } : {}) };
}

/**
 * Why this move's own payload cannot be drawn, or null. Scope, policy and the workspace
 * rules are the runtime's; this only asks whether the numbers and words match the delta.
 */
export function movePayloadRefusal(move: ComposedMove): string | null {
  if (move.delta === 'illustrate') {
    return move.description ? null
      : 'A drawn picture needs `description`: the literal picture, its objects and their exact counts.';
  }
  if (move.description) return `A ${move.delta} move is drawn from its numbers; leave \`description\` out.`;
  // `attend` is the one delta that adds nothing to the screen: it rings work already there,
  // so it carries a target instead of a carrier and its numbers must stay empty.
  if (move.delta === 'attend') {
    if (!move.targets?.length) return 'An attend move needs `targets`: which parts of their own work to draw attention to.';
    if (move.values.length) return 'An attend move rings what is already on screen and draws no numbers; leave `values` empty.';
    if (move.operation) return 'An attend move shows no process; leave `operation` out.';
    return null;
  }
  if (move.targets) return `Only an attend move names targets; leave \`targets\` out of a ${move.delta} move.`;
  if (!moveCarrier(move.delta)) return `The pieces for a ${move.delta} move are not built yet. Use a different delta, or words.`;
  if (move.delta === 'contrast') {
    if (move.values.length !== 2) return 'A contrast needs exactly two counts in `values`: the two cases to line up.';
    const [a, b] = move.values;
    if (a === b) return 'A contrast needs two DIFFERENT counts; equal rows show no distinguishing feature.';
    if (a < 1 && b < 1) return 'A contrast needs at least one case with something in it.';
    return null;
  }
  // re-represent and model-process both draw [start, change].
  if (move.values.length !== 2) return `A ${move.delta} move needs exactly two numbers in \`values\`: the start and the change.`;
  if (!move.operation) return `A ${move.delta} move needs \`operation\`: which process the counters show.`;
  const [start, change] = move.values;
  if (move.operation === 'subtract' && (change > start || start < 1)) return 'Taking away needs a start of at least 1 and a change no larger than it.';
  if (move.operation === 'make-ten' && (change < 1 || start < 1 || start + change > 20)) return 'Making a whole needs a start and a change of at least 1, totalling 20 or less.';
  if (move.operation === 'count' && start < 1) return 'Counting needs a start of at least 1.';
  return null;
}

/** The steps of each process on one aligned column grid: what is there, what changes, what results. */
function processFrames(operation: MoveOperation, start: number, change: number): StepFrame[] {
  if (operation === 'subtract') return [
    { segments: [{ count: start, tone: 'plain' }], caption: `Start with ${start} counters.` },
    { segments: [{ count: start - change, tone: 'plain' }, { count: change, tone: 'crossed' }], caption: `Take away ${change}.` },
    // A frame needs at least one counter to draw, so nothing-left keeps an empty outline.
    { segments: start - change > 0 ? [{ count: start - change, tone: 'plain' }] : [{ count: 1, tone: 'empty' }],
      caption: `${start - change} counters are left.` },
  ];
  if (operation === 'make-ten') return [
    { segments: [{ count: start, tone: 'plain' }, { count: change, tone: 'empty' }], caption: `${start} counters are here.` },
    { segments: [{ count: start, tone: 'plain' }, { count: change, tone: 'marked' }], caption: `Count the empty spaces. There are ${change}.` },
    { segments: [{ count: start, tone: 'plain' }, { count: change, tone: 'added' }], caption: `${start} and ${change} make ${start + change}.` },
  ];
  return [
    { segments: [{ count: 1, tone: 'plain' }, { count: Math.max(start - 1, 0), tone: 'empty' }], caption: 'Place one counter and say "one".' },
    { segments: [{ count: start, tone: 'plain' }], caption: `Keep going, one at a time, up to ${start}.` },
  ];
}

/**
 * Code builds every artifact, including its sentences. The tutor supplied the numbers and
 * the diagnosis; the captions state what the drawing actually shows, so the tutor cannot
 * narrate a relationship the picture does not hold.
 */
export function buildMoveArtifact(move: ComposedMove, id: string): SupportArtifact {
  const exposure: AnswerExposure = 'partial';
  if (move.delta === 'illustrate') {
    const artifact: GeneratedImageSupport = { id, kind: 'generated-image', title: move.obstacle.slice(0, 120),
      altText: move.description!, purpose: move.delta, answerExposure: exposure, provenance: 'generated' };
    validateSupportArtifact(artifact);
    return artifact;
  }
  if (move.delta === 'contrast') {
    const [a, b] = move.values;
    const [more, less] = a > b ? [a, b] : [b, a];
    const artifact: ContrastPairSupport = { id, kind: 'contrast-pair', title: `${more} against ${less}`,
      panels: [{ kind: 'counters', label: String(more), count: more, highlighted: more - less },
        { kind: 'counters', label: String(less), count: less, highlighted: 0 }],
      caption: `${more} has ${more - less} more than ${less}. The last ${more - less} have no partner.`,
      altText: `Two rows of counters lined up. The top row has ${more} and the bottom row has ${less}. `
        + `The last ${more - less} counters of the top row are ringed because nothing sits under them.`,
      answerExposure: exposure, provenance: 'prepared' };
    validateSupportArtifact(artifact);
    return artifact;
  }
  const [start, change] = move.values;
  if (move.delta === 'model-process') {
    const frames = processFrames(move.operation!, start, change);
    const artifact: StepSequenceSupport = { id, kind: 'step-sequence',
      title: move.operation === 'subtract' ? 'Take away, step by step'
        : move.operation === 'make-ten' ? 'Fill it up, step by step' : 'Count them, step by step',
      frames, altText: `${frames.length} steps. ` + frames.map((f, i) => `Step ${i + 1}: ${f.caption}`).join(' '),
      answerExposure: exposure, provenance: 'prepared' };
    validateSupportArtifact(artifact);
    return artifact;
  }
  // re-represent: the same quantity as a plain row of counters, the second model beside the work.
  const artifact: CounterSupport = { id, kind: 'counter-example', operation: move.operation!,
    title: 'The same amount with counters',
    total: move.operation === 'make-ten' ? start + change : start,
    removed: move.operation === 'count' ? 0 : change,
    altText: move.operation === 'subtract' ? `Start with ${start} counters. Cross out ${change}. ${start - change} remain.`
      : move.operation === 'make-ten' ? `${start} counters and ${change} more make ${start + change}.`
        : `A row of ${start} counters. Touch each one once as you count.`,
    answerExposure: exposure, provenance: 'prepared' };
  validateSupportArtifact(artifact);
  return artifact;
}
