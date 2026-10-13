/**
 * Generators for the drawers without numbers (textSpecs.ts). Code checks structure only; the
 * prompts ask for accurate, well-established content in words the audience knows.
 */
import { Type, type Schema } from '@google/genai';
import { brief, generateChecked, type DrawerAsk } from './gemini-drawers';
import {
  cycleWheelProblems, perspectiveLensProblems, rhythmGridProblems, RHYTHM_SOUNDS, shadesOfMeaningProblems, storyArcProblems,
  thenAndNowProblems, wordAnatomyProblems,
  type DrawerCycleWheelData, type DrawerPerspectiveLensData, type DrawerRhythmGridData, type DrawerShadesOfMeaningData,
  type DrawerStoryArcData, type DrawerThenAndNowData, type DrawerWordAnatomyData,
} from '../../primitives/visual-primitives/drawers/textSpecs';

const S = Type.STRING;
const PLAIN = 'Keep every sentence short, accurate and in words the audience knows.';

// ---------------------------------------------------------------------------

const cycleWheelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence on what keeps going round.' },
    stages: {
      type: Type.ARRAY, description: '3-8 stages in the order they happen; the last leads back to the first.',
      items: { type: Type.OBJECT, properties: { label: { type: S, description: '1-2 words.' }, text: { type: S, description: '1-2 sentences on what happens in this stage.' } }, required: ['label', 'text'] },
    },
  },
  required: ['title', 'caption', 'stages'],
};

export const generateDrawerCycleWheel = (ask: DrawerAsk) =>
  generateChecked<DrawerCycleWheelData, DrawerCycleWheelData>('cycle-wheel', cycleWheelSchema,
    `You are designing a cycle wheel: stages arranged in a loop with no first or last step.\n${brief(ask)}\n`
    + `Use the stages as this topic is usually taught at this level. ${PLAIN}`,
    raw => raw, cycleWheelProblems);

// ---------------------------------------------------------------------------

const event = (what: string): Schema => ({ type: S, description: `${what} One or two sentences.` });
const storyArcSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'The story\'s name.' },
    caption: { type: S, description: 'One sentence about the shape of the story.' },
    beginning: event('Who, where, and how things are at the start.'),
    problem: event('The problem appears and grows.'),
    climax: event('The biggest, most exciting moment.'),
    solved: event('What happens right after; the problem gets solved.'),
    ending: event('How things are at the end.'),
  },
  required: ['title', 'caption', 'beginning', 'problem', 'climax', 'solved', 'ending'],
};

interface StoryArcRaw { title: string; caption: string; beginning: string; problem: string; climax: string; solved: string; ending: string }

export const generateDrawerStoryArc = (ask: DrawerAsk) =>
  generateChecked<StoryArcRaw, DrawerStoryArcData>('story-arc', storyArcSchema,
    `You are designing a story arc: one story told in five stages up and down a plot mountain.\n${brief(ask)}\n`
    + `Use the story the lesson is about; if it names none, use a well-known story that fits the topic. Tell what happens `
    + `in the story itself, faithfully. ${PLAIN}`,
    raw => ({ title: raw.title, caption: raw.caption, events: { beginning: raw.beginning, problem: raw.problem, climax: raw.climax, solved: raw.solved, ending: raw.ending } }),
    storyArcProblems);

// ---------------------------------------------------------------------------

const thenAndNowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'A question: what changed, and what stayed the same?' },
    thenLabel: { type: S, description: 'The earlier time, e.g. "1900" or "Long ago".' },
    nowLabel: { type: S, description: 'The later time, e.g. "Today".' },
    rows: {
      type: Type.ARRAY, description: '3-7 aspects compared across the two times. Include at least one that stayed the same.',
      items: {
        type: Type.OBJECT,
        properties: {
          aspect: { type: S, description: 'e.g. "Light at night".' },
          then: { type: S }, now: { type: S },
          same: { type: Type.BOOLEAN, description: 'True only if this aspect did not change.' },
        },
        required: ['aspect', 'then', 'now', 'same'],
      },
    },
  },
  required: ['title', 'caption', 'thenLabel', 'nowLabel', 'rows'],
};

export const generateDrawerThenAndNow = (ask: DrawerAsk) =>
  generateChecked<DrawerThenAndNowData, DrawerThenAndNowData>('then-and-now', thenAndNowSchema,
    `You are designing a then-and-now comparison: one place or activity at two times, lined up aspect by aspect.\n`
    + `${brief(ask)}\nUse historically accurate details. ${PLAIN}`,
    raw => raw, thenAndNowProblems);

// ---------------------------------------------------------------------------

const perspectiveLensSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S },
    event: { type: S, description: 'The event in one factual sentence: when, where, what happened.' },
    prompts: { type: Type.ARRAY, items: { type: S }, description: '2-4 questions put to every viewpoint, e.g. "What happened?", "How did they feel?", "What did they want?"' },
    views: {
      type: Type.ARRAY, description: '2-4 people or groups who were part of the event.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: S, description: 'e.g. "A Boston Patriot".' },
          answers: { type: Type.ARRAY, items: { type: S }, description: 'One answer per question, in the same order, in this viewpoint\'s own voice.' },
        },
        required: ['label', 'answers'],
      },
    },
  },
  required: ['title', 'caption', 'event', 'prompts', 'views'],
};

