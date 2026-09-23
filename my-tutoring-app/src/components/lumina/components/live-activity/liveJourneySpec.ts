/**
 * What a live-runtime JOURNEY needs to know about one primitive.
 *
 * Same rule as `LiveActivitySpec`, one layer down: the host declares, the wire
 * relays, and Python names no primitive. `run_live_runtime.py` is a transport and
 * a phase program; every fact that differs per primitive is declared here, beside
 * the primitive, and resolved by the mounted driver — which already loads this
 * module live. A new adoption adds a row to `LIVE_JOURNEYS`, never a new harness.
 *
 * The split is deliberate:
 *   - **Python says what should happen next** ("the learner answers wrongly now").
 *   - **TypeScript says how to do it and whether it was right** (which DOM events
 *     that means on this primitive, and whether the drawn example taught its claim).
 *
 * A value computed from generated content — a wrong landing on a number line, the
 * spoken answer for a counting board — is therefore never computed in Python. That
 * was how `first['targetValues'][0] + 1` ended up in a backend test file.
 *
 * Development only. The capabilities route that serves it 404s in production, and
 * nothing in the shipped lesson path imports this module.
 */
import type { SupportArtifact } from './runtime/contract';
import type { LivePrimitiveId } from './activityContract';
import { itemsFromChallenges as shapeItems, shapeSorterHarnessAnswers } from '../../primitives/visual-primitives/math/shapeSorterScript';
import { buildSequencerItems as sequencerItems, sequencerHarnessAnswers }
  from '../../primitives/visual-primitives/math/numberSequencerDomain';
