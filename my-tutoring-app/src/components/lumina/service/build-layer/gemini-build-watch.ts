import { Type } from '@google/genai';
import { ai } from '../geminiClient';

/**
 * The open-build watcher: flash-lite looks at a picture of the learner's build while they work and says
 * one line about what it looks like so far. It never judges and never advises (flash-lite gave away the
 * fix in the 10-06 judge probes, and an early "it's a house!" read as a pass before the roof was on), so
 * code drops any line that does. On a build whose skill is a number, a line with a number is dropped too:
 * "five apples!" would count for the child. Runs on Open Builder 10-06: qa/open-build/vision-drive-2026-10-06.
 */
const WATCH_MODEL = 'gemini-flash-lite-latest';

const system = (numbers: 'allowed' | 'never', neverSay: readonly string[]) => `You are watching a young child (aged 5-8) build something on a screen. You see a PICTURE of what is there right now. Scenery the child did not make is described to you.
Say ONE short, delighted sentence (at most 12 words) about the child's work so far, like a friend watching over their shoulder.
Talk about what they placed: shapes, colors, where things are next to the scenery, and what it is STARTING to look like ("Ooh, a tall pink stack is growing next to the giraffe!").
Never say the work is finished, complete or ready, and never say it already does what the task asks. That is decided later by someone else.
Never suggest adding, moving or changing anything, and never ask a question.${numbers === 'never'
  ? '\nNEVER say a number or a counting word of any kind (no "one", "two", "a few", "lots", "many", "some more"): the child is doing the counting. Describe where things are and what they look like instead ("apples are filling up the top branches!").'
    + '\nNever name a fraction or how much of something is colored (no "half", "a quarter", "thirds", "the whole", "equal", "the same"): the child is making the fraction.'
  : ''}${neverSay.length ? `
NEVER use any of these words: ${neverSay.join(', ')}. Saying them would do the child's task for them.` : ''}
No grid positions, rows or columns.`;

/** Advice, a question, or a claim that the work is done: none of it is the watcher's job. */
const OVERSTEP = /\?|\b(add|put|move|try|need|needs|should|could|must|missing|almost|yet|finish|finished|maybe|don't forget|remember|complete|done|ready|perfect)\b/i;
/** The watcher only looks at a scene with something in it, so "empty" is a misread. */
const MISREAD = /\b(empty|blank|nothing)\b/i;
const NUMBER_WORD = /\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|dozen|pair|couple|few|many|lots|several|both|single|double|triple|twins?|once|twice|first|second|third|thirds|half|halves|halfway|quarters?|fourths?|fifths?|sixths?|eighths?|tenths?|twelfths?|fraction|whole|equal|same)\b/i;

export interface BuildWatchParams {
  task: string;
  sceneNote: string;
  numbers: 'allowed' | 'never';
  /** Words the line may never use (a shape name, where naming the shape can be the skill). */
  neverSay?: readonly string[];
  /** What the child placed, as exact facts (colours, kinds), so the line names them as placed rather than as
   *  flash-lite guesses them from the picture (it called a red tile purple, then blue, on pattern-builder 10-08). */
  made?: string;
  /** PNG of the build, base64 without the data: prefix. */
  image: string;
}

/** The line passes the leak rules, or is dropped (an empty line shows nothing). */
export function keepWatchLine(line: string, numbers: 'allowed' | 'never', neverSay: readonly string[] = []): string {
  const s = line.trim();
  if (!s || OVERSTEP.test(s) || MISREAD.test(s) || s.split(/\s+/).length > 16) return '';
  if (numbers === 'never' && NUMBER_WORD.test(s)) return '';
  if (neverSay.some(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?\\b`, 'i').test(s))) return '';
  return s;
}

export async function watchBuild(p: BuildWatchParams): Promise<{ seeing: string }> {
  if (typeof p.image !== 'string' || p.image.length < 100) throw new Error('watchBuild: no picture of the build');
  const numbers = p.numbers === 'never' ? 'never' : 'allowed';
  const neverSay = Array.isArray(p.neverSay) ? p.neverSay.map(String).filter(w => w.trim()).slice(0, 40) : [];
  const res = await ai.models.generateContent({
    model: WATCH_MODEL,
    contents: [{ role: 'user', parts: [
      { text: `The child is working on: ${String(p.task ?? '').slice(0, 300)}\nSCENERY (not made by the child): ${String(p.sceneNote ?? '').slice(0, 300)}`
        + (p.made ? `\nWHAT THE CHILD PLACED (exact; name colors and kinds only from this, never by guessing from the picture): ${String(p.made).slice(0, 300)}` : '') },
      { inlineData: { mimeType: 'image/png', data: p.image } },
    ] }],
    config: { systemInstruction: system(numbers, neverSay), responseMimeType: 'application/json', temperature: 0.7,
      responseSchema: { type: Type.OBJECT, properties: { seeing: { type: Type.STRING } }, required: ['seeing'] } },
  });
  return { seeing: keepWatchLine(String((JSON.parse(res.text ?? '{}') as { seeing?: string }).seeing ?? ''), numbers, neverSay) };
}
