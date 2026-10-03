/**
 * di-spoken-practice on the shared tutor/JEV teaching workspace (rollout C6), through `DiTeachingStage`
 * like the other spoken DI packs. Every mode is one spoken answer; the tutor hears it and the observer
 * judges the tutor's completed feedback against the key below. Pure: the component and the journey read
 * the same assignment and scene.
 *
 * What the scripted judging contract carried that is task structure stays here, in the key: the spoken
 * alternates, the generated `acceptRule` (a right answer that does not look right) and `signatureError`
 * (a wrong answer that sounds right), the closed word menu of `compare_choice`, and for `explain_concept`
 * the one idea judged on meaning, with the class's own refusals (the instance read back, a bare name).
 * The sentinel openers, the fixed correction lines and the wait instruction were control protocol and are
 * gone. The generator gates (`findAnswerLeaks`, `findChoiceMenuDefects`, `findConceptDefects`) still
 * decide what ships, so the ask never contains the answer.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { DI_SPOKEN_PRACTICE_MODES } from './diSpokenPracticeModes';
import { conceptAffirmForm, numberWordFor, type SpokenPracticeItem } from './diSpokenPracticeScript';

const MODES = new Set<string>(DI_SPOKEN_PRACTICE_MODES.map(definition => definition.evalMode));
const quoted = (words: readonly string[]) => words.map(word => `"${word}"`).join(', ');

/** The ask the learner hears. The generator writes it and gates it against the answer. */
export const spokenPracticeAskFor = (item: SpokenPracticeItem): string => item.ask;

/** The key as the observer judges it: the answer, what else counts, and what does not. */
export function spokenPracticeKey(item: SpokenPracticeItem): string {
  const rule = item.acceptRule.trim() ? ` ${item.acceptRule.trim()}` : '';
  const miss = item.signatureError.trim() ? ` ${item.signatureError.trim()}` : '';
  if (item.mode === 'explain_concept') {
    const examples = [item.expectedAnswer, ...item.alternates].map(a => a.trim()).filter(Boolean);
    return `An explanation in the learner's own words that means: "${conceptAffirmForm(item.conceptStatement ?? '')}" `
      + `For example ${quoted(examples)}, or any wording with that idea. Judge the meaning, not the words: `
      + 'the same words inside a sentence that means the opposite or a different idea are wrong, and so are '
      + `"${item.stimulusText}" read back, a bare number, or just the name of what is shown.${rule}${miss}`;
  }
  const also = item.alternates.length ? ` (also accept ${quoted(item.alternates)})` : '';
  const menu = item.mode === 'compare_choice' && item.choices?.length
    ? ` The learner chooses one word from ${quoted(item.choices)}; any other word does not answer the question.` : '';
  return `"${item.expectedAnswer}"${also}.${menu}${rule}${miss}`;
}

/** What a wrong spoken answer shows on the two bounded modes (handoff 20 Part B). */
export type SpokenPracticeMiss = OffByMiss | 'skipped_a_number' | 'other_menu_word' | 'said_same' | 'said_thing_name'
  | 'misread' | 'sounds_not_blended' | 'letter_names' | 'word_dropped' | 'signature_error' | 'said_stimulus'
  | 'read_back' | 'named_only' | 'bare_number' | 'opposite_idea';

const bare = (thing: string) => thing.replace(/^(a|an|the)\s+/i, '').trim();
const SAME = /^(the )?same$|^equal$/i;

/**
 * A bounded item's known wrong answers, in precedence order, for the `spoken_miss` observer: on count_and_say the
 * counting walk and the off-by misses, on compare_choice the other menu word(s) and a picture's name. The other
 * modes name none: say_answer and read_aloud keys are generated with no recorded distractor, and explain_concept is
 * judged on meaning.
 */
export function spokenPracticeSpokenMisses(item: SpokenPracticeItem): KnownMiss[] {
  const accepted = new Set([item.expectedAnswer, ...item.alternates].map(a => a.trim().toLowerCase()));
  if (item.mode === 'count_and_say' && item.stimulusCount > 0) {
    const n = item.stimulusCount;
    return [...(n >= 3 ? [{ id: 'skipped_a_number', pattern: 'The learner counts aloud and leaves a number out of the counting sequence, whatever number they end on.',
      examples: ['one, two, four'] }] : []), ...offByMisses(n, `the ${n} ${item.stimulusText} in the picture`)];
  }
  if (item.mode === 'read_aloud') {
    const printed = item.stimulusText.trim(), numeral = /^\d+$/.test(printed), several = printed.split(/\s+/).length > 1;
    const fact = `The printed text is "${printed}", read "${item.expectedAnswer}".`;
    return [
      { id: 'misread', pattern: `${fact} The learner reads it as a different ${numeral ? 'number' : 'word'}.`, examples: [] },
      ...(numeral ? [] : [
        { id: 'sounds_not_blended', pattern: `${fact} The learner says the separate sounds and never the whole word.`, examples: [] },
        { id: 'letter_names', pattern: `${fact} The learner spells it with letter names instead of reading it.`, examples: [] },
      ]),
      ...(several ? [{ id: 'word_dropped', pattern: `${fact} The learner leaves out a printed word.`, examples: [] }] : []),
    ];
  }
  if (item.mode === 'say_answer') {
    return [
      ...(item.signatureError.trim() ? [{ id: 'signature_error', pattern: `The answer is "${item.expectedAnswer}". ${item.signatureError.trim()}`.slice(0, 400), examples: [] }] : []),
      ...(item.stimulusText.trim() && item.stimulusKind !== 'none'
        ? [{ id: 'said_stimulus', pattern: `The answer is "${item.expectedAnswer}". The learner says the shown "${item.stimulusText}" back instead of answering.`, examples: [] }] : []),
    ];
  }
  if (item.mode === 'explain_concept') {
    const fact = `The idea is: "${item.conceptStatement ?? item.expectedAnswer}".`;
    return [
      { id: 'read_back', pattern: `${fact} The learner reads the example "${item.stimulusText}" back.`, examples: [] },
      { id: 'named_only', pattern: `${fact} The learner only names what is shown and says no idea about it.`, examples: [] },
      { id: 'bare_number', pattern: `${fact} The learner says only a number.`, examples: [] },
      { id: 'opposite_idea', pattern: `${fact} The learner uses the right words inside an idea that means something else.`, examples: [] },
    ];
  }
  if (item.mode !== 'compare_choice' || !item.choices?.length) return [];
  const a = bare(item.stimulusText), b = bare(item.stimulusText2 ?? '');
  const fact = `The pictures are ${item.stimulusText} and ${item.stimulusText2 ?? 'another thing'}; the word that fits is ${item.expectedAnswer}.`;
  const wrong = item.choices.filter(c => !accepted.has(c.trim().toLowerCase()));
  const other = wrong.filter(c => !SAME.test(c.trim())), same = wrong.filter(c => SAME.test(c.trim()));
  return [
    ...(other.length ? [{ id: 'other_menu_word', pattern: `${fact} The learner's answer is ${other.join(' or ')}, another word from the menu.`,
      examples: other.slice(0, 2) }] : []),
    ...(same.length ? [{ id: 'said_same', pattern: `${fact} The learner's answer is ${same[0]}.`, examples: [same[0]] }] : []),
    ...(a && b ? [{ id: 'said_thing_name', pattern: `${fact} The learner names a picture (${a} or ${b}) and says no word from the menu.`,
      examples: [a] }] : []),
  ];
}

