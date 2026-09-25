/**
 * The outcome observer refuses a scene fact over 500 characters (`dialogueContract.ts`), and a
 * refused request leaves every spoken answer on that item unjudged. A long text (a story read
 * aloud) goes in as `key`, continued at a sentence boundary in `key2`, `key3`, ...
 */
export const FACT_MAX_CHARS = 480;

export function textFacts(key: string, text: string): Record<string, string> {
  const sentences = text.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g) ?? [text];
  const parts: string[] = [];
  let part = '';
  for (const sentence of sentences) {
    if (part && (part + sentence).length > FACT_MAX_CHARS) { parts.push(part.trim()); part = ''; }
    part += sentence;
  }
  if (part.trim()) parts.push(part.trim());
  return Object.fromEntries(parts.flatMap(p => p.length > FACT_MAX_CHARS
    ? [p.slice(0, FACT_MAX_CHARS), p.slice(FACT_MAX_CHARS)] : [p])
    .map((p, i) => [i ? `${key}${i + 1}` : key, p]));
}
