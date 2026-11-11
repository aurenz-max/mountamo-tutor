/**
 * Grammar frame spaces (service/wordSpace): every (picture, spoken sentence with one word missing, answer, wrong
 * forms) a K grammar frame allows, for di-spoken-practice's article, pronoun, verb-form and tense modes. Code picks
 * the words, fills the sentence and computes the key; the model writes nothing.
 *
 * Each item belongs to one ANSWER GROUP (a vs an, she vs he vs they): a session picks from every group of its frames
 * so the contrast is always present, and the tier picks within a group by beta.
 *
 * Difficulty features (logits; refit from first-try results):
 * - two choices before three (he/she before they; is/are before am);
 * - the form children over-use first ("a apple", "she" for "her", "runned"): the other form is harder;
 * - a regular form before an irregular one (dogs before men; walked before ran before went);
 * - the contrast shown in the picture before one carried only by the sentence (a picture of two dogs before
 *   "The dogs" under a picture of the action);
 * - a word the grade knows later, or a longer word, adds a little.
 */
import 'server-only';
import { knownByForGrade, type LexWord } from './lexicon';
import { nounPool } from './categorySpaces';
import type { WordSpaceItem } from './pick';
import {
  articleFor, ingOf, longVowelStart, OBJECT_OF, pastOf, peopleFor, pluralOf, POSSESSIVE_OF, SUBJECT_OF, thingsFor,
  thirdPersonOf, verbsFor, type Person,
} from './grammarFacts';

export type GrammarFrame =
  | 'a_an' | 'a_the'
  | 'he_she' | 'he_she_they' | 'possessive' | 'subject_object'
  | 'present_agreement' | 'be_ing'
  | 'past_regular' | 'past_irregular' | 'future_will';

export interface FramePayload {
  frame: GrammarFrame;
  /** The answer group: the item's answer kind, so a session can hold every side of the contrast. */
  group: string;
  /** The sentence with "..." where the missing word goes. */
  sentence: string;
  answer: string;
  /** Wrong forms, the most likely one first. The easy menu is [answer, wrong[0]]. */
  wrong: string[];
  /** The picture (one or two library emoji) and what it shows, without an article or the answer. */
  emoji: string;
  pictureLabel: string;
  /** The menu must be said on every tier: without it the sentence cannot name its verb without saying the answer. */
  menuAlways: boolean;
  /** The named miss, in words for the tutor. */
  miss: string;
  /** The rule, said after the corrected sentence. */
  rule: string;
  /** A person word the child might say back instead of a pronoun. */
  noun?: string;
}

export type FrameItem = WordSpaceItem<FramePayload>;

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const hash = (s: string): number => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The answer in the gap, with a capital wherever it starts a sentence ("…a ball. She will kick it."). */
const fill = (sentence: string, word: string) => cap(sentence.replace('...', word)).replace(/([.!?] )([a-z])/g, (_, p, c) => p + c.toUpperCase());
const r2 = (n: number) => +n.toFixed(2);

/** The library files some animal PARTS under animal; a sentence about one doing something ("the feather was hungry") is wrong. */
const ANIMAL_PARTS: ReadonlySet<string> = new Set(['feather', 'fin', 'wing', 'tail', 'paw', 'horn', 'shell', 'nest', 'web']);
const animals = (grade: string) => nounPool(grade).filter((x) => x.category === 'animal' && x.syllables <= 2 && !ANIMAL_PARTS.has(x.w));

// ── articles ────────────────────────────────────────────────────────────────

function aAnSpace(grade: string): FrameItem[] {
  // Things a child names with "It is a …": not school symbols (plus, multiply) or sport names (tennis).
  return nounPool(grade).filter((x) => x.category !== 'school' && x.category !== 'sport').flatMap((x) => {
    const art = articleFor(x);
    if (!art) return [];
    const an = art === 'an';
    return [{
      beta: r2((an ? 0.4 : 0) + (an && longVowelStart(x) ? 0.2 : 0) + 0.1 * (x.syllables - 1) + famBeta(x)),
      structure: an ? (longVowelStart(x) ? 'an:long' : 'an:short') : 'a', key: art, words: [x.w],
      payload: {
        frame: 'a_an', group: art, sentence: `It is ... ${x.w}.`, answer: art, wrong: [an ? 'a' : 'an'], emoji: x.emoji!,
        pictureLabel: x.w, menuAlways: false,
        miss: an ? `says "a" before ${x.w}, which starts with a vowel sound` : `says "an" before ${x.w}, which starts with a consonant sound`,
        rule: an ? `We say an before ${x.w}, because ${x.w} starts with a vowel sound.` : `We say a before ${x.w}.`,
      },
    }];
  });
}

