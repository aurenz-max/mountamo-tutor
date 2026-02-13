import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { EvidenceFinderData } from "../../primitives/visual-primitives/literacy/EvidenceFinder";

/**
 * Schema definition for Evidence Finder Data
 *
 * Generates informational passages with claims for students to find
 * and evaluate text evidence. Supports the Claim-Evidence-Reasoning (CER)
 * framework for grades 4+. Students highlight evidence sentences, rate
 * evidence strength, and explain reasoning.
 */
const evidenceFinderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the evidence finding activity"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('2' through '6')"
    },
    passage: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "The full passage text as a single string"
        },
        sentences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "Unique sentence identifier (e.g., 's1', 's2')"
              },
              text: {
                type: Type.STRING,
                description: "The sentence text"
              },
              isEvidence: {
                type: Type.BOOLEAN,
                description: "Whether this sentence is valid evidence for one of the claims"
              },
              evidenceStrength: {
                type: Type.STRING,
                enum: ["strong", "moderate", "weak"],
                description: "How strong this sentence is as evidence (only for evidence sentences)"
              },
              claimIndex: {
                type: Type.NUMBER,
                description: "Which claim this evidence supports (0-based index into claims array). Only for evidence sentences."
              }
            },
            required: ["id", "text", "isEvidence"]
          },
          description: "Array of individual sentences making up the passage"
        },
        imageDescription: {
          type: Type.STRING,
          description: "Brief description of the passage scene for visual context"
        }
      },
      required: ["text", "sentences"]
    },
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique claim identifier (e.g., 'claim1', 'claim2')"
          },
          text: {
            type: Type.STRING,
            description: "The claim statement students must find evidence for"
          },
          color: {
            type: Type.STRING,
            description: "Color label for highlighting (e.g., 'blue', 'violet', 'emerald')"
          }
        },
        required: ["id", "text", "color"]
      },
      description: "Array of 1-2 claims to find evidence for"
    },
    cerEnabled: {
      type: Type.BOOLEAN,
      description: "Whether to enable the CER (Claim-Evidence-Reasoning) framework scaffold (grades 4+)"
    }
  },
  required: ["title", "gradeLevel", "passage", "claims", "cerEnabled"]
};

/**
 * Generate evidence finder data using Gemini AI
 *
 * Creates informational passages with specific claims for students to find
 * text evidence. Scales from simple "find the sentence" (grade 2) to full
 * CER framework with evidence strength ranking (grades 5-6).
 *
 * @param topic - Subject of the informational passage
 * @param gradeLevel - Grade level ('2' through '6') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns EvidenceFinderData with passage, claims, and evidence-tagged sentences
 */
