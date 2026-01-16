import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Dot Plot Data Interface
 *
 * This matches the DotPlotData interface in the component
 */
export interface DotPlotData {
  title: string;
  description: string;
  range: [number, number];
  dataPoints: number[];
  showStatistics: boolean;
  editable: boolean;
  parallel?: boolean;
  secondaryDataPoints?: number[];
  secondaryLabel?: string;
  primaryLabel?: string;
  stackStyle: 'dots' | 'x' | 'icons';
  iconEmoji?: string;
}

/**
 * Schema definition for Dot Plot Data
 *
 * This schema defines the structure for a dot plot (line plot) visualization
 * with support for data point stacking, statistics, and parallel dataset comparison.
 */
const dotPlotSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the dot plot (e.g., 'Heights of Students', 'Daily Temperature')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what the dot plot shows and what students should learn"
    },
    range: {
      type: Type.ARRAY,
      description: "Number line range [min, max]. Choose appropriate range for the data.",
      items: {
        type: Type.NUMBER
      }
    },
    dataPoints: {
      type: Type.ARRAY,
      description: "Array of numeric data values to plot. Values can repeat to show frequency.",
      items: {
        type: Type.NUMBER
      }
    },
    showStatistics: {
      type: Type.BOOLEAN,
      description: "Whether to display mean, median, and mode calculations. Default: true"
    },
    editable: {
      type: Type.BOOLEAN,
      description: "Whether students can add/remove data points by clicking. Default: true"
    },
    parallel: {
      type: Type.BOOLEAN,
      description: "Enable second dataset for comparison. Default: false"
    },
    secondaryDataPoints: {
      type: Type.ARRAY,
      description: "Optional second dataset for comparison (only if parallel is true)",
      items: {
        type: Type.NUMBER
      }
    },
    primaryLabel: {
      type: Type.STRING,
      description: "Label for the primary dataset (e.g., 'Class A', 'Morning')"
    },
    secondaryLabel: {
      type: Type.STRING,
      description: "Label for the secondary dataset (e.g., 'Class B', 'Afternoon')"
    },
    stackStyle: {
      type: Type.STRING,
      description: "Visual style for data points: 'dots' (filled circles), 'x' (X marks), or 'icons' (custom emoji). Default: 'dots'"
    },
    iconEmoji: {
      type: Type.STRING,
      description: "Custom emoji to use when stackStyle is 'icons' (e.g., '⭐', '🍎')"
    }
  },
  required: ["title", "description", "range", "dataPoints", "showStatistics", "editable", "stackStyle"]
};

/**
 * Generate dot plot data for visualization
 *
 * This function creates dot plot data including:
 * - Appropriate data values for the topic and grade level
 * - Number line range that fits the data
 * - Optional parallel datasets for comparison
 * - Statistics display configuration
 *
 * @param topic - The topic or context for the data
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns DotPlotData with complete configuration
 */
