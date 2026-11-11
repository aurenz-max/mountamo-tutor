/**
 * deep-dive's domain on the shared tutor/JEV teaching workspace: which blocks are checks, each check as an item, its
 * spoken key, its misses and the scene. The boss (`deepDive.boss.ts`) builds the assignment from these; the card is
 * `deepDive.card.ts`.
 *
 * Pure: the component, the boss and the generator read the same values. Every graded block is one item, in lesson
 * order. A choice block (multiple choice, fill in the blank, a table's pattern question, a perspectives question, a
 * mini-sim prediction) is answered by a tap, and also spoken when every choice can be said; the tutor judges the words
 * against `deepDiveKey`. A sort, an order, a diagram's labels and a lab's variables are answered only on screen and
 * checked by the block. The display blocks are what the learner reads; they are not items. Sections the learner adds by
 * asking a question are practice: they are never items and never scored.
 */
import type { KnownMiss } from '../../../../components/live-activity/runtime/spokenMissContract';
import { askLeaks, containsPhrase, type SpokenKey } from '../../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../../components/live-activity/bossLevers';
import { spokenMath } from '../../../../utils/mathText';
import { chartWords } from '../../../../service/insets/chartView';
import { displayWords } from '../../../../service/agent-kit/displays';
import { surfaceScene } from '../../../../service/agent-kit/surfaceScene';
import type {
  ChartBlockData, CheckBlockData, CompareContrastBlockData, DataTableBlockData, DeepDiveBlock, DeepDiveData, DiagramBlockData, FigureBlockData, FillInBlankBlockData,
  MiniSimBlockData, NumberLineBlockData, MultipleChoiceBlockData, PerspectivesBlockData, TimelineBlockData, WorkedExampleBlockData,
} from './types';
import type { DeepDiveMiss } from './deepDive.card';

export type { DeepDiveMiss };

/** Whether a block is graded: a choice, or an on-screen sort, order, labeling or lab. */
export function isEvaluableBlock(block: DeepDiveBlock): boolean {
  switch (block.blockType) {
    case 'multiple-choice': case 'fill-in-blank': case 'hypothesis-lab': case 'check': return true;
    case 'worked-example': return !!(block as WorkedExampleBlockData).tryStep;
    case 'diagram': return (block as DiagramBlockData).interactionMode === 'label';
    case 'mini-sim': return !!(block as MiniSimBlockData).prediction;
    case 'perspectives': return !!(block as PerspectivesBlockData).comprehension;
    case 'compare-contrast': return (block as CompareContrastBlockData).interactionMode === 'sort';
    case 'timeline': return (block as TimelineBlockData).interactionMode === 'order' && (block as TimelineBlockData).events.length >= 3;
    case 'data-table': return !!(block as DataTableBlockData).patternCheck;
    case 'chart': return !!(block as ChartBlockData).patternCheck;
    default: return false;
  }
}

/** A closed choice: the question, the choices as printed, and the right one. */
export interface DeepDiveChoice { question: string; options: string[]; correctIndex: number }