export function spokenPracticeAssignment(item: SpokenPracticeItem): TeachingAssignment {
  const misses = spokenPracticeSpokenMisses(item);
  return { id: item.id, task: spokenPracticeAskFor(item), response: 'speech', expectedAnswer: spokenPracticeKey(item),
    ...(misses.length ? { misses } : {}) };
}

/** What the screen shows, without the answer: a count item never prints its numeral, a picture to name is
 *  not labeled, and a listen-only item prints nothing (the ask carries it). */
function drawn(item: SpokenPracticeItem): { label: string; constraints: string } {
  switch (item.stimulusKind) {
    case 'text':
      return item.answerSource === 'decode'
        ? { label: `the printed text "${item.stimulusText}", which the learner reads aloud`,
          constraints: 'The learner reads the printed text aloud; reading it is the whole task.' }
        : { label: `the printed "${item.stimulusText}"`,
          constraints: 'The learner answers aloud. The answer is not printed.' };
    case 'emoji':
      return { label: 'one unlabeled picture', constraints: 'The learner answers aloud. The picture has no label.' };
    case 'pair':
      return { label: `two unlabeled pictures side by side: ${item.stimulusText} and ${item.stimulusText2 ?? ''}`,
        constraints: `The learner says one word from ${quoted(item.choices ?? [])}. The pictures have no labels, `
          + 'so the learner hears their names from you.' };
    case 'objects':
      return { label: `a group of identical ${item.stimulusText} pictures`,
        constraints: 'The learner counts the pictures and says how many aloud. No numeral is shown.' };
    case 'none':
    default:
      return { label: 'nothing printed', constraints: 'Nothing is printed: the learner hears the question from you and answers aloud.' };
  }
}

export function spokenPracticeScene(item: SpokenPracticeItem): WorkspaceScene {
  const { label, constraints } = drawn(item);
  return {
    objects: [{ id: 'stimulus', selected: false, group: 'assignment target', label }],
    facts: { kind: item.mode, constraints,
      // DI's model is a DIFFERENT item, never this one (ruling 2026-10-02): easy (or no tier) starts with its card.
      support: item.supportTier === 'hard' ? 'answer it cold: model nothing before the learner answers, and never say this answer'
        : item.supportTier === 'medium' ? 'the learner tries first; after a miss, model a different item with the model lever, never this one'
          : 'the model card of a different item starts on screen: say it as your turn, then ask this one. Never model this one' },
  };
}

/** The journey's answers: the key's own words, or a plainly different answer of the same kind. */
export function diSpokenPracticeHarnessAnswers(item: SpokenPracticeItem): { correct: string; plainWrong: string } {
  if (item.mode === 'explain_concept') {
    return { correct: item.conceptStatement ?? item.expectedAnswer, plainWrong: "I don't know" };
  }
  if (item.mode === 'count_and_say') {
    const n = item.stimulusCount;
    return { correct: item.expectedAnswer, plainWrong: numberWordFor(n >= 2 ? n - 1 : n + 1) };
  }
  if (item.mode === 'compare_choice') {
    const other = (item.choices ?? []).find(choice => choice.toLowerCase() !== item.expectedAnswer.toLowerCase());
    return { correct: item.expectedAnswer, plainWrong: other ?? 'bigger' };
  }
  return { correct: item.expectedAnswer, plainWrong: item.expectedAnswer.toLowerCase() === 'banana' ? 'rocket' : 'banana' };
}

/** An item the stage can ask: a known mode, an ask, a key, and pictures to count on a counting item. */
export const spokenPracticeItemValid = (item: SpokenPracticeItem) =>
  !!item && typeof item.id === 'string' && MODES.has(item.mode)
    && typeof item.ask === 'string' && !!item.ask.trim()
    && typeof item.expectedAnswer === 'string' && !!item.expectedAnswer.trim()
    && (item.stimulusKind !== 'objects' || (Number.isInteger(item.stimulusCount) && item.stimulusCount > 0))
    && (item.mode !== 'explain_concept' || !!item.conceptStatement?.trim());