const SECOND_MENTION = ['went to sleep', 'was hungry', 'ran home', 'liked to play'];

function aTheSpace(grade: string): FrameItem[] {
  return animals(grade).filter((x) => articleFor(x) === 'a').flatMap((x) => {
    const tail = SECOND_MENTION[hash(x.w) % SECOND_MENTION.length];
    return [
      { beta: r2(0.2 + famBeta(x)), structure: 'first-mention', key: 'a', words: [x.w], payload: {
        frame: 'a_the' as const, group: 'a', sentence: `Once there was ... ${x.w}.`, answer: 'a', wrong: ['the'], emoji: x.emoji!,
        pictureLabel: x.w, menuAlways: false, miss: `says "the" for a ${x.w} the story has not named yet`,
        rule: `This is the first time we hear about the ${x.w}, so we say a.` } },
      { beta: r2(0.5 + famBeta(x)), structure: 'second-mention', key: 'the', words: [x.w], payload: {
        frame: 'a_the' as const, group: 'the', sentence: `Once there was a ${x.w}. ... ${x.w} ${tail}.`, answer: 'the', wrong: ['a'],
        emoji: x.emoji!, pictureLabel: x.w, menuAlways: false, miss: `says "a" for the ${x.w} the story already named`,
        rule: `We already know which ${x.w}, so we say the.` } },
    ];
  });
}

// ── pronouns ────────────────────────────────────────────────────────────────

const SUBJECT_TAILS = ['can run fast', 'can jump high', 'can sing a song', 'will eat lunch', 'can swim', 'will read a book', 'can clap', 'will go home'];
const OBJECT_HEADS = ['Give the ball to ... now', 'Wave to ... now', 'I can see ... over there', 'Say hi to ... today', 'Sit next to ... at lunch', 'I will help ... later'];
const kindWord = (p: Person) => (p.kind === 'they' ? 'more than one person' : p.kind === 'she' ? `a ${p.noun}` : `a ${p.noun}`);
const subjectWrong = (k: Person['kind']) => (k === 'she' ? ['he', 'they'] : k === 'he' ? ['she', 'they'] : ['she', 'he']);

function subjectSpace(grade: string, withThey: boolean): FrameItem[] {
  const allowed = knownByForGrade(grade);
  const people = peopleFor(allowed).filter((p) => withThey || p.kind !== 'they');
  const things = thingsFor(allowed);
  const frame: GrammarFrame = withThey ? 'he_she_they' : 'he_she';
  const wrongOf = (p: Person) => (withThey ? subjectWrong(p.kind) : [p.kind === 'she' ? 'he' : 'she']);
  return people.flatMap((p) => {
    const answer = SUBJECT_OF[p.kind];
    const base = (p.kind === 'they' ? 0.3 : 0) + (withThey ? 0.2 : 0);
    const shown = SUBJECT_TAILS.filter((_, i) => (hash(p.word) + i) % 3 === 0).map((tail): FrameItem => ({
      beta: r2(base), structure: `pictured:${p.kind}`, key: answer, words: [p.word], payload: {
        frame, group: answer, sentence: `... ${tail}.`, answer, wrong: wrongOf(p), emoji: p.emoji, pictureLabel: p.label,
        menuAlways: false, noun: p.noun, miss: `says ${wrongOf(p)[0]} for ${p.label}, or says the person word instead of a pronoun`,
        rule: `We say ${answer} for ${kindWord(p)}.` } }));
    // The person is carried by the sentence; the picture shows only the thing.
    const heard = things.filter((_, i) => p.word !== 'family' && (hash(p.word) + i) % 3 === 1).map((t): FrameItem => {
      const has = p.kind === 'they' ? 'have' : 'has';
      return { beta: r2(base + 0.4), structure: `heard:${p.kind}`, key: answer, words: [p.word, t.word], payload: {
        frame, group: answer, sentence: `The ${p.noun} ${has} a ${t.word}. ... will ${t.verb} it.`, answer, wrong: wrongOf(p),
        emoji: t.emoji, pictureLabel: t.word, menuAlways: false, noun: p.noun,
        miss: `says ${wrongOf(p)[0]} for the ${p.noun}, or says "the ${p.noun}" again instead of a pronoun`,
        rule: `We say ${answer} for the ${p.noun}.` } };
    });
    return [...shown, ...heard];
  });
}

