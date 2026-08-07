/**
 * Reader-fit: story-planner @ PRE — 2026-08-07. Item 15A / S4.
 *
 * The 15A queue predicted this generator was CLEAN, and the live probe agreed:
 * it reads canonical `ctx.grade` first (with an explicit contract comment) and
 * returned correct rungs at BOTH K and G1 on the happy path. That prediction is
 * held here as a regression, not re-fixed.
 *
 * What the audit DID find is that the K-1 screen had nothing a non-reader could
 * do: two free-text `<textarea>`s (band-contract rule 6) with no pickable
 * content behind them. A component-only pass cannot invent that content, so the
 * generator gained two ADDITIVE fields — `elements[].choices` and `arcEvents` —
 * emitted at K-1 only and stripped above the band.
 *
 * Non-vacuity: pre-fix, `gradeLevel` was Gemini's echo (no stamp), `choices`
 * and `arcEvents` did not exist, and nothing bounded either array.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Drive the REAL generator body with Gemini stubbed. Testing only the exported
 * band helpers would leave the generator's own USE of them uncovered — which is
 * where the stamp and the band strip live (the S3 lesson).
 */
const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));

import {
  normalizeStoryPlannerGrade,
  isStoryPlannerPictureBand,
  STORY_PLANNER_PICTURE_BAND,
  STORY_PLANNER_MAX_CHOICES,
} from './storyPlannerBand';
import { generateStoryPlanner } from './gemini-story-planner';
import { LITERACY_CATALOG } from '../manifest/catalog/literacy';

const K_PROSE = 'kindergarten students (ages 5-6) - Use clear, simple language';
const G3_PROSE = 'grade 3 students (ages 8-9) - Use grade-appropriate language';

type Reply = Record<string, unknown>;

const replyWith = (over: Reply = {}) => ({
  text: JSON.stringify({
    title: 'A Day at the Park',
    // Deliberately WRONG echo — the stamp must beat it.
    gradeLevel: '3',
    writingPrompt: 'Tell a story about the park!',
    elements: [
      {
        elementId: 'char_1', label: 'Character', prompt: 'Who is in your story?', required: true,
        choices: ['🐶 A happy puppy', '👧 A smiling girl', '🐸 A little frog'],
      },
      {
        elementId: 'event_1', label: 'What Happened', prompt: 'What did they do?', required: true,
        choices: ['🛝 Went down the slide', '⚽ Played with a ball', '🍦 Ate a treat'],
      },
    ],
    storyArcLabels: ['Beginning', 'End'],
    arcEvents: ['🏃 Came to the big park', '🏠 Went back home'],
    ...over,
  }),
});

const ctxFor = (grade: string | undefined, prose: string, raw: unknown = {}) => ({
  topic: 'A day at the park',
  grade,
  gradeContext: prose,
  gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary',
  raw,
  intent: '',
} as never);

const promptText = () => String((generateContentMock.mock.calls[0][0] as { contents: string }).contents);

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue(replyWith());
});

// ---------------------------------------------------------------------------

describe('storyPlannerBand — the shared resolver', () => {
  it('maps every K spelling the pipeline actually produces', () => {
    for (const raw of ['K', 'k', 'Kindergarten', 'kinder', 'pre-k', 'preschool', '0', K_PROSE]) {
      expect(normalizeStoryPlannerGrade(raw)).toBe('K');
    }
  });

  it('maps numerals and prose to a canonical rung', () => {
    expect(normalizeStoryPlannerGrade('1')).toBe('1');
    expect(normalizeStoryPlannerGrade('Grade 4')).toBe('4');
    expect(normalizeStoryPlannerGrade(G3_PROSE)).toBe('3');
    expect(normalizeStoryPlannerGrade('9')).toBe('6'); // clamps to the ceiling
  });

  it('returns null rather than guessing when nothing grade-shaped is present', () => {
    for (const raw of [undefined, null, '', '   ', 'elementary']) {
      expect(normalizeStoryPlannerGrade(raw)).toBeNull();
      expect(isStoryPlannerPictureBand(raw)).toBe(false);
    }
  });

  it('puts exactly K and 1 in the picture band', () => {
    expect(STORY_PLANNER_PICTURE_BAND.slice()).toEqual(['K', '1']);
    expect(isStoryPlannerPictureBand('K')).toBe(true);
    expect(isStoryPlannerPictureBand('1')).toBe(true);
    for (const g of ['2', '3', '4', '5', '6']) {
      expect(isStoryPlannerPictureBand(g)).toBe(false);
    }
  });
});

