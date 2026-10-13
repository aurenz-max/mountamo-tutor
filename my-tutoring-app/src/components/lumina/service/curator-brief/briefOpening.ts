/**
 * The curator brief's opening-screen fields, checked in code (contract R3: the quick-check answer
 * is never shown, spoken or drawn). Pure: the generator, the component and the live adapter share it.
 */
import type { IntroBriefingData, BriefWonder } from '../../types';
import { emojiForHookTheme } from '../../utils/hookVisual';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Whether `text` contains the quick-check answer as whole words. */
export function mentionsAnswer(text: string | undefined, answer: string | undefined): boolean {
  if (!text || !answer) return false;
  const a = normalize(answer);
  if (!a) return false;
  return ` ${normalize(text)} `.includes(` ${a} `);
}

/**
 * Words that ask an image model for an exact arrangement it will get wrong (a row, a count, a pattern).
 * The prompt already forbids them; a scene that still asks for one is dropped and the placeholder stays.
 */
const ARRANGEMENT = /\b(rows?|lines? of|lined up|in a line|queue|sequence|alternating|repeating|patterns?|\d+|two|three|four|five|six|seven|eight|nine|ten)\b/i;
export const asksForArrangement = (scene: string) => ARRANGEMENT.test(scene);

/** Pictures for wonders whose themes repeat, so a pre-reader can tell the choices apart. */
const SPARE_EMOJI = ['❓', '💡', '🔍', '⭐'];

/**
 * Attach each wonder's emoji from its theme, keep at most three distinct ones, and drop any field
 * that carries the quick-check answer. Mutates the raw model result in place.
 */
export function finishOpeningFields(result: Record<string, any>): void {
  const answer: string | undefined = result?.prerequisites?.quickCheck?.answer;
  const hook = result?.hook;
  if (hook) {
    if (typeof hook.question !== 'string' || !hook.question.trim() || mentionsAnswer(hook.question, answer)) delete hook.question;
    if (typeof hook.imagePrompt !== 'string' || !hook.imagePrompt.trim() || mentionsAnswer(hook.imagePrompt, answer)
      || asksForArrangement(hook.imagePrompt)) delete hook.imagePrompt;
  }
  if (typeof result.today !== 'string' || !result.today.trim() || mentionsAnswer(result.today, answer)) delete result.today;

  const raw = Array.isArray(result.wonders) ? result.wonders : [];
  const used = new Set<string>();
  const seenText = new Set<string>();
  const wonders: BriefWonder[] = [];
  for (const w of raw) {
    const text = typeof w?.text === 'string' ? w.text.trim() : '';
    if (!text || mentionsAnswer(text, answer) || seenText.has(normalize(text))) continue;
    seenText.add(normalize(text));
    let emoji = emojiForHookTheme(w.theme, 'question');
    if (used.has(emoji)) emoji = SPARE_EMOJI.find(e => !used.has(e)) ?? emoji;
    used.add(emoji);
    wonders.push({ text, emoji });
    if (wonders.length === 3) break;
  }
  if (wonders.length >= 2) result.wonders = wonders; else delete result.wonders;
}

/**
 * The prompt the image model receives. The picture sets the scene and nothing else: image models
 * get counts, orders and aligned rows wrong, so anything precise is drawn by code, never here.
 */
export function hookPicturePrompt(brief: Pick<IntroBriefingData, 'gradeLevel'> & { hook: { imagePrompt?: string } }): string | null {
  const scene = brief.hook.imagePrompt?.trim();
  if (!scene) return null;
  return `A warm, friendly illustration for a ${brief.gradeLevel || 'young'} student's lesson opening. `
    + `The setting: ${scene}. `
    + 'Show the place and the mood only. No text, letters, numbers or labels anywhere. '
    + 'Do not line objects up in rows, repeating patterns or sequences, and do not show anyone solving a problem.';
}
