/**
 * PassageStudio Rubric Judge
 *
 * Server-side judge for theme-statement (and any future free-response) blocks.
 * Takes the stimulus, rubric, exemplar, and student response and returns a
 * verdict with per-criterion scores + concrete feedback.
 *
 * Judge contract is intentionally narrow: rubric is authored at hydration time
 * so the LLM grades against a stable spec, not an open-ended "is this good".
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  ThemeRubricCriterion,
  ThemeRubricVerdict,
} from '../../primitives/visual-primitives/core/passage-studio/types';

// ── Input contract ──────────────────────────────────────────────────

export interface JudgePassageRubricInput {
  stimulusText: string;
  stimulusKind: 'prose' | 'poem' | 'dialogue' | 'sentence-set';
  prompt: string;
  rubric: ThemeRubricCriterion[];
  exemplar: string;
  studentResponse: string;
}

// ── Schema ──────────────────────────────────────────────────────────
// Flat schema: each criterion gets a score + feedback indexed 0..3 (we cap
// rubric length at 4 to keep this simple). Total weight is reconstructed
// server-side so the judge doesn't have to redo arithmetic.

const RUBRIC_VERDICT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'Overall feedback (2–3 sentences) that addresses the student\'s response by quoting it specifically.' },
    criterion0Score: { type: Type.NUMBER, description: '0–10 score for criterion 0' },
    criterion0Feedback: { type: Type.STRING, description: '1–2 sentences of feedback for criterion 0, with concrete reference to the response.' },
    criterion1Score: { type: Type.NUMBER, nullable: true },
    criterion1Feedback: { type: Type.STRING, nullable: true },
    criterion2Score: { type: Type.NUMBER, nullable: true },
    criterion2Feedback: { type: Type.STRING, nullable: true },
    criterion3Score: { type: Type.NUMBER, nullable: true },
    criterion3Feedback: { type: Type.STRING, nullable: true },
  },
  required: ['summary', 'criterion0Score', 'criterion0Feedback'],
};

// ── Main judge ──────────────────────────────────────────────────────

const STRONG_THRESHOLD = 80;
const PARTIAL_THRESHOLD = 50;

export async function judgePassageRubric(
  input: JudgePassageRubricInput,
): Promise<ThemeRubricVerdict> {
  const { stimulusText, stimulusKind, prompt, rubric, exemplar, studentResponse } = input;

  if (rubric.length === 0) {
    throw new Error('Rubric is empty');
  }

  const rubricBlock = rubric
    .map(
      (c, i) =>
        `Criterion ${i} (weight ${c.weight}): "${c.label}" — ${c.description}`,
    )
    .join('\n');

  const judgePrompt = `You are an experienced English Language Arts teacher grading a student's open response.

## Passage (${stimulusKind})
${stimulusText}

## The prompt the student answered
${prompt}

## Rubric criteria
${rubricBlock}

## Exemplar response (this earns full marks across all criteria)
"${exemplar}"

## Student's response
"${studentResponse}"

## Instructions
For each rubric criterion (in the same order as listed above), score the student's response from 0 to 10:
- 8–10 = strong: criterion is clearly met
- 5–7 = partial: criterion is partially met
- 0–4 = weak or missing: criterion is not met

For each criterion, write 1–2 sentences of concrete feedback. Quote a specific phrase from the student's response. If the criterion isn't met, point to what's missing or what to revise — don't just restate the criterion.

Then write a 2–3 sentence summary that addresses the student's response holistically. Encouraging, specific, actionable.

IMPORTANT:
- Score against the EXEMPLAR's level, not against perfection. A response that matches the exemplar should score 9–10 across criteria.
- Be specific in feedback — quote the student.
- A "weak" criterion is unsupported, off-topic, or missing — not just informal.
- Don't score criteria the student wasn't expected to satisfy. There are exactly ${rubric.length} criteria; only fill criterion0..criterion${rubric.length - 1}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: judgePrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: RUBRIC_VERDICT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Rubric judge returned empty response');

  const data = JSON.parse(text);

  // Reconstruct per-criterion scores
  const criterionScores: ThemeRubricVerdict['criterionScores'] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < rubric.length; i++) {
    const score = data[`criterion${i}Score`];
    const feedback = data[`criterion${i}Feedback`];
    if (typeof score !== 'number') continue;

    const clamped = Math.max(0, Math.min(10, Math.round(score)));
    criterionScores.push({
      label: rubric[i].label,
      score: clamped,
      feedback: feedback ?? '',
    });
    weightedSum += clamped * rubric[i].weight;
    weightTotal += rubric[i].weight;
  }

  if (criterionScores.length === 0) {
    throw new Error('Rubric judge returned no valid criterion scores');
  }

  // Overall 0–100 score: weighted average × 10
  const overallScore = weightTotal > 0
    ? Math.round((weightedSum / weightTotal) * 10)
    : 0;

  const verdict: ThemeRubricVerdict['verdict'] =
    overallScore >= STRONG_THRESHOLD
      ? 'strong'
      : overallScore >= PARTIAL_THRESHOLD
        ? 'partial'
        : 'weak';

  return {
    verdict,
    score: overallScore,
    criterionScores,
    summary: data.summary ?? '',
  };
}
