/**
 * Drawers without numbers: cycle wheel, story arc, then and now, perspective lens, word anatomy,
 * shades of meaning, rhythm grid. Code can check only structure here (every viewpoint answers
 * every question, the pieces include a root, a pattern fits its grid); whether the text is true
 * is not something these checks can see.
 */
import { num, text, type DrawerBase, type DrawerProblem } from './drawerSpecs';

const base = (d: DrawerBase): DrawerProblem[] => (text(d.title) && text(d.caption) ? [] : ['title and caption are required']);
const unique = (xs: string[]) => new Set(xs.map(x => x.trim().toLowerCase())).size === xs.length;

// ---------------------------------------------------------------------------
// cycle-wheel
// ---------------------------------------------------------------------------

export interface CycleStage { label: string; text: string }
export interface DrawerCycleWheelData extends DrawerBase { stages: CycleStage[] }

export function cycleWheelProblems(d: DrawerCycleWheelData): DrawerProblem[] {
  const p = base(d);
  if (!Array.isArray(d.stages) || d.stages.length < 3 || d.stages.length > 8) return [...p, 'needs 3-8 stages'];
  if (!d.stages.every(s => text(s.label) && text(s.text))) p.push('every stage needs a label and text');
  else if (!unique(d.stages.map(s => s.label))) p.push('stage labels must be unique');
  return p;
}

// ---------------------------------------------------------------------------
// story-arc: the five stages are fixed, so the shape is the same in every lesson
// ---------------------------------------------------------------------------

export const STORY_STAGES = [
  { key: 'beginning', label: 'Beginning' },
  { key: 'problem', label: 'Problem grows' },
  { key: 'climax', label: 'Big moment' },
  { key: 'solved', label: 'Problem solved' },
  { key: 'ending', label: 'Ending' },
] as const;
export type StoryStageKey = typeof STORY_STAGES[number]['key'];
export interface DrawerStoryArcData extends DrawerBase { events: Record<StoryStageKey, string> }

export function storyArcProblems(d: DrawerStoryArcData): DrawerProblem[] {
  const p = base(d);
  if (!d.events || typeof d.events !== 'object') return [...p, 'events are required'];
  for (const s of STORY_STAGES) if (!text(d.events[s.key])) p.push(`the ${s.label} event is missing`);
  if (!p.length && !unique(STORY_STAGES.map(s => d.events[s.key]))) p.push('two stages have the same event');
  return p;
}

// ---------------------------------------------------------------------------
// then-and-now
// ---------------------------------------------------------------------------

export interface ThenNowRow { aspect: string; then: string; now: string; /** True when this aspect did not change. */ same: boolean }
export interface DrawerThenAndNowData extends DrawerBase { thenLabel: string; nowLabel: string; rows: ThenNowRow[] }

export function thenAndNowProblems(d: DrawerThenAndNowData): DrawerProblem[] {
  const p = base(d);
  if (!text(d.thenLabel) || !text(d.nowLabel)) p.push('thenLabel and nowLabel are required');
  if (!Array.isArray(d.rows) || d.rows.length < 3 || d.rows.length > 7) return [...p, 'needs 3-7 rows'];
  for (const r of d.rows) if (!text(r.aspect) || !text(r.then) || !text(r.now)) p.push(`row "${r.aspect}" needs an aspect, a then and a now`);
  if (p.length) return p;
  if (!unique(d.rows.map(r => r.aspect))) p.push('aspects must be unique');
  if (d.rows.every(r => r.same)) p.push('at least one aspect must have changed');
  for (const r of d.rows) if (!r.same && r.then.trim().toLowerCase() === r.now.trim().toLowerCase()) p.push(`row "${r.aspect}" says the same thing twice but is not marked same`);
  return p;
}

// ---------------------------------------------------------------------------
// perspective-lens
// ---------------------------------------------------------------------------

/** answers[i] answers prompts[i]. */
export interface PerspectiveView { label: string; answers: string[] }
export interface DrawerPerspectiveLensData extends DrawerBase { event: string; prompts: string[]; views: PerspectiveView[] }

