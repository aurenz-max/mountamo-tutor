/**
 * The in-item levers on di-word-problem-setup (`/add-support-tiers`, DI family 10; table
 * qa/support-levers/di-word-problem-setup-lever-table-2026-10-03.md). No real-learner evidence: the misses are the
 * placement check (`wordProblemMiss`), the spoken-miss ids, the 09-10 signature bench, and `commonStruggles`.
 *
 * A session item is one STEP of a story. This pack is not on `DiTeachingStage`: the component owns the lever state per
 * step and the practice item, and publishes `levers`, `pullLever` and `endPractice` beside its scene.
 *
 * Help:
 * - `model_story` (every step): a card with TWO different stories, one add (the box is the big amount) and one subtract
 *   (a printed big amount), each solved through the mode's steps; classify_and_build shows THREE, one per kind (R1: the
 *   card never points at one operation or kind). Code-owned themes; no story uses the item's frame; no model number is
 *   one of the item's three amounts; no model answer is within one of the item's. Per STORY, so it holds across steps.
 * - `story_links` (big_number step): tapping a story-part card underlines the sentence it comes from. Never marks a card
 *   big or small, never orders them.
 * - `read_along` (family step): a highlight steps across the built family (slot, +, slot, =, slot). Prints nothing new.
 * - `count_dots` (solve step): dots in the bar model's known parts (add: each known small amount; subtract: the big
 *   amount with the known small amount crossed out). No combined count; nothing in the box. Refused above 20.
 * Simplify:
 * - `within_ten` (solve step): the same frame with every amount at most 10 (20 in a within-100 session), no amount
 *   shared with the item and a different answer; ungraded, then the full step. Refused when the item is already in band.
 * No lever on the placement beyond help (an easier story would hand over or contradict the big status), on the
 * operation step (box-in-big-slot → add is the rule), or on the classify step (a cue word maps to the kind).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { BIG_UNKNOWN_FRAMES, FRAME_IDS, SHAPE_WORD, familySpoken, numberWord as w, planWordProblem, shapeOfFrame, type FrameId,
  type StoryShape, type StoryTheme, type WordProblemPlan } from './diWordProblemPlan';
import { itemsFromProblems, type WordProblemItem } from './diWordProblemScript';

export const MODEL_STORY = 'model_story';
export const STORY_LINKS = 'story_links';
export const READ_ALONG = 'read_along';
export const COUNT_DOTS = 'count_dots';
export const WITHIN_TEN = 'within_ten';

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];

/** Code-owned model themes; each passes `themeUsable`. */
const THEMES: readonly StoryTheme[] = [
  { nameA: 'Maya', nameB: 'Leo', nounPlural: 'shells', gainPast: 'found', gainBase: 'find', losePast: 'dropped', loseBase: 'drop' },
  { nameA: 'Omar', nameB: 'Ruby', nounPlural: 'marbles', gainPast: 'won', gainBase: 'win', losePast: 'lost', loseBase: 'lose' },
  { nameA: 'Iris', nameB: 'Ben', nounPlural: 'acorns', gainPast: 'picked', gainBase: 'pick', losePast: 'spilled', loseBase: 'spill' },
];

const amounts = (p: WordProblemPlan) => p.quantities.map(q => q.value);
const themeFor = (p: WordProblemPlan) => THEMES.find(t => ![t.nameA, t.nameB, t.nounPlural].some(word => p.story.includes(word))) ?? THEMES[0];

/** The first plan of a frame whose numbers pass `ok`, enumerating printed pairs in a fixed order. */
function planWhere(frameId: FrameId, theme: StoryTheme, max: number, ok: (p: WordProblemPlan) => boolean, id: string): WordProblemPlan | null {
  for (let first = 2; first <= max; first++) for (let second = 2; second <= max; second++) {
    const plan = planWordProblem({ id, frameId, theme, first, second }, max);
    if (plan && ok(plan)) return plan;
  }
  return null;
}

/** A model story leaks when it shares an amount with the item or lands within one of its answer. */
export const storyLeaks = (model: WordProblemPlan, item: WordProblemPlan) =>
  model.frameId === item.frameId || amounts(model).some(n => amounts(item).includes(n)) || Math.abs(model.answer - item.answer) <= 1;

