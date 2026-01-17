import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Two-Way Table Data Interface
 *
 * This matches the TwoWayTableData interface in the component
 */
export interface TwoWayTableData {
  title: string;
  description: string;
  rowCategories: string[];
  columnCategories: string[];
  frequencies: number[][];
  showTotals: boolean;
  displayMode: 'table' | 'venn' | 'both';
  showProbabilities: boolean;
  editable: boolean;
  highlightedCells?: { row: number; col: number }[];
  questionPrompt?: string;
}

/**
 * Schema definition for Two-Way Table Data
 *
 * This schema defines the structure for a two-way table visualization
 * with categorical data, supporting table and Venn diagram views.
 */
const twoWayTableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the two-way table (e.g., 'Pet Preferences by Gender', 'Sports vs. Grades')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what the table shows and how to interpret the categorical data relationships"
    },
    rowCategories: {
      type: Type.ARRAY,
      description: "Labels for row categories (e.g., ['Male', 'Female'] or ['Grade 6', 'Grade 7', 'Grade 8']). Usually 2-4 categories.",
      items: {
        type: Type.STRING
      }
    },
    columnCategories: {
      type: Type.ARRAY,
      description: "Labels for column categories (e.g., ['Dogs', 'Cats'] or ['Pass', 'Fail']). Usually 2-4 categories.",
      items: {
        type: Type.STRING
      }
    },
    frequencies: {
      type: Type.ARRAY,
      description: "2D array of frequency counts. Each row corresponds to a row category, each column to a column category. Values should be non-negative integers.",
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.NUMBER
        }
      }
    },
    showTotals: {
      type: Type.BOOLEAN,
      description: "Whether to display row and column totals. Default: true"
    },
    displayMode: {
      type: Type.STRING,
      description: "Initial display mode: 'table' (default), 'venn' (for 2x2 tables), or 'both'"
    },
    showProbabilities: {
      type: Type.BOOLEAN,
      description: "Whether to initially show relative frequencies (probabilities) instead of counts. Default: false"
    },
    editable: {
      type: Type.BOOLEAN,
      description: "Whether students can edit cell values. Default: true for exploration, false for assessment"
    },
    questionPrompt: {
      type: Type.STRING,
      description: "Optional question prompt for students to answer based on the data (e.g., 'What is the probability that a randomly selected student is male given they prefer dogs?')"
    }
  },
  required: ["title", "description", "rowCategories", "columnCategories", "frequencies", "showTotals", "displayMode", "showProbabilities", "editable"]
};

/**
 * Generate two-way table data for visualization
 *
 * This function creates two-way table data including:
 * - Realistic categorical data appropriate for the topic
 * - Proper 2D frequency array
 * - Educational prompts for probability questions
 * - Support for joint, marginal, and conditional probability exploration
 *
 * @param topic - The topic or context for the categorical data
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns TwoWayTableData with complete configuration
 */