export function perspectiveLensProblems(d: DrawerPerspectiveLensData): DrawerProblem[] {
  const p = base(d);
  if (!text(d.event)) p.push('event is required');
  if (!Array.isArray(d.prompts) || d.prompts.length < 2 || d.prompts.length > 4 || !d.prompts.every(text)) return [...p, 'needs 2-4 questions'];
  if (!Array.isArray(d.views) || d.views.length < 2 || d.views.length > 4) return [...p, 'needs 2-4 viewpoints'];
  if (!unique(d.views.map(v => v.label ?? ''))) p.push('viewpoint labels must be unique');
  // The same questions to every side, so no side is left thin.
  for (const v of d.views) {
    if (!text(v.label)) p.push('every viewpoint needs a label');
    if (!Array.isArray(v.answers) || v.answers.length !== d.prompts.length || !v.answers.every(text)) p.push(`viewpoint "${v.label}" must answer all ${d.prompts.length} questions`);
  }
  return p;
}

// ---------------------------------------------------------------------------
// word-anatomy
// ---------------------------------------------------------------------------

export type WordPieceType = 'prefix' | 'root' | 'suffix';
export interface WordPiece { text: string; type: WordPieceType; meaning: string }
/** A real word made from some of the pieces. `use` lists piece texts. */
export interface WordForm { use: string[]; word: string; meaning: string }
export interface DrawerWordAnatomyData extends DrawerBase { pieces: WordPiece[]; forms: WordForm[] }

const ORDER: Record<WordPieceType, number> = { prefix: 0, root: 1, suffix: 2 };
/** Pieces in reading order: prefixes, the root, suffixes. */
export const orderedPieces = (d: DrawerWordAnatomyData) =>
  d.pieces.map((x, i) => ({ ...x, i })).sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.i - b.i);
const setKey = (xs: string[]) => [...xs].map(x => x.trim().toLowerCase()).sort().join('|');
export const formFor = (d: DrawerWordAnatomyData, on: string[]) => d.forms.find(f => setKey(f.use) === setKey(on)) ?? null;

export function wordAnatomyProblems(d: DrawerWordAnatomyData): DrawerProblem[] {
  const p = base(d);
  if (!Array.isArray(d.pieces) || d.pieces.length < 2 || d.pieces.length > 5) return [...p, 'needs 2-5 pieces'];
  if (!Array.isArray(d.forms) || d.forms.length < 2 || d.forms.length > 8) return [...p, 'needs 2-8 real words'];
  for (const x of d.pieces) {
    if (!text(x.text) || !text(x.meaning)) p.push('every piece needs text and a meaning');
    if (!(x.type in ORDER)) p.push(`piece "${x.text}" type must be prefix, root or suffix`);
  }
  if (p.length) return p;
  const roots = d.pieces.filter(x => x.type === 'root');
  if (roots.length !== 1) return [...p, 'needs exactly one root'];
  if (!unique(d.pieces.map(x => x.text))) p.push('piece texts must be unique');
  const root = roots[0].text.trim().toLowerCase();
  const known = new Set(d.pieces.map(x => x.text.trim().toLowerCase()));
  for (const f of d.forms) {
    if (!text(f.word) || !text(f.meaning) || !Array.isArray(f.use)) { p.push('every word needs the pieces it uses, the word and a meaning'); continue; }
    for (const u of f.use) if (!known.has(u.trim().toLowerCase())) p.push(`"${f.word}" uses "${u}", which is not a piece`);
    if (!f.use.some(u => u.trim().toLowerCase() === root)) p.push(`"${f.word}" must use the root "${roots[0].text}"`);
    // Spelling can change at a join (happy + ness = happiness), so only the root's start must appear.
    if (!f.word.toLowerCase().includes(root.slice(0, Math.min(3, root.length)))) p.push(`"${f.word}" does not contain the root "${roots[0].text}"`);
  }
  if (!p.length && new Set(d.forms.map(f => setKey(f.use))).size !== d.forms.length) p.push('two words use the same pieces');
  if (!p.length && !d.forms.some(f => f.use.length >= 2)) p.push('at least one word must join two or more pieces');
  return p;
}

