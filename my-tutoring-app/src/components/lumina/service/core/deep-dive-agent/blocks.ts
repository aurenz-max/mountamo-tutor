/**
 * Block tools for the agentic DeepDive author: one function declaration per
 * block type, a builder that turns the agent's arguments into the block the
 * renderer reads, and the code checks the agent sees after every write.
 *
 * The agent writes every block's content itself. Code owns what code can
 * decide: option order (the agent gives the answer and the distractors, code
 * shuffles), blanking the fill-in-blank word, which interaction mode a block
 * runs in at this eval mode, and the structural and leak checks below.
 */

import { Type, type FunctionDeclaration, type Schema } from '@google/genai';
import { shuffleIndexedChoices } from '../../../utils/choiceOrder';
import { hasMath, mathIssues, splitMath } from '../../../utils/mathText';
import { tryEvaluateKatex } from '../../annotated-example/mathEvaluator';
import type { ChartInset, DefinitionBoxInset, NumberLineInset, PassageInset } from '../../../types';
import type {
  BlockType,
  ChartBlockData,
  DefinitionBlockData,
  NumberLineBlockData,
  PassageBlockData,
  WorkedExampleBlockData,
  ProcessBlockData,
  MisconceptionBlockData,
  CompareContrastBlockData,
  DataTableBlockData,
  DeepDiveBlock,
  DiagramBlockData,
  FillInBlankBlockData,
  HeroImageBlockData,
  HypothesisLabBlockData,
  HypothesisVariableRole,
  KeyFactsBlockData,
  MiniSimBlockData,
  MultipleChoiceBlockData,
  PerspectivesBlockData,
  ProseBlockData,
  PullQuoteBlockData,
  TimelineBlockData,
} from '../../../primitives/visual-primitives/core/deep-dive/types';

// ── Context ──────────────────────────────────────────────────────────

export interface BlockContext {
  evalMode?: string;
  preReader: boolean;
  /** Numeric grade when known (K = 0); drives the sentence-length advisory. */
  grade?: number;
  /** True when this audience has drawers to embed (drawerMenu is not empty). */
  drawers?: boolean;
}

const hardTier = (m?: string) => m === 'apply' || m === 'analyze';

/** Which interaction each block runs in at this eval mode. Code-owned, never the agent's choice. */
export function tierModes(evalMode?: string) {
  return {
    compareSort: evalMode === 'recall' || hardTier(evalMode),
    timelineOrder: hardTier(evalMode),
    diagramLabel: hardTier(evalMode),
    tablePattern: hardTier(evalMode),
    workedTry: hardTier(evalMode),
  };
}

export const PRE_READER_BLOCKED = new Set<BlockType>(['fill-in-blank', 'data-table', 'timeline', 'compare-contrast', 'perspectives', 'hypothesis-lab', 'chart', 'definition', 'passage', 'misconception']);

/** Longest passage the student reads in one block, in words, by grade. */
export const passageLimit = (grade?: number) => (grade === undefined ? 300 : grade <= 3 ? 120 : grade <= 5 ? 200 : 300);

// ── Shared schema pieces ─────────────────────────────────────────────

const S = (description: string): Schema => ({ type: Type.STRING, description });
const strings = (description: string): Schema => ({ type: Type.ARRAY, items: { type: Type.STRING }, description });

const CHOICE: Schema = {
  type: Type.OBJECT,
  description: 'A closed question. Give the right answer and three wrong ones separately; code shuffles them.',
  properties: {
    question: S('The question. It must not contain or hint at the answer.'),
    answer: S('The correct option, written like the distractors (similar length and form).'),
    distractors: strings('Exactly 3 wrong options. Each is what a student who misunderstood would actually believe; never silly, magical or a joke. Each is actually wrong.'),
    explanation: S('Why the answer is right, 1-3 sentences; shown after the student answers.'),
    answerEmoji: { type: Type.STRING, nullable: true, description: 'Pre-reader lessons only: one emoji depicting the answer.' },
    distractorEmojis: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: 'Pre-reader lessons only: one emoji per distractor, same order.' },
  },
  required: ['question', 'answer', 'distractors', 'explanation'],
};

/** Where a block sits in the outline; shared with embed_primitive. */
export const SECTION_FIELDS: Record<string, Schema> = {
  section: { type: Type.INTEGER, description: 'The outline section this block belongs to, 1-based. Blocks go in section order.' },
  ideas: strings('The key ideas this block teaches (a display or explanation) or tests (a check), as "section.idea" refs from the outline, e.g. ["2.1"]. Empty only for a hero image.'),
};

const COMMON: Record<string, Schema> = {
  label: S('Short section heading shown above the block. Never names the answer to a check.'),
  tutoringBrief: S('One sentence: what the tutor says or does while the student is on this block.'),
  transitionCue: S('One short sentence linking this block to the next.'),
  replaceIndex: { type: Type.INTEGER, nullable: true, description: 'Omit to append. Set to a 0-based index to replace that block in place.' },
  ...SECTION_FIELDS,
};
const COMMON_REQUIRED = ['label', 'tutoringBrief', 'transitionCue', 'section', 'ideas'];

function blockTool(name: string, description: string, properties: Record<string, Schema>, required: string[]): FunctionDeclaration {
  return { name, description, parameters: { type: Type.OBJECT, properties: { ...properties, ...COMMON }, required: [...required, ...COMMON_REQUIRED] } };
}

