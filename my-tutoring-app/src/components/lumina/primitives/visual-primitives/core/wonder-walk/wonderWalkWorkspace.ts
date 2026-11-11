/**
 * Wonder walk on the shared tutor/JEV teaching workspace. Each stop of the walk is one challenge.
 * - `which-one`: tap the picture that fits the idea, never the scene's own example.
 * - Math stops are worlds (`wonderWalkWorld.ts`): tap a place, tap a number, or move things until the goal holds and
 *   tap Done. The activity checks every answer itself.
 * How it is wired to the tutor is its boss (`wonderWalk.boss.ts`).
 *
 * Pure: the component, the boss and the tests read the same ask, scene, check and miss. The key (the right picture,
 * place or number, and the goal's numbers beyond what the ask says) never reaches the tutor.
 */
import type { WorkspaceScene } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WonderWalkData, WonderWalkStop } from './WonderWalk';
import { countIn, goalFailure, moveTaps, solveMove, type WorldObject } from './wonderWalkWorld';
import { isMark, markName, orderHolds, sentenceText, sortHolds, wordHarnessTaps, type WordThing, type WordWorld } from './wonderWalkWords';

type Placed = Array<Pick<WorldObject, 'place' | 'event' | 'word' | 'color'>>;

/**
 * The task the tutor says for one stop, all of it, because a Kindergartner cannot read the screen: the narration, the
 * ask, and the cards by name (`stopCardsLine`). A session (2026-11-06, f4bd55bda6b9) gave the tutor the bare ask and
 * left the card names in the scene facts: it said "Which picture rhymes with cat?" over four unnamed pictures.
 * The author's ask and narration are checked by code never to say the answer; the cards line is derived here.
 */
export const stopAsk = (stop: WonderWalkStop) =>
  [stop.narration, stopSentenceLine(stop), stop.ask, stopCardsLine(stop)].map(s => s?.trim()).filter(Boolean).join(' ');

/** A sentence with one word left out, as the tutor reads it: the missing word is "blank", never said. */
export function stopSentenceLine(stop: WonderWalkStop): string {
  const w = stop.words;
  return w?.sentence && w.answer.kind === 'tap' && w.answer.rule.type === 'fills' ? `The sentence is: ${sentenceText(w, 'blank')}` : '';
}

/**
 * The cards a pre-reader must hear named, in screen order, derived from the world. A child must know a picture is a
 * hat, not a cap, to hear its sounds. Letter tiles are not named (reading them is the task), and cards told apart by
 * their name (one or many, where it sits) are described without it (`cardsFact`). Math worlds: none (the counts are
 * the task). It is said by design, so it may name the answer card among the others (`stopGiven`).
 */
export function stopCardsLine(stop: WonderWalkStop): string {
  const w = stop.words;
  if (w) {
    if (w.things.some(t => t.letter)) return '';
    // Word tiles are read out for a child who cannot read them, in screen order, the answer among them.
    if (w.things.some(t => t.tile)) return `The cards say ${listOf(w.things.map(t => (isMark(t.tile) ? markName(t.tile!) : t.tile!)))}.`;
    const rule = w.answer.kind === 'tap' ? w.answer.rule.type : undefined;
    const cards = rule === 'where' || rule === 'number' ? `There are ${cardsFact(w)}.` : `The pictures are ${listOf(w.things.map(thingName))}.`;
    const baskets = w.answer.kind === 'sort'
      ? ` The baskets are marked with ${listOf(w.answer.baskets.map(b => thingName(thingById(w, b.label)!)))}.` : '';
    return `${cards}${baskets}`;
  }
  if (!stop.world && stop.options?.length) return `The pictures are ${listOf(stop.options.map(o => `the ${o.word}`))}.`;
  return '';
}

