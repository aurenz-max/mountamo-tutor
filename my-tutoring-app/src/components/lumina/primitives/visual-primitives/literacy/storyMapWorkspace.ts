/**
 * Story map on the shared tutor/JEV teaching workspace: the domain its boss (`storyMap.boss.ts`) and component read.
 *
 * One generated story is two or three checked items, the activity's own steps: `identify` (pick every character
 * and the setting), `sequence` (put every event card in its part of the story arc) and, at Grade 4 and up when the
 * story has a conflict, `analyze` (name the kind of conflict). The activity's own check is the judge, so the tutor
 * is never told which printed names are characters, which setting is right, where an event goes, or the conflict type.
 *
 * Pure: the component, the boss and the journey read the same items, choice orders, ask and scene.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import { stableShuffle } from '../../../utils/choiceOrder';
import type { StoryMapData } from './StoryMap';
import type { StoryMapMiss } from './storyMap.card';

export { ANALYZE_MISSES, IDENTIFY_MISSES, SEQUENCE_MISSES, type StoryMapMiss } from './storyMap.card';

export type StoryPhase = 'identify' | 'sequence' | 'analyze';
export type ArcPosition = StoryMapData['events'][number]['arcPosition'];
export type ConflictType = NonNullable<StoryMapData['elements']['conflict']>['type'];

/** A practice story: the session's shape with a pool story's content, and (analyze) fewer conflict choices. */
export type PracticeStory = StoryMapData & { conflictChoices?: readonly ConflictType[] };

/**
 * One checked item: a step of the story map. `id` is the step on the session story, or `<step>~simpler` on the
 * practice story a simplify lever opens (`story`), which is then on screen in place of the session's.
 */
export interface StoryMapItem {
  id: string;
  phase: StoryPhase;
  structureType: StoryMapData['structureType'];
  story?: PracticeStory;
}

export const ARC_LABELS_BME: { key: ArcPosition; label: string }[] = [
  { key: 'beginning', label: 'Beginning' },
  { key: 'climax', label: 'Middle' },
  { key: 'resolution', label: 'End' },
];
export const ARC_LABELS_MOUNTAIN: { key: ArcPosition; label: string }[] = [
  { key: 'beginning', label: 'Introduction' },
  { key: 'rising-action', label: 'Rising Action' },
  { key: 'climax', label: 'Climax' },
  { key: 'falling-action', label: 'Falling Action' },
  { key: 'resolution', label: 'Resolution' },
];
export const CONFLICT_LABELS: Record<ConflictType, string> = {
  'person-vs-person': 'Character vs. Character',
  'person-vs-self': 'Character vs. Self',
  'person-vs-nature': 'Character vs. Nature',
  'person-vs-society': 'Character vs. Society',
};

export const CONFLICT_ORDER: readonly ConflictType[] = ['person-vs-self', 'person-vs-person', 'person-vs-nature', 'person-vs-society'];

/** The conflict choices a story prints, in order: all four, or a practice story's fewer. */
export const conflictOptions = (d: StoryMapData & { conflictChoices?: readonly ConflictType[] }): readonly ConflictType[] =>
  d.conflictChoices ?? CONFLICT_ORDER;

export const arcLabels = (data: Pick<StoryMapData, 'structureType'>) =>
  data.structureType === 'bme' ? ARC_LABELS_BME : ARC_LABELS_MOUNTAIN;

/** Grade 4 and up, with a conflict in the story: the analyze phase is asked. */
export function asksConflict(data: Pick<StoryMapData, 'gradeLevel' | 'elements'>): boolean {
  const grade = parseInt(String(data.gradeLevel ?? '').replace(/[^0-9]/g, ''), 10);
  return grade >= 4 && !!data.elements?.conflict;
}

export function storyMapItems(data: Pick<StoryMapData, 'gradeLevel' | 'elements' | 'structureType'>): StoryMapItem[] {
  const phases: StoryPhase[] = ['identify', 'sequence', ...(asksConflict(data) ? ['analyze' as const] : [])];
  return phases.map(phase => ({ id: phase, phase, structureType: data.structureType }));
}

const seedOf = (data: StoryMapData) => `${data.passage?.title ?? ''}|${data.events.map(e => e.id).join('|')}`;

/** One printed character tile: a name from the story, or (medium/hard tiers) a validated name that is not in it. */
export interface CharacterChoice { name: string; inStory: boolean; description?: string; role?: string }