/** Function declarations for the block tools, filtered to what this audience can use. */
export function blockTools(ctx: BlockContext): FunctionDeclaration[] {
  const modes = tierModes(ctx.evalMode);
  const all: Array<[BlockType, FunctionDeclaration]> = [
    ['hero-image', blockTool('write_hero_image', 'An illustration that anchors attention on the topic. Display only. The image renders in the background.', {
      imagePrompt: S('Detailed scene for the image model: subject, setting, composition. No text in the image.'),
      caption: S('One-sentence caption.'),
      altText: S('Accessible description of the image.'),
    }, ['imagePrompt', 'caption', 'altText'])],
    ['key-facts', blockTool('write_key_facts', 'Flip cards: front shows an emoji and a teaser headline, back shows the fact. Display only.', {
      facts: {
        type: Type.ARRAY, description: '3-5 facts.',
        items: { type: Type.OBJECT, properties: { icon: S('One emoji that depicts the fact.'), headline: S('2-4 word teaser that does not give the fact away.'), text: S('The fact, one or two sentences.') }, required: ['icon', 'headline', 'text'] },
      },
    }, ['facts'])],
    ['prose', blockTool('write_prose', 'Explanatory text that says why or how. Display only.', {
      paragraphs: strings('1-4 paragraphs, 2-4 sentences each (pre-readers: at most 2 paragraphs of 2-3 short sentences).'),
      layout: { type: Type.STRING, enum: ['flow', 'masonry', 'columns'], nullable: true, description: 'flow (default); masonry = each short paragraph becomes a card (3-4+ one-to-two-sentence paragraphs); columns = newspaper columns for longer text.' },
      reveal: { type: Type.BOOLEAN, nullable: true, description: 'Lines animate in on scroll; for a dramatic or climactic passage.' },
      insetFacts: { type: Type.ARRAY, nullable: true, description: 'Optional 3 takeaways shown in a card beside the text.', items: { type: Type.OBJECT, properties: { icon: S('Emoji'), text: S('Takeaway') }, required: ['icon', 'text'] } },
      figurePrompt: { type: Type.STRING, nullable: true, description: 'Optional inline illustration: the scene to draw. Leave empty unless a picture explains something the words cannot.' },
      figureCaption: { type: Type.STRING, nullable: true, description: 'Caption for the figure.' },
    }, ['paragraphs'])],
    ['pull-quote', blockTool('write_pull_quote', 'One or two sentences that state the key insight of the blocks just before it, set large. Display only.', {
      text: S('The insight, at most 2 sentences.'),
      attribution: { type: Type.STRING, nullable: true, description: 'Optional source or concept area.' },
    }, ['text'])],
    ['data-table', blockTool('write_data_table', `A table of real data. ${modes.tablePattern ? 'At this level it MUST carry a patternCheck: a question answered only by comparing two or more rows.' : 'Display only at this level; patternCheck is ignored.'}`, {
      caption: S('Short caption.'),
      headers: strings('2-4 column headers.'),
      rows: { type: Type.ARRAY, description: '3-6 rows; each row has one cell per header.', items: { type: Type.OBJECT, properties: { cells: strings('Cells in header order.') }, required: ['cells'] } },
      patternCheck: { ...CHOICE, nullable: true },
    }, ['caption', 'headers', 'rows'])],
    ['multiple-choice', blockTool('write_multiple_choice', 'A comprehension check (evaluable). It tests something a block above it taught.', {
      check: CHOICE,
    }, ['check'])],
    ['fill-in-blank', blockTool('write_fill_in_blank', 'A vocabulary recall check (evaluable): code blanks one word of the sentence and the student picks it from a word bank.', {
      sentence: S('A complete sentence that contains the answer word exactly once.'),
      answer: S('The single key word to blank (not "the", "is", ...). Must appear in the sentence exactly once.'),
      distractors: strings('Exactly 3 wrong words of the same kind (all nouns, all verbs, ...) that fit the grammar.'),
    }, ['sentence', 'answer', 'distractors'])],
    ['timeline', blockTool('write_timeline', `3-6 events in true chronological order. ${modes.timelineOrder ? 'At this level the events are SHUFFLED and the student puts them in order (evaluable): no sequence words (then, next, after, finally, later) and no event may mention another.' : 'Display only at this level.'}`, {
      events: { type: Type.ARRAY, description: 'Earliest first.', items: { type: Type.OBJECT, properties: { date: S('Year, decade or period.'), title: S('Short title.'), description: S('1-2 sentences.') }, required: ['date', 'title', 'description'] } },
    }, ['events'])],
    ['compare-contrast', blockTool('write_compare_contrast', `Two items side by side, 3-4 points each. ${modes.compareSort ? 'At this level the points are POOLED and the student sorts each to its item (evaluable): no point may contain either item\'s name; it must be sortable by meaning.' : 'Display only at this level.'}`, {
      itemA: { type: Type.OBJECT, properties: { title: S('Item A'), points: strings('3-4 points') }, required: ['title', 'points'] },
      itemB: { type: Type.OBJECT, properties: { title: S('Item B'), points: strings('3-4 points') }, required: ['title', 'points'] },
    }, ['itemA', 'itemB'])],
    ['diagram', blockTool('write_diagram', `A generated picture with 4-6 labelled parts, for when how parts sit together IS the idea. ${modes.diagramLabel ? 'At this level the student drags the labels onto the picture (evaluable).' : 'At this level labels are placed and the student taps them to read (display).'} The image renders in the background.`, {
      imagePrompt: S('The picture: each labelled part spatially distinct, dark background, bright elements, NO text in the image.'),
      caption: S('Caption.'),
      altText: S('Accessible description.'),
      learningObjective: S('What the student should understand from the diagram.'),
      labels: { type: Type.ARRAY, description: '4-6 labels.', items: { type: Type.OBJECT, properties: { text: S('Part name.'), description: S('What it is and why it matters, 1-2 sentences.') }, required: ['text', 'description'] } },
    }, ['imagePrompt', 'caption', 'altText', 'learningObjective', 'labels'])],
    ['mini-sim', blockTool('write_mini_sim', 'A "what if" experiment (evaluable): the student predicts first, then moves ONE control and sees each state.', {
      scenario: S('The setup, 2-3 sentences.'),
      controlType: { type: Type.STRING, enum: ['toggle', 'slider'] },
      controlLabel: S('Label above the control.'),
      toggleOffLabel: { type: Type.STRING, nullable: true },
      toggleOnLabel: { type: Type.STRING, nullable: true },
      slider: { type: Type.OBJECT, nullable: true, properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER }, step: { type: Type.NUMBER }, unit: { type: Type.STRING }, start: { type: Type.NUMBER } }, required: ['min', 'max', 'step', 'unit', 'start'] },
      states: {
        type: Type.ARRAY, description: 'Toggle: exactly 2 states with condition "off" and "on". Slider: 2-4 states with condition "lo-hi" ranges that cover min..max without gaps.',
        items: { type: Type.OBJECT, properties: { condition: S('"off"/"on" or "lo-hi"'), title: S('What happens'), description: S('What the student observes, 1-3 sentences'), keyObservation: S('The insight, one sentence') }, required: ['condition', 'title', 'description', 'keyObservation'] },
      },
      prediction: CHOICE,
    }, ['scenario', 'controlType', 'controlLabel', 'states', 'prediction'])],
    ['perspectives', blockTool('write_perspectives', 'Two to four first-person accounts of the SAME event from people whose views genuinely differ, plus a check that needs comparing them (evaluable).', {
      eventDescription: S('Neutral one-to-two sentence framing of the event.'),
      perspectives: { type: Type.ARRAY, description: '2-4 voices.', items: { type: Type.OBJECT, properties: { name: S('Speaker'), role: S('Who they are: role, group, place, time'), narrative: strings('1-2 first-person paragraphs') }, required: ['name', 'role', 'narrative'] } },
      comprehension: CHOICE,
    }, ['eventDescription', 'perspectives', 'comprehension'])],
    ['hypothesis-lab', blockTool('write_hypothesis_lab', 'Experimental design check (evaluable): the student sorts the factors of a described experiment into changed, measured and kept-the-same.', {
      scenario: S('2-4 sentences describing the experiment in plain words. Never says which factor is which and never uses the words variable, control or constant.'),
      variables: { type: Type.ARRAY, description: '4-6 factors: exactly one iv, exactly one dv (measurable), at least one control, at most two irrelevant distractors.', items: { type: Type.OBJECT, properties: { label: S('Short noun phrase as it appears in the scenario'), role: { type: Type.STRING, enum: ['iv', 'dv', 'control', 'irrelevant'] } }, required: ['label', 'role'] } },
      explanation: S('Why each role is what it is, 2-3 sentences.'),
    }, ['scenario', 'variables', 'explanation'])],
    ['worked-example', blockTool('write_worked_example', `A solved problem shown one step at a time, each step with the reason for that move, for when HOW to solve is the idea. Math in $...$; every numeric equation is checked by code. ${modes.workedTry ? 'At this level it MUST carry tryStep: the student picks that step\'s line from four before it is shown (evaluable).' : 'Display only at this level; tryStep is ignored.'}`, {
      problem: S('The problem as posed, with its numbers.'),
      steps: { type: Type.ARRAY, description: '2-6 steps in order. Each is one move: the line written down and why.', items: { type: Type.OBJECT, properties: { work: S('The line written down, e.g. "$2x = 8$".'), reason: S('Why this move, one short sentence ("Subtract 3 from both sides").') }, required: ['work', 'reason'] } },
      answer: S('The result in words and math, e.g. "$x = 4$, because $2(4) + 3 = 11$".'),
      tryStep: {
        type: Type.OBJECT, nullable: true, description: 'The step the student does. Pick one that needs the idea the lesson teaches, not the first copy-down step.',
        properties: {
          step: { type: Type.INTEGER, description: '1-based step number, 2 or later.' },
          distractors: strings('Exactly 3 wrong versions of that step\'s line, each the result of a real error at this move (sign slip, wrong operation, one side only).'),
          explanation: S('Why the right line follows from the one before it, 1-2 sentences; shown after the student answers.'),
        },
        required: ['step', 'distractors', 'explanation'],
      },
    }, ['problem', 'steps', 'answer'])],
    ['process', blockTool('write_process', `The stages of a one-way process in order, from a start to an end, for when the order of stages IS the idea: how a bill becomes law, digestion, the steps of an experiment, how a seed becomes a plant. Display only; the student taps a stage to hear more. Use a timeline when the stages are dated events${ctx.drawers ? ', and the cycle wheel display (embed_primitive) when the last stage leads back to the first' : ''}.`, {
      stages: { type: Type.ARRAY, description: '3-6 stages in order.', items: { type: Type.OBJECT, properties: { icon: S('One emoji for the stage.'), title: S('2-4 word stage name.'), description: S('What happens at this stage, one or two sentences.') }, required: ['icon', 'title', 'description'] } },
    }, ['stages'])],
    ['misconception', blockTool('write_misconception', 'A wrong idea students at this grade really hold about the topic, set against what is true and the evidence that settles it. Display only. Place it where the lesson has just given the evidence or is about to; never right before a check whose answer it states.', {
      belief: S('The wrong idea, in a student\'s own words ("Heavy things fall faster").'),
      actually: S('What is true, one sentence.'),
      why: S('The evidence or reasoning that settles it, 1-2 sentences.'),
    }, ['belief', 'actually', 'why'])],
    ['chart', blockTool('write_chart', 'Real data drawn as a chart, for when the shape of the data is the idea: line for change over time, bar to compare amounts, pie for parts of a whole. Display only. Values are real and specific; the caption names the source. Text on the chart is plain (no $...$).', {
      chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
      title: S('What the chart shows, with units.'),
      xLabel: { type: Type.STRING, nullable: true, description: 'Bar and line: what the labels are (e.g. "Year").' },
      yLabel: { type: Type.STRING, nullable: true, description: 'Bar and line: what the values measure, with units.' },
      data: { type: Type.ARRAY, description: '2-12 points in display order (time order for a line); a pie has 2-6 slices.', items: { type: Type.OBJECT, properties: { label: S('Category or time'), value: { type: Type.NUMBER } }, required: ['label', 'value'] } },
      caption: S('Where the data comes from, one short sentence. Never states what a later check asks.'),
    }, ['chartType', 'title', 'data', 'caption'])],
    ['number-line', blockTool('write_number_line', 'A number line with labelled points and an optional shaded interval, for when where numbers sit is the idea: order, distance, fractions, negatives, rounding, an inequality. Display only. Labels are plain text (1/2, -3, x), no $...$.', {
      min: { type: Type.NUMBER }, max: { type: Type.NUMBER },
      step: { type: Type.NUMBER, description: 'Tick spacing; must split max - min into at most 20 equal parts.' },
      points: { type: Type.ARRAY, nullable: true, description: '0-8 marked points.', items: { type: Type.OBJECT, properties: { value: { type: Type.NUMBER }, label: S('Short plain label') }, required: ['value', 'label'] } },
      region: { type: Type.OBJECT, nullable: true, description: 'A shaded interval.', properties: { from: { type: Type.NUMBER }, to: { type: Type.NUMBER }, label: { type: Type.STRING, nullable: true } }, required: ['from', 'to'] },
      caption: S('One sentence on what the line shows.'),
    }, ['min', 'max', 'step', 'caption'])],
    ['definition', blockTool('write_definition', 'One term the rest of the lesson depends on: its meaning in this reader\'s words and an example. Display only. Use it the first time the term matters, not for every new word.', {
      term: S('The term.'),
      definition: S('What it means, one or two sentences, without using the term itself.'),
      partOfSpeech: { type: Type.STRING, nullable: true, description: 'noun, verb, ... (vocabulary lessons only).' },
      example: S('One sentence or case that uses the term.'),
    }, ['term', 'definition', 'example'])],
    ['passage', blockTool('write_passage', 'A text the student reads closely: a primary source, a poem, a letter, a famous speech, a short excerpt. Display only; a check below can ask about it. Quote a real text exactly, or start the attribution with "Adapted from"; never invent words and put them in a real person\'s mouth.', {
      format: { type: Type.STRING, enum: ['prose', 'poem', 'quote', 'letter', 'source'], description: 'poem keeps line breaks and numbers lines; source is a document excerpt.' },
      text: S('The text. Use \\n for line breaks in a poem or letter.'),
      attribution: S('Who wrote or said it, and when ("Frederick Douglass, 1852"). Required except for prose.'),
      intro: S('One sentence above the text: what to read it for. Never the answer to a check.'),
    }, ['format', 'text', 'attribution', 'intro'])],
  ];
  return all.filter(([type]) => !(ctx.preReader && PRE_READER_BLOCKED.has(type))).map(([, decl]) => decl);
}

