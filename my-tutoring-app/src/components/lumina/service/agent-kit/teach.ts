/**
 * The kit's teach step (USER 2026-11-08): the agent shows an idea before it asks about it. A teach step is a short
 * storyboard the child taps through, each frame a sentence and at least one drawing, so the same field can explain a part,
 * demonstrate a process (the same drawing with a different part lit, frame by frame) or show a worked case.
 *
 * Pure (no React, no model). The author writes `teach` on an item; `TeachPanel.tsx` plays it; the tutor reads the current
 * frame from the scene; the look stage shows the reader the whole storyboard above the task.
 */
import { DISPLAY_CSS, displayHtml, displayIssues, displayText, displayToolSchema, displayWords, esc, readDisplays, type Display, type DisplayCapability } from './displays';

export interface TeachStep { says: string; show: Display[] }
export const MAX_TEACH_STEPS = 4;
const MAX_TEACH_DISPLAYS = 2;
const MAX_SAYS = 220;

/** A writer's `teach` field. */
export const teachToolSchema = (cap: DisplayCapability) => ({
  type: 'array',
  description: 'What the child is shown before this item (see "Teach first"). 1-4 frames, each a sentence and a drawing.',
  items: { type: 'object', properties: { says: { type: 'string' }, show: displayToolSchema(cap) }, required: ['says', 'show'] },
}) as const;

/** A tool's teach frames as code reads them. */
export function readTeach(v: unknown): TeachStep[] {
  return (Array.isArray(v) ? v : []).map(x => {
    const a = (x ?? {}) as { says?: unknown; show?: unknown };
    return { says: typeof a.says === 'string' ? a.says.trim() : '', show: readDisplays(a.show) };
  });
}

/** Why these frames cannot be shown, as sentences the author can act on. */
export function teachIssues(steps: readonly TeachStep[], cap: DisplayCapability): string[] {
  if (steps.length > MAX_TEACH_STEPS) return [`teach: at most ${MAX_TEACH_STEPS} frames`];
  return steps.flatMap((s, i) => {
    const tag = `teach frame ${i + 1}`;
    if (!s.says) return [`${tag}: says what the child hears`];
    if (s.says.length > MAX_SAYS) return [`${tag}: says is at most ${MAX_SAYS} characters`];
    if (!s.show.length) return [`${tag}: words alone do not teach here; show a drawing`];
    if (s.show.length > MAX_TEACH_DISPLAYS) return [`${tag}: at most ${MAX_TEACH_DISPLAYS} displays`];
    return displayIssues(s.show, cap).map(x => `${tag}: ${x}`);
  });
}

/** Every word the frames put on screen or say. */
export const teachText = (steps: readonly TeachStep[]) => steps.map(s => `${s.says} ${s.show.map(displayText).join(' ')}`).join(' ');

/** One frame in words, for the tutor. */
export const teachFrameWords = (s: TeachStep) => `${s.says}${s.show.length ? ` (on screen: ${s.show.map(displayWords).join('; ')})` : ''}`;

/** The storyboard for the reader of the look stage: every frame, above the task. */
export function teachHtml(steps: readonly TeachStep[] | undefined): string {
  if (!steps?.length) return '';
  return `<div style="border:1px solid rgba(251,191,36,.4);border-radius:12px;padding:10px;margin-bottom:14px"><p style="margin:0 0 8px;font-size:13px;color:#fbbf24">Shown first, one frame at a time, then hidden when the task opens:</p>${steps.map((s, i) => `<div style="margin-bottom:10px"><p style="margin:0 0 6px">${i + 1}. ${esc(s.says)}</p><div style="display:flex;flex-wrap:wrap;gap:10px">${s.show.map(d => `<div style="max-width:380px;min-width:160px">${displayHtml(d)}</div>`).join('')}</div></div>`).join('')}</div>`;
}

/** What the look reader is told about a teach step, so it judges the task after it fairly (USER 11-08: a textbook section and its knowledge check). */
export const TEACH_DESIGN = 'A panel headed "Shown first" teaches the idea and is gone when the task opens. The task is a knowledge check on it: recalling or using what the panel taught is the activity, not a shortcut. Report only a way to succeed that needs nothing from the panel.';

/** The prompt section an author with `teach` reads. */
export const teachPrompt = (examples: string) => `
## Teach first (teach)
You are teaching this idea, not only testing it. The child taps through teach frames before the item opens: each is one sentence the tutor says and a drawing. The drawing does the explaining: draw the same picture again with a different part lit or one thing changed, so the child watches it happen. Do not write a list of facts. The item after the frames is a knowledge check: it may ask the child to recall what the frames showed, and later items can use the idea on a new case.
${examples}`;

export { DISPLAY_CSS };
