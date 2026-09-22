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

/** One real learner action for the mounted driver to perform. */
export type DriverInput =
  | { type: 'place'; value: number }
  | { type: 'check' }
  | { type: 'touch'; index: number }
  | { type: 'give' }
  | { type: 'choose'; label: string }
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
    component: 'primitives/visual-primitives/math/NumberLine.tsx',
    instanceId: 'line',
    defaults: { grade: 'Grade 1', mode: 'jump', di: false,
      topic: 'Subtract within 10: two independent single backward jumps, each taking away 1 to 4, starting at 5 to 9. No addition.' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE'],
    prompts: {
      opening: 'Please read my current number-line instruction so I can begin.',
      retry: 'Please clear my incorrect response so I can try this same problem again.',
      replay: 'Please repeat this same instruction using the replay action.',
      hint: 'Please show the spaces reminder on my screen.',
      fade: 'Please hide the reminder now.',
      example: 'Please open the worked example and save my unfinished number line.',
      return: 'Please close the example and return to my saved number line.',
    },
    // The landing the jump actually reaches; one past it is the wrong placement the
    // real component must reject. Derived from the mounted challenge, not from Python.
    inputsFor: (intent, ctx) => {
      const landing = ctx.challenge?.targetValues?.[0];
      if (intent === 'warmup' || typeof landing !== 'number') return [];
      return [{ type: 'place', value: intent === 'wrong' ? landing + 1 : landing }, { type: 'check' }];
    },
    probes: { mounted: { selector: 'svg[viewBox="0 0 760 240"]' },
      promptFocused: { selector: '[aria-label="Current instruction"]', kind: 'focused' } },
  },

  'ten-frame': {
    component: 'primitives/visual-primitives/math/TenFrame.tsx',
    instanceId: 'frame',
    defaults: { grade: 'Grade 1', mode: 'make_ten', di: true,
      topic: 'Make ten: how many more counters are needed' },
    leakTokens: ['TF_'],
    prompts: {
      hint: 'Please show me a counting hint for this task.',
      example: 'Please show the worked example and save my unfinished frame.',
      return: 'Please close the example and return to my saved frame.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
    // A make-ten or take-away example IS its quantities; a turn that omits them has
    // announced an example rather than taught one.
    exampleTaught: (artifact, text) => {
      return omittedQuantities(artifact, text);
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
    component: 'primitives/visual-primitives/math/NumberBond.tsx',
    instanceId: 'bond',
    defaults: { grade: 'Grade 1', mode: 'missing_part', di: true,
      topic: 'Finding the missing part of a number bond within ten' },
    leakTokens: ['NB_', 'NS_HEAR'],
    prompts: {
      hint: 'Please show me a reminder for how to find this part.',
      fade: 'Please hide the reminder now.',
      replay: 'Please ask me about this same bond again.',
      example: 'Please show the worked example and save my unfinished bond.',
      return: 'Please close the example and return to my saved bond.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
    // A bond example IS its three numbers: part, part and whole. A turn that
    // announces an example without saying them has not taught the relationship.
    exampleTaught: (artifact, text) => {
      return omittedQuantities(artifact, text);
    },
    probes: { mounted: { selector: '[data-pip-dock]' } },
  },
  'ordinal-line': {
    component: 'primitives/visual-primitives/math/OrdinalLine.tsx',
    instanceId: 'line-up',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: true,
      topic: 'Saying which place someone is standing in a line' },
    leakTokens: ['OL_'],
    // No example or return prompt: the example surface states HOW MANY and every
    // mode here teaches WHICH PLACE, so this family advertises no artifact. A
    // journey that asked for one would score the runtime for refusing correctly.
    prompts: {
      hint: 'Please show me a reminder for how to work out the place.',
      fade: 'Please hide the reminder now.',
      replay: 'Please ask me about this same line again.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
    probes: { mounted: { selector: '[data-pip-object="stage"]' } },
  },
  'sorting-station': {
    component: 'primitives/visual-primitives/math/SortingStation.tsx',
    instanceId: 'station',
    defaults: { grade: 'Kindergarten', mode: 'sort_one', di: true,
      topic: 'Sorting objects into groups by one attribute' },
    leakTokens: ['SS_'],
    // No example or return prompt: the example surface draws identical counters,
    // which have no attribute to sort by, so this family advertises no artifact.
    prompts: {
      hint: 'Please show me a reminder for how to work this out.',
      fade: 'Please hide the reminder now.',
      replay: 'Please ask me this same sorting question again.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
    probes: { mounted: { selector: '[data-pip-object^="tray-"]', kind: 'count' } },
  },
  'number-tracer': {
    component: 'primitives/visual-primitives/math/NumberTracer.tsx',
    instanceId: 'tracer',
    defaults: { grade: 'Kindergarten', mode: 'trace', di: false,
      topic: 'Writing the numerals zero through five' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    // No example or return prompt: a row of counters cannot show how a numeral is
    // formed, so this family advertises no artifact.
    prompts: {
      opening: 'Please read my current writing instruction so I can begin.',
      retry: 'Please clear my drawing so I can try this same number again.',
      replay: 'Please repeat this same instruction using the replay action.',
      hint: 'Please show me a reminder for how to write this.',
      fade: 'Please hide the reminder now.',
    },
    // The driver has no drawing verb, so the tracer's own intents are DOM-free:
    // the journey certifies the command surface, and the stroke gesture is a
    // browser gate rather than a machine one. Recorded as a limitation, not faked.
    inputsFor: () => [],
    probes: { mounted: { selector: 'canvas' },
      promptFocused: { selector: '[aria-label="Current instruction"]', kind: 'focused' } },
  },
  'comparison-builder': {
    component: 'primitives/visual-primitives/math/ComparisonBuilder.tsx',
    instanceId: 'compare',
    // Grade 1, because that is the band with labelled choice buttons and a Check
    // button the driver can press. Kindergarten answers by tapping the group
    // pictures themselves, which is an SVG gesture the driver has no verb for.
    defaults: { grade: 'Grade 1', mode: 'compare_groups', di: false,
      topic: 'Deciding which of two groups has more' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'DISAMBIGUATE'],
    prompts: {
      opening: 'Please read my current comparison instruction so I can begin.',
      retry: 'Please clear my answer so I can try this same comparison again.',
      replay: 'Please repeat this same instruction using the replay action.',
      hint: 'Please show me a reminder for how to work this out.',
      fade: 'Please hide the reminder now.',
      example: 'I still cannot see it. Please show me an example with different groups and save my work.',
      return: 'Please close the example and return to my saved comparison.',
    },
    // compare-groups only: the wrong choice is the OPPOSITE comparison word, never
    // "the same", so the misstep the aids route on is the one the child made.
    // The other three modes still have no driver verb and return nothing.
    inputsFor: (intent, ctx) => {
      const c = ctx.challenge;
      if (intent === 'warmup' || c?.type !== 'compare-groups' || !c.correctAnswer) return [];
      const label = (answer: string) => answer === 'equal' ? 'The Same' : answer === 'more' ? 'More' : 'Fewer';
      const wrong = c.correctAnswer === 'more' ? 'less' : 'more';
      return [{ type: 'choose', label: label(intent === 'wrong' ? wrong : c.correctAnswer) }, { type: 'check' }];
    },
    // A contrast pair IS its two counts and the relationship between them. A turn
    // that names neither the counts nor which row has counters left over has
    // announced a picture, not taught a comparison.
    exampleTaught: (artifact, text) => {
      if (artifact.kind !== 'contrast-pair') return `Expected a contrast pair, got ${artifact.kind}`;
      const missing = artifact.panels.map(p => p.count).filter(n => !says(text, n));
      if (missing.length) return `Contrast omitted its counts: ${missing.join(', ')}`;
      return /\b(more|fewer|less|bigger|smaller|same|equal|left over|extra|partner)\b/i.test(text)
        ? null : 'Contrast did not state the relationship between the two rows';
    },
    probes: { mounted: { selector: '[data-pip-dock]' },
      promptFocused: { selector: '[aria-label="Current instruction"]', kind: 'focused' },
      contrastRows: { selector: '[data-contrast-row]', kind: 'count' } },
  },
  'compare-objects': {
    component: 'primitives/visual-primitives/math/CompareObjects.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'compare_two', di: true,
      topic: 'Deciding which of two objects is longer' },
    leakTokens: ['CO_'],
    // No example or return prompt: the example surface states HOW MANY and every
    // mode here compares a continuous attribute, so no artifact is advertised.
    prompts: {
      hint: 'Please show me a reminder for how to work this out.',
      fade: 'Please hide the reminder now.',
      replay: 'Please ask me this same comparison again.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
    probes: { mounted: { selector: '[data-pip-object="drawing"]' } },
  },
  'place-value-chart': {
    component: 'primitives/visual-primitives/math/PlaceValueChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 2', mode: 'compare', di: true,
      topic: 'What a digit is worth in the tens and ones places' },
    leakTokens: ['PV_'],
    // No example or return prompt: one flat row of counters has no positions, and
    // position carrying magnitude is the whole of this primitive's teaching.
    prompts: {
      hint: 'Please show me a reminder for how to work this out.',
      fade: 'Please hide the reminder now.',
      replay: 'Please ask me about this same chart again.',
    },
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : spoken(ctx, intent === 'wrong' ? 'plainWrong' : 'correct'),
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
