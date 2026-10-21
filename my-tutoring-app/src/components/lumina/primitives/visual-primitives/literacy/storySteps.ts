/**
 * story-planner on the teaching workspace (OB-7L, following R12), wired from its boss (`storyPlanner.boss.ts`). The
 * learner MAKES a story plan; the item's kind is its step on the card:
 *   - plan (K-1, picture choices): one picture per card. Every choice is a fair creative pick, so the item passes when
 *     each card has one; it is the setup, not a quiz.
 *   - write (grade 2+): one typed card per element (character, setting, problem, ...). Code catches a short line or a
 *     repeat of an earlier card; the shared writing judge checks the card answers its question for this story.
 *   - order (K-1 `arcEvents`): the learner puts the story's events in order, checked in code against the generated
 *     order, which is the answer and never the board order.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import { isStoryPlannerPictureBand } from '../../../service/literacy/storyPlannerBand';
import type { StoryMiss } from './storyPlanner.card';

export type { StoryMiss } from './storyPlanner.card';

export interface StoryElementIn { elementId: string; label: string; prompt: string; required?: boolean; choices?: string[] }
export interface StoryPayload {
  writingPrompt: string; elements: StoryElementIn[]; storyArcLabels?: string[]; arcEvents?: string[];
  /** The lesson's support tier (`config.difficulty`), stamped by the generator; old payloads fall back to medium. */
  supportTier?: SupportTier;
}

type Tier = { supportTier?: SupportTier };
export type StoryItem = Tier & (
  | { id: 'plan'; kind: 'plan'; cards: { id: string; label: string; prompt: string; choices: string[] }[] }
  | { id: string; kind: 'write'; label: string; prompt: string; part: StoryPart }
  | { id: 'arc'; kind: 'order'; events: { id: string; text: string }[] });
export type OrderItem = Extract<StoryItem, { kind: 'order' }>;
export type WriteItem = Extract<StoryItem, { kind: 'write' }>;

export type StoryPart = 'character' | 'setting' | 'problem' | 'events' | 'solution' | 'theme' | 'other';
export const partOf = (label: string): StoryPart => {
  const l = label.toLowerCase();
  if (/charact|who/.test(l)) return 'character';
  if (/setting|where|place/.test(l)) return 'setting';
  if (/problem|conflict|happen/.test(l)) return 'problem';
  if (/event|plot|middle/.test(l)) return 'events';
  if (/solution|resol|ending|end\b/.test(l)) return 'solution';
  if (/theme|lesson|message/.test(l)) return 'theme';
  return 'other';
};

const words = (s: string) => s.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

export function storyItems(p: StoryPayload): StoryItem[] {
  const tier: Tier = p?.supportTier ? { supportTier: p.supportTier } : {};
  const els = (p?.elements ?? []).filter(e => e && typeof e.label === 'string' && typeof e.prompt === 'string' && e.prompt.trim());
  const picks = els.filter(e => Array.isArray(e.choices) && e.choices.filter(c => typeof c === 'string' && c.trim()).length >= 2);
  const items: StoryItem[] = [];
  if (picks.length) items.push({ id: 'plan', kind: 'plan', cards: picks.slice(0, 4).map(e => ({ id: e.elementId, label: e.label, prompt: e.prompt.trim(), choices: e.choices!.filter(c => c.trim()) })), ...tier });
  else for (const e of els.slice(0, 6)) items.push({ id: `write-${e.elementId}`, kind: 'write', label: e.label, prompt: e.prompt.trim(), part: partOf(e.label), ...tier });
  const events = (p?.arcEvents ?? []).filter(e => typeof e === 'string' && e.trim());
  // The generated arc labels ("Rising Action") are adult chrome a K-1 child cannot read: slots are numbered.
  if (events.length >= 2 && new Set(events.map(norm)).size === events.length) {
    items.push({ id: 'arc', kind: 'order', events: events.map((text, i) => ({ id: `e${i + 1}`, text: text.trim() })), ...tier });
  }
  return items;
}

