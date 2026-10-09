/**
 * figurative-language-finder on the teaching workspace (OB-7L, following R12). Three kinds of item:
 *   - find (the older modes): the learner taps a sentence of the passage and names the figure of speech in it. Any
 *     figure in any order passes. A tagged instance of that type in that sentence passes in code; a sentence with no
 *     tagged instance of that type goes to the writing judge, because generated passages hold devices nobody tagged
 *     ("frogs croak" in a sound-devices passage).
 *   - meaning (the older modes' translate step): the learner writes what a tagged phrase really means; the writing
 *     judge checks it. An idiom's `literalMeaning` is its word-for-word reading, so it is never used as a key.
 *   - make (`build_figurative`, open build): the learner writes their own simile, metaphor, ... about a subject.
 * No instance is marked before the learner finds it.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';

export type FigType = 'simile' | 'metaphor' | 'personification' | 'hyperbole' | 'idiom' | 'alliteration' | 'onomatopoeia' | 'imagery';
export interface FigInstance { instanceId: string; text: string; type: FigType; literalMeaning?: string }
export interface FigMake { id: string; device: FigType; subject: string }
export interface FigPayload {
  passage?: string; instances?: FigInstance[]; translateInstanceIds?: string[]; availableTypes?: FigType[];
  classifyTypeChoices?: FigType[]; task?: 'figurative_build'; makes?: FigMake[];
}

export type FigMiss = 'wrong_type' | 'no_device' | 'already_found' | 'too_short' | 'unchanged' | 'not_sense' | 'wrong_job';
export const FIND_MISSES: readonly FigMiss[] = ['wrong_type', 'no_device', 'already_found'];
export const MEANING_MISSES: readonly FigMiss[] = ['too_short', 'unchanged', 'not_sense', 'wrong_job'];
export const MAKE_MISSES: readonly FigMiss[] = ['too_short', 'not_sense', 'wrong_job'];

/** What each figure is, in a learner's words (the device guide lever, and the judge's criterion). */
export const CLUE: Record<FigType, string> = {
  simile: 'compares two different things using like or as',
  metaphor: 'says one thing IS a different thing, without like or as',
  personification: 'gives a human action or feeling to something that is not a person',
  hyperbole: 'exaggerates so much it cannot really be true',
  idiom: 'is a saying whose meaning is different from its words',
  alliteration: 'has nearby words that begin with the same sound',
  onomatopoeia: 'uses a word that sounds like the sound it names',
  imagery: 'uses words that help you see, hear, smell, taste or feel something',
};

export type FigItem =
  | { id: string; kind: 'find' }
  | { id: string; kind: 'meaning'; phrase: string; type: FigType; sentence: string; key?: string }
  | { id: string; kind: 'make'; device: FigType; subject: string };

export const sentencesOf = (passage: string) => (passage.match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? [passage]).map(s => s.trim()).filter(Boolean);
const low = (s: string) => s.toLowerCase();
/** Index of the one sentence holding the phrase, or -1. */
export const sentenceOf = (sentences: readonly string[], phrase: string) => sentences.findIndex(s => low(s).includes(low(phrase.trim())));

const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
const MAX_FIND = 4;
const MAX_MEANING = 3;

export function figItems(p: FigPayload): FigItem[] {
  if (p?.task === 'figurative_build') {
    return (p.makes ?? []).filter(m => m && CLUE[m.device] && m.device !== 'idiom' && typeof m.subject === 'string' && m.subject.trim())
      .slice(0, 5).map((m, i) => ({ id: m.id || `m${i + 1}`, kind: 'make' as const, device: m.device, subject: m.subject.trim() }));
  }
  const sentences = sentencesOf(p?.passage ?? '');
  const located = (p?.instances ?? []).filter(i => i && CLUE[i.type] && typeof i.text === 'string' && sentenceOf(sentences, i.text) >= 0);
  if (located.length < 2) return [];
  const finds: FigItem[] = located.slice(0, MAX_FIND).map((_, n) => ({ id: `find${n + 1}`, kind: 'find' }));
  const meanings: FigItem[] = (p.translateInstanceIds ?? []).map(id => located.find(i => i.instanceId === id)).filter((i): i is FigInstance => !!i)
    .slice(0, MAX_MEANING).map(i => ({ id: `mean-${i.instanceId}`, kind: 'meaning', phrase: i.text.trim(), type: i.type,
      sentence: sentences[sentenceOf(sentences, i.text)], ...(i.type !== 'idiom' && i.literalMeaning ? { key: i.literalMeaning } : {}) }));
  return [...finds, ...meanings];
}

const NEAR: FigType[] = ['simile', 'metaphor', 'personification', 'hyperbole', 'idiom', 'alliteration', 'onomatopoeia', 'imagery'];
/** The chips: the payload's narrowed choices, else its types, always holding every tagged type, and at least three so
 *  naming is never a coin toss (an idiom passage lists only "idiom"). */