export const generateTwoWayTable = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rowCategories?: string[];
    columnCategories?: string[];
    frequencies?: number[][];
    showTotals?: boolean;
    displayMode?: 'table' | 'venn' | 'both';
    showProbabilities?: boolean;
    editable?: boolean;
  }
): Promise<TwoWayTableData> => {
  const prompt = `
Create an educational two-way table (contingency table) for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A two-way table organizes categorical data by two different variables
- Rows represent one categorical variable, columns represent another
- Cell values are frequencies (counts) of observations in each combination
- Used to analyze relationships between categorical variables
- Foundation for joint, marginal, and conditional probability concepts
- Can be visualized as a Venn diagram for 2x2 tables

GUIDELINES FOR GRADE LEVELS:

**Grade 7 (Introduction to Categorical Data)**:
- 2x2 tables with simple, relatable categories
- Use whole number frequencies (5-30 per cell)
- Total sample size: 30-100
- Simple contexts: favorite subject, pet preference, breakfast choice
- displayMode: 'both' (show table and Venn)
- showProbabilities: false initially
- editable: true
- Focus on reading the table and understanding categories
- Example prompt: "How many students are both male and prefer dogs?"

**Grade 7 (Set Relationships)**:
- 2x2 tables emphasizing set operations (union, intersection)
- Venn diagram view essential
- Use contexts that naturally map to sets
- Example: "Students in Band AND/OR Sports"
- displayMode: 'venn' or 'both'
- showProbabilities: false
- editable: true
- Focus on understanding overlap and exclusive regions

**Grade 7-8 (Joint Probability)**:
- 2x2 or 2x3 tables
- Introduce P(A and B) notation
- Total sample size: 50-200 for meaningful percentages
- showProbabilities: true option available
- displayMode: 'table'
- Include questionPrompt about joint probabilities
- Example: "What fraction of all students are female AND prefer cats?"

**Statistics (Conditional Probability)**:
- 2x2 or larger tables
- Focus on P(A|B) calculations
- Clear contexts where conditioning makes sense
- Include questionPrompt about conditional probability
- displayMode: 'table'
- showProbabilities: toggle available
- Example: "Given a student is male, what is the probability they prefer dogs?"

**Statistics (Independence Testing)**:
- Design data that either shows independence or clear association
- Include larger sample sizes (100-500)
- Use contexts where independence is meaningful
- showProbabilities: true for relative frequency analysis
- Include questionPrompt about whether variables appear independent

TOPIC-SPECIFIC GUIDANCE:

- "Pet preferences" → Use gender or grade as rows, pet types as columns
- "Sports participation" → Use gender as rows, sports as columns
- "Study habits" → Use grade/age as rows, study time categories as columns
- "Favorite subjects" → Use gender as rows, subjects as columns
- "Transportation to school" → Use distance as rows, mode as columns
- "Breakfast habits" → Use weekday/weekend as rows, food types as columns
- "Screen time" → Use age groups as rows, time categories as columns
- "Health behaviors" → Use one behavior as rows, another as columns

DATA GENERATION RULES:

1. **For showing association/dependence**:
   - Make frequencies clearly different across rows or columns
   - Example: If males strongly prefer dogs, make that cell notably larger
   - Pattern should be visible when comparing rows

2. **For showing independence**:
   - Keep row proportions similar across columns
   - Each row should have approximately the same distribution
   - Joint probability ≈ product of marginals

3. **For balanced data**:
   - Row totals should be similar (within 2x of each other)
   - Column totals should be similar
   - No empty cells (minimum 3-5 per cell)

4. **For interesting Venn diagrams**:
   - In 2x2 tables, all four cells should have non-zero values
   - Make intersection meaningful but not dominant
   - Neither set should be entirely contained in the other

MAPPING TO VENN DIAGRAM (for 2x2 tables):
- Cell [0][0] = Both categories (intersection)
- Cell [0][1] = Row category 1 only (A - B)
- Cell [1][0] = Column category 1 only (B - A)
- Cell [1][1] = Neither category (complement)

${config ? `
CONFIGURATION HINTS:
${config.rowCategories ? `- Row Categories: ${config.rowCategories.join(', ')}` : ''}
${config.columnCategories ? `- Column Categories: ${config.columnCategories.join(', ')}` : ''}
${config.frequencies ? `- Frequencies provided: ${JSON.stringify(config.frequencies)}` : ''}
${config.showTotals !== undefined ? `- Show Totals: ${config.showTotals}` : ''}
${config.displayMode ? `- Display Mode: ${config.displayMode}` : ''}
${config.showProbabilities !== undefined ? `- Show Probabilities: ${config.showProbabilities}` : ''}
${config.editable !== undefined ? `- Editable: ${config.editable}` : ''}
` : ''}

REQUIREMENTS:
1. Generate realistic, contextually appropriate categorical data
2. Use 2-4 row categories and 2-4 column categories (2x2 preferred for Venn)
3. Write a clear, engaging title that describes the data relationship
4. Provide an educational description about what students should observe
5. Set displayMode based on the learning objective
6. Include a questionPrompt that guides student analysis
7. Frequencies should create meaningful patterns for analysis
8. Total sample size should be appropriate for the grade level

Return the complete two-way table configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: twoWayTableSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid two-way table data returned from Gemini API');
  }

  // Validation: ensure categories exist
  if (!data.rowCategories || data.rowCategories.length === 0) {
    console.warn('No row categories provided. Using defaults.');
    data.rowCategories = ['Category A', 'Category B'];
  }

  if (!data.columnCategories || data.columnCategories.length === 0) {
    console.warn('No column categories provided. Using defaults.');
    data.columnCategories = ['Group 1', 'Group 2'];
  }

  // Validation: ensure frequencies match dimensions
  const expectedRows = data.rowCategories.length;
  const expectedCols = data.columnCategories.length;

  if (!data.frequencies || data.frequencies.length !== expectedRows) {
    console.warn('Frequencies do not match row categories. Generating default data.');
    data.frequencies = Array(expectedRows).fill(null).map(() =>
      Array(expectedCols).fill(null).map(() => Math.floor(Math.random() * 20) + 5)
    );
  } else {
    // Check each row has correct number of columns
    data.frequencies = data.frequencies.map((row: number[]) => {
      if (row.length !== expectedCols) {
        return Array(expectedCols).fill(null).map(() => Math.floor(Math.random() * 20) + 5);
      }
      return row.map((val: number) => Math.max(0, Math.round(val)));
    });
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.rowCategories) data.rowCategories = config.rowCategories;
    if (config.columnCategories) data.columnCategories = config.columnCategories;
    if (config.frequencies) data.frequencies = config.frequencies;
    if (config.showTotals !== undefined) data.showTotals = config.showTotals;
    if (config.displayMode) data.displayMode = config.displayMode;
    if (config.showProbabilities !== undefined) data.showProbabilities = config.showProbabilities;
    if (config.editable !== undefined) data.editable = config.editable;
  }

  // Set defaults
  if (data.showTotals === undefined) data.showTotals = true;
  if (!data.displayMode) data.displayMode = 'table';
  if (data.showProbabilities === undefined) data.showProbabilities = false;
  if (data.editable === undefined) data.editable = true;

  return data;
};