/** The choice a block asks, or null for a block answered by sorting, ordering, labeling or a lab. */
export function choiceOf(block: DeepDiveBlock): DeepDiveChoice | null {
  switch (block.blockType) {
    case 'multiple-choice': { const b = block as MultipleChoiceBlockData; return { question: b.question, options: b.options, correctIndex: b.correctIndex }; }
    case 'data-table': case 'chart': { const p = (block as DataTableBlockData | ChartBlockData).patternCheck; return p ? { question: p.question, options: p.options, correctIndex: p.correctIndex } : null; }
    case 'perspectives': { const c = (block as PerspectivesBlockData).comprehension; return c ? { question: c.question, options: c.options, correctIndex: c.correctIndex } : null; }
    case 'mini-sim': { const p = (block as MiniSimBlockData).prediction; return p ? { question: p.question, options: p.options, correctIndex: p.correctIndex } : null; }
    case 'worked-example': {
      const t = (block as WorkedExampleBlockData).tryStep;
      return t ? { question: `In the worked example, which line is step ${t.index + 1}?`, options: t.options, correctIndex: t.correctIndex } : null;
    }
    case 'fill-in-blank': {
      const b = block as FillInBlankBlockData;
      const at = b.wordBank.findIndex(w => w.toLowerCase().trim() === b.correctAnswer.toLowerCase().trim());
      return at < 0 ? null : { question: `Which word fills the blank? ${b.sentence}`, options: b.wordBank, correctIndex: at };
    }
    case 'check': {
      // A choose check whose every card carries its own words can be said; cards told apart only by a picture cannot.
      const it = (block as CheckBlockData).item;
      const labels = it.options.map(o => o.label?.trim() ?? '');
      // A bare letter or number on a picture card is a tag, not words about the choice.
      const tag = (l: string, i: number) => !!it.options[i].display && /^(card|option|picture)?\s*[a-z0-9]$/i.test(l);
      if (it.surface !== 'choose' || labels.some((l, i) => !l || tag(l, i)) || new Set(labels.map(l => l.toLowerCase())).size !== labels.length) return null;
      return { question: it.prompt, options: labels, correctIndex: it.options.findIndex(o => o.id === it.key) };
    }
    default: return null;
  }
}

/** One item: a graded block, with what it asks. */
export interface DeepDiveItem {
  id: string;
  kind: DeepDiveBlock['blockType'];
  /** The section's label as printed above it. */
  label: string;
  block: DeepDiveBlock;
  choice: DeepDiveChoice | null;
}

/** The lesson's items, in order: every graded block. */
export function deepDiveItems(data: Pick<DeepDiveData, 'blocks'>): DeepDiveItem[] {
  return (data.blocks ?? []).filter(isEvaluableBlock).map(block => ({
    id: block.id, kind: block.blockType, label: block.label || block.blockType, block, choice: choiceOf(block),
  }));
}

/** What the learner is asked on one item. Never the answer. */
export function deepDiveAsk(item: DeepDiveItem): string {
  if (item.choice) return item.choice.question;
  switch (item.kind) {
    case 'timeline': return `Put the events in "${item.label}" in order, earliest first, then check.`;
    case 'compare-contrast': {
      const b = item.block as CompareContrastBlockData;
      return `Sort each statement under "${b.itemA.title}" or "${b.itemB.title}", then check.`;
    }
    case 'diagram': return `Drag each label onto its place in the diagram "${item.label}", then check.`;
    case 'check': return (item.block as CheckBlockData).item.prompt;
    case 'hypothesis-lab': return 'Sort the factors of this experiment: the one that is changed, the one that is measured, the ones kept the same, and the ones that do not belong. Then check.';
    default: return `Answer the check in "${item.label}".`;
  }
}

/** A choice a learner can say: a number, a word or a short phrase (no emoji or symbols). Math is judged as it is said. */
const SAYABLE = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ '.,:%/-]*$/;
const sayable = (o: string) => SAYABLE.test(o.trim()) && o.trim().length <= 30 && o.trim().split(/\s+/).length <= 4;

/**
 * The spoken key, or null when the item is only answered on screen: a sort, an order, a labeling, a lab, a choice that
 * cannot be said, or a question that prints its own answer. A question that says every choice gets a menu key.
 */
export function deepDiveKey(item: DeepDiveItem): SpokenKey | null {
  const c = spokenChoice(item);
  if (!c || !c.options.length || !c.options.every(sayable)) return null;
  const answer = (c.options[c.correctIndex] ?? '').trim();
  if (!answer) return null;
  const options = c.options.map(o => o.trim());
  // A kit card prints its number above its words, so "card two" names it as well.
  const alsoAccept = item.kind === 'check' ? [`card ${c.correctIndex + 1}`] : [];
  if (options.every(o => containsPhrase(c.question, o))) return { answer, alsoAccept, menu: options };
  const key: SpokenKey = { answer, alsoAccept, signatureError: 'Naming two choices, or hedging between them, is not an answer.' };
  return askLeaks(c.question, key).length ? null : key;
}

