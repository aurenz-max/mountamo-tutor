/**
 * diScript — script data for the Direct Instruction Bench.
 *
 * The bench validates the DI delivery loop (I do → we do → you do) from the
 * TUTOR's perspective: a deterministic engine authors every beat, the Gemini
 * Live tutor is the voice, the Azure→Gemini spoken-word ladder is the truth
 * channel, and the verdict conditions the tutor's NEXT utterance.
 *
 * Two modes:
 *  - 'scripted': the engine authors the verify/correction lines; the tutor is
 *    a pure voice actor. Validates timing + verbatim compliance (fidelity %).
 *  - 'informed': the judge verdict is injected as a [JUDGE_VERDICT] message
 *    and the tutor authors the verify/correction line itself, per the DI
 *    procedure in its system directives. Validates tutor comprehension.
 */

import type { TutoringScaffold } from '../../types';

export type DIItemKind = 'sound' | 'word';

export interface DIItem {
  id: string;
  kind: DIItemKind;
  /** What the item looks like on screen ("m", "sam"). */
  display: string;
  /** How the tutor voices it ("mmm", "sam"). Editable bench lever. */
  spoken: string;
  /** Reference text sent to the Azure/Gemini judge. Editable bench lever —
   *  the right reference for an isolated phoneme is an open empirical
   *  question this bench exists to answer. */
  reference: string;
  enabled: boolean;
}

/** Continuous sounds first (m, s, a, f) — the DISTAR opening set — plus two
 *  decodable words built from them. */
export const DEFAULT_ITEMS: DIItem[] = [
  { id: 'sound-m', kind: 'sound', display: 'm', spoken: 'mmm', reference: 'mmm', enabled: true },
  { id: 'sound-s', kind: 'sound', display: 's', spoken: 'sss', reference: 'sss', enabled: true },
  { id: 'sound-a', kind: 'sound', display: 'a', spoken: 'aaa', reference: 'aaa', enabled: true },
  { id: 'sound-f', kind: 'sound', display: 'f', spoken: 'fff', reference: 'fff', enabled: false },
  { id: 'word-sam', kind: 'word', display: 'sam', spoken: 'sam', reference: 'sam', enabled: true },
  { id: 'word-mat', kind: 'word', display: 'mat', spoken: 'mat', reference: 'mat', enabled: false },
];

// ---------------------------------------------------------------------------
// Script lines (the engine's authored beats)
// ---------------------------------------------------------------------------

export const modelLine = (it: DIItem) =>
  it.kind === 'sound'
    ? `This sound is ${it.spoken}. Listen: ${it.spoken}. ${it.spoken}.`
    : `This word is ${it.spoken}. Listen: ${it.spoken}.`;

export const guideLine = (it: DIItem) => `Say it with me: ${it.spoken}.`;

export const testLine = (it: DIItem) =>
  it.kind === 'sound' ? `Your turn. What sound?` : `Your turn. What word?`;

export const verifyLine = (it: DIItem) => `Yes, ${it.spoken}.`;

export const correctionLine = (it: DIItem) =>
  it.kind === 'sound'
    ? `That sound is ${it.spoken}. What sound?`
    : `That word is ${it.spoken}. What word?`;

export const unclearLine = (it: DIItem) =>
  `Say it big and loud. ${testLine(it)}`;

/** Wrap a scripted line in its cue tag. The persona directive tells the tutor
 *  to speak the quoted line verbatim and nothing else. */
export const scriptedCue = (tag: string, line: string) =>
  `[${tag}] Speak this line exactly, and nothing else: "${line}"`;

/** Informed-mode verdict injection — the tutor authors its own next line. */
export const verdictCue = (
  it: DIItem,
  heard: string | null,
  outcome: 'match' | 'no-match' | 'unclear' | 'no-speech',
) => {
  const heardPart =
    outcome === 'no-speech'
      ? 'The student said nothing.'
      : `The speech judge heard the student say "${heard ?? '(unclear)'}".`;
  return (
    `[JUDGE_VERDICT] ${heardPart} Judge outcome: ${outcome}. ` +
    `The target was "${it.spoken}". Respond out loud now, following the correction procedure.`
  );
};

// ---------------------------------------------------------------------------
// Tutor persona — installed via the PrimitiveContext.tutoring override
// ---------------------------------------------------------------------------

export const DI_TUTORING: TutoringScaffold = {
  taskDescription:
    'Direct Instruction drill (developer bench). A script engine runs a kindergarten ' +
    'reading drill; you are the voice. You only ever speak what the tagged messages ' +
    'instruct — you never freelance.',
  scaffoldingLevels: {
    level1: 'Not used — this session is fully scripted by the bench engine.',
    level2: 'Not used — this session is fully scripted by the bench engine.',
    level3: 'Not used — this session is fully scripted by the bench engine.',
  },
  aiDirectives: [
    {
      title: 'SCRIPT EXECUTOR',
      instruction:
        'Messages tagged [DI_MODEL], [DI_GUIDE], [DI_TEST], [DI_VERIFY], [DI_CORRECT], or ' +
        '[DI_UNCLEAR] contain one line in double quotes. Speak that quoted line EXACTLY as ' +
        'written — word for word. Say nothing before it and nothing after it. Do not greet, ' +
        'encourage, explain, or improvise. Do not ask questions of your own.',
    },
    {
      title: 'SOUND PRONUNCIATION',
      instruction:
        'A stretched letter sequence like "mmm", "sss", "aaa", or "fff" is a continuous ' +
        'letter SOUND, held for about two seconds — the sound at the start of "man", "sun", ' +
        '"apple", "fun". Never say a letter name, never spell it out.',
    },
    {
      title: 'JUDGE VERDICTS',
      instruction:
        'Messages tagged [JUDGE_VERDICT] report what a speech engine heard the student say. ' +
        'When asked to respond, follow the Direct Instruction correction procedure. Correct: ' +
        'confirm in three words or fewer, for example "Yes, mmm." Incorrect: calmly re-model ' +
        'and immediately re-test, for example "That sound is mmm. What sound?" Never say ' +
        '"no" or "wrong", never explain the error, never repeat the incorrect attempt.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Every utterance in this session is one short line. Never exceed one sentence unless ' +
        'the quoted script line itself is longer. A silent student is handled by the engine, ' +
        'not by you — never fill silence.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Fidelity — did the tutor speak the scripted line verbatim?
// ---------------------------------------------------------------------------

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export interface Fidelity {
  /** Fraction of scripted tokens present in the transcript (0..1). */
  coverage: number;
  /** Transcript tokens beyond the scripted line (freelancing indicator). */
  extras: number;
}

export function scoreFidelity(scripted: string, transcript: string): Fidelity {
  const want = tokenize(scripted);
  const got = tokenize(transcript);
  if (want.length === 0) return { coverage: 1, extras: got.length };
  const pool = new Map<string, number>();
  for (const t of got) pool.set(t, (pool.get(t) ?? 0) + 1);
  let matched = 0;
  for (const t of want) {
    const n = pool.get(t) ?? 0;
    if (n > 0) {
      matched++;
      pool.set(t, n - 1);
    }
  }
  const extras = got.length - matched;
  return { coverage: matched / want.length, extras };
}
