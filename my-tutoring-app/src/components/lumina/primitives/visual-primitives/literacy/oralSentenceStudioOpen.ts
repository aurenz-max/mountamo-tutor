/**
 * oral-sentence-studio's open-speech modes (handoff H2): ask a question, say why, two voices. Pure; the domain
 * (`oralSentenceStudioDomain.ts`) dispatches here for an open item.
 *
 * Nothing is printed: the scene is library pictures and the tutor says the situation (and the claim). An open spoken
 * answer has no code key: the key states what the tutor credits and the named misses, and the three examples are
 * anchors for the judge, shown only after credit.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { OralOpenChallenge, OralOpenType, OralPicture } from './OralSentenceStudio';
import { OPEN_SPEECH_MISSES } from './oralSentenceStudio.card';

export const ORAL_OPEN_TYPES: readonly OralOpenType[] = ['ask_question', 'say_why', 'two_voices'];
export const isOralOpenType = (type: unknown): type is OralOpenType =>
  (ORAL_OPEN_TYPES as readonly unknown[]).includes(type);

export interface OralOpenItem {
  id: string;
  mode: OralOpenType;
  challenge: OralOpenChallenge;
  modelResponse: string;
}

const forbidden = /["\r\n_[\]{}]|\b(?:system|assistant|judge|verdict|correct|incorrect|prompt|placeholder|todo|null|undefined)\b/i;
const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const tokens = (value: string): string[] => value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
const sentences = (value: string): string[] =>
  clean(value).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** A character's name is its picture word, capitalized ("Fox"). */
export const nameOf = (picture: OralPicture): string => cap(picture.word);

const isPicture = (p: OralPicture | undefined): p is OralPicture =>
  !!p && /^[a-z]{2,12}$/.test(clean(p.word)) && clean(p.emoji).length > 0 && clean(p.emoji).length <= 16;

/** Said by the tutor: 1-3 short sentences, at most 40 words. */
const isSaid = (value: string, max = 3): boolean => {
  const lines = sentences(value);
  return lines.length >= 1 && lines.length <= max && tokens(value).length >= 3 && tokens(value).length <= 40
    && /[.!?]$/.test(clean(value)) && !forbidden.test(value);
};

/** An opinion frame a five-year-old can take a side on. */
const OPINION = /\b(?:better|best|more fun|most fun|favou?rite|likes?|loves?|should|nicer|nicest|yummier|yummiest|tastier|prettier|prettiest|cozier|funnier|funniest|what if|would)\b/i;
/** A claim that measures or states a fact has a right answer: bigger, faster, has more legs, can fly, a number. */
const FACTUAL = /\b(?:bigger|smaller|taller|shorter|heavier|lighter|faster|slower|older|younger|longer|louder|hotter|colder|wetter|stronger|more legs|fewer|can fly|can swim|lives? in|is made of|are made of|is called|\d+|two|three|four|five|six|seven|eight|nine|ten)\b/i;

/** Code's check on a say_why claim: an opinion frame, and nothing measurable or countable. The model's own
 *  "has a right answer" flag is checked by the generator as well. */
export const claimIsOpinion = (claim: string): boolean => OPINION.test(claim) && !FACTUAL.test(claim);

const exampleFits = (c: OralOpenChallenge, example: string): boolean => {
  const said = clean(example);
  if (!said || said.length > 160 || forbidden.test(said)) return false;
  if (c.type === 'ask_question') return said.endsWith('?') && sentences(said).length === 1;
  if (c.type === 'say_why') return /\bbecause\b/i.test(said) && /[.!]$/.test(said);
  // two_voices: "Duck: line. Frog: line." One line for each character.
  const [a, b] = c.characters.map(nameOf);
  return new RegExp(`^${a}:`).test(said) && new RegExp(`\\b${b}:`).test(said);
};

export function openChallengeAskable(c: OralOpenChallenge): boolean {
  if (!c?.id || !isOralOpenType(c.type)) return false;
  const title = clean(c.sceneTitle);
  if (!title || title.length > 42 || /[.!?]/.test(title) || forbidden.test(title)) return false;
  if (!isPicture(c.setting) || !Array.isArray(c.characters) || !Array.isArray(c.things)) return false;
  if (!c.characters.every(isPicture) || !c.things.every(isPicture)) return false;
  const words = [c.setting, ...c.characters, ...c.things].map((p) => p.word);
  if (new Set(words).size !== words.length) return false;
  const wantCharacters = c.type === 'two_voices' ? 2 : 1;
  if (c.characters.length !== wantCharacters) return false;
  if (c.type === 'ask_question' && c.things.length !== 1) return false;
  if (c.type === 'say_why' && (c.things.length < 1 || c.things.length > 2)) return false;
  if (c.type === 'two_voices' && c.things.length > 1) return false;
  if (!isSaid(c.situation, 2)) return false;
  if (c.type === 'say_why') {
    if (!isSaid(clean(c.claim), 1) || !claimIsOpinion(clean(c.claim))) return false;
  } else if (c.claim !== undefined) return false;
  if (!Array.isArray(c.examples) || c.examples.length !== 3
    || new Set(c.examples.map((e) => clean(e).toLowerCase())).size !== 3) return false;
  return c.examples.every((example) => exampleFits(c, example));
}

export const openItemFromChallenge = (challenge: OralOpenChallenge): OralOpenItem | null =>
  openChallengeAskable(challenge)
    ? { id: challenge.id, mode: challenge.type, challenge, modelResponse: challenge.examples[0] }
    : null;