const MODEL_CACHE = new Map<string, WordProblemPlan[] | null>();

/** The model stories for an item's story: an add and a subtract (or one per kind on classify_and_build). */
export function modelStoriesFor(item: WordProblemItem): WordProblemPlan[] | null {
  const key = `${item.problemId}|${item.plan.story}|${item.challengeType}`;
  if (MODEL_CACHE.has(key)) return MODEL_CACHE.get(key)!;
  const p = item.plan, theme = themeFor(p), max = Math.min(p.maxNumber, 20);
  const ok = (m: WordProblemPlan) => !storyLeaks(m, p);
  const pick = (frames: readonly FrameId[], id: string) => {
    for (const frame of frames) { const plan = planWhere(frame, theme, max, ok, id); if (plan) return plan; }
    return null;
  };
  let stories: (WordProblemPlan | null)[];
  if (item.challengeType === 'classify_and_build') {
    // One per kind, never the item's frame, and both operations across the three (the first combination that builds).
    const plans = (['comparison', 'change', 'part_whole'] as StoryShape[]).map(shape =>
      FRAME_IDS.filter(f => shapeOfFrame(f) === shape && f !== p.frameId).map(f => planWhere(f, theme, max, ok, `model-${f}`))
        .filter((plan): plan is WordProblemPlan => !!plan));
    stories = [null, null, null];
    outer: for (const a of plans[0]) for (const b of plans[1]) for (const c of plans[2]) {
      if (new Set([a.operation, b.operation, c.operation]).size === 2) { stories = [a, b, c]; break outer; }
    }
  } else {
    stories = [pick(BIG_UNKNOWN_FRAMES.filter(f => f !== p.frameId), 'model-add'),
      pick(FRAME_IDS.filter(f => !BIG_UNKNOWN_FRAMES.includes(f) && f !== p.frameId), 'model-subtract')];
  }
  const result = stories.every(Boolean) ? stories as WordProblemPlan[] : null;
  MODEL_CACHE.set(key, result);
  return result;
}

/** The sentences of the printed story, and which one each story part comes from. */
export function storySentences(plan: WordProblemPlan): { sentences: string[]; sentenceOf: Record<string, number> } {
  const sentences = plan.story.match(/[^.?!]+[.?!]/g)?.map(s => s.trim()) ?? [plan.story];
  const sentenceOf: Record<string, number> = {};
  for (const q of plan.quantities) {
    const at = q.known ? sentences.findIndex(s => new RegExp(`\\b${q.value}\\b`).test(s)) : sentences.findIndex(s => s.endsWith('?'));
    sentenceOf[q.id] = at < 0 ? sentences.length - 1 : at;
  }
  return { sentences, sentenceOf };
}

/** `count_dots`: what the bar model's known parts draw as dots; null above 20. */
export function countDotsFor(plan: WordProblemPlan): { kind: 'add'; rows: number[] } | { kind: 'subtract'; total: number; crossed: number } | null {
  if (Math.max(...amounts(plan)) > 20) return null;
  const known = [plan.small1, plan.small2].filter(q => q.known);
  return plan.operation === 'add' ? { kind: 'add', rows: known.map(q => q.value) }
    : { kind: 'subtract', total: plan.big.value, crossed: known[0]?.value ?? 0 };
}

/** `within_ten`: every step of the same frame's story with small amounts, sharing none of the item's, a different
 *  answer; null when the item is not a solve step or is already in band. */
export function withinTenSteps(item: WordProblemItem): WordProblemItem[] | null {
  if (item.kind !== 'solve') return null;
  const p = item.plan, band = p.maxNumber > 20 ? 20 : 10;
  if (Math.max(...amounts(p)) <= band) return null;
  const theme = themeFor(p);
  for (let first = 2; first <= band; first++) for (let second = 2; second <= band; second++) {
    const plan = planWordProblem({ id: `${item.id}~simpler`, frameId: p.frameId, theme, first, second }, band);
    if (!plan || amounts(plan).some(n => amounts(p).includes(n)) || plan.answer === p.answer) continue;
    // The one item builder: same mode, same frame, ids of their own.
    const steps = itemsFromProblems([{ id: `${item.id}~simpler`, frameId: p.frameId, theme, first, second,
      challengeType: item.challengeType, supportTier: item.supportTier, maxNumber: band }]).items;
    if (steps.some(s => s.kind === 'solve')) return steps;
  }
  return null;
}

