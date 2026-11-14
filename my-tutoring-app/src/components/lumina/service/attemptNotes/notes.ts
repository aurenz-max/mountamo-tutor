/**
 * Attempt notes: shared types and the pure parts (no model, no server-only import).
 *
 * The loop: after a submission a small model writes one factual note from the attempt's record
 * (`writeAttemptNote.ts`), the backend files it under unit / skill / subskill, the notes for a lesson's
 * units ride the signed launch packet (`generation/learningObservationPacket.ts`), one applicability call
 * per objective picks the notes that bear on it (`applyNotes.ts`), and every context-native generator
 * receives the picks as `ctx.learnerNotes` and as a private block on `ctx.intent`.
 *
 * Notes are a read model. They never select a lesson, a mode, a tier or an item count.
 */

export type NoteKind = 'strength' | 'struggle';
export interface NoteSignal { kind: NoteKind; what: string; evidence: string }
export interface AttemptNote { notable: boolean; did: string; signals: NoteSignal[] }

/** What the note writer reads: the activity, where it is filed, and the child's recorded work. */
export interface AttemptRecord {
  activity: string; mode?: string; subject?: string; unit?: string; skill?: string; subskill?: string;
  scoreOutOf10?: number; metrics?: unknown; work: unknown;
}

/** A note picked for one objective, with what to do differently because of it. */
export interface LearnerNote { kind: NoteKind; note: string; use: string;
  /** Exact items the note names (a word, a number, a shape) that this assignment should offer again. */
  include?: string[] }

/** Set LUMINA_ATTEMPT_NOTES=off to stop both writing notes and applying them. */
export const attemptNotesOff = () => process.env.LUMINA_ATTEMPT_NOTES === 'off';

/**
 * The per-item record first (asked, expected, observed, verdict, help), then the primitive's own tally.
 * `teachingAttempts` repeats the item record by id, so it is left out.
 */
export function workText(work: unknown): string {
  if (!work || typeof work !== 'object' || Array.isArray(work)) return JSON.stringify(work ?? null).slice(0, 6000);
  const { learningResponses, teachingAttempts: _attempts, ...rest } = work as Record<string, unknown>;
  const items = (Array.isArray(learningResponses) ? learningResponses : []).map((r: Record<string, unknown>) => ({
    asked: r.challenge, expected: String(r.expected ?? '').slice(0, 300), observed: r.observed, verdict: r.verdict,
    priorCorrections: r.priorCorrections, source: r.source, help: String(r.support ?? '').slice(0, 220) }));
  return JSON.stringify({ items, own: rest }).slice(0, 7000);
}

/** True when the work carries the workspace's per-item record. Without it a note has nothing specific to say. */
export function hasItemRecord(work: unknown): boolean {
  const rows = (work as { learningResponses?: unknown } | null | undefined)?.learningResponses;
  return Array.isArray(rows) && rows.length > 0;
}

/** Only well-formed picks survive a config round trip. */
export function cleanLearnerNotes(raw: unknown): LearnerNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is LearnerNote => !!n && ['strength', 'struggle'].includes((n as LearnerNote).kind)
    && typeof (n as LearnerNote).note === 'string' && typeof (n as LearnerNote).use === 'string' && !!(n as LearnerNote).use.trim())
    .slice(0, 3).map(n => {
      const include = (Array.isArray(n.include) ? n.include : []).filter((w): w is string => typeof w === 'string' && !!w.trim())
        .map(w => w.trim().toLowerCase().slice(0, 40)).slice(0, 3);
      return { kind: n.kind, note: n.note.slice(0, 200), use: n.use.slice(0, 200), ...(include.length ? { include } : {}) };
    });
}

const BLOCK_MARKER = 'LEARNER NOTES (PRIVATE';

/**
 * Remove the notes from generated content before it leaves the generation server: any `learnerNotes` field a
 * generator copied from its config, and the private block from any string that echoes the intent. In place.
 */
export function scrubLearnerNotes<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') { const at = node.indexOf(BLOCK_MARKER); return at < 0 ? node : node.slice(0, at).trimEnd(); }
    if (Array.isArray(node)) { node.forEach((v, i) => { node[i] = walk(v); }); return node; }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      delete record.learnerNotes;
      for (const key of Object.keys(record)) record[key] = walk(record[key]);
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * The prompt section for a generator, private to the model. It states the goal (give the child another try at
 * what they missed) before the limits. Reaches a prompt three ways: `buildScopePromptSection` (from
 * `scope.learnerNotes`), `themedFocusLine` (split off the intent), and the tail of `ctx.intent` for a generator
 * that uses neither.
 */
export function learnerNotesBlock(notes: readonly LearnerNote[]): string {
  if (!notes.length) return '';
  return `

${BLOCK_MARKER} - never quote, mention or explain this to the child):
This child recently missed the things below, and this activity can give them another try. Use it as the chance to work on them.
${notes.map(n => `- ${n.use}${n.include?.length ? ` Use exactly: ${n.include.join(', ')}.` : ''} (What happened: ${n.note})`).join('\n')}
- Build at least one item around each line above. Where exact items are named, they must appear among the items the child works on.
- Stay inside this activity's objective, scope, eval mode, difficulty and item count. Do not make those items easier.
- The child meets them as ordinary items: no hint that points at them, and no mention of the earlier mistake, a rule or an answer in any student-visible text.`;
}

/** An intent with the notes section cut off, and the section itself ('' when the intent carries none). */
export function splitLearnerNotes(intent: string | undefined): { intent: string | undefined; section: string } {
  const at = intent?.indexOf(BLOCK_MARKER) ?? -1;
  if (!intent || at < 0) return { intent, section: '' };
  return { intent: intent.slice(0, at).trimEnd(), section: `\n${intent.slice(at)}\n` };
}

/** What the notes did to one generated component. `absent` = a pick named items and none is in the content. */
export type NoteOutcome = 'present' | 'partly' | 'absent' | 'unnamed';
export interface NoteCheck { outcome: NoteOutcome; named: string[]; present: string[] }

/**
 * Code check: are the exact items the picks named among the generated content? Whole-token match on the
 * serialized content, so "pig" does not match "pigeon". Picks that name no item cannot be checked (`unnamed`).
 */
export function checkLearnerNotes(notes: readonly LearnerNote[], content: unknown): NoteCheck {
  const named = Array.from(new Set(notes.flatMap(n => n.include ?? [])));
  if (!named.length) return { outcome: 'unnamed', named, present: [] };
  const tokens = new Set(JSON.stringify(content ?? '').toLowerCase().split(/[^a-z0-9]+/));
  const present = named.filter(item => item.split(/[^a-z0-9]+/).filter(Boolean).every(part => tokens.has(part)));
  return { outcome: present.length === named.length ? 'present' : present.length ? 'partly' : 'absent', named, present };
}