export function openAskFor(item: OralOpenItem): string {
  const c = item.challenge;
  if (item.mode === 'ask_question') {
    return `Look at the picture. ${clean(c.situation)} We do not know about the ${c.things[0].word} yet. Ask a question about it.`;
  }
  if (item.mode === 'say_why') {
    const who = nameOf(c.characters[0]);
    return `Look at ${who}. ${clean(c.situation)} ${clean(c.claim)} Do you agree with ${who}? Say yes or no, and tell why.`;
  }
  const [a, b] = c.characters.map(nameOf);
  return `Look at ${a} and ${b}. ${clean(c.situation)} Pretend you are them. Say one thing ${a} says, and then one thing ${b} says back.`;
}

const ANY_GRAMMAR = 'Accept child grammar and the learner\'s own words; the examples are only examples.';

/** The open item's key, judged on meaning: what the tutor credits, written as the mode's credit rule. No code key. */
export function openKey(item: OralOpenItem): SpokenKey {
  const c = item.challenge;
  const [answer, ...alsoAccept] = c.examples;
  if (item.mode === 'ask_question') {
    return { answer, alsoAccept,
      meaning: {
        idea: `A question the learner asks about this scene (${clean(c.situation)}), such as what is in or behind the `
          + `${c.things[0].word}, who left it, or what will happen.`,
        notIt: 'a statement, a question about something else, or one word',
      },
      acceptRule: `Accept any question about the scene, with or without a question word, including a rising-voice question ("it's a toy?"). ${ANY_GRAMMAR}` };
  }
  if (item.mode === 'say_why') {
    return { answer, alsoAccept,
      meaning: {
        idea: `A position on ${nameOf(c.characters[0])}'s claim (${clean(c.claim)}), agree or disagree, and a reason that fits that position.`,
        notIt: 'a position with no reason, a reason with no position, or "because I do" (or "because I want to") as the reason',
      },
      acceptRule: `Both positions are right. Accept yes or no, "I like ...", or a different choice, with any reason a child could hold; never judge whether the reason is true. ${ANY_GRAMMAR}` };
  }
  const [a, b] = c.characters.map(nameOf);
  return { answer, alsoAccept,
    meaning: {
      idea: `Two lines of talk that fit this scene (${clean(c.situation)}): one that ${a} says and one that ${b} says.`,
      notIt: 'one line only, or narration about the characters instead of words they say',
    },
    acceptRule: `Accept "${a} says ..." or a change of voice to mark who talks, and any lines that fit the scene. ${ANY_GRAMMAR}` };
}

/** An open item's known wrong answers, in the card's order, concrete per item. */
export function openSpokenMisses(item: OralOpenItem): KnownMiss[] {
  const c = item.challenge;
  const pattern: Record<string, KnownMiss> = {
    statement: { id: 'statement', pattern: `The learner says something about the scene but asks no question.`,
      examples: [`It is a ${c.things[0]?.word ?? c.setting.word}.`] },
    other_question: { id: 'other_question', pattern: `The learner asks a question that is not about this scene.`,
      examples: ['Can I have a snack?'] },
    one_word: { id: 'one_word', pattern: 'The learner says one word, even with a questioning voice.',
      examples: ['What?'] },
    position_only: { id: 'position_only', pattern: 'The learner agrees or disagrees and gives no reason.',
      examples: ['Yes.', 'No, I do not.'] },
    reason_only: { id: 'reason_only', pattern: 'The learner gives a reason but never says whether they agree.' },
    empty_reason: { id: 'empty_reason', pattern: 'The learner gives a position and a reason that only restates the choice.',
      examples: ['Yes, because I do.', 'No, because I want to.'] },
    one_line: { id: 'one_line', pattern: 'The learner says a line for only one character.' },
    narration: { id: 'narration', pattern: 'The learner tells about the characters instead of saying words they say.',
      examples: [`${nameOf(c.characters[0])} and the ${c.characters[1]?.word ?? c.setting.word} are at the ${c.setting.word}.`] },
  };
  return OPEN_SPEECH_MISSES[item.mode].map((id) => pattern[id]);
}

const pictured = (pictures: OralPicture[]) => pictures.map((p) => `${p.word} ${p.emoji}`).join(', ');

/** What is on screen for the tutor: pictures only. The situation and the claim are said, never printed. */
export function openScene(item: OralOpenItem): SceneOf {
  const c = item.challenge;
  return { objects: [], facts: {
    shown: `A picture of "${c.sceneTitle}" at the ${c.setting.word} ${c.setting.emoji}: ${pictured([...c.characters, ...c.things])}.`
      + (item.mode === 'ask_question' ? ` The ${c.things[0].word} is closed with a question mark on it.` : '')
      + (item.mode === 'two_voices' ? ' Each character has an empty speech bubble.' : ''),
    said: [clean(c.situation), clean(c.claim)].filter(Boolean).join(' '),
    constraints: 'No words are printed. An example answer appears on screen only after the answer is credited.',
  } };
}

/** The journey's answers: the first example, or each mode's signature miss. */
export const openHarnessAnswers = (item: OralOpenItem): { correct: string; plainWrong: string } => ({
  correct: item.challenge.examples[0],
  plainWrong: item.mode === 'ask_question' ? `It is a ${item.challenge.things[0].word}.`
    : item.mode === 'say_why' ? 'Yes.'
      : `${nameOf(item.challenge.characters[0])} and ${nameOf(item.challenge.characters[1])} are at the ${item.challenge.setting.word}.`,
});