/** The item's choice as a voice says it: "$x^2$" is "x squared". */
function spokenChoice(item: DeepDiveItem): DeepDiveChoice | null {
  const c = item.choice;
  return c && { question: spokenMath(c.question), options: c.options.map(spokenMath), correctIndex: c.correctIndex };
}

/** What a wrong answer shows (the card's `DEEP_DIVE_MISSES`), by how the item is answered. */
export function deepDiveMiss(item: DeepDiveItem): DeepDiveMiss {
  if (item.choice) return 'wrong_choice';
  switch (item.kind) {
    case 'check': {
      const surface = (item.block as CheckBlockData).item.surface;
      return surface === 'order' ? 'out_of_order' : surface === 'categorize' ? 'wrong_side' : surface === 'make' || surface === 'set' ? 'off_goal' : 'wrong_choice';
    }
    case 'timeline': return 'out_of_order';
    case 'compare-contrast': return 'wrong_side';
    case 'diagram': return 'misplaced_label';
    default: return 'wrong_role';
  }
}

/** A spoken answer's known wrong answers: the other choices. None on an item answered only on screen. */
export function deepDiveSpokenMisses(item: DeepDiveItem): KnownMiss[] {
  const c = spokenChoice(item);
  if (!c || !deepDiveKey(item)) return [];
  const others = c.options.filter((_, i) => i !== c.correctIndex).map(o => o.trim());
  const cards = item.kind === 'check' ? c.options.flatMap((_, i) => (i === c.correctIndex ? [] : [`card ${i + 1}`])) : [];
  return others.length
    ? [{ id: 'wrong_choice', pattern: `The learner's answer is another of the choices: ${[...others, ...cards].join(', ')}.`, examples: others.slice(0, 3) }]
    : [];
}

/** Each string the student reads in a block. */
export function visibleStrings(block: DeepDiveBlock): string[] {
  const b = block as unknown as Record<string, unknown>;
  const parts: string[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') {
      if (!/^(id|blockType|drawerId|displayId|html|svg|shows|expr|ideas|imageBase64|tutoringBrief|transitionCue|interactionMode|controlType|condition|role|placement|layout|insetType|chartType|format|kind|icon|key|surface|tier|band|reasons|field|chart_type)$/.test(key)) parts.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(b);
  return parts;
}

/**
 * What a block draws from numbers, in words, for a reader who cannot see it (the tutor, the blind reader). `visibleText`
 * skips numbers, and stays that way: it feeds the check for an answer given away earlier in the lesson.
 */
export function drawnValues(block: DeepDiveBlock): string {
  if (block.blockType === 'chart') return chartWords((block as ChartBlockData).inset);
  if (block.blockType === 'number-line') {
    const n = (block as NumberLineBlockData).inset;
    const marks = (n.points ?? []).map(p => `${p.label} at ${p.value}`).join(', ');
    return `a number line from ${n.min} to ${n.max}${marks ? `, marked ${marks}` : ''}${n.region ? `, shaded from ${n.region.from} to ${n.region.to}` : ''}`;
  }
  if (block.blockType === 'figure' && (block as FigureBlockData).display.kind !== 'svg') return displayWords((block as FigureBlockData).display);
  if (block.blockType === 'check') {
    const it = (block as CheckBlockData).item;
    return [...it.stimulus, ...(it.board ? [it.board] : []), ...it.options.flatMap(o => (o.display ? [o.display] : []))].map(displayWords).filter(Boolean).join('; ');
  }
  return '';
}

/** Everything the student reads in a block, for length and overlap checks. */
export function visibleText(block: DeepDiveBlock): string {
  return visibleStrings(block).map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(' ');
}

// ── The sections taught before each check ───────────────────────────────

/** The teaching blocks leading up to a check: every block after the check before it. */
export function sectionsBefore(blocks: readonly DeepDiveBlock[], itemId: string): DeepDiveBlock[] {
  const at = blocks.findIndex(b => b.id === itemId);
  let from = at;
  while (from > 0 && !isEvaluableBlock(blocks[from - 1])) from--;
  return at < 0 ? [] : blocks.slice(from, at);
}

/** The sections still to be gone through before a check opens, in order. */
export function sectionsLeft(blocks: readonly DeepDiveBlock[], itemId: string, passed: ReadonlySet<string>): DeepDiveBlock[] {
  return sectionsBefore(blocks, itemId).filter(b => !passed.has(b.id));
}

/** What the learner hears as the task while a section is open. Nothing to answer: the section is taught, not checked. */
export const deepDiveSectionAsk = (block: DeepDiveBlock) => `Let us look at "${spokenMath(block.label || 'this part')}" together.`;

/** How the learner can touch each kind of section. Facts about the block's controls, for the tutor to use. */
const TAP_TO_HEAR = 'the learner can tap a part of it to hear more';
const ON_SECTION: Partial<Record<DeepDiveBlock['blockType'], string>> = {
  'key-facts': 'its cards are face down and turn over when tapped; have the learner tap one at a time, and talk about each',
  diagram: 'its numbered spots can be tapped; have the learner tap one and talk about that part',
  'mini-sim': 'it has a control the learner can move; have them move it and say what changes',
  'compare-contrast': TAP_TO_HEAR, 'data-table': TAP_TO_HEAR, process: TAP_TO_HEAR, 'pull-quote': TAP_TO_HEAR, timeline: TAP_TO_HEAR,
};

/** Long text as parts at word breaks: a scene fact holds at most 500 characters (`dialogueContract`), and math grows when spoken. */
function inParts(text: string, size = 400): string[] {
  const parts: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.length + word.length < size) parts[parts.length - 1] = `${last} ${word}`;
    else parts.push(word);
  }
  return parts;
}