/**
 * A picture option: the emoji is the answer surface, the words its caption (and its name). Avoids
 * `\p{Extended_Pictographic}`: the project targets ES5, where the `u` flag does not compile. A short leading token with
 * no ASCII letters or digits and some non-ASCII is the glyph; anything else is caption only.
 */
export function splitPictureOption(raw: string): { emoji: string; label: string; raw: string } {
  const trimmed = (raw || '').trim();
  const sp = trimmed.indexOf(' ');
  if (sp > 0) {
    const head = trimmed.slice(0, sp);
    if (head.length <= 8 && !/[A-Za-z0-9]/.test(head) && /[^\x00-\x7F]/.test(head)) {
      return { emoji: head, label: trimmed.slice(sp + 1).trim(), raw: trimmed };
    }
  }
  return { emoji: '', label: trimmed, raw: trimmed };
}

/** The K-1 surface (the picture band, or picture content): nothing to read, no adult chrome. */
export const isPictureStory = (items: readonly StoryItem[], gradeLevel?: string) =>
  isStoryPlannerPictureBand(gradeLevel) || items.some(i => i.kind === 'plan');

/** The longest set of positions listed in story order (a subsequence, not only neighbours). */
function longestInOrder(ranks: readonly number[]): number {
  const best = ranks.map(() => 1);
  for (let i = 0; i < ranks.length; i++) for (let j = 0; j < i; j++) if (ranks[j] < ranks[i]) best[i] = Math.max(best[i], best[j] + 1);
  return Math.max(0, ...best);
}

/**
 * The arc tray: a stable mixed order (the same on every render) that is never the story's order and never lists more
 * than two events in story order, even apart (read top to bottom, three in order would tell the story). Two events are
 * always swapped. The plain reverse is kept only when no salt finds another such order.
 */
export function shuffleArcEvents<T>(events: readonly T[], key: string): T[] {
  const n = events.length;
  if (n < 2) return events.slice();
  const score = (ranks: number[]) => {
    if (ranks.every((r, i) => r === i)) return Infinity;
    const run = longestInOrder(ranks);
    if (run > 2) return run;
    return n >= 3 && ranks.every((r, i) => r === n - 1 - i) ? 1 : 0;
  };
  let best = events.map((_, i) => n - 1 - i), bestScore = score(best);
  for (let salt = 0; salt < 256 && bestScore > 0; salt++) {
    let h = salt;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const ranks = events.map((_, i) => ({ i, k: ((h ^ (i * 2654435761)) >>> 0) % 997 })).sort((a, b) => a.k - b.k || a.i - b.i).map(x => x.i);
    const s = score(ranks);
    if (s < bestScore) { best = ranks; bestScore = s; }
  }
  return best.map(i => events[i]);
}
export const boardOf = (item: OrderItem) => shuffleArcEvents(item.events, item.events.map(e => e.text).join('|'));
export const orderMiss = (item: OrderItem, order: readonly string[]): StoryMiss | undefined =>
  order.length === item.events.length && order.every((id, i) => id === item.events[i].id) ? undefined : 'wrong_order';

export function writeShapeMiss(made: string, earlier: readonly string[]): StoryMiss | undefined {
  if (words(made).length < 3) return 'too_short';
  if (earlier.some(e => norm(e) === norm(made))) return 'repeat';
  return undefined;
}

export const askFor = (item: StoryItem): string => item.kind === 'plan' ? 'Plan your story: pick a picture for each card.'
  : item.kind === 'order' ? 'Put the story events in order: what happens first, next and last?' : `${item.label}: ${item.prompt}`;

export function writeJudgeRequest(item: WriteItem, made: string, writingPrompt: string, planSoFar: string, grade?: string): WordBuildJudgeRequest {
  const ask = `${item.label} card: ${clip(item.prompt, 110)} Story: ${clip(writingPrompt, 110)} (It answers the card's question for this story.)`;
  return { ask: clip(ask, 300), made: made.trim(), unit: 'writing', context: planSoFar || writingPrompt, ...(grade ? { grade } : {}) };
}