export const TOOL_TO_BLOCK: Record<string, BlockType> = {
  write_hero_image: 'hero-image',
  write_key_facts: 'key-facts',
  write_prose: 'prose',
  write_pull_quote: 'pull-quote',
  write_data_table: 'data-table',
  write_multiple_choice: 'multiple-choice',
  write_fill_in_blank: 'fill-in-blank',
  write_timeline: 'timeline',
  write_compare_contrast: 'compare-contrast',
  write_diagram: 'diagram',
  write_mini_sim: 'mini-sim',
  write_perspectives: 'perspectives',
  write_hypothesis_lab: 'hypothesis-lab',
  write_worked_example: 'worked-example',
  write_process: 'process',
  write_misconception: 'misconception',
  write_chart: 'chart',
  write_number_line: 'number-line',
  write_definition: 'definition',
  write_passage: 'passage',
};

// ── Building ─────────────────────────────────────────────────────────

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Args => !!x && typeof x === 'object') : []);
const obj = (v: unknown): Args | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Args) : undefined);

/** The block's outline placement: 0-based section and its idea refs. */
export function placement(args: Args): { section?: number; ideas: string[] } {
  const n = Number(args.section);
  return { ...(Number.isInteger(n) && n >= 1 ? { section: n - 1 } : {}), ideas: strs(args.ideas) };
}