/** The tutor's scene while a section is open: unlike a check, it sees the section's content, to teach from. */
export function sectionScene(data: Pick<DeepDiveData, 'title'>, block: DeepDiveBlock, left: number, preReader?: boolean): SceneOf {
  const learnerCan = ON_SECTION[block.blockType];
  return {
    objects: [],
    facts: {
      deepDive: data.title,
      stage: 'a teaching section: nothing here is scored',
      section: block.label || block.blockType,
      ...(preReader ? { reader: 'a pre-reader: the learner cannot read yet, so you say everything the section says, and the pictures carry the rest' } : {}),
      ...Object.fromEntries(inParts(`${drawnValues(block) ? `${drawnValues(block)}. ` : ''}${visibleText(block)}`.slice(0, 2000)).map((part, i) => [`sectionContent${i + 1}`, part])),
      ...(block.tutoringBrief ? { sectionBrief: block.tutoringBrief } : {}),
      ...(learnerCan ? { learnerCan } : {}),
      sectionsLeftBeforeCheck: left,
      howToTeach: 'Teach this section now, from the sectionContent facts, in your own words and short sentences: say what is on screen and '
        + 'what it means. Get the learner doing something with it: use learnerCan if it is given, or ask what they notice. '
        + 'One question at a time, and build on what they say. Do not ask the check that comes later. When the section is '
        + 'covered, tell the learner to tap Next.',
    },
  };
}

/** What is on screen beside the item. */
export interface DeepDiveView {
  /** The learner's work on this try, in their own terms (never the key); '' before they answer. */
  work: string;
  /** Labels of the sections on screen above the check, in order. */
  sections: string[];
  /** Questions the learner typed, oldest first, each with what happened to it. */
  /** The pre-reader screen: the learner cannot read the sections or the check. */
  preReader?: boolean;
  asked: Array<{ question: string; status: 'loading' | 'waiting' | 'ready' | 'redirect' | 'error'; sections: string[] }>;
}

