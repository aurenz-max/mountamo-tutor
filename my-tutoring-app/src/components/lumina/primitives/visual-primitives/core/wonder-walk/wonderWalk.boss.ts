/**
 * The wonder walk's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is `wonderWalk.card.ts`;
 * this file is what the preset cannot know — the content check, the ask, the spoken key and the harness's answers.
 * How each stop is answered is the author's choice (`respond`); the key, its misses and the spoken harness answers
 * are derived from the stored world (`wonderWalkSpoken.ts`), so a stop answered on screen has no key and plays its
 * taps. The live adapter and the journey row are built from it.
 */
import type { WonderWalkData, WonderWalkStop } from './WonderWalk';
import { hasText as text, spokenBoss } from '../../../../components/live-activity/boss';
import { spokenNumber } from '../../../../components/live-activity/runtime/spokenMissContract';
import { wonderWalkCard } from './wonderWalk.card';
import { stopAsk, stopHarnessTaps, type WonderWalkMiss } from './wonderWalkWorkspace';
import { countIn, goalHolds, solveMove } from './wonderWalkWorld';
import { tapKey, wordWorldError } from './wonderWalkWords';
import { RESPONDS, respondError, stopGiven, stopSay, stopSpokenKey, stopSpokenMisses } from './wonderWalkSpoken';