/** Two lines are the same when they differ only in spacing and `$` delimiters. */
const sameLine = (s: string) => s.replace(/\$/g, '').replace(/\s+/g, '');

/**
 * Every all-numeric equation in a string that does not hold ("$3 + 1 = 5$"), as "3 + 1 = 5". Only expressions with no
 * letter left after LaTeX commands are checked; an equation with a variable is the agent's to get right.
 */
export function falseEquations(text: string): string[] {
  const bad: string[] = [];
  for (const seg of splitMath(text)) {
    if (seg.kind !== 'math' || !seg.tex.includes('=')) continue;
    const sides = seg.tex.split(/(?<![<>!\\])=/).map((x) => x.trim());
    if (sides.length < 2 || sides.some((x) => !x || /[A-Za-z]/.test(x.replace(/\\[A-Za-z]+/g, '')) || /\\(neq|approx|ne|circ)\b|%|\\[a-z]*text/.test(x))) continue;
    const values = sides.map((x) => tryEvaluateKatex(x));
    if (values.some((v) => v === null)) continue;
    if (values.some((v) => Math.abs((v as number) - (values[0] as number)) > 1e-6 * Math.max(1, Math.abs(values[0] as number)))) bad.push(seg.tex);
  }
  return bad;
}

/** The first string that carries `$...$` math, for fields drawn as plain text (SVG and chart labels). */
const plainText = (values: Array<string | undefined>) => values.find((v) => v && hasMath(v));

type Choice = { question: string; options: string[]; correctIndex: number; explanation: string; optionEmojis?: string[] };

function buildChoice(raw: Args | undefined, seed: string): Choice | { error: string } {
  if (!raw) return { error: 'missing question' };
  const question = str(raw.question);
  const answer = str(raw.answer);
  const distractors = strs(raw.distractors);
  if (!question || !answer) return { error: 'question and answer are required' };
  if (distractors.length !== 3) return { error: `need exactly 3 distractors, got ${distractors.length}` };
  const shuffled = shuffleIndexedChoices([answer, ...distractors], 0, `${seed}|${question}`);
  const emojis = [str(raw.answerEmoji), ...strs(raw.distractorEmojis)];
  const optionEmojis = emojis.length === 4 && emojis.every(Boolean) ? shuffled.order.map((i) => emojis[i]) : undefined;
  return { question, options: shuffled.options, correctIndex: shuffled.correctIndex, explanation: str(raw.explanation), ...(optionEmojis ? { optionEmojis } : {}) };
}

