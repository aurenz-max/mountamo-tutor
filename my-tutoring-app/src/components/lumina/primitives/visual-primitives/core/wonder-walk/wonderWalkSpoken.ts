/**
 * How the child answers a wonder-walk stop, and the spoken key code derives for it (agent-primitive I11,
 * `.claude/skills/agent-primitive/SKILL.md`).
 *
 * The author chooses what the child produces (`stop.respond`); code works out whether that fits the stop and how it
 * is judged:
 * - `show`: the child answers on screen (a place, a move, a sort, a track) and the activity checks it.
 * - `say`: the child says the one answer, or taps it: a number, the right picture's word, a letter. The tutor judges
 *   the words against the key below; the activity judges a tap.
 * - `say-any`: the child says ANY word the stop's rule holds for (a word that rhymes with cat, starts with /s/, is an
 *   animal), or taps the one card that fits. The key accepts every such word; the examples come from the word library.
 *
 * Code decides what can be said: a picture or letter answer, or a number. A place, a move, a sort, a track, and a card
 * whose picture all the cards share (one or many, where it sits) are shown, never said. A stop with a sayable answer is
 * spoken unless the author says otherwise (USER 10-13: voice beside the tap), so a saved stop with no `respond` reads
 * as `say` when it can be said.
 *
 * Pure and light: the boss, the component's workspace, the author's checks and the tests read the same rules.
 */
import type { KnownMiss } from '../../../../components/live-activity/runtime/spokenMissContract';
import { numberMisses, spokenNumber } from '../../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../../components/live-activity/spokenKey';
import type { WonderWalkStop } from './WonderWalk';
import { countIn } from './wonderWalkWorld';
import { stopCardsLine } from './wonderWalkWorkspace';
import { isMark, markName, tapKey, thingOf, type WordRule, type WordThing } from './wonderWalkWords';

export type Respond = 'show' | 'say' | 'say-any';
export const RESPONDS: readonly Respond[] = ['show', 'say', 'say-any'];

/** Rules a `say-any` stop can use: each has many right words, and code can tell a right word from its sounds or kind. */
export const SAY_ANY_RULES = new Set<WordRule['type']>(['rhymes', 'sound', 'same-sound', 'kind']);