/** A word appears in a sentence (case-blind, plural-blind). */
const says = (sentence: string, word: string) =>
  new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)?\\b`).test(sentence.toLowerCase());

/** A number appears in a sentence, as a word or as digits. */
export const saysNumber = (sentence: string, n: number) =>
  new RegExp(`\\b(${spokenNumber(n)}|${n})\\b`, 'i').test(sentence);

const STOP_TYPES = new Set(['which-one', 'how-many', 'more-fewer', 'count-out', 'add-take', 'parts', 'teens', 'sort-count', 'count-on',
  'rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'blend', 'change-sound', 'letter-name', 'letter-sound', 'spell-word',
  'word-kinds', 'one-many', 'where-is', 'story-detail', 'story-order']);

/** A language stop is playable, its key is what its facts say, and the ask and why-card never say the answer picture. */
function wordsError(s: WonderWalkStop): string | null {
  const w = s.words!;
  const error = wordWorldError(w, s.correctOptionId);
  if (error) return error;
  const k = tapKey(w);
  const word = k ? w.things.find(t => t.id === k)?.word : undefined;
  // Cards that all show one picture (one or many, where it sits) are told apart by something else.
  const shared = w.answer.kind === 'tap' && w.answer.among.filter(id => id !== k).some(id => w.things.find(t => t.id === id)?.word === word);
  if (word && !shared && (says(s.ask, word) || says(s.why, word) || (w.answer.kind === 'tap' && w.answer.rule.type !== 'story' && says(s.narration, word)))) return 'it says its answer';
  if (/\[(sound|sounds|from|to)\]/.test(s.ask)) return 'its ask still holds a sound token';
  return null;
}
const STEP: Record<string, number> = { 'same-as': 0, 'one-more-than': 1, 'one-fewer-than': -1 };

/** A math stop is playable and its key is what its world says (the boss re-derives it; it never trusts the key). */
function worldError(s: WonderWalkStop): string | null {
  const w = s.world!;
  if (!Array.isArray(w.places) || !w.places.length || !Array.isArray(w.objects)) return 'its world is not drawn';
  const ids = new Set(w.places.map(p => p.id));
  if (w.objects.some(o => !ids.has(o.place) || !text(o.emoji))) return 'a thing sits in no place';
  const kindOf = (id: string) => w.places.find(p => p.id === id)?.kind;
  const a = w.answer;
  if (a.kind === 'tap') {
    const among = w.places.filter(p => p.choosable).map(p => p.id);
    if (among.length < 2 || among.length > 3) return 'a tap world needs 2-3 places to choose from';
    const counts = among.map(p => countIn(w.objects, [p]));
    const want = a.rule === 'has' ? a.number
      : a.rule === 'most' ? Math.max(...counts) : a.rule === 'fewest' ? Math.min(...counts)
      : a.ref && STEP[a.rule] !== undefined ? countIn(w.objects, [a.ref]) + STEP[a.rule] : undefined;
    const right = among.filter((_, i) => counts[i] === want);
    if (right.length !== 1 || s.correctOptionId !== `place-${right[0]}`) return 'its key is not the place the rule names';
    if (a.rule === 'has' && !saysNumber(s.ask, a.number!)) return 'the ask does not say the number';
    return null;
  }
  if (a.kind === 'number') {
    const n = countIn(w.objects, a.countPlaces, { color: a.countColor, word: a.countWord });
    if (n !== a.answer || s.correctOptionId !== `num-${n}` || !a.choices.includes(n) || new Set(a.choices).size !== a.choices.length) return 'its key is not the count';
    if (saysNumber(`${s.ask} ${s.why}`, n)) return 'the ask says the answer';
    return null;
  }
  if (a.kind === 'move') {
    if (s.correctOptionId) return 'a move world has no answer option';
    if (goalHolds(a.goal, w.objects, kindOf)) return 'its goal holds before anything moves';
    if (!solveMove(w)) return 'no moves reach its goal';
    return null;
  }
  return 'its answer has no kind';
}

/** Reject a walk whose stops cannot be played or give the answer away. */
export function validateWonderWalkData(value: unknown): WonderWalkData {
  const d = value as WonderWalkData;
  if (!d || !text(d.title) || !text(d.bigIdea) || !Array.isArray(d.challenges) || d.challenges.length < 2 || d.challenges.length > 6)
    throw new Error('Generated wonder walk has invalid lesson content.');
  const ids = new Set(d.challenges.map(s => s?.id));
  if (ids.size !== d.challenges.length) throw new Error('Wonder walk stops need distinct ids.');
  for (const s of d.challenges as WonderWalkStop[]) {
    if (!s || !STOP_TYPES.has(s.challengeType) || !text(s.id) || !text(s.ask) || !text(s.narration) || !text(s.idea) || !text(s.why) || !Array.isArray(s.options))
      throw new Error(`Wonder walk stop ${s?.id} cannot be played as generated.`);
    if (s.challengeType === 'which-one') {
      if (s.options.length < 2 || s.options.length > 3 || new Set(s.options.map(o => o?.id)).size !== s.options.length
          || s.options.some(o => !o || !text(o.id) || !text(o.word) || !text(o.emoji)) || !s.options.some(o => o.id === s.correctOptionId))
        throw new Error(`Wonder walk stop ${s.id} cannot be played as generated.`);
      const right = s.options.find(o => o.id === s.correctOptionId)!;
      if (says(s.ask, right.word) || says(s.narration, right.word) || says(s.why, right.word))
        throw new Error(`Wonder walk stop ${s.id} says its answer.`);
    } else {
      const error = s.words ? wordsError(s) : s.world ? worldError(s) : 'a math or language stop has no world';
      if (error) throw new Error(`Wonder walk stop ${s.id}: ${error}.`);
    }
    if (s.respond !== undefined && !RESPONDS.includes(s.respond)) throw new Error(`Wonder walk stop ${s.id}: respond is ${RESPONDS.join(', ')}.`);
    const respond = respondError(s);
    if (respond) throw new Error(`Wonder walk stop ${s.id}: ${respond}.`);
  }
  return d;
}

export const wonderWalkBoss = spokenBoss<WonderWalkData, WonderWalkStop, WonderWalkMiss>({
  card: wonderWalkCard,
  validate: validateWonderWalkData,
  items: data => data.challenges,
  speech: {
    ask: stopAsk,
    // Null on a stop answered on screen (a place, a move, a sort, a track): the activity checks it and it plays `show`.
    key: stopSpokenKey,
    given: stopGiven,
    misses: stopSpokenMisses,
    say: stopSay,
    modeOf: stop => stop.challengeType,
    // A tap on a picture, a place or a number; a move world is a tap per move (thing, then place when it could go to
    // more than one), then Done.
    show: (right, stop) => {
      const taps = stopHarnessTaps(stop);
      const seq = right ? taps.correct : taps.wrong;
      if (!seq) throw new Error('wonder-walk: no wrong choice to tap');
      return seq.map(target => ({ type: 'touch' as const, target }));
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/wonder-walk/WonderWalk.tsx',
    instanceId: 'wonder-walk-k',
    defaults: { grade: 'Kindergarten', mode: 'which-one', topic: 'Living and nonliving things' },
    mounted: '[data-pip-object="scene"]',
  },
});