export const generateDotPlot = async (
  topic: string,
  gradeLevel: string,
  config?: {
    range?: [number, number];
    dataPoints?: number[];
    showStatistics?: boolean;
    editable?: boolean;
    parallel?: boolean;
    stackStyle?: 'dots' | 'x' | 'icons';
  }
): Promise<DotPlotData> => {
  const prompt = `
Create an educational dot plot (line plot) visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A dot plot (also called line plot) is a number line with stacked dots/marks showing data frequency
- Each dot represents one data value
- Multiple dots at the same value show frequency (how often that value appears)
- Used for small datasets to visualize distribution, clusters, gaps, and outliers
- Perfect for teaching mean, median, mode, and data interpretation

GUIDELINES FOR GRADE LEVELS:
- Grades 2-3: Small whole numbers (0-10), simple counting data, no statistics display
- Grades 3-4: Whole numbers (0-20), introduction to frequency, simple statistics
- Grades 4-5: Larger ranges, comparing datasets, mean/median/mode concepts
- Grades 5-6: Decimals allowed, data analysis, distribution shape discussions
- Grades 6-7: Comparing two datasets (parallel plots), statistical measures
- Middle School+: Larger datasets, advanced statistics, data interpretation

TOPIC-SPECIFIC GUIDANCE:

**Counting and Frequency (Grades 2-3)**:
- range: [0, 10] or [1, 10]
- dataPoints: 8-12 simple whole numbers
- showStatistics: false
- editable: true (let students add data)
- parallel: false
- stackStyle: 'dots' or 'icons'
- Example topics: "Number of pets", "Siblings", "Favorite colors (as numbers)"

**Data Representation (Grades 3-4)**:
- range: [0, 15] or appropriate for data
- dataPoints: 10-15 values
- showStatistics: true
- editable: true
- parallel: false
- stackStyle: 'dots'
- Example topics: "Test scores", "Hours of sleep", "Books read"

**Mean, Median, Mode (Grades 5-6)**:
- range: Choose to fit data with some room
- dataPoints: 12-20 values with clear mode(s)
- showStatistics: true
- editable: true
- parallel: false
- stackStyle: 'dots'
- Include data where mean ≠ median to discuss differences
- Example topics: "Quiz scores", "Daily temperatures", "Heights"

**Comparing Datasets (Grades 6-7)**:
- range: Same range for both datasets
- dataPoints: 10-15 values in primary
- secondaryDataPoints: 10-15 values
- showStatistics: true
- editable: true
- parallel: true
- primaryLabel and secondaryLabel: Describe the groups
- Example topics: "Morning vs Afternoon temperatures", "Class A vs Class B scores"

DATA GENERATION RULES:
1. Generate realistic, contextually appropriate data
2. For statistics focus: Include clear patterns (cluster, spread, outliers)
3. For comparison focus: Make datasets noticeably different but comparable
4. Data values should be within the range [min, max]
5. Include some repeated values to demonstrate frequency
6. For mode practice: Include at least one clear mode (most frequent value)
7. Keep data size manageable: 8-20 values per dataset

CONTEXT-SPECIFIC DATA EXAMPLES:
- "Student heights in inches" → range [48, 72], values like 54, 56, 56, 58, 58, 58, 60, 62
- "Daily high temperatures" → range [60, 90], values reflecting realistic weather
- "Number of pets at home" → range [0, 8], mostly 0-3 with occasional higher
- "Quiz scores" → range [0, 10] or [0, 100], cluster around common scores

${config ? `
CONFIGURATION HINTS:
${config.range ? `- Range: [${config.range[0]}, ${config.range[1]}]` : ''}
${config.dataPoints ? `- Data points provided: ${config.dataPoints.length} values` : ''}
${config.showStatistics !== undefined ? `- Show Statistics: ${config.showStatistics}` : ''}
${config.editable !== undefined ? `- Editable: ${config.editable}` : ''}
${config.parallel !== undefined ? `- Parallel mode: ${config.parallel}` : ''}
${config.stackStyle ? `- Stack Style: ${config.stackStyle}` : ''}
` : ''}

REQUIREMENTS:
1. Choose an appropriate range that fits all data points with some margin
2. Write a clear, engaging title that describes the data
3. Provide an educational description about what students should observe
4. Generate realistic data values appropriate for the topic
5. Set showStatistics based on grade level (false for grades 2-3, true for 4+)
6. Set editable to true unless there's a specific reason not to
7. For comparison topics, use parallel mode with labeled datasets
8. Choose stackStyle appropriate for the context ('dots' is default, 'icons' for younger students)
9. If using icons, choose an appropriate emoji for the topic

Return the complete dot plot configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: dotPlotSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid dot plot data returned from Gemini API');
  }

  // Validation: ensure range is valid
  if (!data.range || data.range.length !== 2 || data.range[0] >= data.range[1]) {
    console.warn('Invalid range. Using default [0, 10]');
    data.range = [0, 10];
  }

  // Ensure dataPoints exist and are within range
  if (!data.dataPoints || data.dataPoints.length === 0) {
    console.warn('No data points provided. Using default data.');
    data.dataPoints = [3, 4, 4, 5, 5, 5, 6, 6, 7, 8];
  }

  // Filter data points to be within range
  const [min, max] = data.range;
  data.dataPoints = data.dataPoints.filter((p: number) => p >= min && p <= max);

  if (data.secondaryDataPoints) {
    data.secondaryDataPoints = data.secondaryDataPoints.filter((p: number) => p >= min && p <= max);
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.range) data.range = config.range;
    if (config.dataPoints) data.dataPoints = config.dataPoints;
    if (config.showStatistics !== undefined) data.showStatistics = config.showStatistics;
    if (config.editable !== undefined) data.editable = config.editable;
    if (config.parallel !== undefined) data.parallel = config.parallel;
    if (config.stackStyle) data.stackStyle = config.stackStyle;
  }

  // Set defaults
  if (data.showStatistics === undefined) data.showStatistics = true;
  if (data.editable === undefined) data.editable = true;
  if (data.parallel === undefined) data.parallel = false;
  if (data.stackStyle === undefined) data.stackStyle = 'dots';

  // Ensure parallel mode has required labels
  if (data.parallel) {
    if (!data.primaryLabel) data.primaryLabel = 'Dataset A';
    if (!data.secondaryLabel) data.secondaryLabel = 'Dataset B';
    if (!data.secondaryDataPoints) data.secondaryDataPoints = [];
  }

  return data;
};
