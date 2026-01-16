import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Histogram Data Interface
 *
 * This matches the HistogramData interface in the component
 */
export interface HistogramData {
  title: string;
  description: string;
  data: number[];
  binWidth: number;
  binStart: number;
  showFrequency: boolean;
  showCurve: boolean;
  editable: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

/**
 * Schema definition for Histogram Data
 *
 * This schema defines the structure for a histogram visualization
 * with adjustable bin widths and optional normal curve overlay.
 */
const histogramSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the histogram (e.g., 'Student Test Scores', 'Daily Temperatures')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what the histogram shows and what students should observe about the distribution"
    },
    data: {
      type: Type.ARRAY,
      description: "Array of numeric data values. Include enough values (15-50) to show meaningful distribution patterns.",
      items: {
        type: Type.NUMBER
      }
    },
    binWidth: {
      type: Type.NUMBER,
      description: "Width of each bin. Choose based on data range: for 0-100 data use 10, for 0-10 data use 1 or 2"
    },
    binStart: {
      type: Type.NUMBER,
      description: "Left edge of the first bin. Usually 0 or a round number below the minimum data value"
    },
    showFrequency: {
      type: Type.BOOLEAN,
      description: "Whether to display frequency count labels on top of each bar. Default: true"
    },
    showCurve: {
      type: Type.BOOLEAN,
      description: "Whether to overlay a normal distribution curve. Use for statistics lessons about normal distribution. Default: false for elementary, true for middle school+"
    },
    editable: {
      type: Type.BOOLEAN,
      description: "Whether students can add/remove data points and adjust bin width. Default: true"
    },
    xAxisLabel: {
      type: Type.STRING,
      description: "Label for the x-axis describing what the data represents (e.g., 'Test Score', 'Height (cm)')"
    },
    yAxisLabel: {
      type: Type.STRING,
      description: "Label for the y-axis. Usually 'Frequency' or 'Count'"
    }
  },
  required: ["title", "description", "data", "binWidth", "binStart", "showFrequency", "showCurve", "editable"]
};

/**
 * Generate histogram data for visualization
 *
 * This function creates histogram data including:
 * - Appropriate data values for the topic and grade level
 * - Bin width and start values that create meaningful distributions
 * - Distribution shape (normal, skewed, bimodal) based on context
 * - Optional normal curve overlay for statistics lessons
 *
 * @param topic - The topic or context for the data
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns HistogramData with complete configuration
 */