export const generateDrawerPerspectiveLens = (ask: DrawerAsk) =>
  generateChecked<DrawerPerspectiveLensData, DrawerPerspectiveLensData>('perspective-lens', perspectiveLensSchema,
    `You are designing a perspective lens: one event seen by several people or groups who were part of it, each answering `
    + `the same questions.\n${brief(ask)}\nGive each side a fair, historically grounded account of what it believed; do not `
    + `make any side a strawman. ${PLAIN}`,
    raw => raw, perspectiveLensProblems);

// ---------------------------------------------------------------------------

const wordAnatomySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'e.g. "Taking apart unbreakable"' },
    caption: { type: S, description: 'One sentence inviting the learner to switch pieces on and off.' },
    pieces: {
      type: Type.ARRAY, description: '2-5 word parts: exactly one root, plus prefixes and suffixes.',
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: S, description: 'The part as written, e.g. "un", "break", "able".' },
          type: { type: S, enum: ['prefix', 'root', 'suffix'] },
          meaning: { type: S, description: 'What the part means, a few words.' },
        },
        required: ['text', 'type', 'meaning'],
      },
    },
    forms: {
      type: Type.ARRAY, description: 'Every real English word these parts make, 2-8 of them, each including the root.',
      items: {
        type: Type.OBJECT,
        properties: {
          use: { type: Type.ARRAY, items: { type: S }, description: 'The texts of the parts this word uses.' },
          word: { type: S, description: 'The word, correctly spelled.' },
          meaning: { type: S, description: 'A short, kid-friendly definition.' },
        },
        required: ['use', 'word', 'meaning'],
      },
    },
  },
  required: ['title', 'caption', 'pieces', 'forms'],
};

export const generateDrawerWordAnatomy = (ask: DrawerAsk) =>
  generateChecked<DrawerWordAnatomyData, DrawerWordAnatomyData>('word-anatomy', wordAnatomySchema,
    `You are designing a word anatomy display: one word split into prefix, root and suffix. The learner switches parts on `
    + `and off and sees which combinations are real words.\n${brief(ask)}\nPick a word that shows the lesson's word parts. `
    + `List only combinations that are real, common English words. ${PLAIN}`,
    raw => raw, wordAnatomyProblems);

// ---------------------------------------------------------------------------

const shadesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S, description: 'e.g. "How big was it?"' },
    caption: { type: S, description: 'e.g. "Same sentence, stronger word."' },
    frame: { type: S, description: 'A short sentence with one blank written ___, e.g. "The pumpkin was ___."' },
    words: { type: Type.ARRAY, items: { type: S }, description: '4-7 words for the same idea, weakest first, each fitting the blank.' },
    weakLabel: { type: S, description: 'What the weak end means, e.g. "a little".' },
    strongLabel: { type: S, description: 'What the strong end means, e.g. "a lot".' },
  },
  required: ['title', 'caption', 'frame', 'words', 'weakLabel', 'strongLabel'],
};

export const generateDrawerShadesOfMeaning = (ask: DrawerAsk) =>
  generateChecked<DrawerShadesOfMeaningData, DrawerShadesOfMeaningData>('shades-of-meaning', shadesSchema,
    `You are designing a shades-of-meaning scale: words for one idea, ordered from weakest to strongest, each dropped into the `
    + `same sentence.\n${brief(ask)}\nChoose words the audience can read or will learn in this lesson, in an order most `
    + `adults would agree with.`,
    raw => raw, shadesOfMeaningProblems);

// ---------------------------------------------------------------------------

const rhythmGridSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: S }, caption: { type: S, description: 'One sentence telling the learner how to count along.' },
    tempo: { type: Type.INTEGER, description: 'Beats per minute, 60-140.' },
    beats: { type: Type.INTEGER, description: 'Beats in the pattern, usually 4.' },
    stepsPerBeat: { type: S, enum: ['1', '2', '4'], description: '1 for quarter notes, 2 for eighth notes, 4 for sixteenth notes.' },
    tracks: {
      type: Type.ARRAY, description: '1-4 rows, one per sound.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: S, description: 'e.g. "Stomp", "Clap", or a syllable.' },
          sound: { type: S, enum: [...RHYTHM_SOUNDS] },
          pattern: { type: S, description: 'beats x stepsPerBeat characters: "x" for a hit, "." for a rest, e.g. "xx..xx.." for 4 beats of 2 steps.' },
        },
        required: ['label', 'sound', 'pattern'],
      },
    },
  },
  required: ['title', 'caption', 'tempo', 'beats', 'stepsPerBeat', 'tracks'],
};

export const generateDrawerRhythmGrid = (ask: DrawerAsk) =>
  generateChecked<Omit<DrawerRhythmGridData, 'stepsPerBeat'> & { stepsPerBeat: string }, DrawerRhythmGridData>('rhythm-grid', rhythmGridSchema,
    `You are designing a rhythm grid: a short repeating beat on a grid of steps, one row per sound, that the learner plays and `
    + `edits.\n${brief(ask)}\nWrite the rhythm the lesson is about (a pattern, note values, the syllables of words). Keep it `
    + `simple enough to clap.`,
    raw => ({ ...raw, stepsPerBeat: Number(raw.stepsPerBeat) }), rhythmGridProblems);