/**
 * What the tutor is told: the step (`kind`), the story idea, and the step's own state. The arc board is listed in tray
 * order (`boardOf`), never the story's order. Only this primitive's facts: the moves are on the card.
 */
export function storyScene(item: StoryItem, writingPrompt: string,
  state: { written?: string; plan?: string; picked?: string; card?: number; picture?: boolean }, inspectorSaid?: string): SceneOf {
  const readAloud = state.picture
    ? 'The learner cannot read yet: read the story idea, the question and the words under every picture aloud.' : '';
  return { objects: [], facts: {
    kind: item.kind,
    ask: askFor(item),
    storyPrompt: clip(writingPrompt),
    ...(item.kind === 'write' ? { card: item.label, written: clip(state.written?.trim() || 'empty') } : {}),
    ...(item.kind === 'order' ? { board: clip(boardOf(item).map(e => e.text).join(' | ')), placed: clip(state.picked || 'nothing placed') } : {}),
    ...(item.kind === 'plan' ? (() => { const card = item.cards[state.card ?? 0];
      return { question: card ? `${card.label}: ${card.prompt}` : 'all cards picked', options: card ? card.choices.map(c => splitPictureOption(c).label).join(' | ') : '',
        picked: clip(state.picked || 'nothing yet') }; })() : {}),
    ...(state.plan ? { planSoFar: clip(state.plan) } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: item.kind === 'write'
      ? 'The builder checks the card answers its question for this story and makes sense; spelling is not judged. Any '
        + 'idea that fits passes.'
      : item.kind === 'order' ? `${readAloud} The board lists the events in tray order, never the story's order.`.trim()
        : `${readAloud} Every picture is a fine choice.`.trim(),
  } };
}

export const readRequest = (text: string) => `The learner asked to hear this. Read only this, once: "${splitPictureOption(text).label}"`;

// ── Lever content (the lever set is `storyPlannerLevers.ts`) ─────────────────
export const MODEL_LEVER = 'model_card';
export const STARTER_LEVER = 'card_starter';
export const FIRST_LEVER = 'place_first';

/** A filled card for a DIFFERENT story (a lost kite), per part. */
export const MODEL_CARD: Record<StoryPart, string> = {
  character: 'Rosa is a shy girl who loves her red kite more than anything.',
  setting: 'A windy beach with loud gulls and warm, soft sand.',
  problem: 'A strong gust pulls the kite string out of Rosa\'s hand.',
  events: 'First Rosa chases it, then a boy helps her climb a dune, then they spot it in a tree.',
  solution: 'The boy lifts Rosa up and she pulls the kite down, and they fly it together.',
  theme: 'Asking for help can turn a stranger into a friend.',
  other: 'Rosa says, "Can you help me get my kite?"',
};
export const STARTER: Record<StoryPart, string> = {
  character: 'My main character is ___ who ___.', setting: 'The story happens at ___, where you can see ___.',
  problem: 'The problem is that ___.', events: 'First ___, then ___, then ___.', solution: 'In the end, ___.',
  theme: 'This story shows that ___.', other: '___',
};
export const MODEL_ORDER = ['🌱 Mia plants a seed.', '💧 Mia waters it every day.', '🌻 A big flower grows.'];

export function storyMissWords(miss: StoryMiss | undefined): string {
  switch (miss) {
    case 'too_short': return 'Write a whole idea for this card.';
    case 'repeat': return 'You already wrote that on another card. Write something new.';
    case 'not_sense': return 'Read it out loud. Does it make sense?';
    case 'wrong_job': return 'Read the card\'s question again. Does your idea answer it?';
    case 'wrong_order': return 'Tell the story in that order. Does it make sense?';
    default: return 'Not quite. Try again.';
  }
}
