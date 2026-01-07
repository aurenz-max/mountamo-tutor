import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ArrayGridData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Array Grid Data
 *
 * This schema defines the structure for array/grid visualization,
 * including rows, columns, icon types, labels, and partitioning.
 */
const arrayGridSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the array grid (e.g., '3 × 4 Array: Understanding Multiplication')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    rows: {
      type: Type.NUMBER,
      description: "Number of rows in the array. Range 2-10. Common values for elementary: 2-5"
    },
    columns: {
      type: Type.NUMBER,
      description: "Number of columns in the array. Range 2-12. Common values for elementary: 2-6"
    },
    iconType: {
      type: Type.STRING,
      description: "Type of icon to display: 'dot', 'square', 'star', or 'custom'. Default: 'dot'",
      enum: ["dot", "square", "star", "custom"]
    },
    showRowLabels: {
      type: Type.BOOLEAN,
      description: "Display row numbers (1, 2, 3...). Default: true. Helps students count rows."
    },
    showColumnLabels: {
      type: Type.BOOLEAN,
      description: "Display column numbers (1, 2, 3...). Default: true. Helps students count columns."
    },
    partitionLines: {
      type: Type.ARRAY,
      description: "Array of partition lines to divide the grid. Each line has 'type' (row/column) and 'index' (position)",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ["row", "column"],
            description: "Whether this is a horizontal (row) or vertical (column) partition line"
          },
          index: {
            type: Type.NUMBER,
            description: "Position of the partition line (1-based index between cells)"
          }
        },
        required: ["type", "index"]
      }
    },
    highlightMode: {
      type: Type.STRING,
      description: "What students can click to highlight: 'row', 'column', 'cell', or 'region'. Default: 'cell'",
      enum: ["row", "column", "cell", "region"]
    },
    animateSkipCounting: {
      type: Type.BOOLEAN,
      description: "Enable skip counting animation button. Animates counting by rows. Default: false. Use for introducing multiplication."
    }
  },
  required: ["title", "description", "rows", "columns"]
};

/**
 * Generate array grid data for visualization
 *
 * This function creates array grid data including:
 * - Appropriate row and column counts for the topic and grade level
 * - Icon type selection (dots, squares, stars)
 * - Label configurations for educational clarity
 * - Partition lines for showing grouping strategies
 * - Highlight modes for interactive exploration
 * - Animation features for skip counting
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ArrayGridData with complete configuration
 */
