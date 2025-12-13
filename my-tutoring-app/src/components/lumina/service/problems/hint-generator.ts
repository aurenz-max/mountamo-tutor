/**
 * Hint Generation Service
 *
 * Provides AI-powered hints for practice problems without revealing answers.
 * Uses progressive hint levels to guide students toward understanding.
 */

import { ProblemData } from '../../types';
import { ai } from '../geminiClient';

/**
 * Generate contextual hints for a problem without giving away the answer
 * @param problem - The problem data
 * @param hintLevel - The level of hint (1=small, 2=medium, 3=big)
 * @returns A hint string that guides without revealing the answer
 */
export const generateProblemHint = async (
  problem: ProblemData,
  hintLevel: number
): Promise<string> => {
  const hintLevelDescriptions = {
    1: "Provide a very subtle hint. Give a gentle nudge in the right direction by highlighting one key concept they should think about. Don't explain the concept fully. 2-3 sentences maximum.",
    2: "Provide a medium hint. Explain the relevant concept more clearly and help them understand what approach to take. You can give an analogy or a related example, but still don't solve the problem. 3-4 sentences.",
    3: "Provide a detailed hint. Give a thorough explanation of the concepts involved and walk through the thinking process step-by-step. You can explain WHY certain options might be wrong or right, but DO NOT directly state which answer is correct. 4-6 sentences."
  };

  const hintInstruction = hintLevelDescriptions[hintLevel as keyof typeof hintLevelDescriptions] || hintLevelDescriptions[1];

  let problemContext = `Question: ${problem.question}\n`;

  // Add problem-type specific context
  if (problem.type === 'multiple_choice' && problem.options) {
    problemContext += `\nOptions:\n${problem.options.map(opt => `${opt.id}. ${opt.text}`).join('\n')}`;
  } else if (problem.type === 'true_false' && problem.statement) {
    problemContext += `\nStatement: ${problem.statement}`;
  } else if (problem.type === 'fill_in_blanks' && problem.sentence) {
    problemContext += `\nSentence: ${problem.sentence}`;
  } else if (problem.type === 'categorization_activity' && problem.categories) {
    problemContext += `\nCategories: ${problem.categories.map(c => c.label).join(', ')}`;
  } else if (problem.type === 'sequencing_activity' && problem.items) {
    problemContext += `\nItems to sequence: ${problem.items.map(i => i.content).join(', ')}`;
  } else if (problem.type === 'matching_activity' && problem.pairs) {
    problemContext += `\nMatching pairs needed`;
  }

  const prompt = `You are a helpful AI tutor assisting a student with a practice problem. Your goal is to guide them to understand the concept and arrive at the answer themselves.

${problemContext}

Grade Level: ${problem.gradeLevel}
Difficulty: ${problem.difficulty}

${hintInstruction}

CRITICAL RULES:
- DO NOT reveal the correct answer
- DO NOT say which option is correct
- DO guide them to think about the relevant concepts
- DO explain why they should consider certain aspects
- Use encouraging, supportive language
- Be concise and focused
- Adapt your language to the grade level

Provide your hint now:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt
    });

    if (!response.text) {
      throw new Error('No text returned from AI');
    }

    return response.text.trim();
  } catch (error) {
    console.error('Error generating hint:', error);
    throw new Error('Failed to generate hint. Please try again.');
  }
};
