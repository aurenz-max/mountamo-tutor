import { Type, Schema, ThinkingLevel } from "@google/genai";
import { MediaPlayerData, LessonSegment, FullLessonSegment } from "../../types";
import { ai } from "../geminiClient";

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};

/**
 * Generate lesson plan with segments (text-only, no images yet)
 */
const generateLessonPlan = async (
  topic: string,
  gradeLevel: string,
  segmentCount: number = 4
): Promise<LessonSegment[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "A short, catchy title for this segment (3-5 words)"
        },
        script: {
          type: Type.STRING,
          description: "Clear, engaging narration script (2-3 sentences) intended to be spoken. Age-appropriate and conversational."
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Detailed visual description for image generation that illustrates the concept clearly (photorealistic or diagrammatic as appropriate)"
        },
        knowledgeCheck: {
          type: Type.OBJECT,
          description: "Comprehension question to verify understanding of this segment",
          properties: {
            question: {
              type: Type.STRING,
              description: "Clear question testing the KEY concept from this segment"
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 answer choices (include 1 correct answer and plausible distractors)"
            },
            correctOptionIndex: {
              type: Type.NUMBER,
              description: "Index (0-based) of the correct answer in the options array"
            },
            explanation: {
              type: Type.STRING,
              description: "Brief explanation of why this answer is correct (optional but recommended)"
            }
          },
          required: ["question", "options", "correctOptionIndex"]
        }
      },
      required: ["title", "script", "imagePrompt", "knowledgeCheck"]
    }
  };

  const prompt = `Create a ${segmentCount}-part educational walkthrough about the following topic: "${topic}".
The audience is ${gradeLevelContext}

For EACH segment, provide:
1. A short, catchy title (3-5 words)
2. A clear, engaging explanation script (2-3 sentences, intended to be spoken aloud with natural pacing)
3. A detailed visual description prompt for an image generation model that illustrates the concept clearly
4. A comprehension question with 3-4 multiple choice options to verify understanding

KNOWLEDGE CHECK REQUIREMENTS:
- Each question should test the KEY concept from that specific segment
- Options should include 1 correct answer and 2-3 plausible distractors
- Questions should be answerable ONLY from information in that segment
- Avoid trivial questions - test true understanding, not just recall
- Include a brief explanation of why the correct answer is right
- Make distractors believable but clearly incorrect upon reflection
- Questions should be grade-appropriate for ${gradeLevelContext}

The segments should build on each other progressively, starting with fundamentals and moving to more complex ideas.
Use age-appropriate language and relatable examples.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1.0,
      },
    });

    const result = response.text ? JSON.parse(response.text) : null;

    if (!result || !Array.isArray(result)) {
      throw new Error('No valid lesson plan returned from Gemini API');
    }

    console.log('📋 Media Player Lesson Plan Generated:', result);
    return result as LessonSegment[];
  } catch (error) {
    console.error('Error generating lesson plan:', error);
    throw error;
  }
};

/**
 * Generate image for a specific prompt
 * Returns base64 data URL or null if generation fails
 */
const generateImageSegment = async (
  prompt: string,
  resolution: '1K' | '2K' | '4K' = '1K'
): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: resolution
        }
      }
    });

    // Find the image in the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64String = part.inlineData.data;
        return `data:image/png;base64,${base64String}`;
      }
    }

    console.warn('No image generated found in response');
    return null;
  } catch (error) {
    console.error('Error generating image segment:', error);
    return null;
  }
};

/**
 * Generate complete media player content with lesson plan and images
 * Audio narration is handled natively by Lumina AI at runtime.
 */
export const generateMediaPlayer = async (
  topic: string,
  gradeLevel: string = 'elementary',
  segmentCount: number = 4,
  imageResolution: '1K' | '2K' | '4K' = '1K'
): Promise<MediaPlayerData> => {
  try {
    console.log('🎬 Generating Media Player content for:', topic);

    // Step 1: Generate the lesson plan (text only)
    const lessonPlan = await generateLessonPlan(topic, gradeLevel, segmentCount);

    // Step 2: Generate images for all segments in parallel
    const fullSegments: FullLessonSegment[] = await Promise.all(
      lessonPlan.map(async (segment: LessonSegment) => {
        const imageUrl = await generateImageSegment(segment.imagePrompt, imageResolution).catch(e => {
          console.error("Image generation failed for segment:", segment.title, e);
          return null;
        });

        return {
          ...segment,
          audioBase64: null,
          imageUrl
        };
      })
    );

    const result: MediaPlayerData = {
      title: `Interactive Lesson: ${topic}`,
      description: `A ${segmentCount}-part visual walkthrough exploring ${topic}`,
      segments: fullSegments,
      imageResolution
    };

    console.log('🎬 Media Player Generated Successfully:', result);
    return result;
  } catch (error) {
    console.error('Error generating media player:', error);
    throw error;
  }
};
