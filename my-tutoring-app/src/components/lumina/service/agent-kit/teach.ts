/**
 * The kit's teaching sections (USER 2026-11-08): the agent shows and explains an idea before it asks about it, and puts
 * a section wherever the lesson needs one. A section is a short storyboard the child taps through. Each frame is one
 * sentence the tutor says plus any of: displays or the agent's own drawing, a painted picture, named cards. The same call
 * can explain a part, demonstrate a process (the same drawing with a different part lit, frame by frame) or show a worked case.
 *
 * A painted picture is a prompt until the child asks for it (`TeachPanel.tsx`), so a lesson costs nothing for images no
 * one opens. No reader sees it at authoring time, which is why pictures live only in sections and never on a question.
 *
 * Pure (no React, no model). `TeachPanel.tsx` plays the frames; the tutor reads the current frame from the scene; the look
 * stage shows the reader the frames above the task.
 */
import type { FunctionDeclaration } from '@google/genai';
import { DISPLAY_CSS, displayHtml, displayIssues, displayText, displayToolSchema, displayWords, esc, readDisplay, readDisplays, type Display, type DisplayCapability } from './displays';

export interface TeachPicture { prompt: string; caption: string }
export interface TeachCard { title: string; text: string; display?: Display }
export interface TeachStep { says: string; show: Display[]; picture?: TeachPicture; cards?: TeachCard[]; heading?: string }

/** The most frames a child taps through before one question. */
export const MAX_TEACH_STEPS = 8;
const MAX_TEACH_DISPLAYS = 2;
const MAX_TEACH_CARDS = 6;
const MAX_SAYS = 220;

/** The writer a primitive adds to give its author sections. `insertAt` and `replaceIndex` are the kit loop's. */
export const sectionTool = (cap: DisplayCapability): FunctionDeclaration => {
  const show = displayToolSchema(cap);
  return {
    name: 'write_section',
    description: 'Teach before asking: a section the child taps through, placed in the lesson where it is needed. Appended, or put before the piece at insertAt, or replacing the piece at replaceIndex.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short heading for the section.' },
        frames: { type: 'array', description: 'The frames, in order. Each has says and at least one of show, picture, cards.', items: { type: 'object', properties: {
          says: { type: 'string', description: 'The one sentence the tutor says. It must teach even if the picture is never opened.' },
          show: { ...show, description: 'Up to 2 displays or your own svg drawings.' },
          picture: { type: 'object', description: 'A painted picture, for what only a realistic image can show. The child opens it with a button.', properties: {
            prompt: { type: 'string', description: 'What the image model paints: subject, what it is doing, view, setting. No text in the image.' },
            caption: { type: 'string', description: 'A few words the child reads under it.' },
          }, required: ['prompt', 'caption'] },
          cards: { type: 'array', description: 'Up to 6 named cards laid side by side: new words, parts, kinds of a thing.', items: { type: 'object', properties: {
            title: { type: 'string' }, text: { type: 'string', description: 'One short line.' }, display: show.items,
          }, required: ['title', 'text'] } },
        }, required: ['says'] } },
        insertAt: { type: 'integer', description: 'Put this section before the piece at this index.' },
        replaceIndex: { type: 'integer' },
      },
      required: ['frames'],
    },
  };
};

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Frames as code reads them. */
export function readTeach(v: unknown): TeachStep[] {
  return (Array.isArray(v) ? v : []).map(x => {
    const a = (x ?? {}) as { says?: unknown; show?: unknown; picture?: { prompt?: unknown; caption?: unknown }; cards?: unknown; heading?: unknown };
    const cards = (Array.isArray(a.cards) ? a.cards : []).map(c => {
      const o = (c ?? {}) as { title?: unknown; text?: unknown; display?: unknown };
      const display = o.display === undefined ? null : readDisplay(o.display);
      return { title: s(o.title), text: s(o.text), ...(display ? { display } : {}) };
    });
    return { says: s(a.says), show: a.show === undefined ? [] : readDisplays(a.show),
      ...(a.picture ? { picture: { prompt: s(a.picture.prompt), caption: s(a.picture.caption) } } : {}),
      ...(cards.length ? { cards } : {}), ...(s(a.heading) ? { heading: s(a.heading) } : {}) };
  });
}

/** A `write_section` call as frames: the title heads the first one. */
export function readSection(a: { title?: unknown; frames?: unknown }): TeachStep[] {
  const frames = readTeach(a.frames);
  const title = s(a.title);
  return frames.length && title ? [{ ...frames[0], heading: title }, ...frames.slice(1)] : frames;
}