const HOW: Partial<Record<DeepDiveItem['kind'], string>> = {
  timeline: 'ordering: the learner taps the events into slots, earliest first, then presses Check; events in the right place from the start stay after a check',
  'compare-contrast': 'sorting: the learner places each statement under one of two headings, then presses Check; the ones placed right stay after a check',
  diagram: 'labeling: the learner drags each label onto the diagram, then presses Check',
  'hypothesis-lab': 'a lab: the learner places each factor in a zone (changed, measured, kept the same, does not belong), then presses Check',
};

/** A check on a kit surface, as the kit describes it to the tutor: what the learner does, the pictures in words, the cards. Never the key. */
function checkFacts(item: DeepDiveItem): Record<string, string | number> {
  if (item.kind !== 'check') return {};
  const facts = surfaceScene((item.block as CheckBlockData).item, { answer: {}, tries: [], solved: false }).facts as Record<string, string>;
  const { task, shown, cards } = facts;
  const boards = Object.fromEntries(Object.entries(facts).filter(([k]) => /^board\d?$/.test(k)));
  return { kind: `${task}, then presses Check`, ...(shown ? { pictures: shown } : {}), ...boards, ...(cards ? { cards } : {}) };
}

/** What is drawn and asked. The choices are on screen, so they are listed; never the key or the sections' text. */
export function workspaceScene(data: Pick<DeepDiveData, 'title'>, item: DeepDiveItem, view: DeepDiveView): SceneOf {
  const asked = view.asked.map(a => `"${a.question}" (${a.status === 'ready' ? `answered by the sections ${a.sections.join(', ')}`
    : a.status === 'waiting' ? 'held until the learner tries a check it would give away' : a.status === 'loading' ? 'sections being made'
      : a.status === 'redirect' ? 'off the topic; not answered' : 'failed; the learner may ask again'})`);
  return {
    objects: [],
    facts: {
      deepDive: data.title,
      section: item.label,
      ...(view.preReader ? { reader: 'a pre-reader: the learner cannot read yet, so you read the check and every choice aloud, and the pictures carry the sections' } : {}),
      sectionsAbove: view.sections.join(', '),
      kind: item.choice ? 'a choice: the learner taps one choice, then presses Check' : HOW[item.kind] ?? 'answered on screen',
      question: deepDiveAsk(item),
      ...checkFacts(item),
      // What to point at: the chart's kind and axes. Its values stay on screen for the learner to read.
      ...(item.block.blockType === 'chart' ? { chartOnScreen: chartWords({ ...(item.block as ChartBlockData).inset, data: [] }).replace(/:\s*$/, '') } : {}),
      ...(item.choice ? { choices: item.choice.options.join(' | ') } : {}),
      learnerWork: view.work || 'Nothing checked yet',
      ...(asked.length ? { learnerQuestions: `The learner typed these questions in the Ask box; their sections sit below the lesson as practice, never scored, and are not this item: ${asked.join('; ')}` } : {}),
      constraints: (deepDiveKey(item) ? '' : 'This item is answered only on screen, and you are not told its answer. ')
        + 'The sections have been taught: do not repeat from them the fact this check asks for. '
        + 'The check on screen is the only question to ask: do not ask the learner questions of your own about the topic. '
        + 'Teach what the check asks and where on screen to look, never the content of the answer.'
        + (item.choice ? ' Read the choices aloud in the order shown, in the same voice for each.' : ''),
      neverSay: 'Never describe a choice by what it says or is about, never say what a wrong choice means, and never hint at '
        + 'the idea the answer rests on.',
    },
  };
}

/** The harness's answers for a choice item: the key's text, and the first wrong choice. */
export function deepDiveHarnessAnswers(item: DeepDiveItem): { correct: string; wrong: string } {
  const c = spokenChoice(item);
  const correct = c?.options[c.correctIndex];
  const wrong = c?.options.find((_, i) => i !== c.correctIndex);
  if (!correct || !wrong) throw new Error(`deep-dive ${item.kind}: the item has no choice to answer`);
  return { correct, wrong };
}
