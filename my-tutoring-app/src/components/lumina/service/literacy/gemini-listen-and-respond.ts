import { Type, Schema, Modality } from "@google/genai";
import { ai } from "../geminiClient";
import { ListenAndRespondData } from "../../primitives/visual-primitives/literacy/ListenAndRespond";

/**
 * Schema definition for Listen and Respond Data
 *
 * Generates grade-appropriate listening comprehension activities with:
 * - A passage delivered via Gemini TTS (text hidden during listening)
 * - 3-5 comprehension questions ranging from literal to inferential/evaluative
 * - Segment markers for replay during review phase
 *
 * Grade-level adaptations:
 * - K:   Simple story, 30-60 words, 2-3 "Who?" and "What happened?" questions
 * - 1-2: Retell key details, main topic questions, up to 80 words
 * - 3-4: Main idea, speaker's purpose, cause/effect, up to 150 words
 * - 5-6: Analyze evidence, evaluate arguments, up to 200 words
 */
const listenAndRespondSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging, student-friendly title for the listening activity"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level (e.g., 'K', '1', '2', '3', '4', '5', '6')"
    },
    passageType: {
      type: Type.STRING,
      enum: ["narrative", "informational", "persuasive", "dialogue"],
      description: "Type of passage"
    },
    passage: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "The full passage text. This is hidden from the student during listening and revealed in review. Must be grade-appropriate in vocabulary and complexity."
        },
        wordCount: {
          type: Type.NUMBER,
          description: "Exact word count of the passage text"
        },
        estimatedDurationSeconds: {
          type: Type.NUMBER,
          description: "Estimated time to read aloud at natural pace (approx 2-3 words/second for younger grades, 3-4 for older)"
        }
      },
      required: ["text", "wordCount", "estimatedDurationSeconds"]
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique question identifier (e.g., 'q1', 'q2')"
          },
          question: {
            type: Type.STRING,
            description: "The comprehension question"
          },
          type: {
            type: Type.STRING,
            enum: ["multiple-choice", "short-answer", "sequencing"],
            description: "Question format type"
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Answer options for multiple-choice questions (3-4 options). Omit for short-answer."
          },
          correctAnswer: {
            type: Type.STRING,
            description: "For multiple-choice: the exact text of the correct option. For short-answer: the expected answer."
          },
          correctSequence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For sequencing type: the items in correct order. Each item must exactly match one of the options."
          },
          difficulty: {
            type: Type.STRING,
            enum: ["literal", "inferential", "evaluative"],
            description: "Cognitive level: literal (directly stated), inferential (implied), evaluative (judge/analyze)"
          },
          explanation: {
            type: Type.STRING,
            description: "Brief explanation of the correct answer for review phase"
          }
        },
        required: ["id", "question", "type", "correctAnswer", "difficulty", "explanation"]
      },
      description: "3-5 comprehension questions ordered from easier to harder"
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique segment identifier (e.g., 'seg1', 'seg2')"
          },
          startWord: {
            type: Type.NUMBER,
            description: "Word index where this segment starts (0-based)"
          },
          endWord: {
            type: Type.NUMBER,
            description: "Word index where this segment ends (exclusive)"
          },
          label: {
            type: Type.STRING,
            description: "Student-facing segment label (e.g., 'Part 1: The Beginning')"
          }
        },
        required: ["id", "startWord", "endWord", "label"]
      },
      description: "2-4 segment markers dividing the passage for targeted replay"
    }
  },
  required: ["title", "gradeLevel", "passageType", "passage", "questions", "segments"]
};

/**
 * Generate TTS audio for text using Gemini TTS
 * Returns base64 PCM audio data (24kHz, 16-bit mono) or null on failure
 *
 * Uses the same pattern as gemini-media-player.ts generateAudioSegment
 */
const generateTTSAudio = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Clear, warm voice for K-6 students
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      console.warn('No audio data returned from Gemini TTS');
      return null;
    }

    return base64Audio;
  } catch (error) {
    console.error('Error generating TTS audio:', error);
    return null;
  }
};

/**
 * Generate Listen and Respond data using Gemini AI
 *
 * Creates listening comprehension activities where students:
 * 1. Listen to a passage via Gemini TTS (text hidden)
 * 2. Answer comprehension questions from memory
 * 3. Review with passage revealed and segment replay
 *
 * Audio generation:
 * - Full passage audio generated via gemini-2.5-flash-preview-tts
 * - Each segment's text extracted and TTS-generated separately for replay
 *
 * @param topic - The subject/topic for the passage (e.g., "The Water Cycle", "A Day at the Farm")
 * @param gradeLevel - Target grade level ('K', '1', '2', '3', '4', '5', '6')
 * @param passageType - Type of passage ('narrative', 'informational', 'persuasive', 'dialogue')
 * @param config - Optional partial configuration to override generated values
 * @returns ListenAndRespondData with passage, questions, segments, and TTS audio
 */
