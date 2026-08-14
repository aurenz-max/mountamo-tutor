/**
 * judgedScriptContract.testkit — the di-script test scaffolding, once.
 *
 * Before this file, every port's `__tests__/<Primitive>.di-script.test.ts`
 * hand-copied the same ~60 lines of gate plumbing (validate → [], audioInput
 * pin, template-key resolution, catalog sentinel scan, spoken-line parser) —
 * 12 copies, three divergent `spokenLine` parsers, and drifting field coverage
 * (a test that forgets `commonStruggles` silently skips the field most proven
 * to be recited verbatim to a child). One suite call replaces the plumbing;
 * the per-port file keeps only the pedagogy pins: the answer-material fork,
 * leak asserts, correction/affirm wording, build-gate drops.
 *
 * Framework-free by design: every check returns a string[] of issues and the
 * test asserts `toEqual([])`, the same shape as `validateJudgedScriptPack`.
 * That keeps this importable from vitest, a live probe, or a node script.
 *
 * ADOPTED BY ALL 13 SUITES (19a sweep, 2026-08-13; ten-frame was the pilot).
 * The two newest gates (`findPerformedStageDirections`,
 * `findRepeatedConsecutiveAsks`) are ON here and still deliberately NOT inside
 * `validateJudgedScriptPack`, which the RUNNER calls in dev — a pack loaded at
 * runtime should not console.error over wording the test file already refuses.
 *
 * ⚠️ ONE THING TO KNOW BEFORE YOU TRUST A GREEN `checkPackGates`:
 * `findRepeatedConsecutiveAsks` compares consecutive items of the SAME action,
 * so a fixture pack built one-item-per-mode — which every port's was — cannot
 * trigger it at all. Every suite therefore ALSO builds the real session shape
 * (two same-mode items, or two lines of one passage). Copy that when you add a
 * port: without it the gate is on and asleep.
 *
 * The four pre-runner ports (phonics-blender, sound-swap, word-flip,
 * cvc-speller) do NOT come through here and that is deliberate — they still
 * hand-roll their runner half (2026-08-10 extraction ruling: no retrofit), so
 * their items carry no `answerKind`/`responseClass` and there is no pack to
 * check. Their suites run the cue-level gates over a labelled cue list
 * directly, which needs no pack.
 */

import {
  findPerformedStageDirections,
  findRepeatedConsecutiveAsks,
  findSentinelCollisions,
  findUnresolvedTemplateKeys,
  JUDGED_AUDIO_INPUT,
  validateJudgedScriptPack,
  type JudgedScriptItem,
  type JudgedScriptPack,
} from './judgedScriptContract';

/** The catalog surface a di-script test pins — structural, not the full type,
 *  so the testkit never imports a catalog module. */
export interface DiCatalogEntryLike {
  id?: string;
  description?: string;
  constraints?: string;
  audioInput?: unknown;
  tutoring?: {
    contextKeys?: string[];
    taskDescription?: string;
    scaffoldingLevels?: Record<string, string>;
    commonStruggles?: Array<{ pattern: string; response: string }>;
    aiDirectives?: Array<{ title: string; instruction: string }>;
  };
}

/** Every prose field the tutor can be handed, labeled for findings. Includes
 *  `commonStruggles` — responses in that field get recited verbatim (proven
 *  live), so they are scanned like any other spoken surface. */