function possessiveSpace(grade: string): FrameItem[] {
  const allowed = knownByForGrade(grade);
  const things = thingsFor(allowed);
  return peopleFor(allowed).flatMap((p) => {
    const answer = POSSESSIVE_OF[p.kind];
    const wrong = [SUBJECT_OF[p.kind], ...Object.values(POSSESSIVE_OF).filter((w) => w !== answer)];
    const base = p.kind === 'they' ? 0.4 : 0;
    return things.filter((_, i) => (hash(p.word) + i) % 2 === 0).flatMap((t): FrameItem[] => [
      { beta: r2(base), structure: `pictured:${p.kind}`, key: answer, words: [p.word, t.word], payload: {
        frame: 'possessive', group: answer, sentence: `That is ... ${t.word}.`, answer, wrong, emoji: `${p.emoji}${t.emoji}`,
        pictureLabel: `${p.label} with a ${t.word}`, menuAlways: false, noun: p.noun,
        miss: `says ${SUBJECT_OF[p.kind]} instead of the word for whose ${t.word} it is`,
        rule: `The ${t.word} belongs to the ${p.noun}, so it is ${answer} ${t.word}.` } },
      ...(p.word === 'family' ? [] : [{ beta: r2(base + 0.4), structure: `heard:${p.kind}`, key: answer, words: [p.word, t.word], payload: {
        frame: 'possessive' as const, group: answer, sentence: `The ${p.noun} ${p.kind === 'they' ? 'have' : 'has'} a ${t.word}. It is ... ${t.word}.`,
        answer, wrong, emoji: t.emoji, pictureLabel: t.word, menuAlways: false, noun: p.noun,
        miss: `says ${SUBJECT_OF[p.kind]} instead of the word for whose ${t.word} it is`,
        rule: `The ${t.word} belongs to the ${p.noun}, so it is ${answer} ${t.word}.` } }]),
    ]);
  });
}

/** Subject vs object: the same person words in both places, so "she" and "her" are both asked. */
function subjectObjectSpace(grade: string): FrameItem[] {
  const allowed = knownByForGrade(grade);
  return peopleFor(allowed).flatMap((p) => {
    const subj = SUBJECT_OF[p.kind], obj = OBJECT_OF[p.kind];
    const base = p.kind === 'they' ? 0.3 : 0;
    const asSubject = SUBJECT_TAILS.filter((_, i) => (hash(p.word) + i) % 4 === 0).map((tail): FrameItem => ({
      beta: r2(base + 0.2), structure: `subject:${p.kind}`, key: subj, words: [p.word], payload: {
        frame: 'subject_object', group: `subject`, sentence: `... ${tail}.`, answer: subj, wrong: [obj], emoji: p.emoji,
        pictureLabel: p.label, menuAlways: false, noun: p.noun, miss: `says ${obj} where the sentence needs ${subj}`,
        rule: `${cap(subj)} goes before the action word.` } }));
    const asObject = OBJECT_HEADS.filter((_, i) => (hash(p.word) + i) % 3 === 0).map((head): FrameItem => ({
      beta: r2(base + 0.5), structure: `object:${p.kind}`, key: obj, words: [p.word], payload: {
        frame: 'subject_object', group: 'object', sentence: `${head}.`, answer: obj, wrong: [subj], emoji: p.emoji,
        pictureLabel: p.label, menuAlways: false, noun: p.noun, miss: `says ${subj} where the sentence needs ${obj}`,
        rule: `After words like to or see, we say ${obj}.` } }));
    return [...asSubject, ...asObject];
  });
}

