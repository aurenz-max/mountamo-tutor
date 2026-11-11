import 'server-only';

/**
 * The canvas pilot (USER 2026-11-11): canvases that passed `canvas-check` but are not promoted are offered only to the
 * pilot students, who vote on them inside a lesson. A thumbs up promotes the canvas (`/api/lumina/canvas/vote` runs
 * `canvas-check --promote`); a thumbs down holds it with a reason until its spec is fixed and checked again.
 *
 * Votes live in `qa/canvas/votes.jsonl` (one JSON object per line) because promotion rewrites the generated library,
 * which only a process on the developer's machine can do. Move them to Firestore when more than one student votes.
 */
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CanvasVote {
  canvasId: string;
  vote: 'up' | 'down';
  studentId: string;
  at: string;
  reasons?: string[];
  note?: string;
  /** The lesson's own record of the play: score, checks, misses, time. */
  outcome?: Record<string, unknown>;
  objective?: string;
  topic?: string;
  /** What the promote run printed (thumbs up only). */
  promote?: { ok: boolean; log: string };
}

export const VOTES_FILE = resolve(process.cwd(), 'qa/canvas/votes.jsonl');

/** Students who are offered pilot canvases. `LUMINA_CANVAS_PILOT_STUDENTS` (comma list) overrides the default. */
export function isPilotStudent(studentId: unknown): boolean {
  if (studentId == null || studentId === '') return false;
  const ids = (process.env.LUMINA_CANVAS_PILOT_STUDENTS ?? '1004').split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(String(studentId).trim());
}

let cache: { mtime: number; votes: CanvasVote[] } | null = null;

export function readVotes(): CanvasVote[] {
  try {
    if (!existsSync(VOTES_FILE)) return [];
    const mtime = statSync(VOTES_FILE).mtimeMs;
    if (cache?.mtime === mtime) return cache.votes;
    const votes = readFileSync(VOTES_FILE, 'utf8').split('\n').filter(l => l.trim()).flatMap(l => {
      try { return [JSON.parse(l) as CanvasVote]; } catch { return []; }
    });
    cache = { mtime, votes };
    return votes;
  } catch {
    return [];
  }
}

/**
 * Pilot canvases whose latest vote is a thumbs down. A held canvas comes back when `canvas-check` passes it again after
 * the fix: a passing check (it rewrites `qa/canvas/<id>.json`) newer than the vote clears the hold.
 */
export function heldCanvasIds(): Set<string> {
  const latest = new Map<string, CanvasVote>();
  for (const v of readVotes()) latest.set(v.canvasId, v);
  const held = new Set<string>();
  for (const [id, v] of Array.from(latest)) {
    if (v.vote !== 'down') continue;
    const checked = checkedAt(id);
    if (checked == null || checked <= Date.parse(v.at)) held.add(id);
  }
  return held;
}

/** When `canvas-check` last passed this spec (its saved run), or null. */
function checkedAt(id: string): number | null {
  try {
    const f = resolve(process.cwd(), 'qa/canvas', `${id}.json`);
    return existsSync(f) ? statSync(f).mtimeMs : null;
  } catch {
    return null;
  }
}

export function appendVote(vote: CanvasVote): void {
  appendFileSync(VOTES_FILE, `${JSON.stringify(vote)}\n`);
}
