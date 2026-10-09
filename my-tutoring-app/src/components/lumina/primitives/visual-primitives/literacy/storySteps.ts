/**
 * story-planner on the teaching workspace (OB-7L, following R12). The learner MAKES a story plan:
 *   - plan (K-1, picture choices): one picture per card. Every choice is a fair creative pick, so the item passes when
 *     each card has one; it is the setup, not a quiz.
 *   - write (grade 2+): one typed card per element (character, setting, problem, ...). Code catches a short line or a
 *     repeat of an earlier card; the shared writing judge checks the card answers its question for this story.
 *   - order (K-1 `arcEvents`): the learner puts the story's events in order, checked in code against the generated
 *     order, which is the answer and never the board order.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import { isStoryPlannerPictureBand } from '../../../service/literacy/storyPlannerBand';

export interface StoryElementIn { elementId: string; label: string; prompt: string; required?: boolean; choices?: string[] }
export interface StoryPayload { writingPrompt: string; elements: StoryElementIn[]; storyArcLabels?: string[]; arcEvents?: string[] }

export type StoryMiss = 'too_short' | 'repeat' | 'not_sense' | 'wrong_job' | 'wrong_order';
export const STORY_MISSES: readonly StoryMiss[] = ['too_short', 'repeat', 'not_sense', 'wrong_job', 'wrong_order'];

export type StoryItem =
  | { id: 'plan'; kind: 'plan'; cards: { id: string; label: string; prompt: string; choices: string[] }[] }
  | { id: string; kind: 'write'; label: string; prompt: string; part: StoryPart }
  | { id: 'arc'; kind: 'order'; events: { id: string; text: string }[] };

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
  const els = (p?.elements ?? []).filter(e => e && typeof e.label === 'string' && typeof e.prompt === 'string' && e.prompt.trim());
  const picks = els.filter(e => Array.isArray(e.choices) && e.choices.filter(c => typeof c === 'string' && c.trim()).length >= 2);
  const items: StoryItem[] = [];
  if (picks.length) items.push({ id: 'plan', kind: 'plan', cards: picks.slice(0, 4).map(e => ({ id: e.elementId, label: e.label, prompt: e.prompt.trim(), choices: e.choices!.filter(c => c.trim()) })) });
  else for (const e of els.slice(0, 6)) items.push({ id: `write-${e.elementId}`, kind: 'write', label: e.label, prompt: e.prompt.trim(), part: partOf(e.label) });
  const events = (p?.arcEvents ?? []).filter(e => typeof e === 'string' && e.trim());
  // The generated arc labels ("Rising Action") are adult chrome a K-1 child cannot read: slots are numbered.
  if (events.length >= 2 && new Set(events.map(norm)).size === events.length) {
    items.push({ id: 'arc', kind: 'order', events: events.map((text, i) => ({ id: `e${i + 1}`, text: text.trim() })) });
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

const hashString = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
/** The arc tray: a content-seeded rotation by 1..n-1, so no card starts in its own slot and the board never reshuffles. */
export function shuffleArcEvents<T>(events: readonly T[], key: string): T[] {
  const n = events.length;
  if (n < 2) return events.slice();
  const shift = (hashString(key) % (n - 1)) + 1;
  return events.map((_, i) => events[(i + shift) % n]);
}
export const boardOf = (item: Extract<StoryItem, { kind: 'order' }>) => shuffleArcEvents(item.events, item.events.map(e => e.text).join('|'));
export const orderMiss = (item: Extract<StoryItem, { kind: 'order' }>, order: readonly string[]): StoryMiss | undefined =>
  order.length === item.events.length && order.every((id, i) => id === item.events[i].id) ? undefined : 'wrong_order';

export function writeShapeMiss(made: string, earlier: readonly string[]): StoryMiss | undefined {
  if (words(made).length < 3) return 'too_short';
  if (earlier.some(e => norm(e) === norm(made))) return 'repeat';
  return undefined;
}

export const askFor = (item: StoryItem): string => item.kind === 'plan' ? 'Plan your story: pick a picture for each card.'
  : item.kind === 'order' ? 'Put the story events in order: what happens first, next and last?' : `${item.label}: ${item.prompt}`;

export const storyAssignment = (item: StoryItem): TeachingAssignment => ({ id: item.id, task: askFor(item), response: 'gesture' });

export function writeJudgeRequest(item: Extract<StoryItem, { kind: 'write' }>, made: string, writingPrompt: string, planSoFar: string, grade?: string): WordBuildJudgeRequest {
  const ask = `${item.label} card: ${clip(item.prompt, 110)} Story: ${clip(writingPrompt, 110)} (It answers the card's question for this story.)`;
  return { ask: clip(ask, 300), made: made.trim(), unit: 'writing', context: planSoFar || writingPrompt, ...(grade ? { grade } : {}) };
}

export function storyScene(item: StoryItem, writingPrompt: string, state: { written?: string; plan?: string; picked?: string; card?: number }, inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
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
      ? 'The learner types this card and presses "I\'m done!". The builder checks it answers the card\'s question for this '
        + 'story and makes sense; spelling is not judged. Any idea that fits passes. You cannot type for the learner.'
      : item.kind === 'order'
        ? 'The learner taps the events into order and presses "I\'m done!". You may read an event aloud when asked. You '
          + 'cannot move an event and must not say which comes first.'
        : 'The learner cannot read yet. Read the story idea, the question and the words under every picture aloud. One tap picks a '
          + 'picture and moves to the next card; every picture is a fine choice.',
  } };
}

export const readRequest = (text: string) => `The learner asked to hear this. Read only this, once: "${splitPictureOption(text).label}"`;

// ── Levers ───────────────────────────────────────────────────────────────────
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

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly StoryMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function storyLevers(item: StoryItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || item.kind === 'plan') return [];
  if (item.kind === 'order') return [
    lever(MODEL_LEVER, 'help', ['wrong_order'], 'The learner\'s order does not make sense.',
      'Shows a DIFFERENT three-step story in order, so the learner sees first, next, last.', pulled),
    lever(FIRST_LEVER, 'simplify', ['wrong_order'], 'The learner cannot find where the story starts.',
      'Places the first event, so the learner orders the rest.', pulled),
  ];
  return [
    lever(MODEL_LEVER, 'help', ['wrong_job', 'not_sense'], 'The card does not answer its question.',
      `Shows a ${item.label.toLowerCase()} card from a DIFFERENT story.`, pulled),
    lever(STARTER_LEVER, 'simplify', ['too_short', 'wrong_job'], 'The learner cannot start from a blank box.',
      'Puts a sentence starter with blanks in the box for the learner to fill.', pulled),
  ];
}

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