/** The character tiles in screen order: the story's characters and the tier's distractor names, mixed. */
export function characterChoices(data: StoryMapData): CharacterChoice[] {
  const real = data.elements.characters.map(c => ({ name: c.name, inStory: true, description: c.description, role: c.role }));
  const taken = new Set(real.map(c => c.name.trim().toLowerCase()));
  const passage = (data.passage?.text ?? '').toLowerCase();
  // A distractor the story mentions is a right pick the check would mark wrong: never printed.
  const fake = (data.distractorCharacters ?? [])
    .filter(n => typeof n === 'string' && n.trim() && !taken.has(n.trim().toLowerCase()) && !passage.includes(n.trim().toLowerCase()))
    .map(name => ({ name, inStory: false }));
  // At least one printed name is never a character, at every tier and with none: with only real characters printed,
  // "select all" passes. A generator shortfall is filled from a fixed pool, a name none of whose words the story uses.
  if (!fake.length) {
    const words = new Set(passage.match(/[a-z']+/g) ?? []);
    const start = Array.from(seedOf(data)).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
    const name = FALLBACK_NAMES.map((_, k) => FALLBACK_NAMES[(start + k) % FALLBACK_NAMES.length])
      .find(n => !taken.has(n.toLowerCase()) && !n.toLowerCase().split(/[\s.]+/).some(w => w.length > 2 && words.has(w)));
    if (name) fake.push({ name, inStory: false });
  }
  return stableShuffle([...real, ...fake], `characters|${seedOf(data)}`);
}

/** Names a story-map story rarely uses, for a printed non-character when the generator shipped none. */
export const FALLBACK_NAMES = ['Mr. Finch', 'Aunt Rita', 'Captain Reed', 'Ms. Ortiz', 'Farmer Gus', 'Dr. Patel'];

export interface SettingChoice { id: string; text: string; isCorrect: boolean }

/** The printed settings: the story's own, and two that fit no story here, in a stable mixed order. */
export function settingChoices(data: StoryMapData): SettingChoice[] {
  const s = data.elements.setting;
  return stableShuffle([
    { id: 'correct', text: `${s.place} - ${s.time}`, isCorrect: true },
    { id: 'distractor-1', text: 'An unknown city - Long ago', isCorrect: false },
    { id: 'distractor-2', text: 'A spaceship - In the future', isCorrect: false },
  ], `setting|${seedOf(data)}`);
}

/**
 * The event cards in the bank's order. A shuffle seeded by the story, never the story's own order: the generator
 * lists events in order, so drawing them as given printed the answer top to bottom (a rotation breaks a sorted draw).
 */
export function eventBank(data: StoryMapData): StoryMapData['events'] {
  const events = stableShuffle(data.events, `events|${seedOf(data)}`);
  const sorted = events.every((e, i) => i === 0 || e.order >= events[i - 1].order);
  return sorted && events.length > 1 ? [...events.slice(1), events[0]] : events;
}

/** What the learner is asked on one step; a practice story says it is one. */
export function storyMapAsk(item: StoryMapItem): string {
  const ask = item.phase === 'identify'
    ? 'Read the story. Pick every character in it, and pick where and when it takes place.'
    : item.phase === 'sequence'
      ? `Put each event card in its part of the story: ${arcLabels(item).map(z => z.label).join(', ')}.`
      : 'What kind of conflict does the main character face? Pick one.';
  return item.story ? `Practice story: ${ask}` : ask;
}

/** What the learner has done on the open phase. */
export interface StoryMapView {
  selectedCharacters: readonly string[];
  selectedSetting: string | null;
  /** eventId -> the part it sits in. */
  placed: Readonly<Record<string, ArcPosition>>;
  selectedConflict: string | null;
  /** After a checked sequence, until Try again: which cards the screen marks right and wrong. */
  marked: { right: readonly string[]; wrong: readonly string[] } | null;
}

export const EMPTY_VIEW: StoryMapView = { selectedCharacters: [], selectedSetting: null, placed: {}, selectedConflict: null, marked: null };

const eventText = (data: StoryMapData, id: string) => data.events.find(e => e.id === id)?.text ?? id;

/** The learner's work in their own terms, never the key. */
export function describeStoryWork(item: Pick<StoryMapItem, 'phase'>, data: StoryMapData, view: StoryMapView): string {
  if (item.phase === 'identify') {
    const setting = settingChoices(data).find(s => s.id === view.selectedSetting)?.text;
    const chars = view.selectedCharacters.length ? `Picked characters: ${view.selectedCharacters.join(', ')}` : 'No character picked yet';
    return `${chars}. ${setting ? `Picked setting: "${setting}"` : 'No setting picked yet'}.`;
  }
  if (item.phase === 'sequence') {
    const parts = arcLabels(data).map(z => {
      const here = Object.entries(view.placed).filter(([, at]) => at === z.key).map(([id]) => `"${eventText(data, id)}"`);
      return `${z.label}: ${here.length ? here.join(', ') : 'empty'}`;
    });
    const left = data.events.length - Object.keys(view.placed).length;
    if (left === data.events.length) return 'No event card placed yet';
    return `Placed: ${parts.join('; ')}.${left ? ` ${left} card${left > 1 ? 's' : ''} not placed yet.` : ''}`;
  }
  const label = view.selectedConflict ? CONFLICT_LABELS[view.selectedConflict as ConflictType] : null;
  return label ? `Picked: ${label}` : 'No conflict type picked yet';
}

// ── the activity's check ───────────────────────────────────────────────────

export function identifyCorrect(data: StoryMapData, view: StoryMapView): boolean {
  const real = new Set(data.elements.characters.map(c => c.name));
  return view.selectedCharacters.length === real.size && view.selectedCharacters.every(n => real.has(n))
    && view.selectedSetting === 'correct';
}

export function sequenceCorrect(data: StoryMapData, placed: StoryMapView['placed']): boolean {
  return data.events.every(e => placed[e.id] === e.arcPosition);
}

export function analyzeCorrect(data: StoryMapData, picked: string | null): boolean {
  return !!picked && picked === data.elements.conflict?.type;
}

export function storyMapCorrect(item: Pick<StoryMapItem, 'phase'>, data: StoryMapData, view: StoryMapView): boolean {
  return item.phase === 'identify' ? identifyCorrect(data, view)
    : item.phase === 'sequence' ? sequenceCorrect(data, view.placed) : analyzeCorrect(data, view.selectedConflict);
}

/** What a wrong check shows (`TeachingAttempt.miss`); the misses are listed on the card (`storyMap.card.ts`). */
export function storyMapMiss(item: Pick<StoryMapItem, 'phase'> | null | undefined, data: StoryMapData, view: StoryMapView): StoryMapMiss | undefined {
  if (!item || storyMapCorrect(item, data, view)) return undefined;
  if (item.phase === 'identify') {
    const real = new Set(data.elements.characters.map(c => c.name));
    if (view.selectedCharacters.some(n => !real.has(n))) return 'picked_not_in_story';
    if (real.size !== view.selectedCharacters.length) return 'missed_character';
    return view.selectedSetting !== 'correct' ? 'wrong_setting' : undefined;
  }
  if (item.phase === 'sequence') {
    const zones = arcLabels(data).map(z => z.key);
    const at = (p: ArcPosition) => zones.indexOf(p);
    const placedAt = data.events.map(e => view.placed[e.id]);
    if (placedAt.some(p => !p)) return undefined;
    const used = new Set(placedAt);
    if (used.size === 1 && new Set(data.events.map(e => e.arcPosition)).size > 1) return 'one_part';
    const wrong = data.events.filter(e => view.placed[e.id] !== e.arcPosition);
    if (!wrong.length) return undefined;
    const n = zones.length;
    if (wrong.every(e => at(view.placed[e.id]) === n - 1 - at(e.arcPosition))) return 'reversed';
    return wrong.every(e => Math.abs(at(view.placed[e.id]) - at(e.arcPosition)) === 1) ? 'next_part' : 'far_part';
  }
  const target = data.elements.conflict?.type, picked = view.selectedConflict;
  if (!target || !picked) return undefined;
  return (target === 'person-vs-self') !== (picked === 'person-vs-self') ? 'inside_outside' : 'other_outside';
}

// ── scene ──────────────────────────────────────────────────────────────────

/** What is drawn and asked. Choices are listed in screen order and never marked right. `kind` names the step. */
export function workspaceScene(item: Pick<StoryMapItem, 'phase'>, data: StoryMapData, view: StoryMapView): SceneOf {
  const facts: Record<string, string> = {
    kind: item.phase,
    storyTitle: data.passage.title,
    ...textFacts('story', data.passage.text),
  };
  if (item.phase === 'identify') {
    facts.characterChoices = `Printed names (some may not be in the story): ${characterChoices(data).map(c => c.name).join(', ')}`;
    facts.settingChoices = `Printed settings: ${settingChoices(data).map(s => `"${s.text}"`).join('; ')}`;
  } else if (item.phase === 'sequence') {
    facts.parts = `Story arc parts, in order: ${arcLabels(data).map(z => z.label).join(', ')}. More than one card can go in a part.`;
    eventBank(data).forEach((e, i) => { facts[`card${i + 1}`] = e.text; });
    facts.cards = 'The event cards above are listed in the bank\'s mixed-up order, not in story order.';
    if (view.marked) {
      facts.checkedMarks = `The screen marks ${view.marked.right.length} of ${data.events.length} cards right (green) and `
        + `${view.marked.wrong.length} wrong (red)${view.marked.wrong.length
          ? `: ${view.marked.wrong.map(id => `"${eventText(data, id)}"`).join(', ')}` : ''}`;
    }
  } else {
    if (data.elements.conflict?.description) facts.conflictShown = data.elements.conflict.description;
    facts.conflictChoices = `Printed choices: ${conflictOptions(data).map(t => CONFLICT_LABELS[t]).join(', ')}`;
  }
  facts.learnerWork = describeStoryWork(item, data, view);
  return { objects: [], facts };
}