export const generateEvidenceFinder = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<EvidenceFinderData>
): Promise<EvidenceFinderData> => {

  const gradeContext: Record<string, string> = {
    '2': `
GRADE 2 GUIDELINES:
- Short informational passage (4-6 sentences)
- 1 simple claim (e.g., "Frogs are good swimmers")
- 1-2 sentences that directly answer "Find the sentence that tells you..."
- Evidence is explicit and directly stated in the text
- NO CER framework (cerEnabled: false)
- Evidence strength: all "strong" (explicit statements)
- Remaining sentences provide context but are NOT evidence for the claim
- Use simple vocabulary and short sentences
`,
    '3': `
GRADE 3 GUIDELINES:
- Informational passage (6-8 sentences)
- 1 claim with a fact/opinion distinction context
- 2-3 evidence sentences (mix of strong and moderate)
- Students should distinguish facts from opinions
- NO CER framework (cerEnabled: false)
- Include some opinion sentences that are NOT evidence (distractors)
- Grade-appropriate vocabulary
`,
    '4': `
GRADE 4 GUIDELINES:
- Informational passage (8-10 sentences)
- 1-2 claims
- 3-4 evidence sentences with varying strength (strong, moderate, weak)
- Enable CER framework (cerEnabled: true) — students explain reasoning
- Include some sentences that seem related but aren't direct evidence
- Evidence requires some inference (not all directly stated)
`,
    '5': `
GRADE 5 GUIDELINES:
- Informational passage (10-12 sentences)
- 2 claims (possibly competing)
- 4-5 evidence sentences across both claims
- CER framework enabled (cerEnabled: true)
- Mix of strong, moderate, and weak evidence
- Some evidence supports one claim but contradicts another
- Requires evaluating evidence quality
`,
    '6': `
GRADE 6 GUIDELINES:
- Informational or persuasive passage (10-14 sentences)
- 2 claims (can be competing/opposing)
- 4-6 evidence sentences with clear strength differentiation
- CER framework enabled (cerEnabled: true)
- Include evidence of varying quality (statistics vs anecdotes)
- Requires evaluating source reliability concepts
- More nuanced claim-evidence relationships
`
  };

  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';
  const useCER = parseInt(gradeLevelKey) >= 4;

  const generationPrompt = `Create an evidence finding activity about: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['3']}

REQUIRED INFORMATION:

1. **Title**: Engaging title for the activity

2. **Grade Level**: "${gradeLevelKey}"

3. **Passage**: An object with:
   - text: The full passage as one string
   - sentences: Array of sentence objects, EACH with:
     - id: Unique ID (s1, s2, etc.)
     - text: The sentence text (should concatenate to the full passage text)
     - isEvidence: true if this sentence IS valid evidence for a claim, false otherwise
     - evidenceStrength: "strong", "moderate", or "weak" (ONLY for evidence sentences)
     - claimIndex: 0-based index of which claim this evidence supports (ONLY for evidence sentences)
   - imageDescription: Brief scene description

   CRITICAL RULES:
   - At least 40% of sentences should NOT be evidence (non-evidence context/distractors)
   - Evidence sentences MUST actually support their assigned claim
   - Non-evidence sentences should be topically related but NOT directly support any claim
   - Evidence strength should be realistic:
     - "strong": Directly and clearly supports the claim with specific facts/data
     - "moderate": Supports the claim but less directly or with less specificity
     - "weak": Tangentially relates but doesn't strongly prove the claim
   - All sentences concatenated should form a coherent, well-written passage

4. **Claims**: Array of 1-2 claim objects:
   - id: Unique ID (claim1, claim2)
   - text: Clear claim statement that can be supported by passage evidence
   - color: Color label ("blue" for first claim, "violet" for second)

5. **CER Enabled**: ${useCER}

EXAMPLE OUTPUT FOR GRADE 3:
{
  "title": "Evidence Hunt: Amazing Dolphins",
  "gradeLevel": "3",
  "passage": {
    "text": "Dolphins are fascinating marine mammals. They can swim up to 20 miles per hour. Many people enjoy watching dolphins at aquariums. Dolphins use echolocation to find their food in murky water. Some scientists believe dolphins are among the smartest animals. Baby dolphins stay with their mothers for up to six years. Dolphins are beautiful animals that make people smile.",
    "sentences": [
      { "id": "s1", "text": "Dolphins are fascinating marine mammals.", "isEvidence": false },
      { "id": "s2", "text": "They can swim up to 20 miles per hour.", "isEvidence": true, "evidenceStrength": "strong", "claimIndex": 0 },
      { "id": "s3", "text": "Many people enjoy watching dolphins at aquariums.", "isEvidence": false },
      { "id": "s4", "text": "Dolphins use echolocation to find their food in murky water.", "isEvidence": true, "evidenceStrength": "strong", "claimIndex": 0 },
      { "id": "s5", "text": "Some scientists believe dolphins are among the smartest animals.", "isEvidence": true, "evidenceStrength": "moderate", "claimIndex": 0 },
      { "id": "s6", "text": "Baby dolphins stay with their mothers for up to six years.", "isEvidence": false },
      { "id": "s7", "text": "Dolphins are beautiful animals that make people smile.", "isEvidence": false }
    ],
    "imageDescription": "A group of dolphins jumping playfully in the ocean"
  },
  "claims": [
    { "id": "claim1", "text": "Dolphins have special abilities that help them survive in the ocean.", "color": "blue" }
  ],
  "cerEnabled": false
}

Now generate an evidence finding activity about "${topic}" at grade level ${gradeLevelKey}. Ensure evidence sentences genuinely support their assigned claims and non-evidence sentences are plausible distractors.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evidenceFinderSchema,
        systemInstruction: `You are an expert K-6 reading comprehension specialist. You create evidence-finding activities that teach students to identify text evidence supporting claims in informational passages. You understand the Claim-Evidence-Reasoning (CER) framework and can generate passages with clearly identifiable evidence sentences of varying strength. You write age-appropriate informational passages on engaging topics, carefully distinguishing evidence sentences from contextual/distractor sentences. Your evidence tagging is accurate — you only mark sentences as evidence when they genuinely support the stated claim.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as EvidenceFinderData;

    const finalData: EvidenceFinderData = {
      ...result,
      ...config,
    };

    console.log('Evidence Finder Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      sentenceCount: finalData.passage?.sentences?.length || 0,
      evidenceCount: finalData.passage?.sentences?.filter(s => s.isEvidence).length || 0,
      claimCount: finalData.claims?.length || 0,
      cerEnabled: finalData.cerEnabled,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating evidence finder:", error);
    throw error;
  }
};