export const catalogProseCues = (
  entry: DiCatalogEntryLike,
): Array<{ label: string; text: string }> => [
  { label: 'description', text: entry.description ?? '' },
  { label: 'constraints', text: entry.constraints ?? '' },
  { label: 'taskDescription', text: entry.tutoring?.taskDescription ?? '' },
  ...Object.entries(entry.tutoring?.scaffoldingLevels ?? {}).map(([label, text]) => ({
    label: `scaffolding-${label}`,
    text,
  })),
  ...(entry.tutoring?.commonStruggles ?? []).map((s, i) => ({
    label: `struggle-${i}`,
    text: `${s.pattern}. ${s.response}`,
  })),
  // Title AND instruction: both land in the assembled prompt, and the title is
  // the shorter, more slogan-shaped of the two — exactly the string most likely
  // to open with a bare "Yes". (rhyme-studio's hand-rolled scan covered titles;
  // the shared one has to, or adopting it would LOSE a check.)
  ...(entry.tutoring?.aiDirectives ?? []).map((d) => ({
    label: d.title,
    text: `${d.title}. ${d.instruction}`,
  })),
];

/**
 * The pack's structural gates: `validateJudgedScriptPack` plus the two gates
 * that exist because a live drive found the defect after every machine gate
 * passed (performed stage directions; byte-identical consecutive asks).
 */
export function checkPackGates<Item extends JudgedScriptItem>(
  pack: JudgedScriptPack<Item>,
): string[] {
  const issues = validateJudgedScriptPack(pack);

  const cues: Array<{ label: string; text: string }> = [];
  pack.items.forEach((item, i) => {
    const next = pack.items[i + 1] ?? null;
    try {
      cues.push({ label: `itemCue(${item.id}, opening)`, text: pack.itemCue(item, { opening: true, howToPlay: true }) });
      cues.push({ label: `itemCue(${item.id})`, text: pack.itemCue(item, { opening: false, howToPlay: false }) });
      cues.push({ label: `moveOnCue(${item.id})`, text: pack.moveOnCue(item, next, { opening: false, howToPlay: false }) });
      if (pack.pronounceCue) cues.push({ label: `pronounceCue(${item.id})`, text: pack.pronounceCue(item) });
    } catch {
      // a throwing builder is already validateJudgedScriptPack's finding
    }
  });

  for (const finding of findPerformedStageDirections(cues)) {
    issues.push(
      `performed stage direction in ${finding.cueLabel}: "${finding.match}" sits outside the spoken span — state the wait as a fact about the turn, never an order`,
    );
  }
  issues.push(...findRepeatedConsecutiveAsks(pack));
  return issues;
}

/**
 * The catalog's side of the contract: the family audio mode, contextKeys
 * matching EXACTLY what the pack pushes (order included — the pin the ports
 * already carry), every `{{key}}` resolvable (an unfilled key renders the
 * literal "(not set)", which a tutor has read aloud as content), and no prose
 * sentence opening with a verdict sentinel (standing gate 2).
 */
export function checkDiCatalogEntry<Item extends JudgedScriptItem>(
  entry: DiCatalogEntryLike,
  pack: JudgedScriptPack<Item>,
  sampleItem: Item,
): string[] {
  const issues: string[] = [];

  if (JSON.stringify(entry.audioInput) !== JSON.stringify(JUDGED_AUDIO_INPUT)) {
    issues.push(
      `audioInput must be ${JSON.stringify(JUDGED_AUDIO_INPUT)}, got ${JSON.stringify(entry.audioInput)}`,
    );
  }

  const provided = Object.keys(pack.contextFor(sampleItem));
  const declared = entry.tutoring?.contextKeys ?? [];
  if (JSON.stringify(declared) !== JSON.stringify(provided)) {
    issues.push(
      `contextKeys [${declared.join(', ')}] must equal exactly what the pack pushes [${provided.join(', ')}]`,
    );
  }

  const prose = catalogProseCues(entry);
  for (const key of findUnresolvedTemplateKeys(prose.map((c) => c.text).join('\n'), provided)) {
    issues.push(`template key {{${key}}} is never pushed by the pack — it renders "(not set)"`);
  }

  for (const collision of findSentinelCollisions(prose)) {
    issues.push(
      `catalog sentinel collision in ${collision.cueLabel}: sentence "${collision.sentence}" opens with "${collision.opener}"`,
    );
  }

  return issues;
}
