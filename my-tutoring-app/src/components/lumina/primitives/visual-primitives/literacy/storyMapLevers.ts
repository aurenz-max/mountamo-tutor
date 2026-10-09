/**
 * story-map's in-item levers (/add-support-tiers; report qa/eval-reports/story-map-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `storyMapMiss` observes; the catalog's commonStruggles name
 * "confusing parts", "missing elements" and "wrong sequence". Every phase's answer is a fact about THIS story (who is
 * in it, where an event goes, the conflict), so no lever marks a name, places or orders an event, or points at a
 * choice: help levers draw what a part of a story or a kind of conflict IS, the same on every story, and simplify
 * levers open a different, shorter story.
 *
 * identify (`picked_not_in_story`, `missed_character`, `wrong_setting`):
 * - `character_count` (help) a row of empty person spaces, one per character in the story, filled one per pick. It
 *   counts picks, never marks which. Declared only when some printed name is not a character (`countLeaks`), which
 *   `characterChoices` now guarantees at every tier; the rule stays so the count never says "pick them all".
 * - `easier_story` (simplify) an ungraded practice story from a code pool: short sentences, two characters, one name
 *   not in it. None of its names, events or words is the session's (`practiceLeaks`).
 * sequence (`one_part`, `reversed`, `next_part`, `far_part`):
 * - `part_pictures` (help) under each arc part, a picture and what that part of a story does ("the problem grows").
 * - `arc_arrow` (help) an arrow along the parts, from where a story starts to where it ends.
 * - `easier_story` (simplify) the same arc on a practice story, one short event per part.
 * analyze (`inside_outside`, `other_outside`):
 * - `conflict_pictures` (help) a picture on every conflict choice (a thought bubble, two people, a storm, a crowd and
 *   a rule sign), the same on every story, so no choice is marked.
 * - `easier_conflict` (simplify) a one-sentence practice story with three choices: its own kind, one across inside
 *   and outside, and one other.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { StoryMapData } from './StoryMap';
import {
  CONFLICT_ORDER, arcLabels, characterChoices, conflictOptions, type ArcPosition, type ConflictType, type StoryMapItem, type StoryMapMiss,
  type StoryPhase,
} from './storyMapWorkspace';

export const COUNT_LEVER = 'character_count';
export const STORY_LEVER = 'easier_story';
export const PARTS_LEVER = 'part_pictures';
export const ARROW_LEVER = 'arc_arrow';
export const CONFLICT_PICTURES_LEVER = 'conflict_pictures';
export const CONFLICT_STORY_LEVER = 'easier_conflict';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'A shorter practice story, ungraded; the full story comes back after it.';

/** A practice story: the session's shape with a pool story's content, and (analyze) fewer conflict choices. */
export type PracticeStory = StoryMapData & { conflictChoices?: readonly ConflictType[] };

const norm = (s: string) => s.trim().toLowerCase();
export const practiceId = (phase: StoryPhase) => `${phase}${PRACTICE_SUFFIX}`;
export const practicePhase = (id: string | null | undefined): StoryPhase | null =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) as StoryPhase : null;

// ── help pictures ──────────────────────────────────────────────────────────

/** What each part of a story does, as a picture and a few words. The same for every story; never an event. */
export const PART_PICTURES: Record<ArcPosition, { icon: string; bme: string; mountain: string }> = {
  beginning: { icon: '🏠', bme: 'who and where', mountain: 'who and where' },
  'rising-action': { icon: '📈', bme: '', mountain: 'the problem grows' },
  climax: { icon: '⚡', bme: 'the problem', mountain: 'the biggest moment' },
  'falling-action': { icon: '🛠️', bme: '', mountain: 'the problem gets fixed' },
  resolution: { icon: '✅', bme: 'how it ends', mountain: 'how it ends' },
};
export const partPicture = (data: Pick<StoryMapData, 'structureType'>, key: ArcPosition) => {
  const p = PART_PICTURES[key];
  return { icon: p.icon, words: data.structureType === 'bme' ? p.bme : p.mountain };
};

/** A picture for every kind of conflict, the same on every story. */
export const CONFLICT_PICTURES: Record<ConflictType, { icon: string; words: string }> = {
  'person-vs-self': { icon: '💭', words: 'a fight inside: a fear or a hard choice' },
  'person-vs-person': { icon: '🧍🧍', words: 'against another character' },
  'person-vs-nature': { icon: '🌪️', words: 'against weather, animals or the land' },
  'person-vs-society': { icon: '👥📜', words: 'against a group or its rules' },
};