export function typeChoices(p: FigPayload): FigType[] {
  const tagged = (p.instances ?? []).map(i => i.type);
  const base = (p.classifyTypeChoices?.length ? p.classifyTypeChoices : p.availableTypes) ?? [];
  const out = Array.from(new Set<FigType>([...base, ...tagged])).filter(t => CLUE[t]);
  for (const t of NEAR) if (out.length < 3 && !out.includes(t)) out.push(t);
  return out;
}

export interface Found { key: string; sentence: number; type: FigType; text?: string }

/** A find, decided in code where the tags decide it; 'judge' when only a model can say. */
export function findVerdict(p: FigPayload, found: readonly Found[], sentence: number, type: FigType):
    { pass: Found } | { miss: FigMiss } | 'judge' {
  const sentences = sentencesOf(p.passage ?? '');
  const here = (p.instances ?? []).filter(i => sentenceOf(sentences, i.text) === sentence);
  const open = here.find(i => i.type === type && !found.some(f => f.key === i.instanceId));
  if (open) return { pass: { key: open.instanceId, sentence, type, text: open.text.trim() } };
  if (here.some(i => i.type === type) || found.some(f => f.key === `s${sentence}:${type}`)) return { miss: 'already_found' };
  // The tags describe a tagged sentence: a figure of another kind there is a wrong name. Untagged sentences go to the judge.
  return here.length ? { miss: 'wrong_type' } : 'judge';
}
export const judgedFind = (sentence: number, type: FigType): Found => ({ key: `s${sentence}:${type}`, sentence, type });
/** Only untagged sentences reach the judge, so its "no" means no figure of that kind. */
export const judgedMiss = (): FigMiss => 'no_device';

const words = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
const norm = (s: string) => low(s).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

export function writtenShapeMiss(item: FigItem, made: string): FigMiss | undefined {
  if (item.kind === 'meaning') {
    if (norm(made).includes(norm(item.phrase))) return 'unchanged';
    if (words(made).length < 3) return 'too_short';
  }
  if (item.kind === 'make' && words(made).length < 4) return 'too_short';
  return undefined;
}

export const askFor = (item: FigItem): string => item.kind === 'find'
  ? 'Find a figure of speech in the passage. Tap its sentence, then choose what kind it is.'
  : item.kind === 'meaning' ? `What does "${item.phrase}" really mean here? Write it in plain words.`
    : `Write a sentence with ${item.device === 'onomatopoeia' || item.device === 'alliteration' || item.device === 'imagery' ? '' : 'a '}${item.device} about ${item.subject}.`;

export const figAssignment = (item: FigItem): TeachingAssignment => ({ id: item.id, task: askFor(item), response: 'gesture' });

export function findJudgeRequest(p: FigPayload, sentence: number, type: FigType, grade?: string): WordBuildJudgeRequest {
  return { ask: `Find a ${type} in the passage. (It counts only if this sentence really has a ${type}: something that ${CLUE[type]}.)`,
    made: sentencesOf(p.passage ?? '')[sentence] ?? '', unit: 'writing', context: p.passage, strict: true, ...(grade ? { grade } : {}) };
}

export function writtenJudgeRequest(item: FigItem, made: string, passage: string | undefined, grade?: string): WordBuildJudgeRequest {
  const base = { made: made.trim(), unit: 'writing' as const, ...(grade ? { grade } : {}) };
  if (item.kind === 'meaning') {
    const ask = `${askFor(item)} (It says in plain words what the ${item.type} means here, not what its words say one by one.`;
    const key = item.key ? ` A good answer means about: ${clip(item.key, 90)}` : '';
    return { ...base, context: item.sentence, ask: `${clip(ask + key, 298)})` };
  }
  if (item.kind === 'make') return { ...base, context: passage ?? '',
    ask: `${askFor(item)} (It is about ${item.subject} and it ${CLUE[item.device]}.)`, strict: true };
  throw new Error('A find is not written');
}

// ── Scene ────────────────────────────────────────────────────────────────────

export function figScene(item: FigItem, found: readonly Found[], picked: { sentence?: string; type?: FigType; written?: string }, inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: askFor(item),
    ...(item.kind === 'find'
      ? { sentencePicked: clip(picked.sentence ?? 'none yet'), typePicked: picked.type ?? 'none yet',
          foundSoFar: clip(found.map(f => `${f.type}${f.text ? ` "${f.text}"` : ''}`).join('; ') || 'nothing yet') }
      : { ...(item.kind === 'meaning' ? { sentence: clip(item.sentence) } : {}), written: clip(picked.written?.trim() || 'empty') }),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: item.kind === 'find'
      ? 'The learner taps a sentence of the passage, chooses a kind of figure of speech and presses "I\'m done!". Any '
        + 'figure the passage has passes, in any order. You cannot tap for the learner and must not say which sentence holds one.'
      : 'The learner types and presses "I\'m done!"; the builder checks it does the job and makes sense. Spelling is not '
        + 'judged and many answers pass. You cannot type for the learner.',
  } };
}