// ── verb forms ──────────────────────────────────────────────────────────────

/** A plural that sounds like the singular gives agreement nothing to hear. */
const SAME_PLURAL: ReadonlySet<string> = new Set(['fish', 'sheep', 'deer', 'moose', 'shrimp', 'squid', 'bison', 'trout', 'salmon']);

interface Subject { word: string; one: string; many: string; emoji: string; irregular: boolean; person: boolean }

function subjectsFor(grade: string): Subject[] {
  const allowed = knownByForGrade(grade);
  const people = peopleFor(allowed).filter((p) => p.kind !== 'they' && ['girl', 'boy', 'man', 'woman'].includes(p.word));
  const list: Array<{ x: { w: string; emoji: string }; person: boolean }> = [
    ...animals(grade).filter((x) => x.syllables === 1).map((x) => ({ x: { w: x.w, emoji: x.emoji! }, person: false })),
    ...people.map((p) => ({ x: { w: p.word, emoji: p.emoji }, person: true })),
  ];
  return list.flatMap(({ x, person }) => {
    if (SAME_PLURAL.has(x.w)) return [];
    const pl = pluralOf(x.w);
    return pl ? [{ word: x.w, one: x.w, many: pl.form, emoji: x.emoji, irregular: pl.irregular, person }] : [];
  });
}

function agreementSpace(grade: string): FrameItem[] {
  const verbs = verbsFor(knownByForGrade(grade));
  return subjectsFor(grade).flatMap((s) => verbs.filter((v) => (s.person || v.animal) && (hash(s.word + v.v) % 3 === 0)).flatMap((v): FrameItem[] => {
    const third = thirdPersonOf(v.v);
    const sing = { beta: (third.es ? 0.3 : 0), group: 'one', subject: `The ${s.one}`, answer: third.form, wrong: v.v, emoji: s.emoji, label: s.one };
    const plur = { beta: 0.2 + (s.irregular ? 0.6 : 0), group: 'many', subject: `The ${s.many}`, answer: v.v, wrong: third.form,
      emoji: `${s.emoji}${s.emoji}`, label: `two ${s.many}` };
    return [sing, plur].flatMap((r) => [false, true].map((heard): FrameItem => ({
      beta: r2(r.beta + (heard ? 0.4 : 0)), structure: `${r.group}:${heard ? 'heard' : 'pictured'}${s.irregular && r.group === 'many' ? ':irregular' : ''}`,
      key: r.group, words: [s.word, v.v], payload: {
        frame: 'present_agreement', group: r.group, sentence: `${r.subject} ... ${v.tail}.`, answer: r.answer, wrong: [r.wrong],
        emoji: heard ? v.emoji : r.emoji, pictureLabel: heard ? `someone doing the action ${ingOf(v.v)}` : r.label, menuAlways: true,
        miss: r.group === 'one' ? `says "${r.wrong}" for one ${s.one}, dropping the -s` : `says "${r.wrong}" for more than one, adding the -s`,
        rule: r.group === 'one' ? `One ${s.one} ${third.form}.` : `Two ${s.many} ${v.v}.`,
      } })));
  }));
}