export const generateHistogram = async (
  topic: string,
  gradeLevel: string,
  config?: {
    data?: number[];
    binWidth?: number;
    binStart?: number;
    showFrequency?: boolean;
    showCurve?: boolean;
    editable?: boolean;
  }
): Promise<HistogramData> => {
  const prompt = `
Create an educational histogram visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A histogram is a bar chart showing frequency distribution of continuous data
- Data is grouped into bins (intervals) of equal width
- The height of each bar represents the frequency (count) of values in that bin
- Used to visualize distribution shape: normal, skewed, bimodal, uniform
- Essential for understanding data patterns, spread, and central tendency

GUIDELINES FOR GRADE LEVELS:

**Grades 6-7 (Grouped Data Introduction)**:
- data: 15-25 simple whole numbers in a relatable context
- binWidth: 5 or 10 (easy to count)
- binStart: 0 or a round number
- showFrequency: true
- showCurve: false
- editable: true
- Focus on reading and interpreting the histogram
- Example: "Quiz scores 0-50", "Daily steps in thousands"

**Grades 6-7 (Distribution Shape)**:
- data: 20-30 values showing clear shape
- Generate data that clearly shows symmetric, left-skewed, or right-skewed
- binWidth: appropriate for the range
- showFrequency: true
- showCurve: false
- editable: true
- Example: "Time to complete a task", "Heights of plants"

**Grades 7-8 (Comparing Distributions)**:
- data: 25-40 values
- Use realistic data appropriate for comparison
- binWidth: consistent for fair comparison
- showFrequency: true
- showCurve: false
- editable: true
- Example: "Morning vs afternoon temperatures"

**Statistics/High School (Normal Distribution)**:
- data: 30-50 values approximating normal distribution
- binWidth: appropriate for range (often 5-10)
- showFrequency: true
- showCurve: true (overlay normal curve)
- editable: true
- Example: "Student heights", "Test scores", "Measurement errors"

DATA GENERATION RULES:

1. **For Normal/Symmetric Distribution**:
   - Generate values clustered around a mean
   - More values near the center, fewer at extremes
   - Example for test scores (mean 75, std 10): many 70-80, some 60-70 and 80-90, few below 60 or above 90

2. **For Right-Skewed Distribution**:
   - Many low values, trailing off to high values
   - Example: "Income", "Time to complete task", "Number of errors"
   - Generate: many values at low end, progressively fewer as values increase

3. **For Left-Skewed Distribution**:
   - Many high values, trailing off to low values
   - Example: "Age at retirement", "Final exam scores (easy test)"
   - Generate: many values at high end, progressively fewer as values decrease

4. **For Bimodal Distribution**:
   - Two peaks with a valley in between
   - Example: "Heights of mixed age group", "Test scores with two preparation levels"
   - Generate: clusters around two different centers

5. **For Uniform Distribution**:
   - Roughly equal frequency across all bins
   - Example: "Random number generator output", "Birth month"

TOPIC-SPECIFIC GUIDANCE:

- "Test scores" → Normal distribution, range 0-100, binWidth 10
- "Heights of students" → Normal distribution, range depends on age
- "Daily temperatures" → Could be normal or bimodal (depending on season)
- "Time to complete task" → Right-skewed (most fast, some slow)
- "Number of pets/siblings" → Right-skewed, discrete data grouped
- "Random sampling" → Approximately normal if large enough

${config ? `
CONFIGURATION HINTS:
${config.data ? `- Data points provided: ${config.data.length} values` : ''}
${config.binWidth ? `- Bin Width: ${config.binWidth}` : ''}
${config.binStart ? `- Bin Start: ${config.binStart}` : ''}
${config.showFrequency !== undefined ? `- Show Frequency: ${config.showFrequency}` : ''}
${config.showCurve !== undefined ? `- Show Curve: ${config.showCurve}` : ''}
${config.editable !== undefined ? `- Editable: ${config.editable}` : ''}
` : ''}

REQUIREMENTS:
1. Generate realistic, contextually appropriate data (15-50 values)
2. Write a clear, engaging title that describes the data
3. Provide an educational description about what students should observe about the distribution shape
4. Choose binWidth that creates 5-12 bins for clear visualization
5. Set binStart to a round number at or below the minimum value
6. Set showFrequency to true for most cases
7. Set showCurve to true only for statistics lessons about normal distribution
8. Include appropriate axis labels
9. Create data that demonstrates a clear distribution pattern appropriate for the lesson

Return the complete histogram configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: histogramSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid histogram data returned from Gemini API');
  }

  // Validation: ensure data array exists and has values
  if (!data.data || data.data.length === 0) {
    console.warn('No data points provided. Using default data.');
    data.data = [45, 52, 58, 62, 65, 68, 70, 72, 73, 75, 75, 76, 78, 80, 82, 85, 88, 92, 95];
  }

  // Ensure binWidth is valid
  if (!data.binWidth || data.binWidth <= 0) {
    const range = Math.max(...data.data) - Math.min(...data.data);
    data.binWidth = Math.ceil(range / 10) || 10;
    console.warn(`Invalid binWidth. Using calculated value: ${data.binWidth}`);
  }

  // Ensure binStart is set
  if (data.binStart === undefined || data.binStart === null) {
    data.binStart = Math.floor(Math.min(...data.data) / data.binWidth) * data.binWidth;
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.data) data.data = config.data;
    if (config.binWidth) data.binWidth = config.binWidth;
    if (config.binStart !== undefined) data.binStart = config.binStart;
    if (config.showFrequency !== undefined) data.showFrequency = config.showFrequency;
    if (config.showCurve !== undefined) data.showCurve = config.showCurve;
    if (config.editable !== undefined) data.editable = config.editable;
  }

  // Set defaults
  if (data.showFrequency === undefined) data.showFrequency = true;
  if (data.showCurve === undefined) data.showCurve = false;
  if (data.editable === undefined) data.editable = true;
  if (!data.xAxisLabel) data.xAxisLabel = 'Value';
  if (!data.yAxisLabel) data.yAxisLabel = 'Frequency';

  return data;
};
