/**
 * Practice Assessment Generation Service
 *
 * Analyzes student performance on practice problems and provides
 * personalized insights, strengths, growth areas, and learning recommendations.
 */

import { ProblemData } from '../../types';
import { ai } from '../geminiClient';

interface PracticeAssessment {
  summary: string;
  strengths: string[];
  areasForGrowth: string[];
  recommendedTopics: Array<{
    topic: string;
    reason: string;
    subject: string;
  }>;
}

/**
 * Generate AI-powered assessment of practice session performance
 * @param subject - The subject area practiced
 * @param gradeLevel - The student's grade level
 * @param problemCount - Number of problems completed
 * @param problems - Array of problem data
 * @returns Assessment with insights and recommendations
 */
export const generatePracticeAssessment = async (
  subject: string,
  gradeLevel: string,
  problemCount: number,
  problems: ProblemData[]
): Promise<PracticeAssessment> => {
  // Analyze problem types and topics covered
  const problemTypes = problems.map(p => p.type);
  const uniqueTypes = Array.from(new Set(problemTypes));
  const topicsList = problems
    .map(p => {
      if (p.topic) return p.topic;
      if (p.question) return p.question.substring(0, 50);
      if (p.statement) return p.statement.substring(0, 50);
      return 'Practice problem';
    })
    .slice(0, 5);

  const prompt = `You are an educational AI analyzing a student's practice session performance. Based on the problems they completed, provide a thoughtful assessment with actionable insights.

PRACTICE SESSION DETAILS:
- Subject: ${subject.replace('-', ' ')}
- Grade Level: ${gradeLevel.replace('-', ' ')}
- Problems Completed: ${problemCount}
- Problem Types: ${uniqueTypes.join(', ')}
- Sample Topics: ${topicsList.join('; ')}

Your task is to generate a JSON response with the following structure:

{
  "summary": "A warm, encouraging 2-3 sentence summary of their practice session. Acknowledge their effort and highlight what they worked on.",
  "strengths": ["List 2-3 specific strengths you can infer from completing these problem types", "Be specific and encouraging"],
  "areasForGrowth": ["List 2-3 areas they could explore next to deepen understanding", "Frame positively as opportunities to learn"],
  "recommendedTopics": [
    {
      "topic": "Specific topic name related to ${subject}",
      "reason": "Why this topic would help them grow (1 sentence)",
      "subject": "${subject}"
    },
    // Include 2-3 recommendations total
  ]
}

IMPORTANT GUIDELINES:
- Be encouraging and growth-oriented
- Base strengths on the variety and types of problems completed
- Recommend topics that build on what they practiced or fill gaps
- Use age-appropriate language for ${gradeLevel}
- Keep recommendations relevant to ${subject}
- Make it personal and specific to their practice session
- Frame growth areas positively - as "areas to explore" not "weaknesses"

Return ONLY valid JSON, no additional text or markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }

    const assessment = JSON.parse(response.text) as PracticeAssessment;

    // Validate the response structure
    if (!assessment.summary || !assessment.strengths || !assessment.areasForGrowth || !assessment.recommendedTopics) {
      throw new Error('Invalid assessment structure');
    }

    return assessment;
  } catch (error) {
    console.error('Error generating practice assessment:', error);

    // Return a fallback assessment
    return {
      summary: `Great work completing ${problemCount} ${subject.replace('-', ' ')} problems! You've shown dedication to learning.`,
      strengths: [
        'Completed a variety of problem types',
        'Showed persistence through the practice session',
        'Demonstrated engagement with the material'
      ],
      areasForGrowth: [
        'Continue exploring different problem types',
        'Try more advanced topics in this subject',
        'Practice regularly to reinforce learning'
      ],
      recommendedTopics: [
        {
          topic: `Advanced ${subject.replace('-', ' ')}`,
          reason: 'Build on the concepts you just practiced',
          subject: subject
        },
        {
          topic: `${subject.replace('-', ' ')} fundamentals review`,
          reason: 'Strengthen your foundation',
          subject: subject
        },
        {
          topic: 'Mixed review practice',
          reason: 'Apply concepts across different contexts',
          subject: subject
        }
      ]
    };
  }
};