import { buildLetterSoundItems, letterSoundHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diLetterSoundsDomain';
import { buildWordReadingItems, wordReadingHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diWordReadingDomain';
import { buildMathFactItems, mathFactsHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diMathFactsDomain';
import { buildSentenceReadingItems, sentenceReadingHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingDomain';
import { buildLetterSoundLinkItems, letterSoundLinkWorkspaceAnswers }
  from '../../primitives/visual-primitives/literacy/letterSoundLinkDomain';
import { itemsFromChallenges as frameItems, tenFrameHarnessAnswers, type TenFrameItem }
  from '../../primitives/visual-primitives/math/tenFrameScript';
import { countsFlips } from '../../primitives/visual-primitives/math/tenFrameWorkspace';
import { buildBondItems } from '../../primitives/visual-primitives/math/numberBondScript';
import { expandNumberBondInteractions } from '../../primitives/visual-primitives/math/numberBondModes';
import { buildCompareItems, compareObjectsHarnessAnswers } from '../../primitives/visual-primitives/math/compareObjectsScript';
import { itemsFromChallenges as placeValueItems, placeValueHarnessAnswers } from '../../primitives/visual-primitives/math/placeValueScript';
import { getDigitPaths } from '../../primitives/visual-primitives/math/numberTracerPaths';
import { itemsFromChallenges as sortingItems, sortingStationHarnessAnswers } from '../../primitives/visual-primitives/math/sortingStationScript';
import { placeLabel } from '../../primitives/visual-primitives/math/spokenNumberWords';
import { itemsFromChallenges as ordinalItems, ordinalLineHarnessAnswers } from '../../primitives/visual-primitives/math/ordinalLineScript';
import type { BarModelChallenge } from '../../primitives/visual-primitives/math/BarModel';
import { OPTION_MODES, ROW_TAP_MODES, barModelHarnessAnswers, isSpokenGraph }
  from '../../primitives/visual-primitives/math/barModelWorkspace';

/** One real learner action for the mounted driver to perform. */
export type DriverInput =
  | { type: 'place'; value: number }
  | { type: 'check' }
  /** The index-th `object-N`, or the object whose `data-pip-object` id is `target`. */
  | { type: 'touch'; index?: number; target?: string }
  | { type: 'give' }
  | { type: 'choose'; label: string }
  /** Text typed into the input with this `aria-label`. */
  | { type: 'write'; label: string; text: string }
  /** Strokes drawn on the canvas, in canvas pixel coordinates. */
  | { type: 'draw'; strokes: { x: number; y: number }[][] }
  | { type: 'answer'; text: string };

/** What the program is asking the learner to do, independent of how this primitive does it. */
export type LearnerIntent = 'warmup' | 'wrong' | 'correct';

export interface JourneyContext {
  /** The generated payload as mounted. */
  data: Record<string, any>;
  /** The item the runtime currently reports, resolved to its generated challenge. */
  challenge: Record<string, any> | null;
  /** `buildDiDrivePlan` items, when the primitive is a registered DI port. */
  diItems: Array<{ id: string; answers: Record<string, string> }>;
  /**
   * The JUDGED ITEM the runtime currently reports, which is not always a challenge.
   * Six primitives expand one generated challenge into several asks with derived ids,
   * so `challenge` is null for them and this is the only handle on "which ask is open".
   */
  itemId: string | null;
  /** The runtime's current `task.demand`: scene facts and whether the stimulus is ready. */
  demand?: Record<string, unknown> | null;
  /** What the workspace tells the tutor the spoken answer is. */
  expectedAnswer?: string | null;
}

export interface JourneyProbe {
  selector: string;
  /** `present` (default) reports a boolean, `count` a number, `focused` compares to activeElement. */
  kind?: 'present' | 'count' | 'focused';
}

export interface LiveJourney {
  execution?: 'workspace';
  /** Module path under `src/components/lumina/`, so the driver needs no primitive map of its own. */
  component: string;
  /** The mounted instance id. The driver owns it and reports it in its ready handshake. */
  instanceId: string;
  /** Defaults for a fresh generation; every one is overridable from the command line. */
  defaults: { topic: string; grade: string; mode: string; di: boolean };
  /** Bracket tags this primitive's own script emits. The model must never voice one. */
  leakTokens: string[];
  /** What the learner says to ask for each action, in this primitive's own vocabulary. */
  prompts: Record<string, string>;
  /** How this primitive performs an intent. Returning [] means the intent does not apply. */
  inputsFor: (intent: LearnerIntent, ctx: JourneyContext) => DriverInput[];
  /**
   * Did the drawn example teach the relationship it claims? Return null for yes, or
   * the reason it did not. This is pedagogy, so it stays beside the primitive — an
   * assertion copied between journeys encodes the wrong primitive's teaching.
   */
  exampleTaught?: (artifact: SupportArtifact, spoken: string) => string | null;
  /** Extra DOM probes. `reminder` and `support` are shared and supplied by the driver. */
  probes?: Record<string, JourneyProbe>;
}

/** What a learner says to ask for each action on any shared-workspace surface. */
const WORKSPACE_PROMPTS = { opening: 'What do I do?', hint: 'Can you help me?', example: 'Can you show me what you mean?' };

/** The retiring cue tags. The workspace emits none of them; a model that voices
 *  one is reading a legacy pack it should no longer be sent. */
const RETIRED_DI_CUE_TAGS = ['DI_ITEM', 'DI_MOVE_ON', 'DI_COMPLETE'];

/** Every mode of a spoken pack is one utterance per intent, and the utterance comes
 *  from the pack's own domain, never from Python. */
const spokenWorkspaceInputs = <I extends { id: string }>(build: (challenges: any[]) => I[],
    answersFor: (item: I) => { correct: string; plainWrong: string }, noun: string): LiveJourney['inputsFor'] =>
  (intent, ctx) => {
    if (intent === 'warmup') return [];
    const item = build(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
    if (!item) throw new Error(`No current ${noun} assignment`);
    const answers = answersFor(item);
    return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
  };

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** Does the turn say this number, as a digit or as its word? */
const says = (text: string, n: number) =>
  new RegExp(`\\b(?:${n}${NUMBER_WORDS[n] ? `|${NUMBER_WORDS[n]}` : ''})\\b`, 'i').test(text);

/** A counter example IS its three quantities; a turn that omits one has announced an example, not taught it. */
const omittedQuantities = (artifact: SupportArtifact, text: string): string | null => {
  if (artifact.kind === 'contrast-pair' || artifact.kind === 'generated-image') return `Expected a counter example or a step sequence, got ${artifact.kind}`;
  // A step sequence's relationship is its LAST step: each part and the whole they make.
  const last = artifact.kind === 'step-sequence' ? artifact.frames[artifact.frames.length - 1].segments.map(s => s.count) : [];
  const quantities = artifact.kind === 'step-sequence' ? [...last, last.reduce((a, b) => a + b, 0)]
    : [artifact.total - artifact.removed, artifact.removed, artifact.total];
  const missing = Array.from(new Set(quantities)).filter(n => !says(text, n));
  return missing.length ? `Worked example omitted its actual quantities: ${missing.join(', ')}` : null;
};

/** The cells a ten-frame placement touches, in order: the seeded counters to flip, or the empty boxes to fill. */
const frameCells = (item: TenFrameItem): number[] => {
  const seeded = item.seedCells ?? Array.from({ length: item.kind === 'subitize' ? 0 : item.shown }, (_, i) => i);
  return countsFlips(item) ? seeded
    : Array.from({ length: item.capacity }, (_, i) => i).filter(cell => !seeded.includes(cell));
};

/** A spoken workspace item answered with the number the workspace publishes, or one more. */
const spokenExpected = (ctx: JourneyContext, intent: LearnerIntent): DriverInput[] => {
  const n = Number(ctx.expectedAnswer);
  if (!Number.isInteger(n)) throw new Error('No published numeric answer for this spoken item');
  const said = intent === 'wrong' ? n + 1 : n;
  return [{ type: 'answer', text: NUMBER_WORDS[said] ?? String(said) }];
};

/** A judged runner's spoken answer comes from the port's own DI plan, never from the harness. */
const spoken = (ctx: JourneyContext, key: 'correct' | 'plainWrong'): DriverInput[] => {
  // Match the JUDGED ITEM first. Falling straight back to `diItems[0]` meant every
  // expanding primitive spoke the first ask's answer on every later ask, which the
  // runner then correctly judged wrong — a harness bug that reads as a model failure.
  const item = ctx.diItems.find(i => i.id === ctx.itemId)
    ?? ctx.diItems.find(i => i.id === ctx.challenge?.id)
    ?? ctx.diItems[0];
  const text = item?.answers?.[key];
  return text ? [{ type: 'answer', text }] : [];
};

export const LIVE_JOURNEYS: Record<LivePrimitiveId, LiveJourney> = {
  'number-line': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberLine.tsx',
    instanceId: 'line',
    defaults: { grade: 'Grade 1', mode: 'jump', di: false,
      topic: 'Subtract within 10: two independent single backward jumps, each taking away 1 to 4, starting at 5 to 9. No addition.' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // The landing the jump actually reaches; one past it is the wrong placement the
    // line's own Check rejects. Derived from the mounted challenge, not from Python.
    inputsFor: (intent, ctx) => {
      const landing = ctx.challenge?.targetValues?.[0];
      if (intent === 'warmup' || typeof landing !== 'number') return [];
      return [{ type: 'place', value: intent === 'wrong' ? landing + 1 : landing }, { type: 'check' }];
    },
    probes: { mounted: { selector: 'svg[viewBox="0 0 760 240"]' } },
  },

  'ten-frame': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/TenFrame.tsx',
    instanceId: 'frame',
    defaults: { grade: 'Kindergarten', mode: 'build', di: false, topic: 'Build numbers to 10 on a ten frame' },
    leakTokens: ['TF_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer; a placement taps the frame's real cells:
    // empty ones on a placing mode, seeded counters on a flipping mode.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const d = ctx.data;
      const item = frameItems(d.challenges ?? [], { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand ?? 'K' })
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current ten-frame assignment');
      const answers = tenFrameHarnessAnswers(item);
      // A quick look not yet shown is the learner's to start: they press Show me, then answer.
      const look: DriverInput[] = item.kind === 'subitize' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Show me' }] : [];
      if (item.answerKind !== 'gesture' || !answers.placed) return [...look, { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return frameCells(item).slice(0, intent === 'wrong' ? answers.placed.wrong : answers.placed.correct)
        .map(cell => ({ type: 'touch' as const, target: `cell-${cell}` }));
    },
    probes: { mounted: { selector: '[data-pip-object="frame"]' } },
  },

  'counting-board': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CountingBoard.tsx', instanceId: 'board',
    defaults: { grade: 'Kindergarten', mode: 'give_me_n', di: false, topic: 'Giving a requested number of objects from a larger collection' },
    leakTokens: ['CB_', 'COUNT_'],
    prompts: WORKSPACE_PROMPTS,
    inputsFor: (intent, ctx) => {
      const ch = ctx.challenge;
      if (!ch) throw new Error('No current counting task');
      if (intent === 'warmup') return [];
      const n = ch.targetAnswer + (intent === 'wrong' ? 1 : 0);
      if (ch.type === 'give_me_n') return [...Array.from({ length: n }, (_, index) => ({ type: 'touch' as const, index })), { type: 'give' as const }];
      const work: DriverInput[] = ch.type === 'take_away' ? Array.from({ length: ch.changeBy }, (_, index) => ({ type: 'touch', index }))
        : ch.type === 'add_more' ? Array.from({ length: ch.changeBy }, (_, index) => ({ type: 'touch', index: ch.count + index }))
        : ch.type === 'recount_moved' ? Array.from({ length: ch.count }, (_, index) => ({ type: 'touch', index })) : [];
      return [...work, { type: 'answer', text: ch.type === 'count_all'
        ? Array.from({ length: n }, (_, i) => String(i + 1)).join(' ') : String(n) }];
    },
    probes: { mounted: { selector: '[data-pip-object^="object-"]', kind: 'count' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'number-sequencer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberSequencer.tsx',
    instanceId: 'train',
    // `before_after` asks exactly ONE question per generated challenge, so the two
    // challenges this harness mounts are two items. A mode whose challenge expands
    // into several asks (count_from, fill_missing, decade_fill) leaves items open
    // after the program's second correct answer and cannot reach completion here.
    defaults: { grade: 'Kindergarten', mode: 'before_after', di: false,
      topic: 'The number that comes just before or just after a given number' },
    leakTokens: ['NS_'],
    prompts: WORKSPACE_PROMPTS,
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = sequencerItems(ctx.data.challenges ?? []).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current number-train assignment');
      const answers = sequencerHarnessAnswers(item);
      const text = intent === 'wrong' ? answers.plainWrong : answers.correct;
      // Page work: the cards carry their own number as their whole label, so a
      // placement is the shared `choose`, not a primitive-specific verb.
      return item.answerKind === 'gesture'
        ? text.split(',').map(label => ({ type: 'choose' as const, label }))
        : [{ type: 'answer', text }];
    },
    probes: { mounted: { selector: '[data-testid^="train-car-"]', kind: 'count' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },

  'number-bond': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberBond.tsx',
    instanceId: 'bond',
    defaults: { grade: 'Kindergarten', mode: 'ten_and_ones', di: false, topic: 'Teen numbers as a ten and some ones' },
    leakTokens: ['NB_', 'NS_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken phase says the number the workspace publishes; a split phase presses the board's own
    // move buttons: everything back to the whole, then a complete split (an incomplete one never
    // commits). Wrong is a split with no full ten, or a decompose pair already made. Model and
    // equation phases are not driven at W1.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = expandNumberBondInteractions(buildBondItems(ctx.data.challenges ?? [],
        { band: ctx.data.gradeBand ?? 'K', maxNumber: ctx.data.maxNumber ?? 10 }).items).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current number-bond assignment');
      if (item.answerKind !== 'gesture') return spokenExpected(ctx, intent);
      if (item.splitPhase !== 'build') throw new Error(`Number-bond ${item.interactionPhase ?? item.kind} hands phase is not driven at W1`);
      const placed = Number(ctx.demand?.countersInLeftPart ?? 0) + Number(ctx.demand?.countersInRightPart ?? 0);
      const wrong = intent === 'wrong';
      const left = item.kind === 'ten-and-ones' ? (wrong ? 9 : 10) : wrong && item.pairIndex > 0 ? 0 : item.pairIndex;
      const right = item.whole - left;
      const press = (place: string, n: number) => Array.from({ length: n }, () => ({ type: 'choose' as const, label: `Move counter to ${place}` }));
      return [...press('whole', placed), ...press('left', left), ...press('right', right)];
    },
    probes: { mounted: { selector: '[data-pip-dock]' } },
  },
  'ordinal-line': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/OrdinalLine.tsx',
    instanceId: 'line-up',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Saying which place someone is standing in a line' },
    leakTokens: ['OL_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer (a name or a place word); a build touches
    // each real picture and then its place, in the clued order or reversed (the wrong-end
    // error through the hands), so a wrong line is complete.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = ordinalItems(ctx.data.challenges ?? [], { band: ctx.data.gradeBand ?? 'K', context: ctx.data.context ?? 'race' })
        .items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current ordinal-line assignment');
      if (item.answerKind === 'gesture') {
        const order = intent === 'wrong' ? [...item.answerOrder].reverse() : item.answerOrder;
        return order.flatMap((name, i) => [{ type: 'touch' as const, target: `picture-${name}` },
          { type: 'touch' as const, target: `slot-${i + 1}` }]);
      }
      const answers = ordinalLineHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stage"]' } },
  },
  'sorting-station': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SortingStation.tsx',
    instanceId: 'station',
    defaults: { grade: 'Kindergarten', mode: 'sort_one', di: false,
      topic: 'Sorting objects into groups by one attribute' },
    leakTokens: ['SS_'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is spoken: the pack's own right answer, or its plain wrong one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = sortingItems(ctx.data.challenges ?? [], { tier: ctx.data.supportTier,
        isPreReader: (ctx.data.gradeBand ?? 'K') === 'K' }).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current sorting-station assignment');
      const answers = sortingStationHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object^="tray-"]', kind: 'count' } },
  },
  'number-tracer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberTracer.tsx',
    instanceId: 'tracer',
    defaults: { grade: 'Kindergarten', mode: 'trace', di: false,
      topic: 'Writing the numerals zero through five' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // `trace` only: the right answer follows the challenge's own guide strokes, densified; the wrong
    // one is the same strokes shifted off the guide. Other modes need a drawn numeral the vision
    // judge reads, which the driver cannot produce, so they throw.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenge = ctx.challenge;
      if (challenge?.type !== 'trace') throw new Error(`Number-tracer ${challenge?.type ?? 'unknown'} is not driven at W1`);
      // The component's own fallback when a challenge carries no strokes (the generator never sends them).
      const guide: { x: number; y: number }[][] = challenge.strokePaths?.length ? challenge.strokePaths : getDigitPaths(challenge.digit);
      const dx = intent === 'wrong' ? 160 : 0;
      const strokes = guide.map(stroke => stroke.slice(1).flatMap((b, k) => {
        const a = stroke[k];
        return Array.from({ length: 12 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 12 + dx, y: a.y + ((b.y - a.y) * i) / 12 }));
      }).concat([{ x: stroke[stroke.length - 1].x + dx, y: stroke[stroke.length - 1].y }]));
      return [{ type: 'draw', strokes }, { type: 'choose', label: 'Check' }];
    },
    probes: { mounted: { selector: 'canvas' } },
  },
  'comparison-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ComparisonBuilder.tsx',
    instanceId: 'compare',
    // Grade 1, because that is the band with labelled choice buttons and a Check
    // button the driver can press. Kindergarten answers by tapping the group
    // pictures themselves, which is an SVG gesture the driver has no verb for.
    defaults: { grade: 'Grade 1', mode: 'compare_groups', di: false,
      topic: 'Deciding which of two groups has more' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'DISAMBIGUATE', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Every Grade-1 mode through its real buttons, then Check. A wrong answer is the
    // mode's signature error: the opposite word or symbol, the reversed order, a step
    // the wrong way. Derived from the mounted challenge, not from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current comparison-builder challenge');
      if ((ctx.data.gradeBand ?? 'K') !== '1') throw new Error(`comparison-builder ${c.type}: Kindergarten taps pictures; the row drives Grade 1`);
      const wrong = intent === 'wrong';
      const check: DriverInput = { type: 'check' };
      if (c.type === 'compare-groups') {
        const label = (answer: string) => answer === 'equal' ? 'The Same' : answer === 'more' ? 'More' : 'Fewer';
        return [{ type: 'choose', label: label(wrong ? (c.correctAnswer === 'more' ? 'less' : 'more') : c.correctAnswer) }, check];
      }
      if (c.type === 'compare-numbers') {
        const symbol = wrong ? (c.correctSymbol === '<' ? '>' : '<') : c.correctSymbol;
        return [{ type: 'choose', label: symbol }, check];
      }
      if (c.type === 'order') {
        const sorted = [...c.numbers].sort((a: number, b: number) => c.direction === 'descending' ? b - a : a - b);
        return [...(wrong ? sorted.reverse() : sorted).map((n: number): DriverInput => ({ type: 'choose', label: String(n) })), check];
      }
      const step = (c.askFor === 'one-less' ? -1 : 1) * (wrong ? -1 : 1);
      if (c.askFor !== 'one-more' && c.askFor !== 'one-less')
        throw new Error('comparison-builder one-more-one-less both: two rows share their labels and the driver has no row-scoped choice');
      return [{ type: 'choose', label: String(c.targetNumber + step) }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'compare-objects': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CompareObjects.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'compare_two', di: false,
      topic: 'Deciding which of two objects is longer' },
    leakTokens: ['CO_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer; an ordering touches the real object
    // buttons, in the right order or reversed (the mode's signature error).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = buildCompareItems(ctx.data.challenges ?? [], { band: ctx.data.gradeBand ?? 'K' }).items
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current compare-objects assignment');
      if (item.answerKind === 'gesture') {
        const order = intent === 'wrong' ? [...item.answerNames].reverse() : item.answerNames;
        return order.map(name => ({ type: 'touch' as const, target: `pick-${name}` }));
      }
      const answers = compareObjectsHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="drawing"]' } },
  },
  'fraction-circles': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FractionCircles.tsx',
    instanceId: 'circles',
    defaults: { grade: 'Grade 2', mode: 'build', di: false, topic: 'Building halves, thirds and fourths by shading equal slices' },
    leakTokens: ['FT_', 'IDENTIFY_', 'BUILD_', 'COMPARE_', 'EQUIVALENT_', 'ALL_COMPLETE', 'PHASE_TRANSITION'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is a gesture through the circle's own controls: typed text, shaded slices or a
    // choice, then Check. A wrong answer is one slice or one numerator off, or another choice.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((ch: { id: string }) => ch.id === ctx.itemId);
      if (!c) throw new Error('No current fraction-circles assignment');
      const wrong = intent === 'wrong';
      const off = (n: number, max: number) => (n + 1 <= max ? n + 1 : n - 1);
      const check: DriverInput = { type: 'check' };
      const shade = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'touch' as const, target: `slice-${i}` }));
      switch (c.type) {
        case 'identify':
          return [{ type: 'write', label: 'Fraction answer', text: `${wrong ? off(c.numerator, c.denominator) : c.numerator}/${c.denominator}` }, check];
        case 'build': return [...shade(wrong ? off(c.numerator, c.denominator) : c.numerator), check];
        case 'equivalent': {
          const built = c.numerator * c.equivalentDenominator / c.denominator;
          return [...shade(wrong ? off(built, c.equivalentDenominator) : built), check];
        }
        case 'compare': {
          const left = c.numerator / c.denominator, right = c.compareFraction.numerator / c.compareFraction.denominator;
          const key = Math.abs(left - right) < 0.001 ? 'equal' : left > right ? 'left' : 'right';
          const choice = wrong ? (key === 'left' ? 'right' : 'left') : key;
          const labels = c.showFractionLabels !== false;
          const label = choice === 'equal' ? 'They are equal'
            : choice === 'left' ? (labels ? `Left (${c.numerator}/${c.denominator}) is larger` : 'Left is larger')
              : (labels ? `Right (${c.compareFraction.numerator}/${c.compareFraction.denominator}) is larger` : 'Right is larger');
          return [{ type: 'choose', label }, check];
        }
        case 'touch_fraction':
          // The two wrong pictures are drawn at random on mount, so the row cannot name one.
          if (wrong) throw new Error('fraction-circles touch_fraction: the wrong pictures are random per mount; no driver input for a wrong touch');
          return [{ type: 'touch', target: `picture-${c.numerator}-of-${c.denominator}` }];
        default: throw new Error(`fraction-circles ${c.type}: no driver input`);
      }
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"], [data-pip-object="stimulus"]' } },
  },
  'place-value-chart': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PlaceValueChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 2', mode: 'compare', di: false,
      topic: 'What a digit is worth in the tens and ones places' },
    leakTokens: ['PV_', 'PVC_'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode alternates a printed number (spoken answer) with a dictated one, written
    // into the chart's labelled columns. A wrong chart is complete, with its ones digit off
    // by one; a half-written chart never commits.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = placeValueItems(ctx.data.challenges ?? [], { mode: ctx.data.challengeType,
        tier: ctx.data.supportTier ?? 'medium' }).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current place-value assignment');
      if (item.answerKind === 'gesture') return item.chartPlaces.map((p, i) => {
        const d = item.expectedDigits[i];
        return { type: 'write' as const, label: placeLabel(p), text: String(intent === 'wrong' && p === 0 ? (d + 1) % 10 : d) };
      });
      const answers = placeValueHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stage"]' } },
  },
  'shape-sorter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ShapeSorter.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Naming flat shapes by their sides and corners' },
    leakTokens: ['SH_'],
    prompts: WORKSPACE_PROMPTS,
    inputsFor: spokenWorkspaceInputs(challenges => shapeItems(challenges, { isPreReader: false }),
      shapeSorterHarnessAnswers, 'shape'),
    probes: { mounted: { selector: '[data-pip-object="shape"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'di-letter-sounds': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiLetterSounds.tsx',
    instanceId: 'sounds',
    defaults: { grade: 'Kindergarten', mode: 'letter_sound', di: false,
      topic: 'Saying the continuous sound a printed letter makes' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The sound itself comes from the domain: the harness must not invent a phoneme.
    inputsFor: spokenWorkspaceInputs(buildLetterSoundItems, letterSoundHarnessAnswers, 'letter-sound'),
    probes: { mounted: { selector: '[data-sound-object="stimulus"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'di-word-reading': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiWordReading.tsx',
    instanceId: 'words',
    defaults: { grade: 'Kindergarten', mode: 'cvc_reading', di: false,
      topic: 'Blending and reading short-vowel CVC words in print' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different word: the near neighbour this pack
    // exists to correct belongs in the JEV probe, where the tutor's reply is fixed
    // and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildWordReadingItems, wordReadingHarnessAnswers, 'word-reading'),
    probes: { mounted: { selector: '[data-word-object="printed"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal, so a transcript inspection can check mechanically that
      // no picture appeared before a committed success: this counts 0 until the
      // observer has credited a read.
      reward: { selector: '[data-word-read]', kind: 'count' } },
  },
  'di-sentence-reading': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiSentenceReading.tsx',
    instanceId: 'sentences',
    defaults: { grade: 'Kindergarten', mode: 'read_sentence', di: false,
      topic: 'Reading a printed short sentence aloud, every word in order' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different sentence: the near-neighbour misread
    // this pack exists to correct belongs in the JEV probe, where the tutor's reply
    // is fixed and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildSentenceReadingItems, sentenceReadingHarnessAnswers, 'sentence-reading'),
    probes: { mounted: { selector: '[data-sentence-object="printed"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal, so a transcript inspection can check mechanically that
      // no picture appeared before a committed success: this counts 0 until the
      // observer has credited a read.
      reward: { selector: '[data-sentence-read]', kind: 'count' } },
  },
  'di-math-facts': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiMathFacts.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Kindergarten', mode: 'answer_fact', di: false,
      topic: 'Adding within five and saying the answer out loud' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different quantity: the off-by-one this pack
    // exists to correct belongs in the JEV probe, where the tutor's reply is fixed
    // and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildMathFactItems, mathFactsHarnessAnswers, 'math-fact'),
    probes: { mounted: { selector: '[data-fact-object="problem"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The completed-equation reveal, so a transcript inspection can check
      // mechanically that no answer appeared on the stage before a committed
      // success: this counts 0 until the observer has credited a fact.
      reward: { selector: '[data-fact-solved]', kind: 'count' } },
  },
  'letter-sound-link': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/LetterSoundLink.tsx',
    instanceId: 'links',
    defaults: { grade: 'Kindergarten', mode: 'see_hear', di: false,
      topic: 'Saying the sound a printed letter makes' },
    leakTokens: ['LSL_'],
    prompts: WORKSPACE_PROMPTS,
    // The only MIXED-CHANNEL journey: two directions answer with an utterance
    // and `hear_see` answers by tapping a letter card, whose label is the
    // uppercase letter the stage prints. Both answers come from the domain —
    // the harness invents neither a phoneme nor a grapheme.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = buildLetterSoundLinkItems(ctx.data.challenges ?? [], ctx.data.supportTier)
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current letter-sound assignment');
      const answers = letterSoundLinkWorkspaceAnswers(item);
      const value = intent === 'wrong' ? answers.plainWrong : answers.correct;
      return [item.answerKind === 'gesture' ? { type: 'choose', label: value } : { type: 'answer', text: value }];
    },
    probes: { mounted: { selector: '[data-letter-stage]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The keyword anchor, so a transcript inspection can check mechanically
      // that no picture or word appeared before a committed success.
      reward: { selector: '[data-letter-revealed]', kind: 'count' } },
  },
  'bar-model': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BarModel.tsx',
    instanceId: 'graph',
    defaults: { grade: 'Kindergarten', mode: 'read_one_to_one', di: false,
      topic: 'Reading a picture graph where one picture stands for one thing' },
    leakTokens: ['ACTIVITY_START', 'CHALLENGE_START', 'PHASE_COMPLETE', 'ALL_COMPLETE', 'GRAPH_'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, derived from the mounted challenge. A spoken item says a
    // true comparison from the rows or the same claim reversed; a number or row choice picks the key
    // or another; a sticker chart or built graph is complete, with one row a sticker off or the wrong step.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId) as BarModelChallenge | undefined;
      if (!c) throw new Error('No current bar-model challenge');
      const wrong = intent === 'wrong';
      if (isSpokenGraph(c)) {
        const answers = barModelHarnessAnswers(c);
        return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
      }
      if (OPTION_MODES.has(c.evalMode)) {
        const pick = wrong ? (c.options ?? []).find(o => o !== c.expectedValue) : c.expectedValue;
        return [{ type: 'choose', label: String(pick) }];
      }
      const row = (i: number) => `${c.values[i].label} row`;
      if (ROW_TAP_MODES.has(c.evalMode)) {
        const target = c.targetBarIndex ?? 0;
        return [{ type: 'choose', label: row(wrong ? (target + 1) % c.values.length : target) }];
      }
      const presses = (label: string, n: number): DriverInput[] => {
        if (n < 0) throw new Error(`bar-model ${c.evalMode}: the chart starts above its target`);
        return Array.from({ length: n }, () => ({ type: 'choose' as const, label }));
      };
      if (c.evalMode === 'build_one_to_one') {
        const counts = (c.expectedCounts ?? []).map((n, i) => wrong && i === 0 ? (n === 0 ? 1 : n - 1) : n);
        return [...counts.flatMap((n, i) => presses(row(i), n - c.values[i].value)), { type: 'check' }];
      }
      const steps = c.availableScaleSteps ?? [1, 2, 5, 10];
      const step = wrong ? steps.find(s => s !== c.expectedScaleStep) : c.expectedScaleStep;
      return [...(c.expectedDataset ?? []).flatMap(e => presses(`Increase ${e.label}`,
        e.value - (c.values.find(v => v.label === e.label)?.value ?? 0))),
        { type: 'choose', label: `Step of ${step}` }, { type: 'choose', label: 'Submit graph' }];
    },
    probes: { mounted: { selector: '[data-pip-object="graph"]' } },
  },
};

/** Shared by every primitive: both belong to the runtime shell, not to any one board. */
export const SHARED_PROBES: Record<string, JourneyProbe> = {
  reminder: { selector: '[data-runtime-hint]' },
  support: { selector: '[aria-label="Worked example"]' },
};

/** The JSON-serializable half — everything but the two resolver functions. */
export function journeyDescriptor(id: LivePrimitiveId) {
  const j = LIVE_JOURNEYS[id];
  if (!j) throw new Error('No live journey for ' + id);
  return { primitiveId: id, component: j.component, instanceId: j.instanceId, defaults: j.defaults, execution: j.execution,
    leakTokens: j.leakTokens, prompts: j.prompts, judgesExample: !!j.exampleTaught,
    probes: { ...SHARED_PROBES, ...(j.probes ?? {}) } };
}