export const generateListenAndRespond = async (
  topic: string,
  gradeLevel: string = '2',
  passageType: 'narrative' | 'informational' | 'persuasive' | 'dialogue' = 'narrative',
  config?: Partial<ListenAndRespondData>
): Promise<ListenAndRespondData> => {

  const gradeGuidelines: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- Passage: 30-60 words, simple sentences (5-8 words each)
- Vocabulary: sight words + common CVC words, no multi-syllable words
- Passage type: simple narrative with clear beginning, middle, end
- Questions: 2-3 questions only, ALL literal
  - "Who was in the story?"
  - "What happened first?"
  - "Where did they go?"
- Question format: ALL multiple-choice with 3 options (short, clear)
- No inferential or evaluative questions
- Reading pace: ~2 words/second
- Segments: 2 segments (beginning, end)
`,
    '1': `
GRADE 1 GUIDELINES:
- Passage: 40-80 words, simple sentences with some compound sentences
- Vocabulary: common grade 1 words, 1-2 slightly challenging words in context
- Questions: 3 questions, mostly literal with 1 simple inferential
  - "What was the main thing that happened?"
  - "Why do you think [character] felt [emotion]?" (inferential)
  - "What happened after [event]?"
- Question format: multiple-choice (3-4 options), 1 short-answer OK
- Reading pace: ~2.5 words/second
- Segments: 2-3 segments
`,
    '2': `
GRADE 2 GUIDELINES:
- Passage: 60-100 words, mix of simple and compound sentences
- Vocabulary: grade-appropriate with 2-3 tier-2 vocabulary words
- Questions: 3-4 questions, mix of literal and inferential
  - Retell key details
  - Main topic identification
  - "How do you know [character] was [feeling]?"
  - Basic cause and effect
- Question format: mix of multiple-choice (4 options) and short-answer
- Reading pace: ~2.5 words/second
- Segments: 2-3 segments
`,
    '3': `
GRADE 3 GUIDELINES:
- Passage: 80-130 words, varied sentence structure
- Vocabulary: grade 3 tier-2 words, some domain-specific terms
- Questions: 3-4 questions spanning literal to inferential
  - Main idea and key details
  - Character motivation or author's purpose
  - Cause and effect
  - Vocabulary in context
- Question format: mix of multiple-choice and short-answer, 1 sequencing OK
- Reading pace: ~3 words/second
- Segments: 2-3 segments
`,
    '4': `
GRADE 4 GUIDELINES:
- Passage: 100-160 words, complex sentences with subordinate clauses
- Vocabulary: tier-2 and tier-3 vocabulary, domain-specific terms
- Questions: 4-5 questions from literal to evaluative
  - Main idea with supporting details
  - Speaker's purpose or point of view
  - Cause-effect chains
  - Inference from context
  - 1 evaluative ("Do you agree that...? Why?")
- Question format: multiple-choice, short-answer, and sequencing
- Reading pace: ~3 words/second
- Segments: 3-4 segments
`,
    '5': `
GRADE 5 GUIDELINES:
- Passage: 130-180 words, sophisticated sentence variety
- Vocabulary: academic language, figurative language OK
- Questions: 4-5 questions heavy on inferential and evaluative
  - Analyze how evidence supports claims
  - Compare perspectives or viewpoints
  - Evaluate strength of arguments
  - Draw conclusions from multiple details
  - Identify author's craft choices
- Question format: mix including short-answer for deeper thinking
- Reading pace: ~3.5 words/second
- Segments: 3-4 segments
`,
    '6': `
GRADE 6 GUIDELINES:
- Passage: 150-200 words, mature prose with varied syntax
- Vocabulary: academic and domain-specific, may include abstract concepts
- Questions: 4-5 questions predominantly inferential and evaluative
  - Analyze evidence and reasoning
  - Evaluate persuasive techniques
  - Synthesize information across passage sections
  - Assess reliability or bias
  - Compare-contrast within passage
- Question format: mix favoring short-answer for analysis
- Reading pace: ~3.5 words/second
- Segments: 3-4 segments
`
  };

  const guidelines = gradeGuidelines[gradeLevel] || gradeGuidelines['2'];

  const generationPrompt = `Create a listening comprehension activity about: "${topic}"

TARGET GRADE LEVEL: ${gradeLevel}
PASSAGE TYPE: ${passageType}

${guidelines}

PASSAGE TYPE SPECIFICS:
${passageType === 'narrative' ? `
- Write a short story or narrative with characters, setting, and a clear sequence of events.
- Include dialogue if appropriate for the grade level.
- Should have a beginning, middle, and end.
` : ''}
${passageType === 'informational' ? `
- Write a factual passage with a clear main idea and supporting details.
- Use text features language (first, next, for example).
- Include specific facts and details students can recall.
` : ''}
${passageType === 'persuasive' ? `
- Write a passage that takes a clear position on a topic.
- Include reasons and evidence supporting the position.
- Use persuasive language appropriate for the grade level.
` : ''}
${passageType === 'dialogue' ? `
- Write a conversation between 2-3 characters.
- Each speaker should have a clear voice and perspective.
- The dialogue should convey information or tell a mini-story.
` : ''}

REQUIREMENTS:
1. The passage must be EXACTLY within the word count range for this grade level.
2. Questions should progress from easier (literal) to harder (inferential/evaluative).
3. For multiple-choice questions, include exactly 3-4 options. The correct answer text must EXACTLY match one option.
4. For sequencing questions, provide 3-4 events as options and the correctSequence array.
5. Segment markers must cover the entire passage (startWord=0 for first, endWord=total word count for last).
6. Each segment should correspond to a meaningful part of the passage.
7. Word indices are 0-based. The passage split by whitespace defines word positions.
8. Every question must have a clear, kid-friendly explanation.
9. The title should be engaging and hint at the topic without giving away details.
10. estimatedDurationSeconds should be calculated based on word count and grade-appropriate reading pace.

Generate the complete listening comprehension activity now.`;

  try {
    // Step 1: Generate the content (passage, questions, segments)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: listenAndRespondSchema,
        systemInstruction: `You are an expert K-6 literacy educator specializing in listening comprehension and speaking & listening standards. You understand how students at different grade levels process auditory information and build comprehension. You create engaging, grade-appropriate passages with thoughtful comprehension questions that assess multiple levels of understanding (literal, inferential, evaluative). Your passages are vivid and engaging when read aloud, with natural rhythm and pacing. You always ensure questions are fair -- answerable from the passage content alone without requiring outside knowledge.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ListenAndRespondData;

    // Step 2: Generate TTS audio for the full passage and each segment
    const passageText = result.passage.text;
    const words = passageText.split(/\s+/);

    // Generate full passage audio
    console.log('Generating TTS audio for full passage...');
    const passageAudio = await generateTTSAudio(passageText);

    // Generate audio for each segment (for replay)
    const segmentsWithAudio = await Promise.all(
      (result.segments || []).map(async (segment) => {
        const segmentWords = words.slice(segment.startWord, segment.endWord);
        const segmentText = segmentWords.join(' ');

        if (!segmentText.trim()) {
          return segment;
        }

        console.log(`Generating TTS audio for segment "${segment.label}"...`);
        const segmentAudio = await generateTTSAudio(segmentText);

        return {
          ...segment,
          audioBase64: segmentAudio || undefined,
        };
      })
    );

    // Merge with any config overrides
    const finalData: ListenAndRespondData = {
      ...result,
      passage: {
        ...result.passage,
        audioBase64: passageAudio || undefined,
      },
      segments: segmentsWithAudio,
      ...config,
    };

    // Validate and log
    const literalCount = finalData.questions.filter(q => q.difficulty === 'literal').length;
    const inferentialCount = finalData.questions.filter(q => q.difficulty === 'inferential').length;
    const evaluativeCount = finalData.questions.filter(q => q.difficulty === 'evaluative').length;

    console.log('Listen & Respond Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      passageType: finalData.passageType,
      wordCount: finalData.passage.wordCount,
      estimatedDuration: `${finalData.passage.estimatedDurationSeconds}s`,
      questions: finalData.questions.length,
      questionDifficulty: { literal: literalCount, inferential: inferentialCount, evaluative: evaluativeCount },
      segments: finalData.segments?.length || 0,
      hasPassageAudio: !!finalData.passage.audioBase64,
      segmentsWithAudio: finalData.segments?.filter(s => s.audioBase64).length || 0,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating listen-and-respond:", error);
    throw error;
  }
};
