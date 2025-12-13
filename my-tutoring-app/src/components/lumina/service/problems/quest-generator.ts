/**
 * Quest Generation Service
 *
 * Generates personalized learning "quests" - curated sub-topics within a subject
 * that feel like adventure paths for students to explore.
 */

import { ai } from '../geminiClient';
import { Type } from '@google/genai';

export interface Quest {
  title: string;
  description: string;
  icon: string; // Lucide icon name
  focusArea: string; // e.g., "Biology", "Geometry"
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface WarmUpQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  funFact: string;
}

/**
 * Generate engaging sub-topic "quests" for a subject
 * @param subject - The subject area (e.g., 'science', 'mathematics')
 * @param gradeLevel - Student's grade level
 * @param count - Number of quests to generate (default 4)
 * @returns Array of quest objects
 */
export const generateQuests = async (
  subject: string,
  gradeLevel: string,
  count: number = 4
): Promise<Quest[]> => {
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Exciting, adventurous title for a specific topic (e.g., 'Cosmic Odyssey' or 'Cellular Cities')"
        },
        description: {
          type: Type.STRING,
          description: "A punchy, engaging description (max 12 words)"
        },
        icon: {
          type: Type.STRING,
          description: "Lucide React icon name that fits the theme (e.g., Atom, Rocket, Microscope, Dna, Zap, Leaf)"
        },
        focusArea: {
          type: Type.STRING,
          description: "The academic sub-category (e.g., 'Physics', 'Biology', 'Algebra')"
        },
        difficulty: {
          type: Type.STRING,
          description: "Difficulty level: beginner, intermediate, or advanced",
          enum: ['beginner', 'intermediate', 'advanced']
        }
      },
      required: ['title', 'description', 'icon', 'focusArea']
    }
  };

  const subjectName = formatSubjectName(subject);
  const prompt = `Generate ${count} distinct, exciting learning "quests" for a ${gradeLevel} level student studying ${subjectName}.

Each quest should:
- Feel like an adventure path or exploration journey
- Focus on a specific sub-topic within ${subjectName}
- Have an engaging, creative title that sparks curiosity
- Include appropriate difficulty progression from beginner to advanced
- Use relevant scientific or academic icon names

Make these quests diverse in topics and difficulty levels. Think of them as different paths a student can take to explore ${subjectName}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.85 // Higher creativity for engaging quest names
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }

    return JSON.parse(response.text) as Quest[];
  } catch (error) {
    console.error('Error generating quests:', error);

    // Fallback quests
    return generateFallbackQuests(subject, count);
  }
};

/**
 * Generate a warm-up question for a subject
 * @param subject - The subject area
 * @param gradeLevel - Student's grade level
 * @returns A warm-up question object
 */
export const generateWarmUpQuestion = async (
  subject: string,
  gradeLevel: string
): Promise<WarmUpQuestion> => {
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "A short, engaging warm-up question"
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3-4 possible answers"
      },
      correctAnswer: {
        type: Type.STRING,
        description: "The correct answer text (must match one of the options exactly)"
      },
      funFact: {
        type: Type.STRING,
        description: "A fascinating one-sentence fact related to the topic"
      }
    },
    required: ['question', 'options', 'correctAnswer', 'funFact']
  };

  const subjectName = formatSubjectName(subject);
  const prompt = `Generate a single, fun, and engaging warm-up multiple-choice question for a ${gradeLevel} level student studying ${subjectName}.

The question should:
- Be quick to answer (not too complex)
- Spark curiosity and excitement for the subject
- Be age-appropriate for ${gradeLevel}
- Include an interesting fun fact that adds context

Keep it concise and engaging!`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.8
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }

    return JSON.parse(response.text) as WarmUpQuestion;
  } catch (error) {
    console.error('Error generating warm-up question:', error);

    // Fallback warm-up
    return {
      question: `Ready to explore ${subjectName}?`,
      options: ['Yes!', 'Absolutely!', "Let's begin!"],
      correctAnswer: 'Yes!',
      funFact: `${subjectName} opens doors to understanding the world around us!`
    };
  }
};

/**
 * Helper function to format subject names for prompts
 */
function formatSubjectName(subject: string): string {
  const subjectMap: Record<string, string> = {
    'mathematics': 'Mathematics',
    'science': 'Science',
    'language-arts': 'Language Arts',
    'social-studies': 'Social Studies',
    'reading': 'Reading',
    'writing': 'Writing',
    'coding': 'Computer Science',
    'mystery': 'Interdisciplinary Topics'
  };

  return subjectMap[subject.toLowerCase()] || subject.replace('-', ' ');
}

/**
 * Generate fallback quests when AI fails
 */
function generateFallbackQuests(subject: string, count: number): Quest[] {
  const fallbacks: Record<string, Quest[]> = {
    'science': [
      {
        title: 'Unraveling the Genetic Code',
        description: "Discover life's blueprint through DNA",
        icon: 'Dna',
        focusArea: 'Biology',
        difficulty: 'intermediate'
      },
      {
        title: 'Cosmic Odyssey',
        description: 'Journey through space and stars',
        icon: 'Rocket',
        focusArea: 'Physics',
        difficulty: 'beginner'
      },
      {
        title: 'Alchemy of the Future',
        description: 'Craft new materials through chemistry',
        icon: 'FlaskConical',
        focusArea: 'Chemistry',
        difficulty: 'advanced'
      },
      {
        title: 'Guardians of the Green',
        description: 'Protect ecosystems and biodiversity',
        icon: 'Leaf',
        focusArea: 'Environmental Science',
        difficulty: 'beginner'
      }
    ],
    'mathematics': [
      {
        title: 'The Number Detective',
        description: 'Solve mysteries with arithmetic',
        icon: 'Calculator',
        focusArea: 'Algebra',
        difficulty: 'beginner'
      },
      {
        title: 'Geometric Architects',
        description: 'Build worlds with shapes',
        icon: 'Layers',
        focusArea: 'Geometry',
        difficulty: 'intermediate'
      },
      {
        title: 'Pattern Seekers',
        description: 'Discover hidden mathematical sequences',
        icon: 'Search',
        focusArea: 'Sequences',
        difficulty: 'intermediate'
      },
      {
        title: 'Data Wizards',
        description: 'Master statistics and probability',
        icon: 'Database',
        focusArea: 'Statistics',
        difficulty: 'advanced'
      }
    ]
  };

  const defaultQuests: Quest[] = [
    {
      title: 'Explorer Mode',
      description: 'Discover fundamental concepts',
      icon: 'Sparkles',
      focusArea: 'General',
      difficulty: 'beginner'
    },
    {
      title: 'Deep Dive',
      description: 'Complex problem solving',
      icon: 'BrainCircuit',
      focusArea: 'Advanced',
      difficulty: 'advanced'
    },
    {
      title: 'Rapid Quest',
      description: 'Quick practice challenges',
      icon: 'Zap',
      focusArea: 'Speed',
      difficulty: 'intermediate'
    },
    {
      title: 'Mixed Topics',
      description: 'Comprehensive subject review',
      icon: 'Layers',
      focusArea: 'Review',
      difficulty: 'intermediate'
    }
  ];

  const quests = fallbacks[subject.toLowerCase()] || defaultQuests;
  return quests.slice(0, count);
}