export const generateArrayGrid = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rows?: number;
    columns?: number;
    iconType?: 'dot' | 'square' | 'star' | 'custom';
    showRowLabels?: boolean;
    showColumnLabels?: boolean;
    partitionLines?: Array<{ type: 'row' | 'column'; index: number }>;
    highlightMode?: 'row' | 'column' | 'cell' | 'region';
    animateSkipCounting?: boolean;
  }
): Promise<ArrayGridData> => {
  // Generate 6-10 random array configurations to encourage variety
  const numConfigs = 6 + Math.floor(Math.random() * 5); // 6-10 configurations
  const randomConfigs: string[] = [];

  for (let i = 0; i < numConfigs; i++) {
    const rows = 2 + Math.floor(Math.random() * 7); // 2-8 rows
    const cols = 2 + Math.floor(Math.random() * 9); // 2-10 columns
    randomConfigs.push(`${rows}×${cols}`);
  }

  const prompt = `
Create an educational array/grid visualization for teaching "${topic}" to ${gradeLevel} students.

RANDOMIZATION GUIDANCE: You MUST choose from these diverse array configurations: ${randomConfigs.join(', ')}
CRITICAL: DO NOT default to 3×5 or any fixed size. Generate DIFFERENT and VARIED array sizes each time by selecting from the randomization options above. Vary both rows and columns across the full range appropriate for the grade level. Each generation should produce a UNIQUE array size.

CONTEXT:
- Arrays are rectangular arrangements of objects in rows and columns
- They are foundational for understanding multiplication as repeated addition
- Each row contains the same number of items
- Students can count by rows (skip counting) or columns
- Arrays demonstrate the commutative property (3×4 = 4×3)
- Partitioning arrays helps with more complex multiplication strategies

GUIDELINES FOR GRADE LEVELS:
- Grades 2-3: Simple arrays (2-5 rows/columns), introduce multiplication, use dots or squares, enable skip counting
- Grades 3-4: Multiplication facts (up to 12×12), show commutative property, use partitions for partial products
- Grades 4-5: Area concepts, larger arrays, partition to show distributive property
- Grades 5+: Combinatorics, advanced grouping, complex partitioning

TOPIC-SPECIFIC GUIDANCE:
- "Multiplication introduction": 2-4 rows, 2-5 columns, enable skip counting animation, use dots
- "Multiplication facts": Match the specific fact (e.g., 3×4 = 3 rows, 4 columns)
- "Commutative property": Use same array dimensions, suggest rotating perspective in description
- "Area concepts": Use square icons, relate to area measurement
- "Skip counting": 3-5 rows, 2-6 columns, enable animation, highlight by rows
- "Distributive property": Use partition lines to break into smaller rectangles
- "Combinatorics": Use for counting outcomes (e.g., 3 shirts × 4 pants), use star or custom icons
- "Partial products": Add partition lines to show how to break apart multiplication

ICON TYPE SELECTION:
- 'dot': General multiplication, abstract counting (most common)
- 'square': Area models, spatial reasoning, grid paper connection
- 'star': Special items, combinatorics, engaging visuals for younger students
- 'custom': Default fallback

PARTITION LINE EXAMPLES:
- To split a 6×4 array into (3×4) + (3×4): Add partition line at row index 3
- To split a 4×8 array into (4×5) + (4×3): Add partition line at column index 5
- For distributive property (e.g., 6×7 = 6×5 + 6×2): partition at column 5

HIGHLIGHT MODE GUIDANCE:
- 'cell': Individual exploration, counting items one-by-one
- 'row': Skip counting by rows, repeated addition
- 'column': Skip counting by columns, commutative property
- 'region': Grouping, partitioning, area sections

COMMON ARRAY SIZES:
- 2×3, 3×2 (basic multiplication introduction)
- 3×4, 4×3 (commutative property)
- 5×6 (standard multiplication facts)
- 4×8, 6×7 (larger facts, partitioning opportunities)
- 10×10 (hundreds chart, place value connections)

${config ? `
CONFIGURATION HINTS:
${config.rows !== undefined ? `- Rows: ${config.rows}` : ''}
${config.columns !== undefined ? `- Columns: ${config.columns}` : ''}
${config.iconType !== undefined ? `- Icon type: ${config.iconType}` : ''}
${config.showRowLabels !== undefined ? `- Show row labels: ${config.showRowLabels}` : ''}
${config.showColumnLabels !== undefined ? `- Show column labels: ${config.showColumnLabels}` : ''}
${config.highlightMode !== undefined ? `- Highlight mode: ${config.highlightMode}` : ''}
${config.animateSkipCounting !== undefined ? `- Enable skip counting animation: ${config.animateSkipCounting}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate row and column counts based on topic and grade level (rows: 2-10, columns: 2-12)
2. Select icon type that best represents the concept (dots for abstract, squares for area, etc.)
3. Enable row and column labels for clarity (usually both true)
4. Add partition lines when teaching distributive property or partial products
5. Set highlight mode based on the learning objective:
   - 'row' for skip counting by rows
   - 'column' for skip counting by columns
   - 'cell' for individual item exploration
   - 'region' for area/grouping concepts
6. Enable skip counting animation for grades 2-3 multiplication introduction
7. Write a clear, student-friendly title that describes the array (e.g., "3 × 4 Array")
8. Provide an educational description explaining how the array relates to multiplication

IMPORTANT:
- Keep arrays reasonably sized (avoid 10+ rows or 12+ columns for elementary)
- For multiplication introduction, use 2-5 rows and 2-6 columns
- Partition lines should be between cells (e.g., partition at index 3 means between cell 3 and 4)
- Partitions are useful for showing (a+b)×c = a×c + b×c
- Skip counting animation is most useful for grades 2-3

Return the complete array grid configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: arrayGridSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid array grid data returned from Gemini API');
  }

  // Validation: ensure reasonable array sizes
  if (data.rows < 2 || data.rows > 10) {
    console.warn(`Array rows (${data.rows}) out of recommended range 2-10. Adjusting to 3.`);
    data.rows = 3;
  }

  if (data.columns < 2 || data.columns > 12) {
    console.warn(`Array columns (${data.columns}) out of recommended range 2-12. Adjusting to 4.`);
    data.columns = 4;
  }

  // Validate partition lines
  if (data.partitionLines) {
    data.partitionLines = data.partitionLines.filter((line: any) => {
      if (line.type === 'row' && (line.index < 1 || line.index > data.rows)) {
        console.warn(`Invalid row partition at index ${line.index}. Removing.`);
        return false;
      }
      if (line.type === 'column' && (line.index < 1 || line.index > data.columns)) {
        console.warn(`Invalid column partition at index ${line.index}. Removing.`);
        return false;
      }
      return true;
    });
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.rows !== undefined) data.rows = Math.max(2, Math.min(10, config.rows));
    if (config.columns !== undefined) data.columns = Math.max(2, Math.min(12, config.columns));
    if (config.iconType !== undefined) data.iconType = config.iconType;
    if (config.showRowLabels !== undefined) data.showRowLabels = config.showRowLabels;
    if (config.showColumnLabels !== undefined) data.showColumnLabels = config.showColumnLabels;
    if (config.partitionLines !== undefined) data.partitionLines = config.partitionLines;
    if (config.highlightMode !== undefined) data.highlightMode = config.highlightMode;
    if (config.animateSkipCounting !== undefined) data.animateSkipCounting = config.animateSkipCounting;
  }

  return data;
};