const listOf = (items: readonly string[]) =>
  (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The activity's own check for a tap on a picture (`<option id>`), a place (`place-<id>`) or a number (`num-<n>`). */
export const stopMatches = (stop: WonderWalkStop, id: string) => !!stop.correctOptionId && stop.correctOptionId === id;

const kindOf = (stop: WonderWalkStop) => (id: string) => stop.world?.places.find(p => p.id === id)?.kind;

/** The activity's own check for a move world: the goal holds on where things are now. */
export const moveMatches = (stop: WonderWalkStop, placed: Placed) =>
  stop.world?.answer.kind === 'move' && goalFailure(stop.world.answer.goal, placed, kindOf(stop)) === null;

const plural = (w: string, n: number) => (n === 1 ? w : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(w) ? `${w}es` : w === 'fish' || w === 'sheep' ? w : `${w}s`);
const placeName = (stop: WonderWalkStop, id: string) => {
  const p = stop.world?.places.find(x => x.id === id);
  return p ? `the ${p.color ? `${p.color} ` : ''}${p.kind === 'group' ? `group ${p.id}` : p.kind}` : id;
};

export interface StopView {
  /** What was tapped on this try, or 'done' once a move is committed. */
  pickedId: string | null;
  /** Move worlds: where every object is now. */
  placed: Placed;
  /** The why-card is on screen (after a wrong answer on this stop). */
  whyShown: boolean;
  /** Language sorts: the basket each thing is in (absent or null: still in the tray). */
  basketOf?: Record<string, string | null>;
  /** Language tracks: the things on the track, in order. */
  track?: string[];
}

/** The activity's own check for a language sort or track (a tap is `stopMatches`). */
export const wordMatches = (stop: WonderWalkStop, view: Pick<StopView, 'basketOf' | 'track'>) => {
  const w = stop.words;
  if (!w) return false;
  if (w.answer.kind === 'sort') return sortHolds(w, view.basketOf ?? {});
  if (w.answer.kind === 'order') return orderHolds(w, view.track ?? []);
  return false;
};

/** A word world's thing in words: the picture's name (drawn once, as many, or by a landmark), or the letter. */
export const thingName = (t: WordThing) => (t.tile ? (isMark(t.tile) ? markName(t.tile) : `the word "${t.tile}"`) : t.letter ? `the letter ${t.letter}`
  : `${(t.count ?? 1) > 1 ? `${t.count} ${t.word}s` : `the ${t.word}`}${t.rel ? ` ${t.rel.replace('-', ' ')} the ${t.landmark?.word}` : ''}`);
/**
 * The cards in words. Pictures are named in screen order (a child must know a picture is a hat, not a cap, to hear its
 * sounds). When the card's name is what tells it apart (a letter, one or many, where it sits), the cards are described
 * without it, so the tutor never says which card is which.
 */
function cardsFact(w: WordWorld): string {
  const rule = w.answer.kind === 'tap' ? w.answer.rule : undefined;
  if (w.things.every(t => t.letter)) return `${w.things.length} letter cards: ${w.things.map(t => t.letter).sort().join(', ')} (not in screen order)`;
  if (rule?.type === 'where') return `${w.things.length} cards, each showing the ${w.things[0].word} somewhere by the ${w.things[0].landmark?.word}`;
  if (rule?.type === 'number') return `${w.things.length} cards of ${Array.from(new Set(w.things.map(t => t.word))).join(' and ')}, some drawn once and some as many`;
  return w.things.map(thingName).join(', ');
}
/** What the tutor may know of a sentence stop: never the order of the cards, never the word left out. */
function sentenceFact(w: WordWorld): string {
  const a = w.answer;
  const toks = (w.sentence ?? []).filter(k => k.role !== 'end');
  if (a.kind === 'order') {
    const fixed = toks.filter(k => !k.card).map(k => `"${k.say}"`);
    return `a track for a sentence of ${toks.length} words; ${fixed.length ? `already on it: ${fixed.join(', ')}` : 'every word is a card'}. `
      + 'The learner builds it; never say the sentence or which card comes first. When it is built, invite the learner to say it.';
  }
  if (a.kind === 'tap' && a.rule.type === 'fills') return `read it with a pause at the blank, never the missing word: ${sentenceText(w, 'blank')}`;
  return `the sentence the learner heard: ${sentenceText(w)}`;
}
const thingById = (w: WordWorld, id: string) => w.things.find(t => t.id === id) ?? w.refs.find(t => t.id === id);

/** What the place holds, in words ("3 ducks", "2 red apples and 1 blue apple"). */
function holds(placed: Placed, id: string): string {
  const here = placed.filter(o => o.place === id && o.event !== 'leave');
  if (!here.length) return 'nothing';
  const by = new Map<string, number>();
  for (const o of here) { const k = `${o.color ? `${o.color} ` : ''}${o.word}`; by.set(k, (by.get(k) ?? 0) + 1); }
  return Array.from(by.entries()).map(([k, n]) => { const parts = k.split(' '); const w = parts.pop()!; return `${n} ${[...parts, plural(w, n)].join(' ')}`; }).join(' and ');
}

/** The learner's work in words: what was tapped, or where things are now; never the key. */
export function describeWork(stop: WonderWalkStop, view: Pick<StopView, 'pickedId' | 'placed' | 'basketOf' | 'track'>): string {
  const ww = stop.words;
  if (ww) {
    const done = view.pickedId === 'done' ? '; tapped Done' : '';
    if (ww.answer.kind === 'sort') {
      const a = ww.answer;
      const said = a.baskets.map(b => {
        const inside = a.things.filter(id => view.basketOf?.[id] === b.id).map(id => thingName(thingById(ww, id)!));
        return `the ${thingName(thingById(ww, b.label)!).replace(/^the /, '')} basket holds ${inside.length ? inside.join(', ') : 'nothing'}`;
      }).join('; ');
      return `${said}${done}`;
    }
    if (ww.answer.kind === 'order') {
      const on = (view.track ?? []).map(id => thingName(thingById(ww, id)!));
      return `${on.length ? `the track holds ${on.join(', then ')}` : 'the track is empty'}${done}`;
    }
    if (!view.pickedId) return 'Nothing tapped yet';
    const t = view.pickedId.startsWith('thing-') ? thingById(ww, view.pickedId.slice(6)) : undefined;
    return t ? `Tapped ${thingName(t)}` : 'Nothing tapped yet';
  }
  const w = stop.world;
  if (w?.answer.kind === 'move') {
    const targets = w.places.filter(p => p.droppable && w.answer.kind === 'move' && w.answer.goal.some(g => g.places.includes(p.id)));
    const said = targets.map(p => `${placeName(stop, p.id)} holds ${holds(view.placed, p.id)}`).join('; ');
    return view.pickedId === 'done' ? `${said}; tapped Done` : said;
  }
  if (!view.pickedId) return 'Nothing tapped yet';
  if (view.pickedId.startsWith('num-')) return `Tapped the number ${view.pickedId.slice(4)}`;
  if (view.pickedId.startsWith('place-')) {
    const id = view.pickedId.slice(6);
    return `Tapped ${placeName(stop, id)}, which holds ${holds(w?.objects ?? [], id)}`;
  }
  const picked = stop.options.find(o => o.id === view.pickedId);
  return picked ? `Tapped the ${picked.word} picture` : 'Nothing tapped yet';
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`):
 * - which-one, from the trap the author named: `repeated_pick`, `looks_like`, `goes_with`, `off_idea`;
 * - math, computed by code: `off_by_one` (one more or fewer than right: a skipped or double-counted thing),
 *   `miscount` (two or more away), `reversed` (most and fewest mixed up), `said_a_part` (a number from the story's
 *   parts, not the whole), `wrong_sort` (something in a place it does not belong), `not_full` (the frame is not full).
 */
export type WonderWalkMiss = 'repeated_pick' | 'looks_like' | 'goes_with' | 'off_idea' | 'off_by_one' | 'miscount' | 'reversed' | 'said_a_part' | 'wrong_sort' | 'not_full'
  // language, computed by code: a near sound (b for p), the meaning instead of the sound (dog for "rhymes with cat"), a
  // letter that looks alike (b for d), another part of the story, a thing the story never had, things out of order.
  | 'near_sound' | 'meaning' | 'look_alike' | 'mixed_story' | 'not_heard' | 'wrong_order'
  // sentences, computed by code: a word of a kind that cannot go there (a naming word where the doing-word is missing),
  // the other joining word (and for but).
  | 'wrong_kind' | 'other_join';

export function pickMiss(stop: WonderWalkStop, id: string, lastWrong: string | null = null): WonderWalkMiss | undefined {
  if (stopMatches(stop, id)) return undefined;
  if (lastWrong === id) return 'repeated_pick';
  if (stop.words?.answer.kind === 'tap' && id.startsWith('thing-')) {
    const trap = stop.words.answer.traps[id.slice(6)];
    return trap === 'near_sound' ? 'near_sound' : trap === 'meaning' ? 'meaning' : trap === 'look_alike' ? 'look_alike'
      : trap === 'in_story' ? 'mixed_story' : trap === 'not_heard' ? 'not_heard' : trap === 'wrong_kind' ? 'wrong_kind' : trap === 'other_join' ? 'other_join' : 'off_idea';
  }
  const w = stop.world;
  if (w?.answer.kind === 'number' && id.startsWith('num-')) {
    const n = Number(id.slice(4));
    const right = w.answer.answer;
    const parts = w.places.map(p => countIn(w.objects.filter(o => o.event !== 'join'), [p.id])).filter(x => x > 0 && x !== right);
    if (parts.includes(n) && (w.objects.some(o => o.event) || w.places.some(p => p.kind === 'cup'))) return 'said_a_part';
    return Math.abs(n - right) === 1 ? 'off_by_one' : 'miscount';
  }
  if (w?.answer.kind === 'tap' && id.startsWith('place-')) {
    const trap = w.answer.traps[id.slice(6)];
    return trap === 'reversed' ? 'reversed' : trap === 'one_off' ? 'off_by_one' : 'miscount';
  }
  const trap = stop.options.find(o => o.id === id)?.trap;
  return trap === 'looks_like' || trap === 'goes_with' ? trap : 'off_idea';
}

/** A committed language sort or track that is wrong. */
export function wordMiss(stop: WonderWalkStop, view: Pick<StopView, 'basketOf' | 'track'>): WonderWalkMiss | undefined {
  if (!stop.words || wordMatches(stop, view)) return undefined;
  return stop.words.answer.kind === 'order' ? 'wrong_order' : 'wrong_sort';
}

export function moveMiss(stop: WonderWalkStop, placed: Placed): WonderWalkMiss | undefined {
  const w = stop.world;
  if (w?.answer.kind !== 'move') return undefined;
  const fail = goalFailure(w.answer.goal, placed, kindOf(stop));
  if (!fail) return undefined;
  if (fail.g.only) return 'wrong_sort';
  if (fail.g.full) return 'not_full';
  const want = fail.g.count ?? fail.g.atLeast ?? 0;
  return Math.abs(fail.n - want) === 1 ? 'off_by_one' : 'miscount';
}

/**
 * The scene in words. A which-one stop: the idea, the scene and the pictures by name. A math stop: each place and the
 * kinds of thing in it, with counts only where the count is not an answer (a hidden cup's number is said in the story;
 * a move world shows where things are as the learner moves them). Never the key.
 */
export function workspaceScene(data: Pick<WonderWalkData, 'bigIdea'>, stop: WonderWalkStop, view: StopView): WorkspaceScene {
  const w = stop.world;
  const ww = stop.words;
  const base = { kind: stop.challengeType, bigIdea: data.bigIdea, idea: stop.idea, narration: stop.narration,
    ...(view.whyShown ? { whyCard: stop.why } : {}), reader: 'the learner may not read' };
  if (ww) {
    const letters = ww.things.some(t => t.letter);
    const todo = ww.answer.kind === 'tap' ? 'Tap one card' : ww.answer.kind === 'sort' ? 'Tap a card, then the basket it goes in; then tap Done' : 'Tap the cards in order to put them on the track; then tap Done';
    return { objects: [], facts: { ...base,
      ...(ww.refs.length ? { scenePicture: ww.refs.map(thingName).join(', ') } : {}),
      cards: cardsFact(ww),
      ...(ww.answer.kind === 'sort' ? { baskets: ww.answer.baskets.map(b => `a basket marked with ${thingName(thingById(ww, b.label)!)}`).join('; ') } : {}),
      ...(ww.sentence ? { sentence: sentenceFact(ww) } : {}),
      ...(ww.say ? { saySounds: `say these sounds exactly as written: ${ww.say}` } : {}),
      ...(letters ? { letterCards: 'never name a letter card the child is to find' } : {}),
      todo, learnerWork: describeWork(stop, view) } };
  }
  if (!w) {
    return { objects: [], facts: { ...base, scenePicture: stop.sceneWords.join(', '), pictures: stop.options.map(o => o.word).join(', '),
      learnerWork: describeWork(stop, view) } };
  }
  const kinds = (id: string) => Array.from(new Set(w.objects.filter(o => o.place === id).map(o => `${o.color ? `${o.color} ` : ''}${o.word}`))).join(' and ') || 'nothing yet';
  const places = w.places.map(p => (p.kind === 'cup' ? `${placeName(stop, p.id)}: some ${kinds(p.id)} hidden under it` : `${placeName(stop, p.id)}: ${kinds(p.id)}`)).join('; ');
  const story = w.objects.some(o => o.event) ? 'Some things join (ringed) or leave (faded) in the story the narration tells' : undefined;
  const todo = w.answer.kind === 'tap' ? 'Tap one of the groups' : w.answer.kind === 'number' ? `Tap one number: ${w.answer.choices.join(', ')}` : 'Move things into places, then tap Done';
  return { objects: [], facts: { ...base, places, ...(story ? { story } : {}), todo, learnerWork: describeWork(stop, view) } };
}

/** The journey's taps for a stop: right and wrong, as workspace targets. */
export function stopHarnessTaps(stop: WonderWalkStop): { correct: string[]; wrong: string[] | null } {
  if (stop.words) return wordHarnessTaps(stop.words, stop.correctOptionId);
  const w = stop.world;
  if (w?.answer.kind === 'move') {
    const plan = solveMove(w);
    return { correct: [...(plan ? moveTaps(w, plan) : []), 'done'], wrong: ['done'] };
  }
  if (w?.answer.kind === 'number') {
    const right = w.answer.answer;
    const wrong = w.answer.choices.find(n => n !== right);
    return { correct: [`num-${right}`], wrong: wrong !== undefined ? [`num-${wrong}`] : null };
  }
  if (w?.answer.kind === 'tap') {
    const wrong = w.places.find(p => p.choosable && `place-${p.id}` !== stop.correctOptionId);
    return { correct: [stop.correctOptionId], wrong: wrong ? [`place-${wrong.id}`] : null };
  }
  const wrong = stop.options.find(o => o.id !== stop.correctOptionId);
  return { correct: [`option-${stop.correctOptionId}`], wrong: wrong ? [`option-${wrong.id}`] : null };
}
