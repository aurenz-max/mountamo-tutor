/** Shared prompt block for Misconception Loop consumers. */
export function buildRemediationPrompt(remediationFocus?: string): string {
  const focus = remediationFocus?.trim();
  if (!focus) return '';

  return `
REMEDIATION FOCUS (PRIVATE - NEVER QUOTE OR EXPLAIN TO THE STUDENT):
The student currently holds this misconception: "${focus}"
- Design the content to directly stress the distinction the student is confusing.
- Include at least one distractor or variation that a student holding this misconception would choose.
- Do NOT state the misconception, the correct rule, or the answer in any student-visible prompt, label, hint, placeholder, or pre-attempt feedback.
- Keep the requested grade, scope, eval mode, difficulty, and item counts unchanged.`;
}
