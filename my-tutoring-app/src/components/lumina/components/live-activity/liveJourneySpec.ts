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
import { baseTenHarnessAnswers, itemsFromChallenges as baseTenItems, usesBaseTenDi, wrongTradePlace }
  from '../../primitives/visual-primitives/math/baseTenScript';
import { blockNoun, blockNounPlural, readCount } from '../../primitives/visual-primitives/math/baseTenModel';
import { itemsFromChallenges as ordinalItems, ordinalLineHarnessAnswers } from '../../primitives/visual-primitives/math/ordinalLineScript';
import { balanceSurface, explainHarnessAnswers, weightsFor } from '../../primitives/visual-primitives/math/balanceScaleWorkspace';
import { equalityItems, equalityProblem, WEIGHTS } from '../../primitives/visual-primitives/math/balanceEqualityModel';
import { isHands, TRAY, workshopItems, workshopProblem } from '../../primitives/visual-primitives/math/balanceWorkshopModel';
import type { BarModelChallenge } from '../../primitives/visual-primitives/math/BarModel';
import { blendHarnessAnswers, blendItems } from '../../primitives/visual-primitives/literacy/phonicsBlenderWorkspace';
import { flipHarnessAnswers } from '../../primitives/visual-primitives/literacy/wordFlipWorkspace';
import { swapHarnessAnswers } from '../../primitives/visual-primitives/literacy/soundSwapWorkspace';
import { cvcHarnessAnswers } from '../../primitives/visual-primitives/literacy/cvcSpellerWorkspace';
import { OPTION_MODES, ROW_TAP_MODES, barModelHarnessAnswers, isSpokenGraph }
  from '../../primitives/visual-primitives/math/barModelWorkspace';