/** The block, or an error the agent must fix before the block exists. Images are filled in later. */
export function buildBlock(type: BlockType, args: Args, ctx: BlockContext): DeepDiveBlock | { error: string } {
  const modes = tierModes(ctx.evalMode);
  const base = { id: '', label: str(args.label) || type, tutoringBrief: str(args.tutoringBrief), transitionCue: str(args.transitionCue), ...placement(args) };
  if (ctx.preReader && PRE_READER_BLOCKED.has(type)) return { error: `${type} needs reading; pre-readers cannot use it` };
  const choiceOr = (raw: unknown, seed: string) => buildChoice(obj(raw), seed);

  switch (type) {
    case 'hero-image':
      return { ...base, blockType: 'hero-image', imageBase64: '', caption: str(args.caption), altText: str(args.altText) } as HeroImageBlockData;
    case 'key-facts': {
      const facts = objs(args.facts).map((f) => ({ icon: str(f.icon), headline: str(f.headline) || undefined, text: str(f.text) })).filter((f) => f.icon && f.text);
      if (facts.length < 2) return { error: 'key facts need 3-5 facts with icon and text' };
      return { ...base, blockType: 'key-facts', facts } as KeyFactsBlockData;
    }
    case 'prose': {
      const paragraphs = strs(args.paragraphs);
      if (!paragraphs.length) return { error: 'prose needs at least one paragraph' };
      const inset = objs(args.insetFacts).map((f) => ({ icon: str(f.icon), text: str(f.text) })).filter((f) => f.icon && f.text);
      const layout = str(args.layout);
      return {
        ...base, blockType: 'prose', paragraphs,
        ...(inset.length && !ctx.preReader ? { insetFacts: { facts: inset, placement: 'right' as const } } : {}),
        ...(layout === 'masonry' || layout === 'columns' ? { layout } : {}),
        ...(args.reveal === true ? { reveal: true } : {}),
      } as ProseBlockData;
    }
    case 'pull-quote': {
      const text = str(args.text);
      if (!text) return { error: 'pull quote needs text' };
      return { ...base, blockType: 'pull-quote', text, attribution: str(args.attribution) || undefined } as PullQuoteBlockData;
    }
    case 'data-table': {
      const headers = strs(args.headers);
      const rows = objs(args.rows).map((r) => strs(r.cells));
      if (headers.length < 2) return { error: 'a table needs at least 2 headers' };
      const bad = rows.findIndex((r) => r.length !== headers.length);
      if (bad >= 0) return { error: `row ${bad} has ${rows[bad].length} cells but there are ${headers.length} headers` };
      if (rows.length < 2) return { error: 'a table needs at least 3 rows' };
      let patternCheck: DataTableBlockData['patternCheck'];
      if (modes.tablePattern) {
        const c = choiceOr(args.patternCheck, 'deep-dive-table');
        if ('error' in c) return { error: `patternCheck: ${c.error}` };
        patternCheck = { question: c.question, options: c.options, correctIndex: c.correctIndex, explanation: c.explanation };
      }
      return { ...base, blockType: 'data-table', headers, rows, caption: str(args.caption), ...(patternCheck ? { patternCheck } : {}) } as DataTableBlockData;
    }
    case 'multiple-choice': {
      const c = choiceOr(args.check, 'deep-dive-mcq');
      if ('error' in c) return c;
      return { ...base, blockType: 'multiple-choice', ...c } as MultipleChoiceBlockData;
    }
    case 'fill-in-blank': {
      const sentence = str(args.sentence);
      const answer = str(args.answer);
      const distractors = strs(args.distractors);
      if (!sentence || !answer || answer.includes(' ')) return { error: 'fill-in-blank needs a sentence and a single-word answer' };
      if (distractors.length !== 3) return { error: `need exactly 3 distractors, got ${distractors.length}` };
      const words = sentence.split(' ');
      const hits = words.map((w, i) => (bare(w) === answer.toLowerCase() ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1) return { error: `the answer "${answer}" must appear in the sentence exactly once as a word (found ${hits.length})` };
      const blankIndex = hits[0];
      words[blankIndex] = '______' + (words[blankIndex].match(/[.,;:!?"'()]+$/)?.[0] ?? '');
      const bank = shuffleIndexedChoices([answer, ...distractors], 0, `deep-dive-fib|${sentence}`).options;
      return { ...base, blockType: 'fill-in-blank', sentence: words.join(' '), blankIndex, correctAnswer: answer, wordBank: bank } as FillInBlankBlockData;
    }
    case 'timeline': {
      const events = objs(args.events).map((e) => ({ date: str(e.date), title: str(e.title), description: str(e.description) })).filter((e) => e.date && e.title);
      if (events.length < 3) return { error: 'a timeline needs 3-6 events' };
      return { ...base, blockType: 'timeline', events, interactionMode: modes.timelineOrder ? 'order' : 'static' } as TimelineBlockData;
    }
    case 'compare-contrast': {
      const item = (v: unknown) => ({ title: str(obj(v)?.title), points: strs(obj(v)?.points) });
      const itemA = item(args.itemA);
      const itemB = item(args.itemB);
      if (!itemA.title || !itemB.title || itemA.points.length < 2 || itemB.points.length < 2) return { error: 'each item needs a title and 3-4 points' };
      return { ...base, blockType: 'compare-contrast', itemA, itemB, interactionMode: modes.compareSort ? 'sort' : 'static' } as CompareContrastBlockData;
    }
    case 'diagram': {
      const labels = objs(args.labels).map((l, i) => ({ id: `label-${i}`, text: str(l.text), description: str(l.description) })).filter((l) => l.text);
      if (labels.length < 3) return { error: 'a diagram needs 4-6 labels' };
      return {
        ...base, blockType: 'diagram', imageBase64: '', caption: str(args.caption), altText: str(args.altText),
        learningObjective: str(args.learningObjective), interactionMode: modes.diagramLabel ? 'label' : 'explore', labels,
      } as DiagramBlockData;
    }
    case 'mini-sim': {
      const controlType = str(args.controlType) === 'slider' ? 'slider' : 'toggle';
      const states = objs(args.states).map((s) => ({ condition: str(s.condition).toLowerCase(), title: str(s.title), description: str(s.description), keyObservation: str(s.keyObservation) })).filter((s) => s.condition && s.title);
      if (controlType === 'toggle') {
        const conds = states.map((s) => s.condition).sort().join(',');
        if (states.length !== 2 || conds !== 'off,on') return { error: 'a toggle needs exactly 2 states with conditions "off" and "on"' };
      }
      const slider = obj(args.slider);
      if (controlType === 'slider') {
        const sliderError = checkSlider(slider, states);
        if (sliderError) return { error: sliderError };
      }
      const prediction = choiceOr(args.prediction, 'deep-dive-prediction');
      if ('error' in prediction) return { error: `prediction: ${prediction.error}` };
      return {
        ...base, blockType: 'mini-sim', scenario: str(args.scenario), controlType, controlLabel: str(args.controlLabel),
        ...(controlType === 'toggle'
          ? { toggleOffLabel: str(args.toggleOffLabel) || 'Off', toggleOnLabel: str(args.toggleOnLabel) || 'On' }
          : { sliderMin: Number(slider!.min), sliderMax: Number(slider!.max), sliderStep: Number(slider!.step) || 1, sliderUnit: str(slider!.unit), sliderDefault: Number(slider!.start) }),
        states, prediction,
      } as MiniSimBlockData;
    }
    case 'perspectives': {
      const perspectives = objs(args.perspectives).map((p, i) => ({ id: `p-${i}`, name: str(p.name), role: str(p.role), narrative: strs(p.narrative) })).filter((p) => p.name && p.narrative.length);
      if (perspectives.length < 2 || perspectives.length > 4) return { error: 'perspectives need 2-4 voices' };
      const c = choiceOr(args.comprehension, 'deep-dive-perspectives');
      if ('error' in c) return { error: `comprehension: ${c.error}` };
      return { ...base, blockType: 'perspectives', eventDescription: str(args.eventDescription), perspectives, comprehension: { question: c.question, options: c.options, correctIndex: c.correctIndex, explanation: c.explanation } } as PerspectivesBlockData;
    }
    case 'hypothesis-lab': {
      const roles = new Set<HypothesisVariableRole>(['iv', 'dv', 'control', 'irrelevant']);
      const variables = objs(args.variables)
        .map((v, i) => ({ id: `var-${i}`, label: str(v.label), role: str(v.role).toLowerCase() as HypothesisVariableRole }))
        .filter((v) => v.label && roles.has(v.role));
      const count = (r: HypothesisVariableRole) => variables.filter((v) => v.role === r).length;
      if (count('iv') !== 1 || count('dv') !== 1 || count('control') < 1 || count('irrelevant') > 2) {
        return { error: `needs exactly 1 iv, 1 dv, at least 1 control and at most 2 irrelevant (got iv=${count('iv')}, dv=${count('dv')}, control=${count('control')}, irrelevant=${count('irrelevant')})` };
      }
      return { ...base, blockType: 'hypothesis-lab', scenario: str(args.scenario), variables, explanation: str(args.explanation) } as HypothesisLabBlockData;
    }
    case 'worked-example': {
      const steps = objs(args.steps).map((st) => ({ work: str(st.work), reason: str(st.reason) }));
      if (steps.length < 2 || steps.length > 6) return { error: `a worked example needs 2-6 steps, got ${steps.length}` };
      if (steps.some((st) => !st.work || !st.reason)) return { error: 'every step needs its work and its reason' };
      const problem = str(args.problem);
      const answer = str(args.answer);
      if (!problem || !answer) return { error: 'a worked example needs the problem and the answer' };
      let tryStep: WorkedExampleBlockData['tryStep'];
      if (modes.workedTry) {
        const t = obj(args.tryStep);
        if (!t) return { error: 'at this level the worked example needs tryStep' };
        const at = Number(t.step) - 1;
        if (!Number.isInteger(at) || at < 1 || at >= steps.length) return { error: `tryStep.step must be 2-${steps.length}` };
        const distractors = strs(t.distractors);
        if (distractors.length !== 3) return { error: `tryStep needs exactly 3 distractors, got ${distractors.length}` };
        const lines = [steps[at].work, ...distractors];
        if (new Set(lines.map(sameLine)).size !== 4) return { error: 'a distractor repeats the right line or another distractor' };
        const shuffled = shuffleIndexedChoices(lines, 0, `deep-dive-worked|${problem}`);
        tryStep = { index: at, options: shuffled.options, correctIndex: shuffled.correctIndex, explanation: str(t.explanation) };
      }
      return { ...base, blockType: 'worked-example', problem, steps, answer, ...(tryStep ? { tryStep } : {}) } as WorkedExampleBlockData;
    }
    case 'process': {
      const stages = objs(args.stages).map((st) => ({ icon: str(st.icon), title: str(st.title), description: str(st.description) }));
      if (stages.length < 3 || stages.length > 6) return { error: `a process needs 3-6 stages, got ${stages.length}` };
      if (stages.some((st) => !st.icon || !st.title || !st.description)) return { error: 'every stage needs an icon, a title and a description' };
      if (new Set(stages.map((st) => norm(st.title))).size !== stages.length) return { error: 'two stages share a title' };
      return { ...base, blockType: 'process', stages } as ProcessBlockData;
    }
    case 'misconception': {
      const belief = str(args.belief);
      const actually = str(args.actually);
      const why = str(args.why);
      if (!belief || !actually || !why) return { error: 'a misconception needs the belief, what is actually true, and why' };
      if (norm(belief) === norm(actually)) return { error: 'the belief and what is actually true say the same thing' };
      return { ...base, blockType: 'misconception', belief, actually, why } as MisconceptionBlockData;
    }
    case 'chart': {
      const chartType = str(args.chartType) as ChartInset['chartType'];
      if (!['bar', 'line', 'pie'].includes(chartType)) return { error: 'chartType must be bar, line or pie' };
      const data = objs(args.data).map((d) => ({ label: str(d.label), value: Number(d.value) }));
      if (data.length < 2 || data.length > 12) return { error: `a chart needs 2-12 data points, got ${data.length}` };
      if (data.some((d) => !d.label || !Number.isFinite(d.value))) return { error: 'every data point needs a label and a numeric value' };
      if (new Set(data.map((d) => d.label.toLowerCase())).size !== data.length) return { error: 'two data points share a label' };
      if (chartType === 'pie' && (data.length > 6 || data.some((d) => d.value < 0))) return { error: 'a pie has 2-6 slices, none negative' };
      if (chartType === 'line' && data.length < 3) return { error: 'a line chart needs at least 3 points' };
      const inset: ChartInset = {
        insetType: 'chart', chartType, title: str(args.title), data,
        ...(str(args.xLabel) ? { xLabel: str(args.xLabel) } : {}), ...(str(args.yLabel) ? { yLabel: str(args.yLabel) } : {}),
      };
      const plain = plainText([inset.title, inset.xLabel, inset.yLabel, ...data.map((d) => d.label)]);
      if (plain) return { error: `chart text is drawn as plain text, so it cannot hold $...$ math ("${plain}"); write it in words or as 1/2` };
      return { ...base, blockType: 'chart', inset, ...(str(args.caption) ? { caption: str(args.caption) } : {}) } as ChartBlockData;
    }
    case 'number-line': {
      const min = Number(args.min);
      const max = Number(args.max);
      const step = Number(args.step);
      if (![min, max, step].every(Number.isFinite) || min >= max || step <= 0) return { error: 'needs numbers min < max and step > 0' };
      const count = Math.round((max - min) / step);
      if (count > 20 || Math.abs(min + count * step - max) > 1e-9 * Math.max(1, Math.abs(max))) return { error: `step must divide max - min into at most 20 equal parts (got ${(max - min) / step})` };
      const ticks = Array.from({ length: count + 1 }, (_, i) => +(min + i * step).toFixed(6));
      const inRange = (v: number) => v >= min && v <= max;
      const points = objs(args.points).map((p) => ({ value: Number(p.value), label: str(p.label) }));
      if (points.length > 8) return { error: 'at most 8 points' };
      if (points.some((p) => !Number.isFinite(p.value) || !inRange(p.value) || !p.label)) return { error: `every point needs a label and a value between ${min} and ${max}` };
      const r = obj(args.region);
      const region = r ? { from: Number(r.from), to: Number(r.to), ...(str(r.label) ? { label: str(r.label) } : {}) } : undefined;
      if (region && !(inRange(region.from) && inRange(region.to) && region.from < region.to)) return { error: `the region must run from a lower to a higher value between ${min} and ${max}` };
      const plain = plainText([...points.map((p) => p.label), region?.label]);
      if (plain) return { error: `number-line labels are drawn as plain text, so they cannot hold $...$ math ("${plain}"); write 1/2, -3 or x` };
      const inset: NumberLineInset = { insetType: 'number-line', min, max, ticks, ...(points.length ? { points } : {}), ...(region ? { region } : {}) };
      return { ...base, blockType: 'number-line', inset, ...(str(args.caption) ? { caption: str(args.caption) } : {}) } as NumberLineBlockData;
    }
    case 'definition': {
      const term = str(args.term);
      const definition = str(args.definition);
      if (!term || !definition) return { error: 'a definition needs the term and its meaning' };
      const inset: DefinitionBoxInset = {
        insetType: 'definition-box', term, definition,
        ...(str(args.partOfSpeech) ? { partOfSpeech: str(args.partOfSpeech) } : {}), ...(str(args.example) ? { exampleSentence: str(args.example) } : {}),
      };
      return { ...base, blockType: 'definition', inset } as DefinitionBlockData;
    }
    case 'passage': {
      const format = str(args.format) as PassageInset['format'];
      if (!['prose', 'poem', 'quote', 'letter', 'source'].includes(format)) return { error: 'format must be prose, poem, quote, letter or source' };
      const text = typeof args.text === 'string' ? args.text.trim() : '';
      if (!text) return { error: 'a passage needs its text' };
      const attribution = str(args.attribution);
      if (format !== 'prose' && !attribution) return { error: `a ${format} needs its attribution: who wrote or said it, and when` };
      const inset: PassageInset = { insetType: 'passage', text, format, ...(attribution ? { attribution } : {}), ...(format === 'poem' ? { showLineNumbers: true } : {}) };
      return { ...base, blockType: 'passage', inset, ...(str(args.intro) ? { intro: str(args.intro) } : {}) } as PassageBlockData;
    }
    default:
      return { error: `unknown block type ${type}` };
  }
}

function checkSlider(slider: Args | undefined, states: Array<{ condition: string }>): string | undefined {
  if (!slider) return 'a slider needs slider {min, max, step, unit, start}';
  const min = Number(slider.min);
  const max = Number(slider.max);
  const start = Number(slider.start);
  if (!(min < max)) return 'slider min must be below max';
  if (!(start >= min && start <= max)) return 'slider start must be between min and max';
  if (states.length < 2 || states.length > 4) return 'a slider needs 2-4 states';
  const ranges = states.map((s) => s.condition.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/)).map((m) => (m ? [Number(m[1]), Number(m[2])] : null));
  if (ranges.some((r) => !r)) return 'every slider state condition must be a "lo-hi" range';
  return undefined;
}

// ── Checks ───────────────────────────────────────────────────────────

const bare = (w: string) => w.replace(/[.,;:!?"'()]/g, '').toLowerCase();
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const contains = (haystack: string, needle: string) => {
  const n = norm(needle);
  return n.length >= 4 && ` ${norm(haystack)} `.includes(` ${n} `);
};
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** The closed question a block asks, if any (MC, prediction, comprehension, pattern check). */
export function blockChoice(block: DeepDiveBlock): Choice | undefined {
  switch (block.blockType) {
    case 'multiple-choice': return block as MultipleChoiceBlockData;
    case 'mini-sim': return (block as MiniSimBlockData).prediction;
    case 'perspectives': return (block as PerspectivesBlockData).comprehension;
    case 'data-table': return (block as DataTableBlockData).patternCheck;
    default: return undefined;
  }
}

/** The text that answers this block's check, if it has one. */
export function blockAnswer(block: DeepDiveBlock): string | undefined {
  const c = blockChoice(block);
  if (c) return c.options[c.correctIndex];
  if (block.blockType === 'fill-in-blank') return (block as FillInBlankBlockData).correctAnswer;
  return undefined;
}

/** Longest sentence a grade's reader should get, in words; undefined above grade 5. */
export function sentenceLimit(grade?: number): number | undefined {
  return grade === undefined ? undefined : grade <= 3 ? 14 : grade <= 5 ? 18 : undefined;
}

/** Problems in one block the agent must fix (blocking) or should look at (advisory). */
export function blockIssues(block: DeepDiveBlock, ctx: BlockContext): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  const choice = blockChoice(block);
  if (choice) {
    const right = choice.options[choice.correctIndex];
    const others = choice.options.filter((_, i) => i !== choice.correctIndex);
    if (new Set(choice.options.map(norm)).size !== choice.options.length) blocking.push('two options say the same thing');
    if (contains(choice.question, right)) blocking.push(`the question contains its own answer ("${right}")`);
    const longest = Math.max(...others.map((o) => o.length));
    if (right.length > 25 && right.length > longest * 1.6) blocking.push('the right option is much longer than every distractor; students can pick it by length');
    if (ctx.preReader) {
      if (!choice.optionEmojis) blocking.push('pre-reader questions need answerEmoji and distractorEmojis (one per option)');
      else if (new Set(choice.optionEmojis).size !== 4) blocking.push('two options share an emoji');
      if (wordCount(choice.question) > 12) blocking.push(`question is ${wordCount(choice.question)} words; pre-readers need 12 or fewer`);
    }
  }
  const answer = blockAnswer(block);
  if (answer && contains(block.label, answer)) blocking.push(`the label "${block.label}" names the answer`);

  switch (block.blockType) {
    case 'fill-in-blank': {
      const b = block as FillInBlankBlockData;
      if (new Set(b.wordBank.map(norm)).size !== b.wordBank.length) blocking.push('the word bank repeats a word');
      break;
    }
    case 'compare-contrast': {
      const b = block as CompareContrastBlockData;
      if (b.interactionMode === 'sort') {
        const named = [...b.itemA.points, ...b.itemB.points].filter((p) => contains(p, b.itemA.title) || contains(p, b.itemB.title));
        if (named.length) blocking.push(`sort points name an item, so they sort by keyword: "${named[0]}"`);
      }
      break;
    }
    case 'timeline': {
      const b = block as TimelineBlockData;
      if (b.interactionMode === 'order') {
        const cue = b.events.find((e) => /\b(then|next|afterwards?|after (this|that)|finally|later|subsequently|before (this|that))\b/i.test(e.description));
        if (cue) blocking.push(`"${cue.title}" uses a sequence word, which gives the order away`);
      }
      const years = b.events.map((e) => e.date.match(/-?\d{3,4}/)?.[0]).map((y) => (y ? Number(y) : NaN));
      if (years.every((y) => !Number.isNaN(y)) && years.some((y, i) => i > 0 && y < years[i - 1])) blocking.push('events are not in chronological order');
      break;
    }
    case 'hypothesis-lab': {
      const b = block as HypothesisLabBlockData;
      if (/\b(independent|dependent|variables?|controls?|constant)\b/i.test(b.scenario)) blocking.push('the scenario uses a role word (variable, control, constant), which labels the answer');
      break;
    }
    case 'prose': {
      const b = block as ProseBlockData;
      if (ctx.preReader && (b.paragraphs.length > 2 || b.paragraphs.some((p) => sentences(p).length > 3))) blocking.push('pre-reader prose is at most 2 paragraphs of 2-3 short sentences');
      break;
    }
    case 'key-facts': {
      const b = block as KeyFactsBlockData;
      if (b.facts.length > 5) blocking.push('at most 5 facts');
      const leaky = b.facts.find((f) => f.headline && norm(f.text).length > 0 && norm(f.text).startsWith(norm(f.headline)));
      if (leaky) advisory.push(`the headline "${leaky.headline}" is the start of its fact; a teaser should not give the fact away`);
      break;
    }
    case 'pull-quote':
      if ((block as PullQuoteBlockData).text.length > 240) blocking.push('a pull quote is at most 2 short sentences');
      break;
    case 'definition': {
      const d = (block as DefinitionBlockData).inset;
      if (contains(d.definition, d.term)) blocking.push(`the definition uses the word "${d.term}" itself; say what it means in other words`);
      break;
    }
    case 'passage': {
      const words = wordCount((block as PassageBlockData).inset.text);
      const max = passageLimit(ctx.grade);
      if (words > max) blocking.push(`the passage is ${words} words; at ${ctx.grade === undefined ? 'this level' : `grade ${ctx.grade}`} keep it to ${max} (quote the part the lesson needs)`);
      break;
    }
  }

  // Math the page cannot typeset (an unpaired $, LaTeX outside $...$, a matrix typed as text, a parse error).
  if (block.blockType !== 'drawer' && block.blockType !== 'display') {
    const bad = Array.from(new Set(visibleStrings(block).flatMap(mathIssues)));
    if (bad.length) blocking.push(`math: ${bad.slice(0, 3).join('; ')}`);
    const wrong = Array.from(new Set(visibleStrings(block).flatMap(falseEquations)));
    if (wrong.length) blocking.push(`arithmetic: ${wrong.slice(0, 3).map((e) => `"${e}" is false`).join('; ')}`);
  }
  if (block.blockType === 'worked-example') {
    const w = block as WorkedExampleBlockData;
    const t = w.tryStep;
    if (t && sameLine(w.problem).includes(sameLine(w.steps[t.index].work))) blocking.push(`the problem already shows step ${t.index + 1}'s line, so the try step gives itself away`);
  }

  // Sentence length for the grade: one long sentence is the agent's call; a block of them is not.
  const limit = sentenceLimit(ctx.grade);
  if (limit) {
    const long = sentences(visibleText(block)).filter((s) => wordCount(s) > limit);
    const note = `${long.length} sentence(s) over ${limit} words for grade ${ctx.grade}, e.g. "${long[0]?.slice(0, 80)}"`;
    // A drawer's words come from its own generator, and a passage is a real text quoted as written.
    if (long.length >= 2 && block.blockType !== 'drawer' && block.blockType !== 'passage') blocking.push(`${note}; split or shorten them`);
    else if (long.length) advisory.push(note);
  }
  return { blocking, advisory };
}

/** Each string the student reads in a block. */
export function visibleStrings(block: DeepDiveBlock): string[] {
  const b = block as unknown as Record<string, unknown>;
  const parts: string[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') {
      if (!/^(id|blockType|drawerId|displayId|html|expr|ideas|imageBase64|tutoringBrief|transitionCue|interactionMode|controlType|condition|role|placement|layout|insetType|chartType|format|kind|icon)$/.test(key)) parts.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(b);
  return parts;
}

/** Everything the student reads in a block, for length and overlap checks. */
export function visibleText(block: DeepDiveBlock): string {
  return visibleStrings(block).map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(' ');
}
