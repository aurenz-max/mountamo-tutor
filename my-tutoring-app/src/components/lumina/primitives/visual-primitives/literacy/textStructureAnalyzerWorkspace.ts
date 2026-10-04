/**
 * Text structure analyzer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C7). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component, the adapter and the journey read the same items, assignment and scene.
 * Every item is one spoken answer computed by the build gates: the linking word of a numbered
 * sentence (find-signal), how the whole passage is organised from the printed menu
 * (name-structure), or which labelled part an idea belongs in (place-idea). The passage is
 * never read aloud: decoding it is the skill, and a find-signal answer is a word in it.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { stableShuffle } from '../../../utils/choiceOrder';
import {
  askFor,
  itemsFromPayload,
  textStructureAnalyzerHarnessAnswers,
  type TextStructureItem,
  type TextStructurePayloadLike,
} from './textStructureAnalyzerScript';

/** The build gates' items with the structure menu in its per-instance screen order. */
export function textStructureItems(payload: TextStructurePayloadLike, instanceId: string) {
  const built = itemsFromPayload(payload);
  return {
    ...built,
    items: built.items.map((item) => {
      if (item.action !== 'name-structure' || item.choices.length < 2) return item;
      const ordered = stableShuffle(
        item.choices.map((choice, index) => ({ choice, note: item.choiceNotes[index] ?? '' })),
        `${instanceId}|${item.id}|${item.choices.join('|')}`,
      );
      return { ...item, choices: ordered.map(({ choice }) => choice), choiceNotes: ordered.map(({ note }) => note) };
    }),
  };
}

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: TextStructureItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

/** What the misses may quote beyond the item: the passage title and the session's linking words. */
export interface MissContext { title?: string; signals?: readonly string[] }

export function textStructureAssignment(item: TextStructureItem, ctx: MissContext = {}): TeachingAssignment {
  let expectedAnswer: string;
  switch (item.action) {
    case 'find-signal':
      expectedAnswer = `${item.answer}, the linking word in "${item.stimulusText}". It may come inside a little phrase `
        + `("the word ${item.answer}"). Any other word of that sentence is wrong: words that name things and actions are `
        + 'not linking words.';
      break;
    case 'name-structure':
      expectedAnswer = `${item.answer}. The part of the label that tells it apart from the other choices counts, and so does `
        + `its place in the printed list. A different structure is wrong even when it is close (choices: ${item.choices.join(', ')}).`;
      break;
    case 'place-idea':
      expectedAnswer = `${item.answer} (parts: ${item.choices.join(', ')}). "The ${item.answer}" or "it goes in ${item.answer}" `
        + 'counts. Saying the idea back is not an answer.';
      break;
  }
  const misses = textStructureSpokenMisses(item, ctx);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** Words of four letters or more that name no thing or action, kept out of `content_word`'s examples. */
const SMALL_WORDS = new Set(['that', 'this', 'with', 'into', 'from', 'there', 'then', 'they', 'their', 'when', 'were', 'have', 'already', 'across', 'onto', 'over']);

/** What a wrong spoken answer shows (handoff 20 Part B), by action; the lever table 2026-10-03 adds the last three. */
export type SpokenTextStructureMiss = 'content_word' | 'other_structure' | 'other_part' | 'said_idea_back'
  | 'not_in_sentence' | 'said_topic' | 'said_signal_word';

/** Linking words a child might offer that a sentence does not use, for `not_in_sentence`'s examples. */
const COMMON_LINKS = ['then', 'because', 'but', 'so', 'next', 'also', 'after'];

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: another word of the sentence
 * that is not the linking word (find-signal), another printed structure (name-structure), the other part or the
 * idea said back (place-idea).
 */
export function textStructureSpokenMisses(item: TextStructureItem, ctx: MissContext = {}): KnownMiss[] {
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  switch (item.action) {
    case 'find-signal': {
      const signal = item.answer.toLowerCase().split(/\s+/);
      const words = (item.stimulusText.toLowerCase().match(/[a-z']+/g) ?? []).filter(w => !signal.includes(w) && w.length > 3 && !SMALL_WORDS.has(w));
      const inSentence = new Set(item.stimulusText.toLowerCase().match(/[a-z']+/g) ?? []);
      const absent = [...(ctx.signals ?? []), ...COMMON_LINKS].map(w => w.toLowerCase())
        .filter((w, i, all) => all.indexOf(w) === i && !w.split(' ').some(x => inSentence.has(x)));
      return [{ id: 'content_word', pattern: `The linking word in "${item.stimulusText}" is "${item.answer}". The learner's answer is a different word from that sentence, one that names a thing, an action or a description.`,
        examples: words.slice(0, 2) },
      ...(absent.length ? [{ id: 'not_in_sentence', pattern: `The linking word in "${item.stimulusText}" is "${item.answer}". The learner's answer is a word that is not in that sentence: another sentence's word, or a linking word this sentence does not use.`,
        examples: absent.slice(0, 2) }] : [])];
    }
    case 'name-structure': {
      const others = item.choices.filter(c => c !== item.answer);
      const topic = (ctx.title?.match(/[A-Za-z]{4,}/g) ?? []).filter(w => !/^(how|what|why|when|with|from|that|this)$/i.test(w));
      const signals = (ctx.signals ?? []).filter(w => !others.some(o => o.toLowerCase().includes(w.toLowerCase())));
      return [
        ...(others.length ? [{ id: 'other_structure', pattern: `The passage is organised as ${item.answer}. The learner's answer is another printed structure: ${quote(others)}.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_topic', pattern: `The passage is organised as ${item.answer}. The learner names what the passage is about (its topic) and no structure.`,
          ...(topic.length ? { examples: topic.slice(0, 2).map(w => w.toLowerCase()) } : {}) },
        { id: 'said_signal_word', pattern: `The passage is organised as ${item.answer}. The learner says a linking word from the passage, such as ${signals.length ? quote(signals.slice(0, 2)) : '"because"'}, and no structure.`,
          examples: (signals.length ? signals : ['because']).slice(0, 2) },
      ];
    }
    case 'place-idea': {
      const others = item.choices.filter(c => c !== item.answer);
      return [
        ...(others.length ? [{ id: 'other_part', pattern: `The idea "${item.stimulusText}" goes with ${item.answer}. The learner's answer is ${quote(others)}, another part.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_idea_back', pattern: `The learner says the idea back ("${item.stimulusText}") without naming a part.`, examples: [item.stimulusText] },
      ];
    }
  }
}

export function textStructureScene(item: TextStructureItem, passage: string): WorkspaceScene {
  const facts: Record<string, string> = { ...textFacts('passage', passage) };
  if (item.action === 'find-signal' && item.showFocusSentence) facts.focus = 'The asked sentence is highlighted in the passage.';
  if (item.action === 'name-structure') facts.menu = `Printed structures: ${item.choices.join(', ')}.`;
  if (item.action === 'place-idea') facts.shown = `The idea card "${item.stimulusText}" above the labelled parts: ${item.choices.join(', ')}.`;
  facts.constraints = 'The learner reads the passage and answers out loud; never read the passage or a sentence of it aloud. '
    + 'Nothing on screen marks a linking word or a structure until the answer is credited.';
  return { objects: [], facts };
}

/** The journey's answers: the code-computed answer, or a plain wrong one. */
export function textStructureJourneyAnswers(item: TextStructureItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = textStructureAnalyzerHarnessAnswers(item);
  return { correct, plainWrong };
}