// ---------------------------------------------------------------------------
// shades-of-meaning
// ---------------------------------------------------------------------------

export interface DrawerShadesOfMeaningData extends DrawerBase {
  /** A sentence with one blank written "___". */
  frame: string;
  /** Weakest first. */
  words: string[];
  weakLabel: string;
  strongLabel: string;
}

export function shadesOfMeaningProblems(d: DrawerShadesOfMeaningData): DrawerProblem[] {
  const p = base(d);
  if (!text(d.frame) || d.frame.split('___').length !== 2) p.push('frame must be a sentence with exactly one "___"');
  if (!text(d.weakLabel) || !text(d.strongLabel)) p.push('weakLabel and strongLabel are required');
  if (!Array.isArray(d.words) || d.words.length < 4 || d.words.length > 7) return [...p, 'needs 4-7 words'];
  if (!d.words.every(w => text(w) && w.trim().split(/\s+/).length <= 3)) p.push('every word must be a word or a short phrase');
  else if (!unique(d.words)) p.push('words must be unique');
  return p;
}

// ---------------------------------------------------------------------------
// rhythm-grid
// ---------------------------------------------------------------------------

export const RHYTHM_SOUNDS = ['stomp', 'clap', 'snap', 'tap', 'bell'] as const;
export type RhythmSound = typeof RHYTHM_SOUNDS[number];
export interface RhythmTrack { label: string; sound: RhythmSound; /** "x" for a hit, "." for a rest, one character per step. */ pattern: string }
export interface DrawerRhythmGridData extends DrawerBase {
  /** Beats per minute. */
  tempo: number;
  beats: number;
  /** 1, 2 or 4 steps in each beat. */
  stepsPerBeat: number;
  tracks: RhythmTrack[];
}

export const rhythmSteps = (d: DrawerRhythmGridData) => d.beats * d.stepsPerBeat;

/** "1 & 2 &" for two steps a beat, "1 e & a" for four. */
export function rhythmCounts(d: DrawerRhythmGridData): string[] {
  const sub = d.stepsPerBeat === 4 ? ['', 'e', '&', 'a'] : d.stepsPerBeat === 2 ? ['', '&'] : [''];
  return Array.from({ length: rhythmSteps(d) }, (_, i) => sub[i % d.stepsPerBeat] || String(Math.floor(i / d.stepsPerBeat) + 1));
}

export function rhythmGridProblems(d: DrawerRhythmGridData): DrawerProblem[] {
  const p = base(d);
  if (!num(d.tempo) || d.tempo < 40 || d.tempo > 180) p.push('tempo must be 40-180');
  if (!Number.isInteger(d.beats) || d.beats < 2 || d.beats > 8) p.push('beats must be 2-8');
  if (![1, 2, 4].includes(d.stepsPerBeat)) p.push('stepsPerBeat must be 1, 2 or 4');
  if (!Array.isArray(d.tracks) || d.tracks.length < 1 || d.tracks.length > 4) return [...p, 'needs 1-4 tracks'];
  if (p.length) return p;
  const n = rhythmSteps(d);
  for (const t of d.tracks) {
    if (!text(t.label)) p.push('every track needs a label');
    if (!RHYTHM_SOUNDS.includes(t.sound)) p.push(`track "${t.label}" sound must be one of ${RHYTHM_SOUNDS.join(', ')}`);
    if (typeof t.pattern !== 'string' || t.pattern.length !== n || /[^x.]/.test(t.pattern)) p.push(`track "${t.label}" pattern must be ${n} characters of x and .`);
  }
  if (!p.length && !d.tracks.some(t => t.pattern.includes('x'))) p.push('the rhythm has no hits');
  return p;
}