/** The practice item `within_ten` opens: the small story's solve step. Its earlier steps are drawn as given. */
export const withinTenFor = (item: WordProblemItem): WordProblemItem | null =>
  withinTenSteps(item)?.find(s => s.kind === 'solve') ?? null;

export const startingLevers = (item: WordProblemItem): string[] =>
  item.supportTier === 'easy' && modelStoriesFor(item) ? [MODEL_STORY] : [];

export function wordProblemLevers(item: WordProblemItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers: [...answers], when, does });
  const out: WorkspaceLever[] = [];
  const classify = item.challengeType === 'classify_and_build';
  if (modelStoriesFor(item)) out.push(lever(MODEL_STORY, 'help', 'both',
    ['box_in_big', 'printed_small_in_big', 'big_in_small_slot', 'subtraction_sentence', 'opposite_operation', 'wrong_way',
      'said_story_number', ...OFF_BY, ...(classify ? ['signature_kind', 'other_kind'] : [])],
    'The learner makes a wrong move on this step, or does not know how to start.',
    `Shows a card with ${classify ? 'THREE different stories, one of each kind' : 'TWO different stories, one to add and one to subtract'}, `
      + 'each solved (onScreen gives them). Say ALL of them as your turn, in order, each with its big amount and why; never only '
      + 'the one like the learner\'s story, and never say which of the learner\'s cards is big. Then hand back their step.'));
  if (item.kind === 'big_number') out.push(lever(STORY_LINKS, 'help', 'shown', ['box_in_big', 'printed_small_in_big'],
    'The learner puts the wrong card in the big slot.',
    'When the learner taps a story-part card, the sentence it comes from is underlined. Say "tap a card to see where it comes from".'));
  if (item.kind === 'family') out.push(lever(READ_ALONG, 'help', 'shown', ['big_in_small_slot', 'subtraction_sentence'],
    'The learner reads the family in the wrong order or as a subtraction.',
    'A highlight moves across the built family, left to right: small, plus, small, equals, big. Read along with it; never say the numbers.'));
  if (item.kind === 'solve' && countDotsFor(item.plan)) out.push(lever(COUNT_DOTS, 'help', 'shown', ['wrong_way', 'said_story_number', ...OFF_BY],
    'The learner gets the number wrong.',
    'Draws dots in the bar model\'s known parts (to subtract, the known part is crossed out of the big amount). Never count them aloud.'));
  if (withinTenFor(item)) out.push(lever(WITHIN_TEN, 'simplify', 'both', OFF_BY,
    'These numbers are too big to work yet.',
    'Opens the same kind of story with small numbers first; the learner solves it. It is not graded; the full step comes back after it.'));
  return out;
}

const storyLine = (p: WordProblemPlan) =>
  `"${p.story}" Big amount: ${p.big.label} (${p.bigReason}). Family: ${familySpoken(p)}. ${p.operation === 'add' ? 'Add' : 'Subtract'}: ${w(p.answer)}.`;

/** What the pulled levers put on screen, as a scene fact. Gives the models; never this story's big amount or answer. */
export function wordProblemLeverFacts(item: WordProblemItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  const models = pulled.includes(MODEL_STORY) ? modelStoriesFor(item) : null;
  return [
    models && `Beside the story, a model card shows ${models.length} different stories, solved: `
      + models.map(m => `${SHAPE_WORD[m.shape]}: ${storyLine(m)}`).join(' ') + ' None is this story.',
    pulled.includes(STORY_LINKS) && item.kind === 'big_number' && 'Tapping a story-part card underlines the sentence it comes from.',
    pulled.includes(READ_ALONG) && item.kind === 'family' && 'A highlight moves left to right across the built family.',
    pulled.includes(COUNT_DOTS) && item.kind === 'solve' && 'Dots fill the known parts of the bar model; nothing is in the box.',
  ].filter((s): s is string => !!s).join(' ');
}
