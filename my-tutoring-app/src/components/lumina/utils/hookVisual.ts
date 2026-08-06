/**
 * Hook visual — the emoji badge beside the curator brief's hook paragraph.
 *
 * The brief renders `hook.visual` in a text-5xl slot, so the field must hold a
 * glyph and nothing else. Asking flash-lite for "a single emoji" in a free
 * STRING field does not hold: it reads the description as prose and returns a
 * WORD ("marbles"), which renders as giant body copy next to the hook.
 *
 * So the model never emits the glyph. It picks a THEME from a fixed menu
 * (schema enum) and code attaches the emoji — the same words-to-a-menu,
 * emoji-in-code split used elsewhere for emoji fields.
 */

/** Menu offered to the model. Broad enough to fit any K-8 lesson hook. */
export const HOOK_VISUAL_THEMES = [
  'counting', 'numbers', 'shapes', 'patterns', 'measurement', 'money', 'time', 'calendar',
  'reading', 'letters', 'words', 'writing', 'story',
  'science', 'nature', 'animals', 'plants', 'space', 'weather', 'water', 'earth', 'experiment',
  'building', 'machines', 'art', 'music', 'sports', 'food', 'travel', 'map', 'history', 'people',
  'question', 'idea', 'discovery', 'game', 'puzzle', 'magic',
] as const;

export type HookVisualTheme = (typeof HOOK_VISUAL_THEMES)[number];

const THEME_EMOJI: Record<HookVisualTheme, string> = {
  counting: '🧮',
  numbers: '🔢',
  shapes: '🔷',
  patterns: '🔁',
  measurement: '📏',
  money: '💰',
  time: '⏰',
  calendar: '📅',
  reading: '📖',
  letters: '🔤',
  words: '💬',
  writing: '✏️',
  story: '📚',
  science: '🔬',
  nature: '🌿',
  animals: '🐾',
  plants: '🌱',
  space: '🚀',
  weather: '⛅',
  water: '💧',
  earth: '🌍',
  experiment: '🧪',
  building: '🏗️',
  machines: '⚙️',
  art: '🎨',
  music: '🎵',
  sports: '⚽',
  food: '🍎',
  travel: '✈️',
  map: '🗺️',
  history: '🏛️',
  people: '👥',
  question: '❓',
  idea: '💡',
  discovery: '🔍',
  game: '🎲',
  puzzle: '🧩',
  magic: '✨',
};

/** Last resort when the theme is missing or off-menu: key off the hook type. */
const TYPE_EMOJI: Record<string, string> = {
  scenario: '🌟',
  question: '❓',
  surprising_fact: '💡',
  story: '📖',
};

const DEFAULT_EMOJI = '✨';

const fallbackEmoji = (hookType?: string): string =>
  (hookType && TYPE_EMOJI[hookType]) || DEFAULT_EMOJI;

/** Map a menu theme to its glyph. Off-menu values degrade to the hook type. */
export const emojiForHookTheme = (theme?: string, hookType?: string): string => {
  const key = theme?.trim().toLowerCase() as HookVisualTheme | undefined;
  return (key && THEME_EMOJI[key]) || fallbackEmoji(hookType);
};

/**
 * Is this value actually a glyph, or did a word leak into the slot?
 *
 * Any ASCII letter or whitespace means prose. The length cap catches non-Latin
 * leakage while still allowing ZWJ sequences (👨‍👩‍👧 is 8 UTF-16 units).
 * `\p{...}` escapes are unavailable at this tsconfig target, hence the ASCII test.
 */
export const isEmojiVisual = (value?: string): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[A-Za-z\s]/.test(trimmed)) return false;
  return trimmed.length <= 8;
};

/**
 * Display guard for the render path — briefs generated before the menu landed
 * (or hand-authored ones) can still carry a word here.
 */
export const resolveHookVisual = (visual?: string, hookType?: string): string =>
  isEmojiVisual(visual) ? (visual as string) : fallbackEmoji(hookType);
