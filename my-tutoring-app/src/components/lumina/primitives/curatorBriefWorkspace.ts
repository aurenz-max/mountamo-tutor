/**
 * The curator brief as an ungraded teaching surface: the lesson's opening screen. The tutor opens
 * the lesson from it in about three short beats (the hook question, the big idea, what the learner
 * will do), heard as facts, not a script. The learner may tap an "I wonder" choice and presses Start.
 *
 * Pure, because the server route imports the validator through the live adapter. The quick-check
 * answer is never a fact here (contract R3): the opening screen does not show the quick check.
 */
import type { IntroBriefingData, BriefWonder } from '../types';
import type { TeachingSurfaceObject } from '../components/live-activity/runtime/useTeachingSurface';

/** Same grade signals as `utils/kindergartenMode.isPreReaderGrade`, which is a client module the server route cannot import. */
export const isPreReaderGrade = (grade?: string | null): boolean =>
  !!grade && /(kinder|preschool|pre-?k\b|prek|toddler|pre-?reader|^\s*gk\s*$|grade\s*k\b|^\s*k\s*$)/i.test(grade);

/** Window event a lesson host listens for: the learner pressed Start on the opening (the K stage advances on it). */
export const BRIEF_START_EVENT = 'lumina:brief-start';

export type PictureState = 'drawn' | 'drawing' | 'none';

/** Accent per "I wonder" choice, in order. A pre-reader tells them apart by colour and picture. */
export const WONDER_ACCENTS = ['cyan', 'amber', 'pink'] as const;

export function validateBriefTeaching(value: unknown): IntroBriefingData {
  const d = value as IntroBriefingData;
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (!d || !text(d.topic) || !text(d.hook?.content) || !text(d.bigIdea?.statement)
      || !Array.isArray(d.objectives) || d.objectives.length === 0 || !d.objectives.every(o => text(o?.text)))
    throw new Error('A lesson opening needs a topic, a hook, a big idea and at least one objective');
  return d;
}

/** The three captions, in speaking order. Older briefs without the short fields fall back to the long ones. */
export function briefCaptions(d: IntroBriefingData) {
  return {
    hook: d.hook.question?.trim() || d.hook.content,
    bigIdea: d.bigIdea.statement,
    today: d.today?.trim() || d.objectives[0].text,
  };
}

export const briefWonders = (d: IntroBriefingData): BriefWonder[] =>
  Array.isArray(d.wonders) ? d.wonders.filter(w => typeof w?.text === 'string' && w.text.trim()).slice(0, 3) : [];

export const briefSteps = (d: IntroBriefingData) =>
  (Array.isArray(d.roadmap) ? d.roadmap : []).filter(p => typeof p?.phase === 'string' && p.phase.trim());

export const teachingTask = (d: IntroBriefingData) =>
  `Open the lesson "${d.topic}": what it is about, its big idea, and what the learner will do today.`;

export interface BriefView { picture: PictureState; picked: number | null; started: boolean }

/** What the opening screen shows, as the tutor receives it. */
export function teachingScene(d: IntroBriefingData, view: BriefView) {
  const captions = briefCaptions(d);
  const wonders = briefWonders(d);
  const steps = briefSteps(d);
  const objects: TeachingSurfaceObject[] = [
    { id: 'picture', label: 'Picture of where the hook happens', shown: view.picture === 'drawn' },
    { id: 'hook', label: `Caption 1, the hook: ${captions.hook}`, shown: true },
    { id: 'bigIdea', label: `Caption 2, the big idea: ${captions.bigIdea}`, shown: true },
    { id: 'today', label: `Caption 3, today: ${captions.today}`, shown: true },
    ...(steps.length ? [{ id: 'steps', label: 'The strip of lesson steps', shown: true }] : []),
    ...wonders.map((w, i) => ({ id: `wonder-${i}`, label: `"I wonder" choice ${i + 1} (${WONDER_ACCENTS[i]}, ${w.emoji}): ${w.text}`, shown: true })),
  ];
  const facts: Record<string, string | number> = {
    topic: d.topic,
    ...(d.preparedFor ? { learnerName: d.preparedFor } : {}),
    hook: d.hook.content,
    hookQuestion: captions.hook,
    bigIdea: captions.bigIdea,
    whyItMatters: d.bigIdea.whyItMatters ?? '',
    today: captions.today,
    objectives: d.objectives.map(o => o.text).join(' | '),
    ...(steps.length ? { steps: steps.map((p, i) => `${i + 1}. ${p.phase}`).join(' | ') } : {}),
    wonders: wonders.length ? wonders.map((w, i) => `${i + 1} (${WONDER_ACCENTS[i]}, ${w.emoji}): ${w.text}`).join(' | ') : 'none',
    picked: view.picked === null || !wonders[view.picked] ? 'none' : `${view.picked + 1}: ${wonders[view.picked].text}`,
    picture: view.picture === 'drawn' ? `drawn: ${d.hook.imagePrompt ?? ''}` : view.picture === 'drawing' ? 'being drawn' : 'not drawn',
    reader: isPreReaderGrade(d.gradeLevel) ? 'pre-reader: hears the captions and choices, cannot read them' : 'reads',
    constraints: 'The learner may tap one "I wonder" choice; it has no right answer. The learner presses Start to begin '
      + 'the lesson. Nothing is graded.',
  };
  return { task: teachingTask(d), objects, facts };
}
