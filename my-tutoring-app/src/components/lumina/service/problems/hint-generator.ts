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

  // Build problem-type specific context from each variant's real fields
  let problemContext = '';
  switch (problem.type) {
    case 'multiple_choice':
      problemContext = `Question: ${problem.question}\n`;
      problemContext += `\nOptions:\n${problem.options.map(opt => `${opt.id}. ${opt.text}`).join('\n')}`;
      break;
    case 'short_answer':
      problemContext = `Question: ${problem.question}\n`;
      break;
    case 'true_false':
      problemContext = `Statement: ${problem.statement}\n`;
      break;
    case 'fill_in_blanks':
      problemContext = `Fill in the blanks: ${problem.textWithBlanks}\n`;
      break;
    case 'categorization_activity':
      problemContext = `Instruction: ${problem.instruction}\n`;
      problemContext += `\nCategories: ${problem.categories.join(', ')}`;
      break;
    case 'sequencing_activity':
      problemContext = `Instruction: ${problem.instruction}\n`;
      problemContext += `\nItems to sequence: ${problem.items.join(', ')}`;
      break;
    case 'matching_activity':
      problemContext = `Prompt: ${problem.prompt}\n\nMatching pairs needed`;
      break;
    case 'scenario_question':
      problemContext = `Scenario: ${problem.scenario}\nQuestion: ${problem.scenarioQuestion}\n`;
      break;
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