/** Why these frames cannot be shown, as sentences the author can act on. */
export function teachIssues(steps: readonly TeachStep[], cap: DisplayCapability): string[] {
  if (steps.length > MAX_TEACH_STEPS) return [`at most ${MAX_TEACH_STEPS} frames before one question`];
  return steps.flatMap((f, i) => {
    const tag = `teach frame ${i + 1}`;
    if (!f.says) return [`${tag}: says what the child hears`];
    if (f.says.length > MAX_SAYS) return [`${tag}: says is at most ${MAX_SAYS} characters`];
    if (!f.show.length && !f.picture && !f.cards?.length) return [`${tag}: words alone do not teach here; show a drawing, a picture or cards`];
    if (f.show.length > MAX_TEACH_DISPLAYS) return [`${tag}: at most ${MAX_TEACH_DISPLAYS} displays`];
    if ((f.cards?.length ?? 0) > MAX_TEACH_CARDS) return [`${tag}: at most ${MAX_TEACH_CARDS} cards`];
    if (f.picture && (!f.picture.prompt || !f.picture.caption)) return [`${tag}: a picture needs a prompt and a caption`];
    if (f.cards?.some(c => !c.title || !c.text)) return [`${tag}: every card needs a title and a line of text`];
    const drawn = [...f.show, ...(f.cards ?? []).flatMap(c => (c.display ? [c.display] : []))];
    return displayIssues(drawn, cap).map(x => `${tag}: ${x}`);
  });
}

/** Every word the frames put on screen or say. A picture's prompt is for the image model and the child never reads it. */
export const teachText = (steps: readonly TeachStep[]) => steps.map(f => [f.heading, f.says, ...f.show.map(displayText), f.picture?.caption,
  ...(f.cards ?? []).flatMap(c => [c.title, c.text, ...(c.display ? [displayText(c.display)] : [])])].filter(Boolean).join(' ')).join(' ');

/** One frame in words, for the tutor. A picture is named only once it is on screen: the tutor must not describe what the child cannot see. */
export function teachFrameWords(f: TeachStep, opts: { pictureLoaded?: boolean } = {}): string {
  const seen = [...f.show.map(displayWords), ...(f.cards ?? []).map(c => `${c.title}: ${c.text}`), ...(f.picture && opts.pictureLoaded ? [`a picture: ${f.picture.caption}`] : [])];
  return `${f.says}${seen.length ? ` (on screen: ${seen.join('; ')})` : ''}`;
}

/** The frames for the reader of the look stage, above the task. */
export function teachHtml(steps: readonly TeachStep[] | undefined): string {
  if (!steps?.length) return '';
  const frame = (f: TeachStep, i: number) => `<div style="margin-bottom:10px">${f.heading ? `<b>${esc(f.heading)}</b>` : ''}<p style="margin:0 0 6px">${i + 1}. ${esc(f.says)}</p><div style="display:flex;flex-wrap:wrap;gap:10px">${f.show.map(d => `<div style="max-width:380px;min-width:160px">${displayHtml(d)}</div>`).join('')}${f.picture ? `<div style="border:1px dashed #64748b;border-radius:10px;padding:14px;min-width:160px">[A painted picture the child can open: ${esc(f.picture.caption)}]</div>` : ''}${(f.cards ?? []).map(c => `<div style="border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px;width:170px">${c.display ? displayHtml(c.display) : ''}<b>${esc(c.title)}</b><div>${esc(c.text)}</div></div>`).join('')}</div></div>`;
  return `<div style="border:1px solid rgba(251,191,36,.4);border-radius:12px;padding:10px;margin-bottom:14px"><p style="margin:0 0 8px;font-size:13px;color:#fbbf24">Shown first, one frame at a time, then hidden when the task opens:</p>${steps.map(frame).join('')}</div>`;
}

/** What the look reader is told about a section, so it judges the task after it fairly. */
export const TEACH_DESIGN = 'A panel headed "Shown first" teaches the idea before the task and is gone when the task opens, though the child can reopen it. A task that only repeats a sentence from it is a shortcut. A task that makes the child use the idea on a new case is what we want.';

/** The prompt section an author with `write_section` reads. */
export const teachPrompt = (examples: string) => `
## Teach (write_section)
You are teaching this idea, not only testing it. A section is frames the child taps through. Place sections wherever the lesson needs them, as many as it needs: before the first question, and again whenever a question depends on something new. Before each question ask: has this child met every word and idea it needs? If not, teach it first, or change the question.
Each frame is one sentence the tutor says and at least one of:
- show: a display, or your own svg drawing. To demonstrate, draw the same picture again with a different part lit or one thing changed, so the child watches it happen.
- picture: a painted image. Write only the prompt and caption; it is painted when the child opens it. Use it when seeing the real thing teaches and a drawing cannot: what a living thing or a part really looks like. It may never be opened, so the sentence must teach without it, and no question may depend on it.
- cards: named cards side by side, each a title, a short line and an optional drawing: new words, parts, kinds of a thing.
Teach the idea with a case, then make the question use a different case, so the child uses the idea and does not repeat your sentence.
${examples}`;

export { DISPLAY_CSS };
