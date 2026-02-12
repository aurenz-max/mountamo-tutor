import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { ParagraphArchitectData } from "../../primitives/visual-primitives/literacy/ParagraphArchitect";

/**
 * Schema definition for Paragraph Architect Data
 *
 * This schema defines the structure for scaffolded paragraph construction
 * using the "hamburger" model, scaled from grades K-6.
 *
 * The primitive follows a 3-phase learning model:
 * - Explore: Study a model paragraph and identify its parts
 * - Practice: Build a paragraph using sentence frames and linking words
 * - Apply: Write an original paragraph with minimal scaffolding
 */
const paragraphArchitectSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Display title for the activity (e.g., 'Build a Paragraph About Dogs')"
    },
    paragraphType: {
      type: Type.STRING,
      enum: ["informational", "narrative", "opinion"],
      description: "Type of paragraph students will build"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level (e.g., 'K', '1', '2', '3', '4', '5', '6')"
    },
    topic: {
      type: Type.STRING,
      description: "The writing topic for the paragraph (e.g., 'Why recycling matters')"
    },
    topicSentenceFrames: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Sentence starter frames for topic sentences. Use '___' for the blank. Provide 3-5 frames. Example: 'The most important thing about ___ is...'"
    },
    detailSentenceFrames: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Sentence starter frames for detail/supporting sentences. Use '___' for blanks. Provide 4-6 frames. Example: 'For example, ___'"
    },
    concludingSentenceFrames: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Sentence starter frames for concluding sentences. Use '___' for blanks. Provide 2-3 frames. Example: 'In conclusion, ___'"
    },
    linkingWords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Transition and linking words appropriate for the grade level. Provide 6-10 words. Examples: 'because', 'also', 'for example', 'first', 'next', 'finally'"
    },
    modelParagraph: {
      type: Type.OBJECT,
      properties: {
        topicSentence: {
          type: Type.STRING,
          description: "A clear, grade-appropriate topic sentence that states the main idea"
        },
        detailSentences: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-4 supporting detail sentences that elaborate on the topic sentence"
        },
        concludingSentence: {
          type: Type.STRING,
          description: "A concluding sentence that wraps up the paragraph"
        }
      },
      required: ["topicSentence", "detailSentences", "concludingSentence"],
      description: "A model paragraph demonstrating the hamburger structure for the Explore phase"
    }
  },
  required: [
    "title",
    "paragraphType",
    "gradeLevel",
    "topic",
    "topicSentenceFrames",
    "detailSentenceFrames",
    "concludingSentenceFrames",
    "linkingWords",
    "modelParagraph"
  ]
};

/**
 * Generate paragraph architect data using Gemini AI
 *
 * Creates scaffolded paragraph construction activities using the "hamburger"
 * model, scaled from grades K-6. The generator produces grade-appropriate
 * sentence frames, linking words, and a model paragraph.
 *
 * Grade-level scaling:
 * - K-1: Heavy scaffolding, simple vocabulary, 2 details, basic frames
 * - 2-3: Full hamburger model, temporal/linking words, 3 details
 * - 4-6: More complex frames, varied sentence structure, 3-4 details
 *
 * @param topic - The writing topic (e.g., "My Favorite Animal", "Why Trees Are Important")
 * @param gradeLevel - Target grade level ('K', '1', '2', '3', '4', '5', '6')
 * @param config - Optional partial configuration to override generated values
 * @returns ParagraphArchitectData with grade-appropriate scaffolding
 */