// ── Levers ───────────────────────────────────────────────────────────────────
export const GUIDE_LEVER = 'device_guide';
export const MODEL_LEVER = 'model_figure';
export const MARK_LEVER = 'mark_sentences';
export const FRAME_LEVER = 'fill_frame';

/** One worked example per figure, on a subject no passage here is about (code-owned). */
export const MODEL_FIGURE: Record<FigType, { sentence: string; phrase: string; means: string }> = {
  simile: { sentence: 'My cat is as quiet as a shadow.', phrase: 'as quiet as a shadow', means: 'My cat makes no sound.' },
  metaphor: { sentence: 'My little brother is a tornado.', phrase: 'is a tornado', means: 'My brother is wild and messy.' },
  personification: { sentence: 'The old car groaned up the hill.', phrase: 'groaned', means: 'The car made a low, tired noise.' },
  hyperbole: { sentence: 'This backpack weighs a ton.', phrase: 'weighs a ton', means: 'The backpack is very heavy.' },
  idiom: { sentence: 'That test was a piece of cake.', phrase: 'a piece of cake', means: 'The test was very easy.' },
  alliteration: { sentence: 'Silly snakes slide slowly.', phrase: 'Silly snakes slide slowly', means: 'Snakes move slowly in a funny way.' },
  onomatopoeia: { sentence: 'The bees buzzed by the window.', phrase: 'buzzed', means: 'The bees made a humming sound.' },
  imagery: { sentence: 'Warm, sticky syrup dripped off the golden pancakes.', phrase: 'warm, sticky syrup', means: 'The syrup was warm and thick.' },
};
/** A starter frame per figure for the make item (the simplify lever puts it in the box). */
export const FRAME: Record<FigType, string> = {
  simile: '___ is as ___ as ___.', metaphor: '___ is a ___.', personification: 'The ___ ___ like a person would.',
  hyperbole: '___ is so ___ that ___.', idiom: '', alliteration: '___ ___ (words that start with the same sound)',
  onomatopoeia: 'The ___ went ___!', imagery: 'The ___ looked / sounded / felt ___.',
};

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly FigMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function figLevers(item: FigItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  if (item.kind === 'find') return [
    lever(GUIDE_LEVER, 'help', ['wrong_type', 'no_device'], 'The learner names the wrong kind, or picks a plain sentence.',
      'Shows what each kind of figure of speech does, next to its button. Never marks a sentence.', pulled),
    lever(MODEL_LEVER, 'help', ['wrong_type', 'no_device'], 'The learner does not know what a figure looks like in a sentence.',
      'Shows one sentence that is NOT in this passage with its figure marked and named.', pulled),
    lever(MARK_LEVER, 'simplify', ['no_device'], 'The learner keeps picking sentences with no figure in them.',
      'Marks the sentences that still hold a figure, so the learner only has to choose among them and name the kind.', pulled),
  ];
  if (item.kind === 'meaning') return [
    lever(MODEL_LEVER, 'help', ['unchanged', 'not_sense', 'wrong_job'], 'The learner copies the phrase or says what its words say.',
      `Shows a different ${item.type} with what it really means, before and after.`, pulled),
  ];
  return [
    lever(GUIDE_LEVER, 'help', ['wrong_job'], 'The learner\'s sentence is not this kind of figure.', `Shows what a ${item.device} does.`, pulled),
    lever(MODEL_LEVER, 'help', ['wrong_job', 'not_sense'], 'The learner does not know how to start.',
      `Shows one ${item.device} about a DIFFERENT subject.`, pulled),
    lever(FRAME_LEVER, 'simplify', ['too_short', 'wrong_job'], 'The learner cannot write it from a blank box.',
      `Puts a ${item.device} frame with blanks in the box for the learner to fill.`, pulled),
  ];
}

export function figMissWords(miss: FigMiss | undefined, type?: FigType): string {
  switch (miss) {
    case 'wrong_type': return 'That sentence has a figure of speech, but not that kind. Look at how it works.';
    case 'no_device': return type ? `I don't see ${type === 'alliteration' || type === 'onomatopoeia' || type === 'imagery' ? '' : 'a '}${type} there. Read the sentence again.` : 'Look for words that do not mean just what they say.';
    case 'already_found': return 'You already found that one. Look for another.';
    case 'too_short': return 'Write a whole sentence.';
    case 'unchanged': return 'Say it in your own plain words, without the phrase.';
    case 'not_sense': return 'Read it out loud. Does it make sense?';
    case 'wrong_job': return 'Read the task again. Does your sentence do that?';
    default: return 'Not quite. Try again.';
  }
}
