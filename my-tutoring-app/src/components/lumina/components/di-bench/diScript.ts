/** Direct Instruction data and the Live-judged per-item cues. */

import type { TutoringScaffold } from '../../types';
import type { DIItem } from './diBenchModel';

export const DEFAULT_ITEMS: DIItem[] = [
  {
    id: 'sound-m', kind: 'sound', display: 'm', spoken: 'mmm', keyword: 'moon', reference: 'mmm',
    asrAliases: ['m', 'mm', 'mmm', 'hm', 'hmm', 'mhm', 'um'],
  },
  {
    id: 'sound-s', kind: 'sound', display: 's', spoken: 'sss', keyword: 'sun', reference: 'sss',
    // Cross-check-only tradeoff: Live ASR often lexicalizes a sustained /s/
    // as "shh". The Live tutor judges from the audio it heard; these aliases
    // only measure transcript agreement.
    asrAliases: ['s', 'ss', 'sss', 'ess', 'sh', 'shh', 'hiss'],
  },
  {
    id: 'sound-a',
    kind: 'sound',
    display: 'a',
    spoken: 'aaa',
    keyword: 'apple',
    elicitation: 'keyword',
    reference: 'aaa',
    asrAliases: ['apple'],
  },
  { id: 'word-sam', kind: 'word', display: 'sam', spoken: 'sam', reference: 'sam', asrAliases: ['sam'] },
];

const sentenceCase = (value: string | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

export const modelLine = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `The first sound in ${it.keyword} is short ${it.display}. Listen: ${it.keyword}.`
    : it.kind === 'sound'
      // Single model repetition: run-2 timing showed tutor talk-time dominates
      // the per-item cycle (~10s of ~13s); pacing is the product at this age.
      ? `This sound is ${it.spoken}, as in ${it.keyword}. Listen: ${it.spoken}.`
      : `This word is ${it.spoken}. Listen: ${it.spoken}.`;

export const guideLine = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `Together, say ${it.keyword}: ${it.keyword}.`
    : it.kind === 'sound'
      ? `Together: ${it.spoken}, as in ${it.keyword}.`
      : `Together: ${it.spoken}.`;

export const testLine = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `Your turn. Say ${it.keyword}.`
    : it.kind === 'sound'
      ? 'Your turn. What sound?'
      : 'Your turn. What word?';

/** Affirmation branch. MUST begin with "Yes" — the bench parses that sentinel. */
export const verifyLine = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `Yes. ${sentenceCase(it.keyword)} starts with short ${it.display}.`
    : `Yes, ${it.spoken}.`;

/** Correction branch. MUST begin with "My turn" — the bench parses that sentinel. */
export const correctionLine = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `My turn: ${it.keyword}. Your turn. Say ${it.keyword}.`
    : it.kind === 'sound'
      ? `My turn: ${it.spoken}, as in ${it.keyword}. Your turn. What sound?`
      : `My turn: ${it.spoken}. Your turn. What word?`;

const targetDescription = (it: DIItem) =>
  it.elicitation === 'keyword'
    ? `the word "${it.keyword}"`
    : it.kind === 'sound'
      ? `the continuous sound ${it.spoken}`
      : `the word "${it.spoken}"`;

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt itself; the bench reads which branch it took
 * from the output transcript and alone decides progression.
 */
export const judgingContract = (it: DIItem) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against ${targetDescription(it)}:
- Correct or reasonably close for a kindergartener: say exactly "${verifyLine(it)}" and stop.
- Wrong, missing, or a different sound: say exactly "${correctionLine(it)}" and stop, then wait again.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told otherwise. */
export const itemCue = (it: DIItem, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk kindergarten practice. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward. */
export const moveOnCue = (it: DIItem, next?: DIItem) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our practice. Great work today!"`;

export const DI_TUTORING: TutoringScaffold = {
  taskDescription:
    'Live-judged Direct Instruction bench for a kindergarten learner. You speak the exact ' +
    'scripted lines from each bracketed application message and judge each learner attempt ' +
    'from the audio you heard, using only the two allowed reply branches.',
  scaffoldingLevels: {
    level1: 'Repeat the prompt once, slowly.',
    level2: 'Model the requested sound or word, then ask for one retry.',
    level3: 'Accept the attempt warmly and continue as instructed.',
  },
  aiDirectives: [
    {
      title: 'LIVE-JUDGED DIRECT INSTRUCTION',
      instruction:
        'Messages tagged [DI_ITEM], [DI_MOVE_ON], or [DI_COMPLETE] contain the only lesson ' +
        'words you may speak. The square-bracket label is private metadata: never speak, ' +
        'reproduce, or invent it. Each [DI_ITEM] message includes a two-branch judging rule: ' +
        'affirmations must begin with "Yes" and corrections must begin with "My turn", using ' +
        'the exact quoted lines. Never begin any other sentence with those words. Judge ' +
        'honestly from the audio: affirm a reasonable kindergarten production of the target; ' +
        'correct a wrong, missing, or different production. Do not praise to be kind. The ' +
        'application decides which item comes next; never introduce one yourself.',
    },
    {
      title: 'SOUND PRONUNCIATION',
      instruction:
        'A stretched letter sequence like "mmm", "sss", or "aaa" is a continuous ' +
        'letter sound held for about two seconds. Never say a letter name and never spell it out.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Speak only the exact quoted lesson text. Never narrate judging, scoring, or ' +
        'application state. Keep pacing brisk: no filler, no chit-chat.',
    },
  ],
};

const tokenize = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

export interface Fidelity {
  coverage: number;
  extras: number;
}

export function scoreFidelity(scripted: string, transcript: string): Fidelity {
  const want = tokenize(scripted);
  const got = tokenize(transcript);
  if (want.length === 0) return { coverage: 1, extras: got.length };

  const dp = Array.from({ length: want.length + 1 }, () =>
    new Array<number>(got.length + 1).fill(0));
  for (let i = 1; i <= want.length; i++) {
    for (let j = 1; j <= got.length; j++) {
      dp[i][j] = want[i - 1] === got[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const orderedMatches = dp[want.length][got.length];
  return {
    coverage: orderedMatches / want.length,
    extras: Math.max(0, got.length - orderedMatches),
  };
}