export const generateParagraphArchitect = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ParagraphArchitectData>
): Promise<ParagraphArchitectData> => {

  // Grade-specific complexity and content instructions
  const gradeContext: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- Use very simple, short words (CVC words preferred)
- Topic sentence frames should be very basic: "I like ___", "___ is fun", "My favorite ___ is ___"
- Only 2 detail sentences needed
- Detail frames should be simple: "It is ___", "I can see ___", "___ has ___"
- Concluding frame: "I love ___!", "That is why I like ___"
- Linking words: "and", "but", "so", "because"
- Model paragraph should be 3-4 sentences total (topic + 2 details + conclusion)
- Use familiar, concrete topics children can relate to
- All sentences should be 5-8 words maximum
`,
    '1': `
GRADE 1 GUIDELINES:
- Simple vocabulary with some descriptive words
- Topic sentence frames: "The best thing about ___ is ___", "___ are special because ___"
- 2-3 detail sentences
- Detail frames: "One reason is ___", "Another thing is ___", "I also know that ___"
- Concluding frames: "That is why ___", "Now you know about ___"
- Linking words: "and", "but", "so", "because", "also", "first", "next"
- Model paragraph should be 4-5 sentences total
- Heavy scaffolding with most content provided in frames
- Sentences should be 6-10 words
`,
    '2': `
GRADE 2 GUIDELINES:
- Expanding vocabulary with some academic words
- Topic sentence frames introduce the main idea clearly
- 3 detail sentences expected
- Detail frames use temporal words: "First, ___", "Next, ___", "Then, ___"
- Also include evidence frames: "For example, ___", "One reason is ___"
- Concluding frames: "In the end, ___", "As you can see, ___"
- Linking words: "because", "also", "for example", "first", "next", "then", "finally", "another"
- Model paragraph should be 5-6 sentences total
- Moderate scaffolding — frames available but encourage original writing
`,
    '3': `
GRADE 3 GUIDELINES:
- Full hamburger paragraph model with all three parts clearly defined
- Topic sentence frames state main idea with supporting claim
- 3-4 detail sentences with varied structure
- Detail frames include: "For example, ___", "In addition, ___", "One important fact is ___", "This shows that ___"
- Concluding frames: "In conclusion, ___", "This is why ___", "As you can see, ___"
- Linking words: "because", "also", "for example", "in addition", "however", "therefore", "first", "second", "finally", "as a result"
- Model paragraph should be 6-7 sentences
- Support all three paragraph types (informational, narrative, opinion)
- Encourage use of specific details and examples
`,
    '4': `
GRADE 4 GUIDELINES:
- More sophisticated sentence frames with complex structures
- Topic sentence frames: "___ is important because ___", "Many people believe ___, and there is evidence to support this"
- 3-4 detail sentences with elaboration
- Detail frames encourage explanation: "For instance, ___. This means that ___", "According to ___, ___"
- Concluding frames: "Clearly, ___", "The evidence shows that ___", "In summary, ___"
- Linking words: "furthermore", "consequently", "specifically", "in contrast", "meanwhile", "similarly", "in addition", "as a result", "for instance", "on the other hand"
- Model paragraph should be 7-8 sentences with varied sentence lengths
- Multi-paragraph awareness — mention that this could be one paragraph in a larger piece
`,
    '5': `
GRADE 5 GUIDELINES:
- Sophisticated vocabulary and varied sentence structure
- Topic sentence frames use academic language: "Research shows that ___", "One critical aspect of ___ is ___"
- 3-4 detail sentences with elaboration strategies (examples, explanations, definitions)
- Detail frames: "Evidence of this can be seen in ___", "To elaborate, ___", "This is significant because ___", "A clear example is ___"
- Concluding frames: "Ultimately, ___", "The significance of ___ cannot be overstated", "In light of this evidence, ___"
- Linking words: "furthermore", "consequently", "specifically", "nevertheless", "despite", "accordingly", "moreover", "in particular", "as demonstrated", "to illustrate"
- Model paragraph should be 7-9 sentences with varying sentence structures
- Encourage varying sentence beginnings and lengths
`,
    '6': `
GRADE 6 GUIDELINES:
- Advanced academic vocabulary and complex sentence structures
- Topic sentence frames introduce argumentative or analytical claims: "While many assume ___, the reality is ___", "A closer examination of ___ reveals ___"
- 3-4 detail sentences with evidence and analysis
- Detail frames: "One compelling piece of evidence is ___", "This can be attributed to ___", "Critics might argue ___, but ___", "When examined closely, ___"
- Concluding frames: "In conclusion, the evidence overwhelmingly suggests ___", "Moving forward, ___", "This analysis demonstrates that ___"
- Linking words: "consequently", "furthermore", "nevertheless", "in contrast", "similarly", "despite", "accordingly", "moreover", "in particular", "as demonstrated", "conversely", "ultimately"
- Model paragraph should be 8-10 sentences with sophisticated structure
- Include counter-argument awareness for opinion paragraphs
- Paragraph as unit of argument — topic sentence functions as a claim
`
  };

  // Default to grade 3 context if grade not found
  const selectedGradeContext = gradeContext[gradeLevel] || gradeContext['3'];

  // Determine paragraph type label
  const paragraphTypeDescriptions: Record<string, string> = {
    informational: "INFORMATIONAL paragraph (main idea + supporting facts/details). The topic sentence states the main idea, details provide facts and evidence, and the conclusion restates or summarizes.",
    narrative: "NARRATIVE paragraph (event/experience + descriptive details + reflection). The topic sentence sets the scene, details describe what happened in order, and the conclusion shares a feeling or lesson.",
    opinion: "OPINION paragraph (claim/opinion + reasons + conclusion). The topic sentence states a clear opinion, details give reasons with evidence, and the conclusion restates the opinion."
  };

  // Infer paragraph type from config or default to informational
  const targetParagraphType = config?.paragraphType || 'informational';
  const paragraphTypeDescription = paragraphTypeDescriptions[targetParagraphType] || paragraphTypeDescriptions.informational;

  const generationPrompt = `Create a scaffolded paragraph writing activity for: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
PARAGRAPH TYPE: ${paragraphTypeDescription}

${selectedGradeContext}

REQUIRED INFORMATION:

1. **Title**: An engaging activity title that mentions the topic (e.g., "Build a Paragraph About Ocean Animals")

2. **Topic**: The specific writing topic students will write about

3. **Paragraph Type**: "${targetParagraphType}"

4. **Topic Sentence Frames** (provide 3-5):
   - Sentence starters that help students write a topic sentence
   - Use "___" for blanks where students fill in their own content
   - Vary the complexity — some more scaffolded, some more open
   - Example: "The most important thing about ___ is ___."
   - Example: "___ are fascinating because ___."

5. **Detail Sentence Frames** (provide 4-6):
   - Sentence starters for supporting detail sentences
   - Include a mix of evidence, example, and elaboration frames
   - Use "___" for blanks
   - Example: "For example, ___."
   - Example: "One reason this matters is ___."
   - Example: "Additionally, ___."

6. **Concluding Sentence Frames** (provide 2-3):
   - Sentence starters for wrapping up the paragraph
   - Use "___" for blanks
   - Example: "In conclusion, ___."
   - Example: "This shows that ___."

7. **Linking Words** (provide 6-10):
   - Transition words appropriate for the grade level
   - Include temporal, causal, additive, and contrastive connectors
   - Examples: "because", "also", "for example", "however", "first", "next"

8. **Model Paragraph**:
   - A complete example paragraph on the given topic
   - Must use the hamburger structure (topic sentence, detail sentences, concluding sentence)
   - Written at the target grade level's reading and vocabulary level
   - The topic sentence should clearly state the main idea
   - Include ${gradeLevel === 'K' || gradeLevel === '1' ? '2' : gradeLevel === '2' || gradeLevel === '3' ? '3' : '3-4'} detail sentences
   - The concluding sentence should wrap up or restate the main idea
   - Use some of the provided linking words naturally

EXAMPLE OUTPUT FOR GRADE 3, INFORMATIONAL:

{
  "title": "Build a Paragraph About Butterflies",
  "paragraphType": "informational",
  "gradeLevel": "3",
  "topic": "How butterflies grow and change",
  "topicSentenceFrames": [
    "The most important thing about ___ is ___.",
    "___ go through an amazing process called ___.",
    "Did you know that ___?",
    "One fascinating fact about ___ is ___.",
    "Learning about ___ helps us understand ___."
  ],
  "detailSentenceFrames": [
    "First, ___.",
    "Next, ___.",
    "For example, ___.",
    "Another important detail is ___.",
    "In addition, ___.",
    "This means that ___."
  ],
  "concludingSentenceFrames": [
    "In conclusion, ___.",
    "As you can see, ___.",
    "This is why ___ is so interesting."
  ],
  "linkingWords": ["first", "next", "then", "also", "because", "for example", "finally", "in addition", "as a result", "however"],
  "modelParagraph": {
    "topicSentence": "Butterflies go through an amazing process called metamorphosis.",
    "detailSentences": [
      "First, a butterfly starts its life as a tiny egg on a leaf.",
      "Next, a caterpillar hatches from the egg and eats leaves to grow bigger.",
      "Then, the caterpillar forms a chrysalis where it changes into a butterfly."
    ],
    "concludingSentence": "As you can see, butterflies go through incredible changes before they can fly."
  }
}

Now generate a paragraph architect activity for "${topic}" at grade level ${gradeLevel} with paragraph type "${targetParagraphType}".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: paragraphArchitectSchema,
        systemInstruction: `You are an expert elementary writing teacher specializing in K-6 paragraph instruction. You understand the "hamburger" model of paragraph writing (topic sentence as top bun, details as fillings, conclusion as bottom bun). You create age-appropriate sentence frames that scaffold student writing while encouraging original thought. You know how to scale writing instruction from kindergarten (simple sentences with heavy support) through grade 6 (complex academic paragraphs with argumentative structure). You always use grade-appropriate vocabulary, sentence length, and complexity. Your model paragraphs are engaging, accurate, and demonstrate the exact structure you want students to learn.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ParagraphArchitectData;

    // Merge with any config overrides
    const finalData: ParagraphArchitectData = {
      ...result,
      ...config,
    };

    console.log('Paragraph Architect Generated:', {
      title: finalData.title,
      paragraphType: finalData.paragraphType,
      gradeLevel: finalData.gradeLevel,
      topic: finalData.topic,
      topicFrames: finalData.topicSentenceFrames.length,
      detailFrames: finalData.detailSentenceFrames.length,
      conclusionFrames: finalData.concludingSentenceFrames.length,
      linkingWords: finalData.linkingWords.length,
      hasModel: !!finalData.modelParagraph,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating paragraph architect:", error);
    throw error;
  }
};