describe('generateStoryPlanner — grade resolution (REGRESSION: already canonical)', () => {
  it('reads canonical ctx.grade, not the prose', async () => {
    // The prose says kindergarten while ctx.grade says 3. Canonical wins — this
    // is the property the 15A queue predicted and must not be lost.
    const data = await generateStoryPlanner(ctxFor('3', K_PROSE));
    expect(data.gradeLevel).toBe('3');
    expect(promptText()).toContain('GRADE: 3.');
  });

  it('falls back to the band key only when ctx.grade is absent', async () => {
    const data = await generateStoryPlanner({
      topic: 'A day at the park', grade: undefined, gradeContext: K_PROSE,
      gradeLevel: 'kindergarten', raw: {}, intent: '',
    } as never);
    expect(data.gradeLevel).toBe('K');
  });

  it('STAMPS the resolved rung over the wrong echo Gemini returned', async () => {
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE));
    expect(data.gradeLevel).toBe('K'); // reply said '3'
  });

  it('lets an explicit config pin win over the stamp', async () => {
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE, { gradeLevel: '2' }));
    expect(data.gradeLevel).toBe('2');
  });
});

describe('generateStoryPlanner — K-1 picture content', () => {
  it('asks for picture-choice content at K and keeps what comes back', async () => {
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE));
    expect(promptText()).toContain('PICTURE-CHOICE MODE');
    expect(data.elements.every(e => (e.choices?.length ?? 0) === 3)).toBe(true);
    expect(data.arcEvents).toEqual(['🏃 Came to the big park', '🏠 Went back home']);
  });

  it('asks for it at grade 1 too', async () => {
    await generateStoryPlanner(ctxFor('1', 'grade 1 students'));
    expect(promptText()).toContain('PICTURE-CHOICE MODE');
  });

  it('bounds choices to the per-screen maximum', async () => {
    generateContentMock.mockResolvedValue(replyWith({
      elements: [{
        elementId: 'c', label: 'Character', prompt: 'Who?', required: true,
        choices: ['🐶 A', '👧 B', '🐸 C', '🦆 D', '🐱 E', '🐰 F'],
      }],
      storyArcLabels: ['Beginning', 'End'],
      arcEvents: ['🏃 Start', '🏠 End'],
    }));
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE));
    expect(data.elements[0].choices).toHaveLength(STORY_PLANNER_MAX_CHOICES);
  });

  it('drops a one-option "choice" — one option decides nothing', async () => {
    generateContentMock.mockResolvedValue(replyWith({
      elements: [{
        elementId: 'c', label: 'Character', prompt: 'Who?', required: true,
        choices: ['🐶 Only one'],
      }],
      storyArcLabels: ['Beginning', 'End'],
      arcEvents: ['🏃 Start', '🏠 End'],
    }));
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE));
    expect(data.elements[0].choices).toBeUndefined();
  });

  it('drops arcEvents outright when they do not cover every slot', async () => {
    // A partial arc cannot be ordered; all-or-nothing keeps the component's
    // fallback reachable instead of half-building a board.
    generateContentMock.mockResolvedValue(replyWith({
      storyArcLabels: ['Beginning', 'Middle', 'End'],
      arcEvents: ['🏃 Start', '🏠 End'],
    }));
    const data = await generateStoryPlanner(ctxFor('K', K_PROSE));
    expect(data.arcEvents).toBeUndefined();
  });
});

describe('generateStoryPlanner — grade 2+ is untouched (the control)', () => {
  it('never asks for picture content above the band', async () => {
    await generateStoryPlanner(ctxFor('3', G3_PROSE));
    expect(promptText()).not.toContain('PICTURE-CHOICE MODE');
  });

  it('STRIPS choices and arcEvents even if Gemini volunteers them', async () => {
    const data = await generateStoryPlanner(ctxFor('3', G3_PROSE));
    expect(data.arcEvents).toBeUndefined();
    expect(data.elements.every(e => e.choices === undefined)).toBe(true);
  });
});

describe('story-planner catalog scaffold', () => {
  const entry = LITERACY_CATALOG.find(e => e.id === 'story-planner')!;

  it('has a tutoring block at all (it ran on the generic tutor before)', () => {
    expect(entry.tutoring).toBeTruthy();
  });

  it('carries the read-aloud cap-override clause so the beat survives a lesson switch', () => {
    const directives = (entry.tutoring!.aiDirectives ?? []).map(d => d.instruction).join(' ');
    expect(directives).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
    expect(directives).toMatch(/\[STORY_ELEMENT_ASKED\]/);
  });

  it('forbids giving away the arc order, including by elimination', () => {
    const directives = (entry.tutoring!.aiDirectives ?? []).map(d => d.title + ' ' + d.instruction).join(' ');
    expect(directives).toMatch(/ORDER IS THE ANSWER/i);
    expect(directives).toMatch(/eliminating is the same as telling/i);
  });

  it('has no handlebars conditionals — interpolate_template does key substitution only', () => {
    const all = JSON.stringify(entry.tutoring);
    expect(all).not.toMatch(/\{\{#/);
  });

  it('declares every context key the component actually sends', () => {
    // Mirrors the tutor-test Tier-1 audit so a bag/catalog drift fails here too.
    expect(entry.tutoring!.contextKeys).toEqual([
      'title', 'writingPrompt', 'gradeBand', 'plannerPhase', 'currentQuestion',
      'currentChoiceLabels', 'chosenSummary', 'arcLabels', 'arcTrayLabels',
      'arcFilledCount', 'arcSlotCount',
    ]);
  });
});