function beIngSpace(grade: string): FrameItem[] {
  const verbs = verbsFor(knownByForGrade(grade));
  const third = subjectsFor(grade).flatMap((s) => verbs.filter((v) => (s.person || v.animal) && hash(s.word + v.v) % 3 === 1).flatMap((v): FrameItem[] => {
    const ing = ingOf(v.v);
    return [
      { beta: r2(0), structure: 'is', key: 'is', words: [s.word, v.v], payload: {
        frame: 'be_ing', group: 'is', sentence: `The ${s.one} ... ${ing}.`, answer: 'is', wrong: ['are', 'am'], emoji: s.emoji,
        pictureLabel: s.one, menuAlways: false, miss: `says "are" for one ${s.one}`, rule: `One ${s.one} is ${ing}.` } },
      { beta: r2(0.2 + (s.irregular ? 0.6 : 0)), structure: s.irregular ? 'are:irregular' : 'are', key: 'are', words: [s.word, v.v], payload: {
        frame: 'be_ing', group: 'are', sentence: `The ${s.many} ... ${ing}.`, answer: 'are', wrong: ['is', 'am'], emoji: `${s.emoji}${s.emoji}`,
        pictureLabel: `two ${s.many}`, menuAlways: false, miss: `says "is" for more than one`, rule: `Two ${s.many} are ${ing}.` } },
    ];
  }));
  const me = verbs.map((v): FrameItem => ({
    beta: 0.3, structure: 'am', key: 'am', words: [`I:${v.v}`], payload: {
      frame: 'be_ing', group: 'am', sentence: `I ... ${ingOf(v.v)}.`, answer: 'am', wrong: ['is', 'are'], emoji: v.emoji,
      pictureLabel: `someone ${ingOf(v.v)}`, menuAlways: false, miss: 'says "is" after I', rule: `With I, we say am: I am ${ingOf(v.v)}.` } }));
  return [...third, ...me];
}

// ── tense ───────────────────────────────────────────────────────────────────

const PAST_BETA = { regular: 0.2, 'vowel-change': 0.5, other: 0.7, 'new-word': 0.9 } as const;

function tenseSpace(grade: string, frame: 'past_regular' | 'past_irregular' | 'future_will'): FrameItem[] {
  return verbsFor(knownByForGrade(grade)).flatMap((v): FrameItem[] => {
    const past = pastOf(v.v);
    if (!past) return [];
    const regular = past.kind === 'regular';
    if (frame === 'past_regular' && !regular) return [];
    if (frame === 'past_irregular' && regular) return [];
    const doing = `someone ${ingOf(v.v)}`;
    const pastItem: FrameItem = { beta: r2(PAST_BETA[past.kind]), structure: `past:${past.kind}`, key: 'past', words: [`${v.v}:past`], payload: {
      frame, group: 'past', sentence: `Yesterday I ... ${v.tail}.`, answer: past.form, wrong: frame === 'future_will' ? [`will ${v.v}`] : [v.v],
      emoji: v.emoji, pictureLabel: doing, menuAlways: true, miss: `says "${frame === 'future_will' ? `will ${v.v}` : v.v}" for yesterday`,
      rule: `Yesterday is in the past, so we say ${past.form}.` } };
    if (frame === 'future_will') {
      return [pastItem, { beta: r2(0.3), structure: 'future', key: 'future', words: [`${v.v}:future`], payload: {
        frame, group: 'future', sentence: `Tomorrow I ... ${v.tail}.`, answer: `will ${v.v}`, wrong: [past.form], emoji: v.emoji,
        pictureLabel: doing, menuAlways: true, miss: `says the past form "${past.form}" for tomorrow`,
        rule: `Tomorrow has not happened yet, so we say will ${v.v}.` } }];
    }
    return [pastItem, { beta: r2(0), structure: 'present', key: 'present', words: [`${v.v}:present`], payload: {
      frame, group: 'present', sentence: `Every day I ... ${v.tail}.`, answer: v.v, wrong: [past.form], emoji: v.emoji,
      pictureLabel: doing, menuAlways: true, miss: `says the past form "${past.form}" for every day`,
      rule: `Every day is now, so we say ${v.v}.` } }];
  });
}

/** Every item a frame allows at this grade. */
export function grammarSpace(frame: GrammarFrame, grade: string): FrameItem[] {
  switch (frame) {
    case 'a_an': return aAnSpace(grade);
    case 'a_the': return aTheSpace(grade);
    case 'he_she': return subjectSpace(grade, false);
    case 'he_she_they': return subjectSpace(grade, true);
    case 'possessive': return possessiveSpace(grade);
    case 'subject_object': return subjectObjectSpace(grade);
    case 'present_agreement': return agreementSpace(grade);
    case 'be_ing': return beIngSpace(grade);
    case 'past_regular': case 'past_irregular': case 'future_will': return tenseSpace(grade, frame);
  }
}

/** The sentence with the answer in the gap: the correction and the model card say it. */
export const filledSentence = (p: Pick<FramePayload, 'sentence'>, word: string): string => fill(p.sentence, word);