import { youAndMeHarnessAnswers } from '../../primitives/visual-primitives/literacy/youAndMeWorkspace';
import { itemsFromChallenges as syllableItems } from '../../primitives/visual-primitives/literacy/syllableClapperScript';
import { syllableHarnessAnswers } from '../../primitives/visual-primitives/literacy/syllableClapperWorkspace';
import { itemsFromChallenge as rhymeItems } from '../../primitives/visual-primitives/literacy/rhymeStudioScript';
import { rhymeHarnessAnswers } from '../../primitives/visual-primitives/literacy/rhymeStudioWorkspace';
import { itemsFromChallenges as phonemeItems } from '../../primitives/visual-primitives/literacy/phonemeExplorerScript';
import { phonemeHarnessAnswers } from '../../primitives/visual-primitives/literacy/phonemeExplorerWorkspace';
import { itemsFromChallenges as workoutItems } from '../../primitives/visual-primitives/literacy/wordWorkoutScript';
import { wordWorkoutJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordWorkoutWorkspace';
import { itemsFromTargets as builderItems } from '../../primitives/visual-primitives/literacy/wordBuilderScript';
import { wordBuilderJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordBuilderWorkspace';
import { itemsFromChallenges as sorterItems } from '../../primitives/visual-primitives/literacy/wordSorterScript';
import { wordSorterJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordSorterWorkspace';
import { itemsFromChallenges as vocabItems } from '../../primitives/visual-primitives/literacy/pictureVocabularyScript';
import { pictureVocabJourneyAnswers } from '../../primitives/visual-primitives/literacy/pictureVocabularyWorkspace';
import { itemsFromChallenges as spotterItems } from '../../primitives/visual-primitives/literacy/letterSpotterScript';
import { letterSpotterJourneyAnswers } from '../../primitives/visual-primitives/literacy/letterSpotterWorkspace';
import { itemsFromChallenges as decodableItems } from '../../primitives/visual-primitives/literacy/decodableReaderScript';
import { decodableReaderJourneyAnswers } from '../../primitives/visual-primitives/literacy/decodableReaderWorkspace';
import { itemsFromChallenges as bookItems } from '../../primitives/visual-primitives/literacy/interactiveBookScript';
import { interactiveBookJourneyAnswers } from '../../primitives/visual-primitives/literacy/interactiveBookWorkspace';
import { itemsFromChallenges as bridgeItems } from '../../primitives/visual-primitives/literacy/storyBridgeScript';
import { storyBridgeJourneyAnswers } from '../../primitives/visual-primitives/literacy/storyBridgeWorkspace';
import { itemsFromChallenges as ribbonItems } from '../../primitives/visual-primitives/literacy/storyRibbonScript';
import { storyRibbonJourneyAnswers } from '../../primitives/visual-primitives/literacy/storyRibbonWorkspace';
import { itemsFromChallenges as addSubItems } from '../../primitives/visual-primitives/math/additionSubtractionSceneScript';
import { additionSubtractionJourneyAnswers } from '../../primitives/visual-primitives/math/additionSubtractionSceneWorkspace';
import { buildThreeDShapeItems } from '../../primitives/visual-primitives/math/threeDShapeExplorerScript';
import { threeDShapeJourneyAnswers } from '../../primitives/visual-primitives/math/threeDShapeExplorerWorkspace';
import type { CalendarExplorerChallenge } from '../../primitives/visual-primitives/calendar/CalendarExplorer';
import { calendarSequenceItemsFromChallenges, calendarSequenceJourneyAnswers, isGridDateAnswer }
  from '../../primitives/visual-primitives/calendar/calendarExplorerWorkspace';
import { itemsFromChallenges as arenaItems } from '../../primitives/visual-primitives/physics/pushPullArenaScript';
import { pushPullArenaJourneyAnswers } from '../../primitives/visual-primitives/physics/pushPullArenaWorkspace';
import { itemsFromChallenges as habitatItems } from '../../primitives/visual-primitives/biology/habitatDioramaScript';
import { habitatJourneyAnswers } from '../../primitives/visual-primitives/biology/habitatDioramaWorkspace';
import { matterItems } from './adapters/matterExplorerLive';
import { matterJourneyAnswers } from '../../primitives/visual-primitives/chemistry/matterExplorerWorkspace';
import { statesItems } from './adapters/statesOfMatterLive';
import { statesJourneyAnswers } from '../../primitives/visual-primitives/chemistry/statesOfMatterWorkspace';
import { solarItems } from './adapters/solarSystemExplorerLive';
import { solarJourneyAnswers } from '../../primitives/visual-primitives/astronomy/solarSystemWorkspace';
import { easierComparisonChoice, rampConclusion } from '../../primitives/visual-primitives/engineering/rampLabWorkspace';
import { diShapesHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diShapesWorkspace';
import { diSpokenPracticeHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeWorkspace';
import { diDiceRollHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diDiceRollWorkspace';
import { deductionItems, diDeductionHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diDeductionWorkspace';
import { diWorkedProcedureHarnessAnswers, workedProcedureItems } from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedureWorkspace';
import { spatialHarnessInputs } from '../../primitives/visual-primitives/math/spatialSceneWorkspace';

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
export type LearnerIntent = 'warmup' | 'wrong' | 'correct'
  /** An ungraded teaching surface (`execution: 'teaching'`): look at one thing, then finish with the surface's own Done. */
  | 'explore' | 'finish';

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
  /** `workspace`: graded items the observer advances. `teaching`: an ungraded surface the learner finishes. */
  execution?: 'workspace' | 'teaching';
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
  'base-ten-blocks': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BaseTenBlocks.tsx',
    instanceId: 'blocks',
    defaults: { grade: 'Grade 1', mode: 'build_number', di: false, topic: 'Building two-digit numbers with tens and ones' },
    leakTokens: ['BT_', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'BUILD_', 'TRADE_', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Two surfaces, chosen by the payload. The judged mat (read_blocks, regroup): a spoken step says the
    // pack's own answer; a trade taps a block (wrong: another size, or the asked size twice). The click mat:
    // build_number presses each column's "Add one to ..." (wrong: one ones cube too many), then Check My Blocks;
    // operate types the result on the keypad (wrong: one more), then the check key.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenges = ctx.data.challenges ?? [];
      const wrong = intent === 'wrong';
      if (usesBaseTenDi(challenges)) {
        const item = baseTenItems(challenges, challenges[0].type).find(i => i.id === ctx.itemId);
        if (!item) throw new Error('No current base-ten-blocks assignment');
        if (item.answerKind !== 'gesture') {
          const answers = baseTenHarnessAnswers(item);
          return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
        }
        const tap = (place: number): DriverInput => ({ type: 'choose', label: `Trade one ${blockNoun(place, 1)} for ten ${blockNounPlural(place - 1)}` });
        if (!wrong) return [tap(item.problem.place)];
        const other = wrongTradePlace(item.problem);
        if (other >= 1) return [tap(other)];
        if (readCount(item.problem) >= 2) return [tap(item.problem.place), tap(item.problem.place)];
        throw new Error('base-ten-blocks regroup: this mat has no wrong trade the driver can tap');
      }
      // The click mat's challenge ids are `${type}-${index}` (assigned by the component).
      const c = challenges[Number(ctx.itemId?.split('-').pop())];
      if (!c) throw new Error('No current base-ten-blocks challenge');
      if (ctx.data.decimalMode) throw new Error(`base-ten-blocks ${c.type}: decimal mats are not driven at W1`);
      if (c.type === 'build_number') {
        const digits = String(c.targetNumber).padStart(4, '0').split('').map(Number);
        const presses = ['Thousands', 'Hundreds', 'Tens', 'Ones'].flatMap((column, i) =>
          Array.from({ length: digits[i] + (wrong && column === 'Ones' ? 1 : 0) }, (): DriverInput => ({ type: 'choose', label: `Add one to ${column}` })));
        return [...presses, { type: 'choose', label: 'Check My Blocks' }];
      }
      if (c.type === 'regroup') throw new Error('base-ten-blocks regroup on the click mat (a mixed payload) is not driven at W1');
      const typed = String(wrong ? c.targetNumber + 1 : c.targetNumber);
      return [...typed.split('').map((key): DriverInput => ({ type: 'choose', label: key })), { type: 'choose', label: '✓' }];
    },
    probes: { mounted: { selector: '[data-base-ten-mat]' } },
  },
  'balance-scale': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BalanceScale.tsx',
    instanceId: 'scale',
    defaults: { grade: 'Grade 1', mode: 'equality', di: false,
      topic: 'Balancing a mystery weight with numbered weights, then adding them' },
    leakTokens: ['BE_', 'BW_', 'ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'STEP_TAKEN'],
    prompts: WORKSPACE_PROMPTS,
    // Spoken steps say the published number (the explanation says the domain's sentence). Hands steps
    // press the real controls after clearing the step. A hands step commits only when complete, so
    // "wrong" is an incomplete move (one weight short, one group filled) that stays exploration: the
    // program then records guidance without a verdict. The plain solver (mixed sessions) is not driven.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const data = ctx.data as any;
      const wrong = intent === 'wrong';
      const add = (values: number[]) => values.map((v): DriverInput => ({ type: 'choose', label: `Add ${v} weight` }));
      // An incomplete hands move commits nothing, so the tutor gets no turn from it; the learner
      // then claims it is done, as a child does, and the tutor answers that claim.
      const claim = (inputs: DriverInput[]): DriverInput[] => wrong
        ? [...inputs, { type: 'answer', text: 'I think I am done.' }] : inputs;
      const short = (target: number, tray: readonly number[]) => weightsFor(wrong ? Math.max(0, target - 1) : target, tray);
      if (balanceSurface(data) === 'equality') {
        const item = equalityItems((data.challenges ?? []).map(equalityProblem)).find(i => i.id === ctx.itemId);
        if (!item) throw new Error('No current balance-scale equality assignment');
        if (item.step !== 'build') return spokenExpected(ctx, intent);
        const clear: DriverInput[] = Number(ctx.demand?.weightsOnRight ?? 0) > 0 ? [{ type: 'choose', label: 'Clear weights' }] : [];
        return claim([...clear, ...add(short(item.problem.target, WEIGHTS))]);
      }
      if (balanceSurface(data) !== 'workshop') throw new Error('balance-scale mixed-equation solver is not driven at W1');
      const item = workshopItems((data.challenges ?? []).map(workshopProblem)).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current balance-scale workshop assignment');
      const p = item.problem;
      if (item.step === 'explain') return [{ type: 'answer', text: wrong ? explainHarnessAnswers.plainWrong : explainHarnessAnswers.correct }];
      if (!isHands(item.step)) return spokenExpected(ctx, intent);
      const reset: DriverInput = { type: 'choose', label: 'Reset this step' };
      if (item.step === 'separate') return claim([reset, { type: 'choose', label: `Set aside known ${p.known} weight` },
        ...Array.from({ length: wrong ? p.known - 1 : p.known }, (_, i): DriverInput => ({ type: 'choose', label: `Unit ${i + 1}` }))]);
      if (item.step === 'share') return claim([reset, ...Array.from({ length: wrong ? 1 : p.parcels }, (_, g) =>
        Array.from({ length: p.target }, (): DriverInput => ({ type: 'choose', label: `Place unit in group ${g + 1}` }))).flat()]);
      // A second combination must differ from the first (greedy), so it is all ones.
      if (item.step === 'recompose') return claim([reset, ...add(wrong ? short(p.target, TRAY) : Array(p.target).fill(1))]);
      return claim([reset, ...add(short(p.target, TRAY))]);
    },
    probes: { mounted: { selector: '[aria-label="Balance scale workspace"]' } },
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
  'phonics-blender': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PhonicsBlender.tsx',
    instanceId: 'blend',
    defaults: { grade: 'Kindergarten', mode: 'cvc', di: false,
      topic: 'Blending the sounds of short-vowel CVC words into whole words' },
    leakTokens: ['DI_BLEND_ITEM', 'DI_BLEND_MOVE_ON', 'DI_BLEND_COMPLETE', 'PRONOUNCE_SOUND'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the word itself, or a plainly different word.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = blendItems(ctx.data.words ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current phonics-blender word');
      const answers = blendHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    // The reward picture, counted so a transcript inspection can check it never shows before a credit.
    probes: { mounted: { selector: '[data-pip-object="letters"]' }, reward: { selector: '[data-blend-reward]', kind: 'count' } },
  },
  'word-flip': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordFlip.tsx',
    instanceId: 'flip',
    defaults: { grade: 'Kindergarten', mode: 'plural_s', di: false,
      topic: 'Saying the plural of a noun when there is more than one' },
    leakTokens: ['DI_FLIP_ITEM', 'DI_FLIP_MOVE_ON', 'DI_FLIP_COMPLETE', 'SAY_WORD'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the changed word, or the source word said back unchanged.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current word-flip challenge');
      const answers = flipHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="frame"]' }, reward: { selector: '[data-flip-reward]', kind: 'count' } },
  },
  'sound-swap': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SoundSwap.tsx',
    instanceId: 'swap',
    defaults: { grade: 'Kindergarten', mode: 'addition', di: false,
      topic: 'Adding one sound to the beginning of a word to make a new word' },
    leakTokens: ['DI_SWAP_ITEM', 'DI_SWAP_MOVE_ON', 'DI_SWAP_COMPLETE', 'PRONOUNCE_SOUND'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the new word, or the starting word said back unchanged.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current sound-swap challenge');
      const answers = swapHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="word"]' }, reward: { selector: '[data-swap-reward]', kind: 'count' } },
  },
  'cvc-speller': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/CvcSpeller.tsx',
    instanceId: 'cvc',
    defaults: { grade: 'Kindergarten', mode: 'spell_word', di: false,
      topic: 'Spelling short-vowel CVC words by putting a letter in each sound box' },
    leakTokens: ['DI_CVC_ITEM', 'DI_CVC_MOVE_ON', 'DI_CVC_COMPLETE', 'DI_CVC_BUILD', 'SAY_WORD'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the middle sound or the whole word back; a spelling presses bank letters
    // into the boxes, the right word or its first letter swapped. The third letter is the commit.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current cvc-speller challenge');
      const answers = cvcHarnessAnswers(c, ctx.demand?.boxes as string | undefined)[intent === 'wrong' ? 'plainWrong' : 'correct'];
      return c.taskType === 'spell-word' ? answers.map(l => ({ type: 'choose' as const, label: `letter ${l}` }))
        : [{ type: 'answer', text: answers[0] }];
    },
    probes: { mounted: { selector: '[aria-label="hear the word"]' }, reward: { selector: '[data-cvc-reward]', kind: 'count' } },
  },
  'adaptation-investigator': {
    execution: 'teaching',
    component: 'primitives/visual-primitives/biology/AdaptationInvestigator.tsx',
    instanceId: 'adapt',
    defaults: { grade: 'Grade 1', mode: 'mixed', di: false, topic: 'Why pink flowers have bright pink petals' },
    leakTokens: [],
    // A young learner's own questions: what the picture is, why, and asking to be shown.
    prompts: { opening: 'What is that flower?', hint: 'Why is it so pink?', example: 'Can you show me?' },
    // Nothing is graded, so there is no wrong or correct: the learner opens a card still closed (the
    // tutor may already have shown one), and later opens the rest and presses Done. A card already
    // open is tapped again harmlessly.
    inputsFor: (intent, ctx) => intent === 'explore'
      ? [{ type: 'touch', target: ['trait', 'environment', 'connection'].find(c => !String(ctx.demand?.cardsOpen ?? '').includes(c)) ?? 'trait' }]
      : intent === 'finish' ? [{ type: 'touch', target: 'trait' }, { type: 'touch', target: 'environment' },
        { type: 'touch', target: 'connection' }, { type: 'choose', label: 'Done' }]
      : [],
    probes: { mounted: { selector: '[data-pip-object="trait"]' }, demonstration: { selector: '[data-tutor-ring]', kind: 'count' },
      closed: { selector: '[aria-label^="Open The"]', kind: 'count' } },
  },
  'you-and-me': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/YouAndMe.tsx',
    instanceId: 'partners',
    defaults: { grade: 'Kindergarten', mode: 'describe_action', di: false,
      topic: 'Using I and you to tell a partner what happened' },
    leakTokens: ['YOU_AND_ME_ITEM', 'YOU_AND_ME_MOVE_ON', 'YOU_AND_ME_COMPLETE', 'YOU_AND_ME_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken sentence per turn: the model sentence, or the same action with I and you swapped.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current you-and-me turn');
      const answers = youAndMeHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="scene"]' } },
  },
  'ramp-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/engineering/RampLab.tsx',
    instanceId: 'ramp',
    defaults: { grade: 'Grade 3', mode: 'compare_conditions', di: false,
      topic: 'How the angle and surface of a ramp change the push needed to move a load' },
    leakTokens: ['RAMP_EVIDENCE_ITEM', 'RAMP_EVIDENCE_HEAR', 'RAMP_EVIDENCE_MOVE', 'RAMP_EVIDENCE_DONE', 'RAMP_PLAN_RETRY'],
    prompts: WORKSPACE_PROMPTS,
    // Compare: pick a setup and reveal. Explain: predict and run both trials once, then speak the
    // supported comparison or its reverse. The slider and select modes have no driver input.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenges = ctx.data.challenges ?? [];
      const c = challenges.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current ramp-lab challenge');
      const wrong = intent === 'wrong';
      if (c.mode === 'compare_conditions') {
        const right = easierComparisonChoice(c);
        const pick = wrong ? (right === 'a' ? 'b' : 'a') : right;
        return [{ type: 'choose', label: `Setup ${pick.toUpperCase()}` }, { type: 'choose', label: 'Reveal Force Evidence' }];
      }
      if (c.mode === 'explain_from_trials') {
        const conclusion = rampConclusion(c);
        const reversed = conclusion.replace(/Setup ([AB]) needed less/, (_m: string, s: string) => `Setup ${s === 'A' ? 'B' : 'A'} needed less`);
        const speak: DriverInput = { type: 'answer', text: wrong ? reversed : conclusion };
        if (ctx.demand?.step === 'explain') return [speak];
        return [{ type: 'choose', label: 'Setup A' }, { type: 'choose', label: 'Record prediction' },
          { type: 'choose', label: 'Run trial A' }, { type: 'choose', label: 'Run trial B' },
          { type: 'choose', label: 'Explain my results' }, speak];
      }
      throw new Error(`ramp-lab ${c.mode} uses a slider or select the driver cannot set; not driven at W1`);
    },
    probes: { mounted: { selector: '[data-testid="ramp-investigation"], svg' } },
  },
  'di-shapes': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiShapes.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'name_shape', di: false,
      topic: 'Naming flat shapes: circle, square, triangle, rectangle' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the shape name or count, or a plainly different one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-shapes item');
      const answers = diShapesHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-shape-object="shape"]' }, reward: { selector: '[data-shape-credited]', kind: 'count' } },
  },
  'di-spoken-practice': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx',
    instanceId: 'spoken',
    defaults: { grade: 'Grade 1', mode: 'compare_choice', di: false,
      topic: 'Comparing lengths: longer and shorter' },
    leakTokens: ['SAY_ITEM', 'SAY_MOVE', 'SAY_HEAR', 'SAY_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the key's own words, or a plainly different answer of the same kind.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.items ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-spoken-practice item');
      const answers = diSpokenPracticeHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-spoken-object="stimulus"]' }, reward: { selector: '[data-spoken-credited]', kind: 'count' } },
  },
  'di-dice-roll': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiDiceRoll.tsx',
    instanceId: 'dice',
    defaults: { grade: 'Kindergarten', mode: 'count_pips', di: false,
      topic: 'Counting the dots on a die' },
    leakTokens: ['DICE_ITEM', 'DICE_MOVE_ON', 'DICE_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Roll first (the dice are covered until then), then one spoken answer, or a plainly different one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-dice-roll item');
      const answers = diDiceRollHarnessAnswers(c);
      const say: DriverInput = { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct };
      return ctx.demand?.rolled === 'yes' ? [say]
        : [{ type: 'choose', label: c.challengeType === 'count_pips' ? 'Roll the die' : 'Roll both dice' }, say];
    },
    probes: { mounted: { selector: '[data-dice-object="dice"]' }, reward: { selector: '[data-dice-trail]', kind: 'count' } },
  },
  'di-deduction': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiDeduction.tsx',
    instanceId: 'deduction',
    defaults: { grade: 'Grade 3', mode: 'deny', di: false,
      topic: 'Using a rule about animal groups to decide what follows' },
    leakTokens: ['DD_ITEM', 'DD_MOVE_ON', 'DD_COMPLETE', 'DD_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per case: the pack's canonical verdict and reason, or the plainest wrong verdict.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = deductionItems(ctx.data as never).find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-deduction case');
      const answers = diDeductionHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-deduction-object="rule"]' }, reward: { selector: '[data-deduction-credited]', kind: 'count' } },
  },
  'di-worked-procedure': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiWorkedProcedure.tsx',
    instanceId: 'procedure',
    defaults: { grade: 'Grade 2', mode: 'subtract_regroup', di: false,
      topic: 'Two-digit subtraction with regrouping' },
    leakTokens: ['WP_ITEM', 'WP_MOVE_ON', 'WP_COMPLETE', 'WP_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken step per item: the pack's canonical move or number, or the column's signature miss.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = workedProcedureItems(ctx.data as never).find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-worked-procedure step');
      const answers = diWorkedProcedureHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-procedure-object="problem"]' }, reward: { selector: '[data-procedure-digit]', kind: 'count' } },
  },
  'spatial-scene': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SpatialScene.tsx',
    instanceId: 'scene',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Position words: above, below, beside and next to' },
    leakTokens: ['ACTIVITY_START', 'NEXT_ITEM', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'STEP_CORRECT', 'ALL_COMPLETE', 'SPATIAL_DESCRIPTION_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a word and Check, a cell and Check, each direction step, or
    // a spoken description. Derived from the mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current spatial-scene challenge');
      return spatialHarnessInputs(c, intent === 'wrong', ctx.data.gridSize ?? 3, ctx.demand?.step as string | undefined);
    },
    probes: { mounted: { selector: '[data-pip-object^="cell-"], [aria-label="Viewer position"]' } },
  },
  'syllable-clapper': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SyllableClapper.tsx',
    instanceId: 'syllables',
    defaults: { grade: 'Kindergarten', mode: 'count_parts', di: false,
      topic: 'Counting the syllables in familiar animal words' },
    leakTokens: ['SC_ITEM', 'SC_MOVE', 'SC_COMPLETE', 'SC_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the count, the blended word or the word left, or the pack's plain wrong answer.
    inputsFor: spokenWorkspaceInputs(syllableItems, syllableHarnessAnswers, 'syllable-clapper'),
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' }, reward: { selector: '[data-testid="reveal"]', kind: 'count' } },
  },
  'rhyme-studio': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/RhymeStudio.tsx',
    instanceId: 'rhymes',
    defaults: { grade: 'Kindergarten', mode: 'recognition', di: false,
      topic: 'Hearing whether two short words rhyme' },
    leakTokens: ['RS_ITEM', 'RS_MOVE', 'RS_COMPLETE', 'RS_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: yes or no, or the rhyming choice. Production and collection have no
    // code-owned answer, so their rows throw with the mode name (undriven at W1).
    inputsFor: spokenWorkspaceInputs(
      (challenges: any[]) => challenges.flatMap(c => rhymeItems(c)), rhymeHarnessAnswers, 'rhyme-studio'),
    probes: { mounted: { selector: '[data-pip-object="target"], [data-pip-object="pair"]' } },
  },
  'phoneme-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PhonemeExplorer.tsx',
    instanceId: 'phonemes',
    defaults: { grade: 'Kindergarten', mode: 'isolate', di: false,
      topic: 'Hearing the first sound in short picture words' },
    leakTokens: ['PE_ITEM', 'PE_MOVE', 'PE_COMPLETE', 'PE_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the pack's right answer, or a real card / plainly different word.
    inputsFor: spokenWorkspaceInputs(phonemeItems, phonemeHarnessAnswers, 'phoneme-explorer'),
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-pip-object="sounds"]' } },
  },
  'word-workout': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordWorkout.tsx',
    instanceId: 'workout',
    defaults: { grade: 'Grade 1', mode: 'real_vs_nonsense', di: false,
      topic: 'Reading short-vowel CVC words and telling real words from silly ones' },
    leakTokens: ['WW_ITEM', 'WW_MOVE', 'WW_COMPLETE', 'WW_HEAR', 'WW_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken read or answer per item; picture match taps the picture (a wrong tap is another picture).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = workoutItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-workout item');
      const answers = wordWorkoutJourneyAnswers(item);
      if (answers.tapped) {
        const word = intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct;
        return [{ type: 'touch', target: `picture-${word}` }];
      }
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[aria-label="Hear the question again"]' } },
  },
  'word-builder': {
    execution: 'workspace',
    component: 'primitives/WordBuilder.tsx',
    instanceId: 'builder',
    defaults: { grade: 'Grade 4', mode: 'compound_affix', di: false,
      topic: 'Building words from prefixes, roots and suffixes' },
    leakTokens: ['WB_ITEM', 'WB_MOVE', 'WB_COMPLETE', 'WB_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item (the pool is `targets`): the word, or its parts in reverse order.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = builderItems(ctx.data.targets ?? [], ctx.data.availableParts ?? [], ctx.data.complexityLevel ?? 'compound_affix')
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-builder word');
      const answers = wordBuilderJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'word-sorter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordSorter.tsx',
    instanceId: 'sorter',
    defaults: { grade: 'Kindergarten', mode: 'binary_sort', di: false, topic: 'Sorting animals and foods' },
    leakTokens: ['WSR_ITEM', 'WSR_MOVE', 'WSR_COMPLETE', 'WSR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the right group or partner, or another printed choice.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = sorterItems(ctx.data.challenges ?? [], { tier: ctx.data.supportTier, isPreReader: (ctx.data.gradeLevel ?? 'K') === 'K' })
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-sorter item');
      const answers = wordSorterJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="word"]' } },
  },
  'picture-vocabulary': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PictureVocabulary.tsx',
    instanceId: 'vocab',
    defaults: { grade: 'Kindergarten', mode: 'naming', di: false, topic: 'Naming everyday things at home' },
    leakTokens: ['PV_ITEM', 'PV_MOVE', 'PV_COMPLETE', 'PV_HEAR', 'PV_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken word per item; listen and find taps a card (a wrong tap is another card).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = vocabItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current picture-vocabulary item');
      const answers = pictureVocabJourneyAnswers(item);
      if (answers.tapped) return [{ type: 'touch', target: `card-${intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct}` }];
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-pip-object="cards"]' } },
  },
  'letter-spotter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/LetterSpotter.tsx',
    instanceId: 'spotter',
    defaults: { grade: 'Kindergarten', mode: 'find_it', di: false, topic: 'Finding the letters s, a, t, i, p and n' },
    leakTokens: ['LSP_ITEM', 'LSP_MOVE', 'LSP_COMPLETE', 'LSP_HEAR', 'LSP_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Name it answers aloud; find it taps a grid cell and match it a little letter (a wrong tap is another letter).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = spotterItems(ctx.data.challenges ?? [], ctx.data.supportTier ?? 'medium').find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current letter-spotter item');
      const answers = letterSpotterJourneyAnswers(item);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      const letter = intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct;
      if (item.mode === 'match-it') return [{ type: 'touch', target: `option-${letter}` }];
      const cell = (item.letterGrid ?? []).findIndex(l => l.toLowerCase() === letter.toLowerCase());
      if (cell < 0) throw new Error(`letter-spotter find_it: no cell holds ${letter}`);
      return [{ type: 'touch', target: `cell-${cell}` }];
    },
    probes: { mounted: { selector: '[data-pip-object="grid"], [data-pip-object="letter"], [data-pip-object="marker"]' } },
  },
  'decodable-reader': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/DecodableReader.tsx',
    instanceId: 'decodable',
    defaults: { grade: 'Grade 1', mode: 'literal', di: false, topic: 'A short story with short-a words' },
    leakTokens: ['DR_ITEM', 'DR_MOVE', 'DR_COMPLETE', 'DR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is spoken: the printed line read aloud, a word from the story, or the right choice said.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = decodableItems(ctx.data as never).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current decodable-reader item');
      const answers = decodableReaderJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="line"], [data-pip-object="question"], [data-pip-object="story"]' } },
  },
  'interactive-book': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/InteractiveBook.tsx',
    instanceId: 'book',
    defaults: { grade: 'Kindergarten', mode: 'find-feature', di: false, topic: 'A picture book about a day at the farm' },
    leakTokens: ['IB_ITEM', 'IB_MOVE', 'IB_COMPLETE', 'IB_HEAR', 'IB_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Read the glowing word aloud; find a book part taps a printed part (a wrong tap is another part on the page).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = bookItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current interactive-book item');
      const answers = interactiveBookJourneyAnswers(item, ctx.data.books[0]);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return [{ type: 'touch', target: intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="page"]' } },
  },
  'story-bridge': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryBridge.tsx',
    instanceId: 'bridge',
    defaults: { grade: 'Kindergarten', mode: 'match_character', di: false, topic: 'Two stories about friends who share' },
    leakTokens: ['SB_ITEM', 'SB_MOVE', 'SB_COMPLETE', 'SB_HEAR', 'SB_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Say alike / different / big ideas answer aloud; the other modes tap a choice (a wrong tap is another choice).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = bridgeItems(ctx.data.challenges ?? [], ctx.data.stories ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current story-bridge item');
      const answers = storyBridgeJourneyAnswers(item);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return [{ type: 'touch', target: intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stories"]' } },
  },
  'story-ribbon': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryRibbon.tsx',
    instanceId: 'ribbon',
    defaults: { grade: 'Kindergarten', mode: 'tell_connected_account', di: false, topic: 'A day at the park' },
    leakTokens: ['SR_ITEM', 'SR_MOVE', 'SR_COMPLETE', 'SR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken account; a wrong one is a single picture label said alone. The cards are not graded.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = ribbonItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current story-ribbon item');
      const answers = storyRibbonJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="ribbon"]' } },
  },
  'addition-subtraction-scene': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AdditionSubtractionScene.tsx',
    instanceId: 'story',
    defaults: { grade: 'Kindergarten', mode: 'act_out', di: false, topic: 'Ducks joining and leaving a pond' },
    leakTokens: ['ASS_ITEM', 'ASS_MOVE', 'ASS_COMPLETE', 'ASS_HEAR', 'ASS_SCENE', 'ASS_EQUATION'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken number; tiles pressed for a number sentence; or the picture brought to a count (the add
    // button brings one in, a tap on the last object sends it away). Hands turns commit on stillness.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = addSubItems(ctx.data.challenges ?? [], { band: ctx.data.gradeBand ?? 'K' }).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current addition-subtraction-scene item');
      const answers = additionSubtractionJourneyAnswers(item);
      const wrong = intent === 'wrong';
      if (answers.tapped) return (wrong ? answers.tapped.wrong : answers.tapped.correct).split(' ')
        .map((tile): DriverInput => ({ type: 'choose', label: `Add tile ${tile}` }));
      if (answers.placed) {
        const now = Number(ctx.demand?.inPicture ?? 0);
        // A wrong scene must be a move: when one short is where the picture starts, go one past instead.
        const target = !wrong ? answers.placed.correct
          : answers.placed.wrong !== now ? answers.placed.wrong : answers.placed.correct + 1;
        return target >= now
          ? Array.from({ length: target - now }, (): DriverInput => ({ type: 'choose', label: `Add one ${item.objectType}` }))
          : Array.from({ length: now - target }, (_, i): DriverInput => ({ type: 'touch', target: `object-${now - 1 - i}` }));
      }
      return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="scene"]' } },
  },
  '3d-shape-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ThreeDShapeExplorer.tsx',
    instanceId: 'solids',
    defaults: { grade: 'Kindergarten', mode: 'identify_3d', di: false, topic: 'Naming solid shapes: cube, sphere, cylinder, cone' },
    leakTokens: ['3DS_ITEM', '3DS_MOVE', '3DS_COMPLETE', '3DS_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer (a challenge may fan out into several items).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = buildThreeDShapeItems(ctx.data.challenges ?? []).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current 3d-shape-explorer item');
      const answers = threeDShapeJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'calendar-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/calendar/CalendarExplorer.tsx',
    instanceId: 'calendar',
    defaults: { grade: 'Grade 1', mode: 'identify', di: false, topic: 'Finding dates on a monthly calendar' },
    leakTokens: ['CE_SEQUENCE_ITEM', 'CE_SEQUENCE_MOVE', 'CE_SEQUENCE_COMPLETE', 'CE_SEQUENCE_HEAR', 'ANSWER_CORRECT', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // The chain answers aloud; a grid question taps a date or an option, then Check (a wrong pick is another one).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const wrong = intent === 'wrong';
      const turn = calendarSequenceItemsFromChallenges(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (turn) {
        const answers = calendarSequenceJourneyAnswers(turn);
        return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
      }
      const c = (ctx.data.challenges ?? []).find((ch: CalendarExplorerChallenge) => ch.id === ctx.itemId) as CalendarExplorerChallenge | undefined;
      if (!c) throw new Error('No current calendar-explorer question');
      const check: DriverInput = { type: 'choose', label: 'Check Answer' };
      if (isGridDateAnswer(c)) {
        const right = Number(c.correctAnswer);
        const day = wrong ? (right > 1 ? right - 1 : right + 1) : right;
        return [{ type: 'touch', target: c.todayDate === day ? 'today' : `date-${day}` }, check];
      }
      const pick = wrong ? c.options.find(o => o.trim().toLowerCase() !== c.correctAnswer.trim().toLowerCase()) : c.correctAnswer;
      if (!pick) throw new Error(`calendar-explorer ${c.type}: no wrong option to choose`);
      return [{ type: 'choose', label: c.options.find(o => o.trim().toLowerCase() === pick.trim().toLowerCase()) ?? pick }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="grid"], [data-pip-object="offset"], [data-pip-object="stimulus"]' } },
  },
  'push-pull-arena': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/physics/PushPullArena.tsx',
    instanceId: 'arena',
    defaults: { grade: 'Grade 1', mode: 'observe', di: false, topic: 'Pushes and pulls move objects' },
    leakTokens: ['ARENA_ITEM', 'ARENA_MOVE', 'ARENA_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken word; observe first presses Go to watch the preset force.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = arenaItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current push-pull-arena item');
      const answers = pushPullArenaJourneyAnswers(item);
      const say: DriverInput = { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct };
      return item.kind === 'observe' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Go!' }, say] : [say];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'habitat-diorama': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/biology/HabitatDiorama.tsx',
    instanceId: 'habitat',
    defaults: { grade: 'Grade 2', mode: 'connect', di: false, topic: 'Animals and plants in a pond habitat depend on each other' },
    leakTokens: ['HABITAT_ITEM', 'HABITAT_GESTURE', 'HABITAT_MOVE', 'HABITAT_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Observe, predict and defend are one spoken choice; connect taps the living thing, restore the zone.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = habitatItems(ctx.data.challenges ?? [], ctx.data as never).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current habitat-diorama item');
      const answers = habitatJourneyAnswers(item);
      const pick = intent === 'wrong' ? answers.plainWrong : answers.correct;
      return [item.answerKind === 'gesture' ? { type: 'choose', label: pick } : { type: 'answer', text: pick }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'matter-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/chemistry/MatterExplorer.tsx',
    instanceId: 'matter',
    defaults: { grade: 'Kindergarten', mode: 'sort', di: false, topic: 'Solids, liquids and gases around us' },
    leakTokens: ['MEX_ITEM', 'MEX_MOVE', 'MEX_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer computed from the object.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = matterItems(ctx.data as never).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current matter-explorer item');
      const answers = matterJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'states-of-matter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/chemistry/StatesOfMatter.tsx',
    instanceId: 'states',
    defaults: { grade: 'Grade 2', mode: 'observe', di: false, topic: 'Heating and cooling change solids, liquids and gases' },
    leakTokens: ['SOM_ITEM', 'SOM_MOVE', 'SOM_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer computed from the substance table.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = statesItems(ctx.data as never).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current states-of-matter item');
      const answers = statesJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'solar-system-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/astronomy/SolarSystemExplorer.tsx',
    instanceId: 'solar',
    defaults: { grade: 'Grade 2', mode: 'identify', di: false, topic: 'The planets of our solar system' },
    leakTokens: ['SOLAR_ITEM', 'SOLAR_MOVE', 'SOLAR_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken planet name computed from the bodies on screen.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = solarItems(ctx.data as never).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current solar-system-explorer item');
      const answers = solarJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
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