const plural = (w: string) => (/[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(w) ? `${w}es` : w === 'fish' || w === 'sheep' ? w : `${w}s`);

/** The one answer a child could say, or null when the answer is shown (a place, a move, a sort, a track, a shared picture). */
export type Sayable = { number: number } | { word: string; thing?: WordThing } | { letter: string };

export function sayableOf(stop: WonderWalkStop): Sayable | null {
  const w = stop.world;
  if (w) return w.answer.kind === 'number' ? { number: w.answer.answer } : null;
  const ww = stop.words;
  if (ww) {
    if (ww.answer.kind !== 'tap') return null;
    const k = tapKey(ww);
    const t = k ? thingOf(ww, k) : undefined;
    if (!t) return null;
    if (t.letter) return { letter: t.letter };
    // A word tile is said as its word; an end mark is shown.
    if (t.tile) return isMark(t.tile) ? null : { word: t.tile, thing: t };
    // Cards that all show one picture are told apart by something else (one or many, where it sits): no word names it.
    if (ww.answer.among.some(id => id !== k && thingOf(ww, id)?.word === t.word)) return null;
    return t.word ? { word: t.word, thing: t } : null;
  }
  const right = stop.options.find(o => o.id === stop.correctOptionId);
  return right ? { word: right.word } : null;
}

/** What the child produces on this stop: the author's choice, or `say` on a sayable stop that names none. */
export const respondOf = (stop: WonderWalkStop): Respond => stop.respond ?? (sayableOf(stop) ? 'say' : 'show');

const ruleOf = (stop: WonderWalkStop): WordRule | undefined => (stop.words?.answer.kind === 'tap' ? stop.words.answer.rule : undefined);

/** Why the author's `respond` does not fit this stop, as a sentence the author can act on; null when it fits. */
export function respondError(stop: WonderWalkStop): string | null {
  const respond = respondOf(stop);
  const sayable = sayableOf(stop);
  const what = stop.world ? (stop.world.answer.kind === 'move' ? 'moves' : 'a place to tap')
    : stop.words ? (stop.words.answer.kind === 'sort' ? 'a sort' : stop.words.answer.kind === 'order' ? 'an order on a track' : stop.words.things.some(t => isMark(t.tile)) ? 'an end mark' : 'a card the cards share by picture') : 'a picture';
  if (respond === 'show' && sayable) {
    const it = 'number' in sayable ? `the number ${sayable.number}` : 'letter' in sayable ? 'a letter' : 'a word';
    return `the answer is ${it}, which a child can say: respond say${ruleOf(stop) && SAY_ANY_RULES.has(ruleOf(stop)!.type) ? ' or say-any' : ''} (the tap still counts)`;
  }
  if (respond !== 'show' && !sayable) return `the answer is ${what}, which a child cannot say as one word or number: respond show`;
  if (respond === 'say-any') {
    const rule = ruleOf(stop);
    if (!rule || !SAY_ANY_RULES.has(rule.type)) return `say-any needs a rule with many right words (rhymes, sound, same-sound, kind), not ${rule?.type ?? 'this answer'}`;
    if ((rule.type === 'sound' || rule.type === 'same-sound') && rule.at === 'middle') return 'say-any on a sound works for the first or last sound, not the middle';
    if ((stop.sayAny?.length ?? 0) < 3) return 'say-any needs at least 3 other library words that fit the rule, so a child has real words to think of; pick a more common sound or rhyme';
  }
  return null;
}

/** The rule in the judge's words, for a `say-any` key. */
function anyRule(stop: WonderWalkStop): { acceptRule: string; signatureError?: string } | null {
  const ww = stop.words;
  const rule = ruleOf(stop);
  if (!ww || !rule) return null;
  const refWord = (id: string) => ww.refs.find(r => r.id === id)?.word ?? thingOf(ww, id)?.word ?? '';
  const sound = (phone: string) => `"${ww.say ?? phone}" (the sound the scene's saySounds says)`;
  switch (rule.type) {
    case 'rhymes': return { acceptRule: `Any real word that rhymes with "${refWord(rule.with)}" counts, made up by the learner or one of the cards.`,
      signatureError: `"${refWord(rule.with)}" itself, or a word that only starts the same way, is not a rhyme.` };
    case 'sound': return { acceptRule: `Any real word whose ${rule.at} sound is ${sound(rule.is)} counts, made up by the learner or one of the cards.`,
      signatureError: `A word that has the sound somewhere else, or only shares the letter, is not right.` };
    case 'same-sound': return { acceptRule: `Any real word whose ${rule.at} sound is the ${rule.at} sound of "${refWord(rule.as)}" counts, made up by the learner or one of the cards.`,
      signatureError: `"${refWord(rule.as)}" itself does not count, and neither does a word that only has the sound somewhere else.` };
    case 'kind': return { acceptRule: `Any real ${rule.is === 'action' ? 'doing-word (something you do)' : `${rule.is} (a kind of ${rule.is})`} counts, named by the learner or one of the cards.` };
    default: return null;
  }
}

/** The number in every form a Kindergartner says it ("13", "thirteen", "ten and three" on a ten-frame). */
function numberForms(stop: WonderWalkStop, n: number): string[] {
  const out = [spokenNumber(n)];
  const framed = stop.world?.places.some(p => p.kind === 'ten-frame' || p.arrangement === 'ten-frame');
  if (framed && n > 10 && n < 20) out.push(`ten and ${spokenNumber(n - 10)}`);
  return out.filter(x => x !== String(n));
}

/** The spoken key, or null on a stop answered on screen. Never written by the author: read from the stored world. */
export function stopSpokenKey(stop: WonderWalkStop): SpokenKey | null {
  const respond = respondOf(stop);
  const sayable = sayableOf(stop);
  if (respond === 'show' || !sayable) return null;
  if ('number' in sayable) return { answer: String(sayable.number), alsoAccept: numberForms(stop, sayable.number) };
  if ('letter' in sayable) {
    return { answer: `the letter ${sayable.letter}`, alsoAccept: [],
      acceptRule: `Saying the letter's name alone ("${sayable.letter.toLowerCase()}") counts.`,
      signatureError: 'Saying the letter\'s sound back is not naming the letter.' };
  }
  if (respond === 'say-any') {
    const rule = anyRule(stop);
    const examples = (stop.sayAny ?? []).filter(x => x !== sayable.word);
    return { answer: sayable.word, alsoAccept: examples.slice(0, 8), ...(rule ?? {}) };
  }
  // A picture's name, and its plural (a child says "frogs" for a frog card).
  return { answer: sayable.word, alsoAccept: sayable.thing?.tile ? [] : [plural(sayable.word)].filter(x => x !== sayable.word) };
}

/** What the ask says by design: a letter-name ask names the letter it asks for ("Which one is the letter M?"). */
export function stopGiven(stop: WonderWalkStop): string[] {
  const rule = ruleOf(stop);
  // The cards line names every picture for a child who cannot read, the answer among them (`stopCardsLine`).
  const cards = stopCardsLine(stop);
  return [...(rule?.type === 'letter-name' ? [stop.ask] : []), ...(cards ? [cards] : [])];
}

const MISS_OF_TRAP: Record<string, string> = {
  near_sound: 'near_sound', meaning: 'meaning', look_alike: 'look_alike', in_story: 'mixed_story', not_heard: 'not_heard',
  looks_like: 'looks_like', goes_with: 'goes_with', wrong_kind: 'wrong_kind', other_join: 'other_join',
};
const WHY: Record<string, string> = {
  near_sound: 'a card whose sound is close to the right one', meaning: 'a card that goes with the heard word by meaning, not by sound',
  look_alike: 'a letter that looks like the right one', mixed_story: 'another part of the story', not_heard: 'a thing the story never had',
  wrong_kind: 'a word of a kind that cannot go in that place in the sentence', other_join: 'the other joining word',
  looks_like: 'a picture that looks like a right answer', goes_with: 'a picture that goes with the scene but is not the idea', off_idea: 'a picture that does not fit the idea',
};

/** The known wrong answers a child says on this stop, most specific first (`spoken_miss`). Empty on a shown stop. */
export function stopSpokenMisses(stop: WonderWalkStop): KnownMiss[] {
  const sayable = sayableOf(stop);
  if (respondOf(stop) === 'show' || !sayable) return [];
  const w = stop.world;
  if (w?.answer.kind === 'number') {
    const n = w.answer.answer;
    const story = w.objects.some(o => o.event) || w.places.some(p => p.kind === 'cup');
    const parts = story ? w.places.map(p => countIn(w.objects.filter(o => o.event !== 'join'), [p.id])).filter(x => x > 0 && x !== n) : [];
    // One entry per miss id (the observer requires distinct ids): a part of the story first, then one off either way.
    const part = numberMisses(n, parts.slice(0, 1).map(v => ({ id: 'said_a_part', value: v,
      pattern: (x: number) => `The learner says ${x}, a part of the story (before things joined or left, or one group), not how many in all.` })));
    const near = [n - 1, n + 1].filter(x => x >= 1 && !parts.slice(0, 1).includes(x));
    return [...part, ...(near.length ? [{ id: 'off_by_one', examples: near.map(spokenNumber),
      pattern: `The learner says ${near.join(' or ')}, one away from right: a thing skipped or counted twice.` }] : [])];
  }
  const ww = stop.words;
  const wrongs: Array<{ word: string; trap: string }> = ww?.answer.kind === 'tap'
    ? ww.answer.among.filter(id => `thing-${id}` !== stop.correctOptionId).map(id => {
      const t = thingOf(ww, id)!;
      return { word: t.tile ? (isMark(t.tile) ? markName(t.tile) : t.tile) : t.letter ? `the letter ${t.letter}` : t.word ?? '', trap: (ww.answer.kind === 'tap' && ww.answer.traps[id]) || 'off_idea' };
    })
    : stop.options.filter(o => o.id !== stop.correctOptionId).map(o => ({ word: o.word, trap: o.trap ?? 'off_idea' }));
  const seen = new Set<string>();
  return wrongs.flatMap(({ word, trap }) => {
    const id = MISS_OF_TRAP[trap] ?? 'off_idea';
    if (!word || seen.has(id)) return [];
    seen.add(id);
    // Concrete for the item: the exact wrong card the learner names, and why a child picks it.
    return [{ id, pattern: `The learner's answer is "${word}" (one of the wrong cards on screen), ${WHY[id] ?? WHY.off_idea}.`, examples: [word] }];
  });
}

/** The journey's spoken answers: the key's own words, or a wrong card's or number's. */
export function stopSay(stop: WonderWalkStop): { correct: string; plainWrong: string } {
  const sayable = sayableOf(stop);
  if (!sayable) throw new Error(`wonder-walk: stop ${stop.id} has no spoken answer`);
  if ('number' in sayable) {
    const w = stop.world!;
    const wrong = w.answer.kind === 'number' ? w.answer.choices.find(n => n !== sayable.number) ?? sayable.number + 1 : sayable.number + 1;
    return { correct: spokenNumber(sayable.number), plainWrong: spokenNumber(wrong) };
  }
  const ww = stop.words;
  const wrongWord = ww?.answer.kind === 'tap'
    ? ww.answer.among.map(id => thingOf(ww, id)).find(t => t && `thing-${t.id}` !== stop.correctOptionId)
    : undefined;
  const wrongText = wrongWord ? (wrongWord.tile ?? (wrongWord.letter ? `the letter ${wrongWord.letter}` : wrongWord.word!)) : stop.options.find(o => o.id !== stop.correctOptionId)?.word ?? 'banana';
  return { correct: 'letter' in sayable ? `the letter ${sayable.letter}` : sayable.word, plainWrong: wrongText };
}
