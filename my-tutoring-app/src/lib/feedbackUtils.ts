/**
 * Feedback Utilities
 *
 * Centralized utilities for safely handling structured feedback from the backend.
 * The backend returns feedback in two possible formats:
 * 1. String: Simple text feedback
 * 2. Object: Structured feedback with {praise, guidance, encouragement, next_steps}
 */

/**
 * Structured feedback format from backend
 */
export interface StructuredFeedback {
  praise?: string;
  guidance?: string;
  encouragement?: string;
  next_steps?: string;
}

/**
 * Feedback can be either a string or a structured object
 */
export type Feedback = string | StructuredFeedback;

/**
 * Options for formatting feedback text
 */
export interface FormatFeedbackOptions {
  /** Include all fields (default: true) */
  includeAll?: boolean;
  /** Separator between fields (default: ' ') */
  separator?: string;
  /** Include field labels (default: false) */
  includeLabels?: boolean;
  /** Fields to include (if not includeAll) */
  fields?: Array<keyof StructuredFeedback>;
}

/**
 * Safely extract text from feedback object or string
 *
 * @param feedback - Feedback object or string from backend
 * @param options - Formatting options
 * @returns Formatted feedback string safe for React rendering
 *
 * @example
 * // String input
 * formatFeedback("Great job!") // "Great job!"
 *
 * @example
 * // Object input with default options
 * formatFeedback({
 *   praise: "Excellent!",
 *   guidance: "Try to work faster",
 *   encouragement: "Keep it up!"
 * }) // "Excellent! Try to work faster Keep it up!"
 *
 * @example
 * // Object input with labels
 * formatFeedback(
 *   { praise: "Good!", guidance: "Check your work" },
 *   { includeLabels: true }
 * ) // "Praise: Good! Guidance: Check your work"
 */
export function formatFeedback(
  feedback: Feedback | null | undefined,
  options: FormatFeedbackOptions = {}
): string {
  const {
    includeAll = true,
    separator = ' ',
    includeLabels = false,
    fields = ['praise', 'guidance', 'encouragement', 'next_steps']
  } = options;

  // Handle null/undefined
  if (!feedback) {
    return '';
  }

  // Handle string feedback
  if (typeof feedback === 'string') {
    return feedback;
  }

  // Handle structured feedback object
  if (typeof feedback === 'object') {
    const parts: string[] = [];
    const fieldsToInclude = includeAll ? fields : (options.fields || []);

    for (const field of fieldsToInclude) {
      const value = feedback[field];
      if (value && typeof value === 'string') {
        if (includeLabels) {
          const label = field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
          parts.push(`${label}: ${value}`);
        } else {
          parts.push(value);
        }
      }
    }

    return parts.join(separator);
  }

  // Fallback for unexpected types
  return String(feedback);
}

/**
 * Extract only the primary feedback message (praise or guidance)
 * Useful for concise displays like tooltips or AI coach messages
 *
 * @param feedback - Feedback object or string
 * @returns Primary feedback message
 */
export function getPrimaryFeedback(feedback: Feedback | null | undefined): string {
  if (!feedback) return '';

  if (typeof feedback === 'string') {
    return feedback;
  }

  // Prioritize: praise > guidance > encouragement > next_steps
  return feedback.praise ||
         feedback.guidance ||
         feedback.encouragement ||
         feedback.next_steps ||
         '';
}

/**
 * Check if feedback is in structured format
 *
 * @param feedback - Feedback to check
 * @returns True if feedback is a structured object
 */
export function isStructuredFeedback(feedback: any): feedback is StructuredFeedback {
  return feedback &&
         typeof feedback === 'object' &&
         (feedback.praise !== undefined ||
          feedback.guidance !== undefined ||
          feedback.encouragement !== undefined ||
          feedback.next_steps !== undefined);
}

/**
 * Format feedback for voice/audio output
 * Combines all fields with natural pauses
 *
 * @param feedback - Feedback object or string
 * @returns Formatted string optimized for audio
 */
export function formatFeedbackForAudio(feedback: Feedback | null | undefined): string {
  if (!feedback) return '';

  if (typeof feedback === 'string') {
    return feedback;
  }

  // For audio, we want natural pauses between sections
  return formatFeedback(feedback, {
    includeAll: true,
    separator: '... ', // Ellipsis creates a natural pause in TTS
    includeLabels: false
  });
}

/**
 * Extract specific feedback component
 *
 * @param feedback - Feedback object or string
 * @param component - Which component to extract
 * @returns The specific feedback component or empty string
 */
export function getFeedbackComponent(
  feedback: Feedback | null | undefined,
  component: keyof StructuredFeedback
): string {
  if (!feedback) return '';

  if (typeof feedback === 'string') {
    return feedback;
  }

  return feedback[component] || '';
}