/** Leak rule for every help picture and caption: no event, no character or printed name, no setting from the story. */
export function helpLeaks(data: StoryMapData, said: string): boolean {
  const s = norm(said);
  const words = [...data.events.map(e => e.text), ...characterChoices(data).map(c => c.name), data.elements.setting.place];
  return words.some(w => w && wordIn(norm(w), s));
}

/** `w` as whole words in `text` ("Sam" is not in "same"). */
function wordIn(w: string, text: string): boolean {
  return new RegExp(`(?<![a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(text);
}

/** Leak rule for the count: refused when every printed name is a character (the count would say "pick them all"). */
export function countLeaks(data: StoryMapData): boolean {
  return characterChoices(data).every(c => c.inStory);
}

// ── easier_story (simplify) ────────────────────────────────────────────────

interface Seed {
  title: string; text: string;
  characters: Array<{ name: string; description: string; role: 'protagonist' | 'supporting' }>;
  notInStory: string; place: string; time: string;
  /** The three-sentence telling a beginning-middle-end practice prints; `bme` is its events. */
  short: string;
  /** beginning, middle (climax), end */
  bme: [string, string, string];
  /** beginning, rising, climax, falling, resolution */
  mountain: [string, string, string, string, string];
}

const POOL: Seed[] = [
  { title: 'Rosa and the Kite',
    text: 'Rosa got a red kite at the beach one windy morning. Her brother Tim helped her run with it. The wind pulled the '
      + 'string out of Rosa\'s hand! Tim ran fast and grabbed the string. Rosa and Tim flew the kite until lunch.',
    characters: [{ name: 'Rosa', description: 'a girl with a red kite', role: 'protagonist' },
      { name: 'Tim', description: 'Rosa\'s brother', role: 'supporting' }],
    notInStory: 'Uncle Joe', place: 'The beach', time: 'A windy morning',
    short: 'One windy morning, Rosa and her brother Tim take a red kite to the beach. The wind pulls the string out of Rosa\'s '
      + 'hand! Tim grabs it, and they fly the kite until lunch.',
    bme: ['Rosa and Tim take a red kite to the beach.', 'The wind pulls the string out of Rosa\'s hand!',
      'Tim grabs the string, and they fly the kite until lunch.'],
    mountain: ['Rosa gets a red kite at the beach.', 'Tim helps Rosa run with the kite.', 'The wind pulls the string out of Rosa\'s hand!',
      'Tim runs fast and grabs the string.', 'Rosa and Tim fly the kite until lunch.'] },
  { title: 'Ben\'s Lost Mitten',
    text: 'Ben wore blue mittens to the park on a snowy day. He built a snowman with his friend Ava. When it was time to go, '
      + 'one mitten was gone! Ava looked under the slide and found it. Ben walked home with warm hands.',
    characters: [{ name: 'Ben', description: 'a boy in blue mittens', role: 'protagonist' },
      { name: 'Ava', description: 'Ben\'s friend', role: 'supporting' }],
    notInStory: 'Grandma Lou', place: 'The park', time: 'A snowy day',
    short: 'One snowy day, Ben and his friend Ava play in the park. Ben\'s blue mitten is gone! Ava finds it under the slide, '
      + 'and Ben goes home with warm hands.',
    bme: ['Ben and Ava play in the park.', 'Ben\'s blue mitten is gone!', 'Ava finds it, and Ben goes home with warm hands.'],
    mountain: ['Ben wears blue mittens to the park.', 'Ben and Ava build a snowman.', 'One mitten is gone!',
      'Ava looks under the slide and finds it.', 'Ben walks home with warm hands.'] },
  { title: 'Kai\'s Beans',
    text: 'Kai planted bean seeds in the backyard in spring. Every day Kai and his mom Lena watered them. One morning a '
      + 'rabbit was eating the leaves! Mom put a little fence around the beans. In summer Kai picked a basket of beans.',
    characters: [{ name: 'Kai', description: 'a boy who plants beans', role: 'protagonist' },
      { name: 'Lena', description: 'Kai\'s mom', role: 'supporting' }],
    notInStory: 'Coach Pat', place: 'The backyard', time: 'Spring',
    short: 'In spring, Kai and his mom Lena plant beans in the backyard. A rabbit eats the leaves! They put up a fence, and in '
      + 'summer Kai picks a basket of beans.',
    bme: ['Kai and Lena plant beans in the backyard.', 'A rabbit eats the leaves!', 'Kai picks a basket of beans.'],
    mountain: ['Kai plants bean seeds in the backyard.', 'Kai and Lena water the seeds every day.', 'A rabbit eats the leaves!',
      'Mom puts a little fence around the beans.', 'Kai picks a basket of beans.'] },
];

/** Every name and event in the session story: a practice story never shows one. */
function sessionWords(data: StoryMapData): string[] {
  return [...characterChoices(data).map(c => c.name), ...data.elements.characters.map(c => c.name),
    ...data.events.map(e => e.text), data.passage.title].filter(Boolean).map(norm);
}

/**
 * Leak rule for a practice story: never the session's story, never another structure, and no name, event or title of
 * the session's story in it (identifying or placing part of the item would be part of its answer).
 */
export function practiceLeaks(p: PracticeStory, data: StoryMapData): boolean {
  if (p.structureType !== data.structureType || norm(p.passage.text) === norm(data.passage.text)) return true;
  const theirs = sessionWords(data);
  const ours = [...characterChoices(p).map(c => c.name), ...p.events.map(e => e.text), p.passage.title, p.passage.text].map(norm);
  // A session name inside the practice text, or a practice name inside the session's printed names.
  return theirs.some(w => ours.some(o => o === w || (w.length > 2 && wordIn(w, o))));
}

const seedStart = (data: StoryMapData) => {
  let n = 0;
  for (const ch of `${data.passage?.title ?? ''}|${data.events.map(e => e.id).join('|')}`) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n;
};

/** The practice story for identify or sequence: the first pool story (from the session's seed) that leaks nothing. */
export function practiceStory(data: StoryMapData): PracticeStory | null {
  const start = seedStart(data);
  const parts = arcLabels(data).map(z => z.key);
  for (let k = 0; k < POOL.length; k++) {
    const s = POOL[(start + k) % POOL.length];
    const texts = data.structureType === 'bme' ? s.bme : s.mountain;
    const p: PracticeStory = {
      title: 'Practice story', gradeLevel: data.gradeLevel, structureType: data.structureType,
      passage: { title: s.title, text: data.structureType === 'bme' ? s.short : s.text },
      elements: { characters: s.characters, setting: { place: s.place, time: s.time, description: `${s.place}, ${s.time.toLowerCase()}.` } },
      events: texts.map((text, i) => ({ id: `p${i + 1}`, text, arcPosition: parts[i], order: i })),
      distractorCharacters: [s.notInStory],
    };
    if (!practiceLeaks(p, data)) return p;
  }
  return null;
}

// ── easier_conflict (simplify) ─────────────────────────────────────────────

const CONFLICT_POOL: Record<ConflictType, { title: string; text: string }> = {
  'person-vs-self': { title: 'Lily\'s Song', text: 'Lily wants to sing in the school show, but she feels too scared to walk on stage.' },
  'person-vs-person': { title: 'The Last Swing', text: 'Jake and Nia both want the last swing, and they argue about who gets it.' },
  'person-vs-nature': { title: 'Snowed In', text: 'A huge snowstorm traps Omar\'s family in their cabin, and they must keep warm.' },
  'person-vs-society': { title: 'The Park Rule', text: 'Zoe thinks the town\'s new rule that kids cannot play in the park is unfair.' },
};
const ORDER = CONFLICT_ORDER;

/**
 * A one-sentence practice conflict with three choices: its own kind, one across inside/outside, one other outside
 * kind. Its kind is picked from the session's seed and never depends on the session's answer.
 */
export function practiceConflict(data: StoryMapData): PracticeStory | null {
  if (!data.elements.conflict) return null;
  const type = ORDER[seedStart(data) % ORDER.length];
  const across: ConflictType = type === 'person-vs-self' ? 'person-vs-nature' : 'person-vs-self';
  const other = ORDER.find(t => t !== type && t !== across && t !== 'person-vs-self')!;
  const s = CONFLICT_POOL[type];
  const p: PracticeStory = {
    ...data, title: 'Practice story',
    passage: { title: s.title, text: s.text },
    elements: { ...data.elements, conflict: { type, description: s.text } },
    conflictChoices: ORDER.filter(t => [type, across, other].includes(t)),
  };
  return norm(p.passage.text) === norm(data.passage.text) ? null : p;
}


export function practiceFor(item: StoryMapItem, data: StoryMapData): PracticeStory | null {
  return item.id === 'analyze' ? practiceConflict(data) : practiceStory(data);
}

export function practiceAssignment(item: StoryMapItem, p: PracticeStory): TeachingAssignment {
  const task = item.id === 'identify'
    ? 'Practice story: pick every character in it, and where and when it takes place.'
    : item.id === 'sequence'
      ? `Practice story: put each event card in its part: ${arcLabels(p).map(z => z.label).join(', ')}.`
      : 'Practice story: what kind of conflict is it? Pick one.';
  return { id: practiceId(item.id), task, response: 'gesture' };
}

// ── declarations ───────────────────────────────────────────────────────────

const IDENTIFY: readonly StoryMapMiss[] = ['picked_not_in_story', 'missed_character', 'wrong_setting'];
const SEQUENCE: readonly StoryMapMiss[] = ['one_part', 'reversed', 'next_part', 'far_part'];
const ANALYZE: readonly StoryMapMiss[] = ['inside_outside', 'other_outside'];

/** The levers on a session phase. A practice story carries none. */
export function storyMapLevers(item: StoryMapItem | null | undefined, data: StoryMapData, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly StoryMapMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const story = practiceFor(item, data) ? [lever(item.id === 'analyze' ? CONFLICT_STORY_LEVER : STORY_LEVER, 'simplify',
    item.id === 'identify' ? IDENTIFY : item.id === 'sequence' ? SEQUENCE : ANALYZE,
    item.id === 'analyze' ? 'The learner cannot tell the kinds of conflict apart in this story yet.'
      : 'The learner cannot do this with a story this long yet.',
    item.id === 'analyze'
      ? 'Opens a one-sentence practice story with three conflict choices first. It is not graded; this story comes back after it, blank.'
      : 'Opens a short, familiar practice story (two characters, one short event per part) with the same task first, none of these names or events. '
        + 'It is not graded; this story comes back after it, blank.')] : [];
  if (item.id === 'identify') return [
    ...(countLeaks(data) ? [] : [lever(COUNT_LEVER, 'help', ['picked_not_in_story', 'missed_character'],
      'The learner leaves out a character or picks a name that is not in the story.',
      'Shows a row of empty person spaces, one for each character in the story, filling one per name picked. It counts the '
        + 'picks; it never marks which names are right. You may say how many characters the story has.')]),
    ...story,
  ];
  if (item.id === 'sequence') return [
    lever(PARTS_LEVER, 'help', ['one_part', 'next_part', 'far_part'],
      'The learner puts cards in the wrong parts, or all in one part, as if the parts mean nothing yet.',
      'Puts a picture and a few words under each part of the arc saying what that part of any story does (who and where, '
        + 'the problem, how it ends). No event is on it; never say which card goes where.'),
    lever(ARROW_LEVER, 'help', ['reversed', 'far_part'],
      'The learner puts the start of the story at the end, or seems not to know which way the arc runs.',
      'Draws an arrow along the parts from where a story starts to where it ends. No event is on it.'),
    ...story,
  ];
  return [
    lever(CONFLICT_PICTURES_LEVER, 'help', ['inside_outside', 'other_outside'],
      'The learner mixes up a struggle inside the character with one outside, or picks the wrong outside force.',
      'Puts a picture and a few words on every conflict choice (a thought bubble, two people, a storm, a crowd with a rule). '
        + 'Every choice gets one, so none is marked.'),
    ...story,
  ];
}

/** What the pulled help levers put on screen, for the tutor. Never a name, an event or a choice singled out. */
export function storyMapLeverFacts(item: StoryMapItem, data: StoryMapData, pulled: readonly string[]): string {
  const has = (id: string) => pulled.includes(id);
  if (item.id === 'identify') {
    return has(COUNT_LEVER) && !countLeaks(data)
      ? `Under the names: ${data.elements.characters.length} empty person spaces, one for each character in the story, filled one `
        + 'per name picked. It does not mark which names.' : '';
  }
  if (item.id === 'sequence') {
    return [
      has(PARTS_LEVER) && `Under each part, a picture and what that part of a story does: ${arcLabels(data)
        .map(z => { const p = partPicture(data, z.key); return `${z.label} ${p.icon} "${p.words}"`; }).join(', ')}. No event is on it.`,
      has(ARROW_LEVER) && `An arrow runs along the parts from where a story starts (${arcLabels(data)[0].label}) to where it ends `
        + `(${arcLabels(data).at(-1)!.label}). No event is on it.`,
    ].filter((s): s is string => !!s).join(' ');
  }
  // The pictures in the printed order, without the choice labels: the scene already lists them, and a label repeated
  // here would read as singled out.
  return has(CONFLICT_PICTURES_LEVER)
    ? `Every conflict choice shows a picture and a few words, in the printed order: ${conflictOptions(data).map(t =>
      `${CONFLICT_PICTURES[t].icon} "${CONFLICT_PICTURES[t].words}"`).join(', ')}.` : '';
}
